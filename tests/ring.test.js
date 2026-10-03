import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REQUEST_FIELDS, joinRequestUrl, validateMembers, resolveNavigation, slugify, widget} from '../src/ring.js';
import {admitMember, linksToRing, parseRequest} from '../scripts/join-request.mjs';
const members = validateMembers(['a', 'b', 'c'].map((id, index) => ({id, name: id, website: `https://${id}.site`, major: 'Computer Science', year: 2026 + index, message: index ? '' : 'Builds tiny synths.'})));
/** The body GitHub writes for a submitted issue form. */
const formBody = member => REQUEST_FIELDS.map(({key, label}) => `### ${label}\n\n${member[key] === '' ? '_No response_' : member[key]}`).join('\n\n') + '\n\n### Widget\n\n- [X] I have added the ring widget to my website.';
test('previous and next wrap, including encoded website identifiers', () => {
  assert.equal(resolveNavigation(members, '#a?nav=prev').destination, 'https://c.site');
  assert.equal(resolveNavigation(members, '#c?nav=next').destination, 'https://a.site');
  assert.equal(resolveNavigation(members, '#https%3A%2F%2Fb.site?nav=next').destination, 'https://c.site');
  assert.equal(resolveNavigation(members, '#b').selected, 1);
  assert.equal(resolveNavigation([members[0]], '#a?nav=next').destination, 'https://a.site');
});
test('unknown or malformed navigation never redirects', () => {
  for (const hash of ['#missing?nav=next', '#%zz', '#a?nav=other']) assert.ok(resolveNavigation(members, hash).error);
  assert.deepEqual(resolveNavigation([], ''), {});
});
test('reject unsafe websites and duplicates at the boundary', () => {
  for (const website of ['javascript:alert(1)', 'http://a.site', 'https://localhost', 'https://foo.localhost', 'https://foo.test', 'https://foo.invalid', 'https://127.0.0.1.', 'https://127.0.0.1', 'https://user:pass@a.site', 'https://a.site?q=x', 'https://a.site/#x']) assert.throws(() => validateMembers([{...members[0], website}]));
  assert.throws(() => validateMembers([...members, {...members[0], id: 'd', website: 'https://a.site/'}]));
});
test('widget retains path-based hosting and URL encoding', () => {
  const html = widget('https://ring.site/webring/', 'https://a.site');
  assert.ok(html.includes('https://ring.site/webring/#https%3A%2F%2Fa.site?nav=prev'));
  assert.ok(html.includes('aria-label="Next website"'));
});
test('members need a major and class year; the message is optional', () => {
  const base = {id: 'd', name: 'D', website: 'https://d.site', major: 'History', year: 2027};
  assert.deepEqual(validateMembers([base])[0], {...base, message: ''});
  for (const change of [{major: ''}, {major: 'x'.repeat(61)}, {year: '2027'}, {year: 27}, {year: 2027.5}, {message: 'x'.repeat(161)}, {message: 7}])
    assert.throws(() => validateMembers([{...base, ...change}]), JSON.stringify(change));
});
test('issue form answers are parsed as data and must match the member schema', () => {
  assert.deepEqual(parseRequest(formBody(members[0])), members[0]);
  assert.deepEqual(parseRequest(formBody(members[1]).replace(/\n/g, '\r\n')), members[1]);
  assert.equal(parseRequest(formBody({...members[0], message: 'Line one\nline two'})).message, 'Line one\nline two');
  assert.throws(() => parseRequest('no form here'));
  assert.throws(() => parseRequest(formBody({...members[0], year: 'soon'})));
  assert.throws(() => parseRequest(formBody({...members[0], major: ''})));
  assert.throws(() => parseRequest(formBody({...members[0], website: 'http://a.site'})));
});
test('the join link prefills the issue form, whose fields match the parser', async () => {
  const url = new URL(joinRequestUrl('owner/ring', members[1]));
  assert.equal(url.origin + url.pathname, 'https://github.com/owner/ring/issues/new');
  assert.equal(url.searchParams.get('template'), 'join.yml');
  assert.equal(url.searchParams.get('title'), 'Join: b');
  assert.equal(url.searchParams.get('member-id'), 'b');
  assert.equal(url.searchParams.get('class-year'), '2027');
  assert.equal(url.searchParams.has('message'), false);
  assert.equal(url.searchParams.has('labels'), false);
  const form = await readFile(new URL('../.github/ISSUE_TEMPLATE/join.yml', import.meta.url), 'utf8');
  assert.match(form, /^labels: \[join-request\]$/m);
  for (const {id, label} of REQUEST_FIELDS) assert.match(form, new RegExp(`id: ${id}\\n\\s+attributes:\\n\\s+label: ${label}\\n`), id);
});

test('the badge check finds links to the ring, and only to the ring', () => {
  assert.ok(linksToRing(widget('https://firestoners.com/', 'https://a.site')));
  assert.ok(linksToRing('<a href="https://www.firestoners.com/#a?nav=next">→</a>'));
  assert.ok(linksToRing("<script src='//firestoners.com/widget.js'></script>"));
  assert.ok(linksToRing('<a href="https://firestoners.vercel.app/#https%3A%2F%2Fa.site?nav=next">'));
  for (const html of ['<a href="https://notfirestoners.com/">', '<a href="https://firestoners.com.evil.site/">', '<a href="https://firestoners.vercel.app.evil.site/">', '<a href="https://my-firestoners.vercel.app/">', 'firestoners.com in plain text', ''])
    assert.equal(linksToRing(html), false, html);
});

/** A fake GitHub API over one issue and a `main` branch that holds `data/members.json`. */
function fakeRepository({body, labels = ['join-request'], members: start = [], races = 0}) {
  const state = {issue: {state: 'open', labels: labels.map(name => ({name})), body}, head: 'c0', files: {c0: JSON.stringify(start)}, comments: [], races};
  const blobs = {}, trees = {}, commits = {};
  const github = {rest: {
    issues: {
      get: async () => ({data: state.issue}),
      listComments: async () => ({data: state.comments}),
      createComment: async ({body}) => {state.comments.push({body});},
      update: async ({state: next, state_reason}) => {Object.assign(state.issue, {state: next, state_reason});}
    },
    repos: {get: async () => ({data: {default_branch: 'main'}}), getContent: async ({ref}) => ({data: {content: Buffer.from(state.files[ref]).toString('base64')}})},
    git: {
      getRef: async ({ref}) => {assert.equal(ref, 'heads/main'); return {data: {object: {sha: state.head}}};},
      getCommit: async ({commit_sha}) => ({data: {tree: {sha: `tree-${commit_sha}`}}}),
      createBlob: async ({content}) => {const sha = `blob${Object.keys(blobs).length}`; blobs[sha] = content; return {data: {sha}};},
      createTree: async ({tree}) => {const sha = `tree${Object.keys(trees).length}`; trees[sha] = blobs[tree[0].sha]; return {data: {sha}};},
      createCommit: async ({tree, parents, message}) => {const sha = `c${Object.keys(commits).length + 1}`; commits[sha] = {parents, message}; state.files[sha] = trees[tree]; return {data: {sha}};},
      updateRef: async ({sha, force}) => {
        assert.equal(force, false);
        if (state.races > 0) {
          state.races--;
          state.head = `other${state.races}`;
          state.files[state.head] = JSON.stringify([...JSON.parse(state.files.c0), {...members[2], id: `z${state.races}`, website: `https://z${state.races}.site`}]);
          throw Object.assign(new Error('Update is not a fast forward'), {status: 422});
        }
        assert.deepEqual(commits[sha].parents, [state.head]);
        state.head = sha;
      }
    }
  }};
  const context = {repo: {owner: 'owner', repo: 'ring'}, payload: {issue: {number: 9}}};
  const ring = () => JSON.parse(state.files[state.head]);
  return {state, github, context, ring, commits};
}
const withBadge = async website => `<footer>${widget('https://firestoners.com/', website)}</footer>`;

test('a valid request whose site links to the ring is added to main and closed', async () => {
  const repository = fakeRepository({body: formBody(members[0]), members: [members[1]]});
  assert.equal(await admitMember({...repository, load: withBadge}), 'added');
  assert.deepEqual(repository.ring(), [members[1], members[0]]);
  assert.match(Object.values(repository.commits)[0].message, /^feat: add a to the ring\n\nCloses #9$/);
  assert.equal(repository.state.issue.state, 'closed');
  assert.match(repository.state.comments.at(-1).body, /Welcome to the ring, a!/);
  assert.equal(await admitMember({...repository, load: withBadge}), 'skipped', 'a closed issue is left alone');
});

test('a site without the badge gets one comment and is added once the badge is live', async () => {
  const repository = fakeRepository({body: formBody(members[0])});
  const bare = async () => '<footer>hello</footer>';
  assert.equal(await admitMember({...repository, load: bare}), 'no-badge');
  assert.equal(await admitMember({...repository, load: bare}), 'no-badge');
  assert.equal(repository.state.comments.length, 1, 'the same reply is not posted twice');
  assert.deepEqual(repository.ring(), []);
  assert.equal(await admitMember({...repository, load: withBadge}), 'added');
  assert.deepEqual(repository.ring(), [members[0]]);
});

test('requests that cannot be added explain why and change nothing', async () => {
  const unreachable = fakeRepository({body: formBody(members[0])});
  assert.equal(await admitMember({...unreachable, load: async () => {throw new Error('The website answered with HTTP 503.');}}), 'unreachable');
  assert.match(unreachable.state.comments[0].body, /HTTP 503/);
  const invalid = fakeRepository({body: formBody({...members[0], website: 'http://a.site'})});
  assert.equal(await admitMember({...invalid, load: withBadge}), 'invalid');
  const taken = fakeRepository({body: formBody({...members[0], website: 'https://other.site'}), members: [members[0]]});
  assert.equal(await admitMember({...taken, load: withBadge}), 'invalid');
  assert.match(taken.state.comments[0].body, /Duplicate member id or website/);
  for (const repository of [unreachable, invalid, taken]) {
    assert.equal(repository.state.issue.state, 'open');
    assert.deepEqual(Object.keys(repository.commits), []);
  }
  const unlabelled = fakeRepository({body: formBody(members[0]), labels: []});
  assert.equal(await admitMember({...unlabelled, load: withBadge}), 'skipped');
  assert.deepEqual(unlabelled.state.comments, []);
});

test('reruns are safe: a member already in the ring only closes the issue, and a lost push race retries', async () => {
  const present = fakeRepository({body: formBody(members[0]), members: [members[0]]});
  assert.equal(await admitMember({...present, load: withBadge}), 'present');
  assert.deepEqual(present.ring(), [members[0]]);
  assert.equal(present.state.issue.state, 'closed');
  const raced = fakeRepository({body: formBody(members[0]), races: 2});
  assert.equal(await admitMember({...raced, load: withBadge}), 'added');
  assert.deepEqual(raced.ring().map(member => member.id), ['z0', 'a'], 'the member is appended to the latest ring');
});

test('Firestone widget includes hosted icon and scoped keyboard helper', () => {
  const html = widget('https://ring.site/webring/', 'https://alex.site');
  assert.ok(html.includes('src="https://ring.site/webring/icon.svg"'));
  assert.ok(html.includes('src="https://ring.site/webring/widget.js"'));
  assert.ok(html.includes('data-ring-prev'));
  assert.ok(html.includes('data-ring-next'));
  assert.ok(html.includes('width="32" height="32"'));
  assert.ok(widget('https://ring.site/webring/', 'https://alex.site', {dark: true}).includes('src="https://ring.site/webring/icon.white.svg"'));
});

test('member IDs derive from names within the ID pattern', () => {
  assert.equal(slugify('Zoë  O’Neil-Chen'), 'zoe-o-neil-chen');
  assert.equal(slugify('  --Alex--  '), 'alex');
  for (const name of ['A'.repeat(80), 'a '.repeat(40), 'Élise 99']) assert.match(slugify(name), /^[a-z0-9][a-z0-9-]{0,39}$/);
  assert.equal(slugify('!!!'), '');
});

test('widget arrow shortcuts ignore the page outside the widget and install once', async () => {
  const {readFile} = await import('node:fs/promises');
  const {runInNewContext} = await import('node:vm');
  const script = await readFile(new URL('../public/widget.js', import.meta.url), 'utf8');
  const handlers = [], destinations = [];
  class Element { closest() {return null;} }
  class HTMLAnchorElement extends Element { constructor(href) {super(); this.href = href;} }
  const context = {Element, HTMLAnchorElement, document: {addEventListener: (event, handler) => handlers.push(handler)}, window: {location: {assign: href => destinations.push(href)}}};
  runInNewContext(script, context); runInNewContext(script, context);
  assert.equal(handlers.length, 1);
  const nav = {querySelector: selector => new HTMLAnchorElement(selector.includes('prev') ? '/previous' : '/next')};
  class Inside extends Element { closest(selector) {return selector === '[data-princeton-webring]' ? nav : null;} }
  const event = target => ({key: 'ArrowRight', target, preventDefault() {this.prevented = true;}});
  const outside = event(new Element()); handlers[0](outside);
  assert.deepEqual(destinations, []);
  const inside = event(new Inside()); handlers[0](inside);
  assert.deepEqual(destinations, ['/next']); assert.equal(inside.prevented, true);
  const previous = {...event(new Inside()), key: 'ArrowLeft'}; handlers[0](previous);
  assert.equal(destinations.at(-1), '/previous');
  handlers[0]({...event(new Inside()), ctrlKey: true});
  assert.equal(destinations.length, 2);
});
