export function canonicalWebsite(value) {
  const url = new URL(value);
  const hostname = url.hostname.replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(hostname) || /^\d+(\.\d+){3}$/.test(hostname)) throw new Error('Use a public HTTPS website without credentials, a port, query, or fragment.');
  url.hostname = hostname;
  return url.href.replace(/\/$/, '');
}
export const LIMITS = Object.freeze({name: 80, major: 60, message: 160, firstYear: 1900, lastYear: 2100});
const text = (value, max, required = true) => typeof value === 'string' && value.trim().length <= max && (!required || value.trim().length > 0);
export function validateMembers(input) {
  if (!Array.isArray(input)) throw new Error('Members must be an array.');
  const ids = new Set(), sites = new Set();
  return input.map(member => {
    const message = member?.message ?? '';
    if (!member || typeof member !== 'object' || typeof member.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(member.id) || !text(member.name, LIMITS.name) || typeof member.website !== 'string' || !text(member.major, LIMITS.major) || !Number.isInteger(member.year) || member.year < LIMITS.firstYear || member.year > LIMITS.lastYear || !text(message, LIMITS.message, false)) throw new Error('Invalid member. Use id, name, website, major, a four-digit class year, and an optional message.');
    const website = canonicalWebsite(member.website);
    if (ids.has(member.id) || sites.has(website)) throw new Error('Duplicate member id or website.');
    ids.add(member.id); sites.add(website);
    return {id: member.id, name: member.name.trim(), website, major: member.major.trim(), year: member.year, message: message.trim()};
  });
}
/** Fields of `.github/ISSUE_TEMPLATE/join.yml`: `id` prefills the form from the URL, and `label` heads each answer in the issue body. */
export const REQUEST_FIELDS = Object.freeze([
  {key: 'name', id: 'name', label: 'Name'},
  {key: 'id', id: 'member-id', label: 'Member ID'},
  {key: 'website', id: 'website', label: 'Website'},
  {key: 'major', id: 'major', label: 'Major'},
  {key: 'year', id: 'class-year', label: 'Class year'},
  {key: 'message', id: 'message', label: 'Message'},
]);
/** The issue form applies its own `join-request` label, which a `labels` query cannot do for people without triage access. */
export function joinRequestUrl(repository, member) {
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set('template', 'join.yml');
  url.searchParams.set('title', `Join: ${member.name}`);
  for (const {key, id} of REQUEST_FIELDS) if (member[key] !== '') url.searchParams.set(id, String(member[key]));
  return url.href;
}
export function resolveNavigation(members, hash) {
  const raw = hash.replace(/^#/, '');
  const separator = raw.lastIndexOf('?nav=');
  const identifier = separator < 0 ? raw : raw.slice(0, separator);
  const direction = separator < 0 ? null : raw.slice(separator + 5);
  let decoded;
  try { decoded = decodeURIComponent(identifier); } catch { return {error: 'This ring link is invalid.'}; }
  const index = members.findIndex(member => member.id === decoded || member.website === decoded.replace(/\/$/, ''));
  if (!raw) return {};
  if (index < 0) return {error: 'This website is not in the ring yet.'};
  if (direction && !['prev', 'next'].includes(direction)) return {error: 'This navigation direction is invalid.'};
  if (!direction) return {selected: index};
  return {destination: members[(index + (direction === 'next' ? 1 : -1) + members.length) % members.length].website};
}
export function slugify(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 40).replace(/-+$/, '');
}
export function widget(base, website, {dark = false} = {}) {
  const root = base.replace(/\/$/, '');
  const id = encodeURIComponent(canonicalWebsite(website));
  const icon = dark ? 'icon.white.svg' : 'icon.svg';
  return `<nav aria-label="Princeton webring" data-princeton-webring style="display:flex;align-items:center;gap:12px">\n  <a data-ring-prev href="${root}/#${id}?nav=prev" aria-label="Previous website">←</a>\n  <a href="${root}/#${id}" aria-label="Explore the Princeton webring">\n    <img src="${root}/${icon}" alt="Firestone Library" width="32" height="32" style="image-rendering:pixelated" />\n  </a>\n  <a data-ring-next href="${root}/#${id}?nav=next" aria-label="Next website">→</a>\n</nav>\n<script src="${root}/widget.js" defer></script>`;
}
