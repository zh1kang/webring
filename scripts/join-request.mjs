import {REQUEST_FIELDS, validateMembers} from '../src/ring.js';
const NO_RESPONSE = '_No response_';
/** Read the answers of the join issue form, where each answer follows a `### Label` heading. */
export function parseRequest(body) {
  const answers = new Map();
  for (const [, label, value] of (body ?? '').replace(/\r\n?/g, '\n').matchAll(/^### (.+)\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm))
    answers.set(label.trim(), value.trim());
  const values = Object.fromEntries(REQUEST_FIELDS.map(({key, label}) => {
    const value = answers.get(label);
    return [key, value === undefined || value === NO_RESPONSE ? '' : value];
  }));
  if (!/^\d{4}$/.test(values.year)) throw new Error('The request must use the join issue form, with a four-digit class year.');
  return validateMembers([{...values, year: Number(values.year)}])[0];
}
const REPLY_MARK = '<!-- firestoners-join -->';
const PAGE_LIMIT = 5_000_000;
/**
 * True when the page links to the ring: the badge links, its icon, or the widget script.
 * firestoners.vercel.app serves the same ring, and badges copied there before badges were pinned to firestoners.com use it.
 */
export function linksToRing(html) {
  return /(?:https?:)?\/\/(?:www\.)?firestoners\.(?:com|vercel\.app)(?=[/#?"'\s>]|$)/i.test(html);
}
/** Load the HTML that the website serves, as the join check sees it. */
export async function fetchSite(website) {
  const response = await fetch(website, {redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: {accept: 'text/html', 'user-agent': 'firestoners-join-check (+https://firestoners.com)'}});
  if (!response.ok) throw new Error(`The website answered with HTTP ${response.status}.`);
  return (await response.text()).slice(0, PAGE_LIMIT);
}
/**
 * Add the member of an open join request: parse the form, check that the website links to the ring, append the member
 * to `data/members.json` on the default branch, then close the issue.
 * A request that cannot be added gets one comment that says why; the next edit or comment on the issue checks again.
 * Safe to rerun: a member already in the ring only closes the issue, and a lost race with another push retries.
 */
export async function admitMember({github, context, load = fetchSite}) {
  const {owner, repo} = context.repo;
  const issue_number = context.payload.issue.number;
  const issue = (await github.rest.issues.get({owner, repo, issue_number})).data;
  if (issue.state !== 'open' || issue.pull_request || !issue.labels.some(label => label.name === 'join-request')) return 'skipped';
  const reply = async text => {
    const body = `${REPLY_MARK}\n${text}`;
    const comments = (await github.rest.issues.listComments({owner, repo, issue_number, per_page: 100})).data;
    if (comments.filter(comment => comment.body?.startsWith(REPLY_MARK)).at(-1)?.body !== body)
      await github.rest.issues.createComment({owner, repo, issue_number, body});
  };
  const close = async (member, text) => {
    await reply(`${text}\n\nYour ring link: https://firestoners.com/#${member.id}`);
    await github.rest.issues.update({owner, repo, issue_number, state: 'closed', state_reason: 'completed'});
  };
  let member;
  try {member = parseRequest(issue.body);}
  catch (error) {
    await reply(`This request could not be read: ${error.message}\n\nEdit the issue to fix it, and the check runs again.`);
    return 'invalid';
  }
  let html;
  try {html = await load(member.website);}
  catch (error) {
    await reply(`${member.website} could not be loaded: ${error.message}\n\nComment on this issue when the site is up, and the check runs again.`);
    return 'unreachable';
  }
  if (!linksToRing(html)) {
    await reply(`${member.website} does not link to the ring yet. Copy the badge from https://firestoners.com (select **Join**), add it to your site, and publish it. The badge must be in the HTML that your site serves.\n\nThen comment on this issue, and the check runs again.`);
    return 'no-badge';
  }
  const base = (await github.rest.repos.get({owner, repo})).data.default_branch;
  for (let attempt = 1; ; attempt++) {
    const head = (await github.rest.git.getRef({owner, repo, ref: `heads/${base}`})).data.object.sha;
    const content = (await github.rest.repos.getContent({owner, repo, path: 'data/members.json', ref: head})).data;
    const members = validateMembers(JSON.parse(Buffer.from(content.content, 'base64').toString('utf8')));
    if (members.some(existing => existing.id === member.id && existing.website === member.website)) {
      await close(member, `${member.name} is in the ring.`);
      return 'present';
    }
    let updated;
    try {updated = validateMembers([...members, member]);}
    catch (error) {
      await reply(`This request could not be added: ${error.message} Choose another member ID, or edit the issue if your site is already listed under another ID.`);
      return 'invalid';
    }
    const commit = (await github.rest.git.getCommit({owner, repo, commit_sha: head})).data;
    const blob = (await github.rest.git.createBlob({owner, repo, content: JSON.stringify(updated, null, 2) + '\n', encoding: 'utf-8'})).data;
    const tree = (await github.rest.git.createTree({owner, repo, base_tree: commit.tree.sha, tree: [{path: 'data/members.json', mode: '100644', type: 'blob', sha: blob.sha}]})).data;
    const next = (await github.rest.git.createCommit({owner, repo, message: `feat: add ${member.id} to the ring\n\nCloses #${issue_number}`, tree: tree.sha, parents: [head]})).data;
    try {await github.rest.git.updateRef({owner, repo, ref: `heads/${base}`, sha: next.sha, force: false});}
    catch (error) {
      if (error.status === 422 && attempt < 3) continue;
      throw error;
    }
    await close(member, `Welcome to the ring, ${member.name}! You appear on https://firestoners.com in about a minute, after the site deploys.`);
    return 'added';
  }
}
