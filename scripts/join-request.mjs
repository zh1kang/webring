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
export async function createMemberPullRequest({github, context}) {
  const {owner, repo} = context.repo;
  const number = context.payload.issue.number;
  const issue = (await github.rest.issues.get({owner, repo, issue_number: number})).data;
  if (issue.state !== 'open' || !['approved', 'join-request'].every(name => issue.labels.some(label => label.name === name))) return;
  const member = parseRequest(issue.body);
  const repository = (await github.rest.repos.get({owner, repo})).data;
  const base = repository.default_branch;
  const branch = `member-request-${number}`;
  const baseRef = (await github.rest.git.getRef({owner, repo, ref: `heads/${base}`})).data;
  const baseSha = baseRef.object.sha;
  const content = (await github.rest.repos.getContent({owner, repo, path: 'data/members.json', ref: baseSha})).data;
  const members = validateMembers(JSON.parse(Buffer.from(content.content, 'base64').toString('utf8')));
  if (members.some(existing => existing.id === member.id && existing.website === member.website)) return;
  const updated = validateMembers([...members, member]);
  const existing = (await github.rest.pulls.list({owner, repo, head: `${owner}:${branch}`, state: 'all'})).data;
  if (existing.length) {
    const previous = existing[0];
    if (previous.state === 'closed' && !previous.merged_at) await github.rest.pulls.update({owner, repo, pull_number: previous.number, state: 'open'});
    return;
  }
  let ref;
  try {ref = (await github.rest.git.getRef({owner, repo, ref: `heads/${branch}`})).data;}
  catch (error) {if (error.status !== 404) throw error;}
  if (!ref) {
    const commit = (await github.rest.git.getCommit({owner, repo, commit_sha: baseSha})).data;
    const blob = (await github.rest.git.createBlob({owner, repo, content: JSON.stringify(updated, null, 2) + '\n', encoding: 'utf-8'})).data;
    const tree = (await github.rest.git.createTree({owner, repo, base_tree: commit.tree.sha, tree: [{path: 'data/members.json', mode: '100644', type: 'blob', sha: blob.sha}]})).data;
    const next = (await github.rest.git.createCommit({owner, repo, message: `Add member from request #${number}`, tree: tree.sha, parents: [commit.sha]})).data;
    await github.rest.git.createRef({owner, repo, ref: `refs/heads/${branch}`, sha: next.sha});
  }
  await github.rest.pulls.create({owner, repo, base, head: branch, title: `Add ${member.name} to the ring`, body: `Adds the approved member request.\n\nCloses #${number}\n\nReview the website and confirm that its ring widget works before merging.`});
}
