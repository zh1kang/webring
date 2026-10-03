import test from 'node:test';
import assert from 'node:assert/strict';
import {BOUNDS, STAGES, advancePlayback, buildLattice, cameraFor, createPlayback, frameFor, jumpPlayback, orbitPlayback, project, releaseOrbit, sceneFor, stageIndex, stageView, viewportFor} from '../src/graph.js';

const DEG = Math.PI / 180;
const near = (a, b, tolerance = 1e-9) => Math.abs(a - b) < tolerance;
const run = (state, seconds, options) => {
  for (let time = 0; time < seconds - 1e-9; time += 1 / 60) state = advancePlayback(state, 1 / 60, options);
  return state;
};

test('the lattice starts at the origin, then its twelve unit neighbours, and has 12-fold symmetry', () => {
  const {points, radius, maxLift, neighbours} = buildLattice();
  assert.equal(points.length, 1200);
  assert.equal(neighbours, 12);
  assert.ok(near(points[0].x, 0) && near(points[0].y, 0));
  const ring = points.slice(1, 13);
  ring.forEach(point => assert.ok(near(Math.hypot(point.x, point.y), 1, 1e-6)));
  const angles = ring.map(point => Math.atan2(point.y, point.x));
  angles.slice(1).forEach((angle, index) => assert.ok(angle > angles[index], 'neighbours are ordered by angle'));
  const key = (x, y) => `${Math.round(x * 1e4) + 0},${Math.round(y * 1e4) + 0}`;
  const keys = new Set(points.map(point => key(point.x, point.y)));
  const cos = Math.cos(30 * DEG), sin = Math.sin(30 * DEG);
  const inner = points.filter(point => Math.hypot(point.x, point.y) < radius * 0.8);
  inner.forEach(point => assert.ok(keys.has(key(point.x * cos - point.y * sin, point.x * sin + point.y * cos)), 'a 30 degree turn maps the lattice to itself'));
  assert.ok(near(maxLift, 0.87 * radius));
  assert.ok(points.every(point => Math.abs(point.lift) <= maxLift + 1e-9));
});

test('edges join points at unit distance, drawn from the centre outward', () => {
  const {points, edges} = buildLattice();
  assert.ok(edges.length > 4000);
  const middle = ([a, b]) => Math.hypot(points[a].x + points[b].x, points[a].y + points[b].y);
  edges.forEach(([a, b], index) => {
    assert.ok(near(Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y), 1, 1e-6));
    if (index > 0) assert.ok(middle(edges[index - 1]) <= middle([a, b]) + 1e-9);
  });
});

test('the camera follows the Erdős choreography: top, lift, side, cut-and-project', () => {
  const at = stage => stageView(stage);
  assert.deepEqual([at(0).polar, at(0).azimuth, at(0).frameOpacity, at(0).edgeOpacity], [0, 0, 0, 0]);
  assert.ok(near(at(BOUNDS[2]).polar, 55 * DEG) && near(at(BOUNDS[2]).azimuth, 45 * DEG), 'lift ends at 55 and 45 degrees');
  assert.ok(near(at(BOUNDS[3]).azimuth, 90 * DEG) && near(at(BOUNDS[3]).polar, 55 * DEG), 'the turn comes first');
  assert.ok(near(at(BOUNDS[4] - 1e-9).polar, 90 * DEG, 1e-6), 'then the tip to the side view');
  assert.ok(near(at(BOUNDS[5]).polar, 0), 'cut-and-project returns to the top view');
  assert.equal(at(BOUNDS[3]).frameOpacity, 1);
  assert.equal(at(BOUNDS[5]).frameOpacity, 0);
  assert.equal(at(BOUNDS[5]).edgeFront, 0);
  assert.equal(at(1).edgeFront, 1);
  assert.equal(at(1).lift, 1);
  for (let step = 0; step <= 600; step++) {
    const view = at(step / 600);
    Object.values(view).forEach(value => assert.ok(Number.isFinite(value)));
  }
});

test('the stage labels follow the stage', () => {
  assert.equal(STAGES.length, 6);
  assert.equal(STAGES[stageIndex(0)].label, 'Origin');
  assert.equal(STAGES[stageIndex(BOUNDS[1])].label, 'Unit neighbours');
  assert.equal(STAGES[stageIndex(0.3)].label, 'Lift');
  assert.equal(STAGES[stageIndex(1)].label, 'Unit-distance graph');
});

test('the reveal shows the origin, then the ring of twelve, then the whole lattice', () => {
  const at = stage => sceneFor({...createPlayback(stage), stage});
  const start = at(0).alphas;
  assert.equal(start[0], 1);
  assert.ok(start.slice(1).every(alpha => alpha === 0));
  const ring = at(BOUNDS[1]).alphas;
  assert.ok(ring.slice(0, 13).every(alpha => near(alpha, 1)));
  assert.ok(ring.slice(13).every(alpha => alpha === 0));
  const full = at(BOUNDS[2]).alphas;
  assert.ok(full.slice(0, 1000).every(alpha => near(alpha, 1)));
});

test('autoplay holds on the neighbours and the centre, then collapses and loops', () => {
  let state = createPlayback();
  const seen = [];
  for (let frame = 0; frame < 60 * 45; frame++) {
    state = advancePlayback(state, 1 / 60);
    if (seen.at(-1) !== state.loop) seen.push(state.loop);
    assert.ok(Number.isFinite(state.stage) && Number.isFinite(state.zoom));
  }
  assert.deepEqual(seen.slice(0, 8), ['fwd', 'holdNeighbours', 'fwd', 'holdCentre', 'fwd', 'holdEnd', 'collapse', 'fadeIn']);
  assert.ok(seen.includes('fwd', 7), 'playback starts again');
});

test('paused playback settles but does not move on; a jump lands on its stage', () => {
  const resting = run(createPlayback(0.4), 1);
  const paused = run(resting, 3, {playing: false});
  assert.equal(paused.target, resting.target);
  const jumped = run(jumpPlayback(paused, BOUNDS[5]), 0.5, {playing: false});
  assert.ok(near(jumped.stage, BOUNDS[5]));
  assert.equal(jumped.jump, null);
  assert.equal(jumped.pausedCentre, true);
});

test('a drag orbits the camera, and the view eases back after release', () => {
  const state = createPlayback(BOUNDS[3]);
  const dragged = orbitPlayback(state, 0.2, 2);
  assert.deepEqual(cameraFor(dragged), {polar: 0.2, azimuth: 2});
  const held = run(dragged, 1);
  assert.deepEqual(cameraFor(held), {polar: 0.2, azimuth: 2}, 'the camera stays put while dragging');
  const returned = run(releaseOrbit(held), 1.2, {playing: false});
  assert.equal(returned.orbit, null);
  assert.deepEqual(cameraFor(returned), cameraFor({...returned, orbit: null}));
});

test('the orthographic top view keeps the plane upright, and the box fits the graph', () => {
  const top = createPlayback(0);
  const scene = sceneFor(top);
  const viewport = viewportFor(800, 600, scene, top.zoom);
  const origin = project({x: 0, y: 0, z: 0}, viewport), right = project({x: 1, y: 0, z: 0}, viewport), up = project({x: 0, y: 1, z: 0}, viewport);
  assert.ok(near(origin.x, 400) && near(origin.y, 300));
  assert.ok(right.x > origin.x && near(right.y, origin.y) && up.y < origin.y && near(up.x, origin.x));
  for (const [width, height] of [[1440, 590], [390, 540]])
    for (let step = 0; step <= 40; step++) {
      const stage = BOUNDS[2] + (step / 40) * (BOUNDS[5] - BOUNDS[2]);
      const state = {...createPlayback(stage), zoom: 0.58};
      const frame = frameFor(sceneFor(state), viewportFor(width, height, sceneFor(state), state.zoom));
      frame.corners.forEach(corner => assert.ok(corner.x > 0 && corner.x < width && corner.y > 0 && corner.y < height, `${width}x${height} stage ${stage.toFixed(3)}`));
      assert.equal(frame.edges.filter(edge => edge.hidden).length, 3);
    }
});
