import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REQUEST_FIELDS, joinRequestUrl, validateMembers, resolveNavigation, slugify, widget} from '../src/ring.js';
import {parseRequest} from '../scripts/join-request.mjs';
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

test('approved issue automation creates one PR and resumes a partial branch', async () => {
  const {createMemberPullRequest} = await import('../scripts/join-request.mjs');
  for (const branchExists of [false, true]) {
    const calls = [];
    const github = {rest: {
      issues: {get: async () => ({data: {state: 'open', labels: [{name: 'approved'}, {name: 'join-request'}], body: formBody(members[0])}})},
      repos: {get: async () => ({data: {default_branch: 'main'}}), getContent: async ({ref}) => {assert.equal(ref, 'base'); return {data: {content: Buffer.from('[]').toString('base64')}};}},
      pulls: {list: async () => ({data: []}), create: async args => {calls.push(['pr', args]);}},
      git: {
        getRef: async ({ref}) => {if (ref !== 'heads/main' && !branchExists) throw Object.assign(new Error('Missing'), {status: 404}); return {data: {object: {sha: 'base'}}};},
        getCommit: async () => ({data: {tree: {sha: 'tree'}}}),
        createBlob: async args => {calls.push(['blob', args]); return {data: {sha: 'blob'}};},
        createTree: async () => ({data: {sha: 'new-tree'}}),
        createCommit: async () => ({data: {sha: 'commit'}}),
        createRef: async args => {calls.push(['ref', args]);}
      }
    }};
    const context = {repo: {owner: 'owner', repo: 'ring'}, payload: {issue: {number: 1}}};
    await createMemberPullRequest({github, context});
    assert.equal(calls.filter(([kind]) => kind === 'pr').length, 1);
    assert.equal(calls.filter(([kind]) => kind === 'ref').length, branchExists ? 0 : 1);
    github.rest.pulls.list = async () => ({data: [{state: 'open'}]});
    await createMemberPullRequest({github, context});
    assert.equal(calls.filter(([kind]) => kind === 'pr').length, 1);
    github.rest.pulls.list = async () => ({data: [{state: 'closed', number: 7, merged_at: null}]});
    github.rest.pulls.update = async args => {assert.equal(args.state, 'open'); calls.push(['reopen']);};
    await createMemberPullRequest({github, context});
    assert.equal(calls.filter(([kind]) => kind === 'reopen').length, 1);
    github.rest.issues.get = async () => ({data: {state: 'open', labels: [{name: 'approved'}], body: formBody(members[1])}});
    await createMemberPullRequest({github, context});
    assert.equal(calls.filter(([kind]) => kind === 'pr').length, 1);
  }
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
