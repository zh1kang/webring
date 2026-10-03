// Draw the 32 x 32 Firestone Library sprite and write public/icon.svg and public/icon.white.svg.
// The composition follows the view from the plaza: the tower and its stair turret on the right,
// the tracery hall on the left, and the arched entrance block in front.
import {writeFile} from 'node:fs/promises';

const SIZE = 32;
const palette = {
  o: '#1f1d24', // outline
  f: '#1f1d24', // finials: spikes, merlons, and the cross
  L: '#f1e9da', // lit stone
  S: '#d6c9b1', // stone
  D: '#ab9b80', // shaded stone
  K: '#7d705d', // deep shade
  w: '#2c3245', // dark glass
  b: '#56708f', // glass reflection
  y: '#f0982e', // lit window
  Y: '#ffd27c', // lit window highlight
};
const grid = Array.from({length: SIZE}, () => Array(SIZE).fill('.'));
const rect = (x, y, w, h, color) => {
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) grid[row][col] = color;
};
const dot = (x, y, color) => rect(x, y, 1, 1, color);
/** An outlined stone mass lit from the left. */
const mass = (x, y, w, h) => {
  rect(x, y, w, h, 'o');
  rect(x + 1, y + 1, w - 2, h - 2, 'S');
  rect(x + 1, y + 1, 1, h - 2, 'L');
  if (w > 4) rect(x + w - 2, y + 1, 1, h - 2, 'D');
};
const spike = (x, top, bottom) => {rect(x, top, 1, bottom - top, 'f');};
/** A pointed lancet: one dark pixel for the arch, then a glazed shaft. */
const lancet = (x, y, w, h, lit = false) => {
  const glass = lit ? 'y' : 'w', shine = lit ? 'Y' : 'b';
  rect(x, y + 1, w, h - 1, glass);
  if (w === 3) {dot(x + 1, y, glass); rect(x + 1, y + 2, 1, h - 2, 'D');}
  else dot(x, y, glass);
  dot(x, y + 1, shine);
};
const courses = (x, w, rows) => rows.forEach(row => rect(x, row, w, 1, 'D'));

// Tower: crenellated top, corner pinnacles, and the octagonal stair turret with its spire and cross.
mass(17, 8, 13, 23);
for (let x = 17; x <= 29; x += 2) dot(x, 7, 'f');
spike(17, 4, 8); spike(29, 4, 8); spike(27, 5, 8);
rect(20, 4, 5, 5, 'o');
rect(21, 5, 3, 3, 'S'); rect(21, 5, 1, 3, 'L'); rect(23, 5, 1, 3, 'D');
dot(20, 4, '.'); dot(24, 4, '.');
dot(22, 6, 'w');
rect(21, 3, 3, 1, 'o');
spike(22, 0, 3);
rect(21, 1, 3, 1, 'f');
lancet(19, 10, 2, 6);
lancet(25, 10, 3, 6);
lancet(25, 18, 2, 3, true);
lancet(26, 23, 1, 3);
courses(18, 11, [9, 17]);

// Hall: a plain west block, a taller pier, and the tracery range with its pinnacled parapet.
mass(1, 16, 8, 15);
lancet(3, 18, 1, 3); lancet(6, 18, 1, 3, true);
lancet(3, 24, 1, 2); lancet(6, 24, 1, 2);
mass(8, 14, 4, 17);
spike(8, 11, 14); spike(11, 12, 14);
mass(11, 16, 11, 15);
for (let x = 11; x <= 21; x += 2) dot(x, 15, 'f');
spike(14, 12, 15); spike(18, 12, 15); spike(21, 13, 15);
for (const [x, lit] of [[12, false], [15, true], [18, false]]) lancet(x, 18, 2, 5, lit);
courses(2, 6, [22]);

// Entrance block with two pointed arches.
mass(9, 24, 17, 7);
rect(10, 25, 15, 1, 'D');
for (const x of [11, 18]) {
  dot(x + 2, 25, 'o');
  rect(x + 1, 26, 3, 1, 'o');
  rect(x, 27, 5, 4, 'o');
  dot(x + 2, 26, 'w');
  rect(x + 1, 27, 3, 3, 'w');
  dot(x + 1, 27, 'b');
}

// Ground line and plaza.
rect(0, 30, SIZE, 1, 'o');
rect(1, 31, SIZE - 2, 1, 'K');

/** An outline pixel on the silhouette: it touches empty space or the sprite edge. */
const rim = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') === '.');

function svg(colors, title, {rimless = false} = {}) {
  const cells = grid.map((row, y) => row.map((key, x) => (rimless && key === 'o' && rim(x, y) ? '.' : key)));
  const paths = new Map();
  cells.forEach((row, y) => {
    let x = 0;
    while (x < SIZE) {
      const key = row[x];
      let end = x;
      while (end < SIZE && row[end] === key) end++;
      if (key !== '.') paths.set(colors[key], (paths.get(colors[key]) || '') + `M${x} ${y}h${end - x}v1H${x}z`);
      x = end;
    }
  });
  const body = [...paths].map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" shape-rendering="crispEdges" role="img"><title>${title}</title>${body}</svg>\n`;
}

const root = new URL('../public/', import.meta.url);
await writeFile(new URL('icon.svg', root), svg(palette, 'Firestone Library'));
// On dark sites the silhouette needs no rim: drop the outer outline and light the finials as stone.
await writeFile(new URL('icon.white.svg', root), svg({...palette, f: '#d6c9b1', K: '#b8ab95'}, 'Firestone Library', {rimless: true}));
