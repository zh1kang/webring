import test from 'node:test';
import assert from 'node:assert/strict';
import {BOUNDS, STAGES, advancePlayback, cameraFor, createPlayback, frameFor, jumpPlayback, orbitPlayback, project, releaseOrbit, ringLayout, sceneFor, stageIndex, stageView, viewportFor} from '../src/graph.js';

const DEG = Math.PI / 180;
const near = (a, b, tolerance = 1e-9) => Math.abs(a - b) < tolerance;
const run = (state, seconds, options) => {
  for (let time = 0; time < seconds - 1e-9; time += 1 / 60) state = advancePlayback(state, 1 / 60, options);
  return state;
};

test('members sit on a ring in ring order, clockwise from the top, each on its own layer', () => {
  const {slots, edges, radius, maxLift} = ringLayout(6);
  assert.equal(slots.length, 6);
  const end = createPlayback(1);
  const scene = sceneFor(end, 6);
  const viewport = viewportFor(800, 600, scene, end.zoom);
  const [first, second] = scene.positions.map(position => project(position, viewport));
  assert.ok(near(first.x, 400, 1e-6) && first.y < 300, 'the first member is at the top of the final view');
  assert.ok(second.x > first.x, 'the ring runs clockwise');
  slots.forEach(slot => assert.ok(near(Math.hypot(slot.x, slot.y), radius)));
  assert.ok(near(slots.reduce((sum, slot) => sum + slot.lift, 0), 0));
  assert.ok(slots.every(slot => Math.abs(slot.lift) <= maxLift + 1e-9));
  assert.ok(near(Math.max(...slots.map(slot => Math.abs(slot.lift))), maxLift));
  assert.equal(new Set(slots.map(slot => slot.lift.toFixed(6))).size, 6, 'no two members share a layer');
  assert.deepEqual(edges, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]]);
});

test('small rings: none, one member at the centre, and two members with one link', () => {
  assert.deepEqual(ringLayout(0).slots, []);
  const one = ringLayout(1);
  assert.deepEqual(one.slots, [{x: 0, y: 0, lift: 0}]);
  assert.deepEqual(one.edges, []);
  assert.deepEqual(ringLayout(2).edges, [[0, 1]]);
  assert.equal(sceneFor(createPlayback(1), 0).positions.length, 0);
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
  assert.deepEqual(STAGES.map(stage => stage.label), ['First site', 'Members', 'Lift', 'Orbit', 'Flatten', 'Link']);
  assert.equal(STAGES[stageIndex(0)].label, 'First site');
  assert.equal(STAGES[stageIndex(BOUNDS[1])].label, 'Members');
  assert.equal(STAGES[stageIndex(0.3)].label, 'Lift');
  assert.equal(STAGES[stageIndex(1)].label, 'Link');
});

test('the first member starts alone at the centre; the others grow out of it to their places on the ring', () => {
  const count = 8;
  const at = stage => sceneFor({...createPlayback(stage), stage}, count);
  const start = at(0);
  assert.equal(start.alphas[0], 1);
  assert.ok(start.alphas.slice(1).every(alpha => alpha === 0));
  assert.ok(near(start.positions[0].x, 0) && near(start.positions[0].y, 0));
  assert.ok(at(BOUNDS[1]).alphas.every(alpha => near(alpha, 1)));
  const {slots} = ringLayout(count);
  at(BOUNDS[2]).positions.forEach((position, index) => {
    assert.ok(near(position.x, slots[index].x, 1e-6) && near(position.y, slots[index].y, 1e-6));
    assert.ok(near(position.z, slots[index].lift, 1e-6));
  });
});

test('the ring links draw from member to member in ring order, then close the ring', () => {
  const at = stage => sceneFor({...createPlayback(stage), stage}, 5);
  assert.deepEqual(at(BOUNDS[5]).strokes, []);
  let drawn = 0;
  for (let step = 0; step <= 100; step++) {
    const {strokes} = at(BOUNDS[5] + (step / 100) * (1 - BOUNDS[5]));
    assert.ok(strokes.length >= drawn, 'the drawing only moves forward');
    drawn = strokes.length;
    strokes.forEach((stroke, index) => {
      assert.deepEqual([stroke.from, stroke.to], [index, (index + 1) % 5]);
      if (index < strokes.length - 1) assert.equal(stroke.amount, 1, 'only the front stroke is partial');
    });
  }
  const done = at(1).strokes;
  assert.equal(done.length, 5);
  assert.ok(done.every(stroke => stroke.amount === 1));
  assert.equal(at(1).edgeOpacity, 1);
  assert.deepEqual(sceneFor(createPlayback(1), 1).strokes, []);
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
  const scene = sceneFor(top, 6);
  const viewport = viewportFor(800, 600, scene, top.zoom);
  const origin = project({x: 0, y: 0, z: 0}, viewport), right = project({x: 1, y: 0, z: 0}, viewport), up = project({x: 0, y: 1, z: 0}, viewport);
  assert.ok(near(origin.x, 400) && near(origin.y, 300));
  assert.ok(right.x > origin.x && near(right.y, origin.y) && up.y < origin.y && near(up.x, origin.x));
  for (const [width, height] of [[1440, 590], [390, 540]])
    for (let step = 0; step <= 40; step++) {
      const stage = BOUNDS[2] + (step / 40) * (BOUNDS[5] - BOUNDS[2]);
      const state = {...createPlayback(stage), zoom: 0.58};
      const scene = sceneFor(state, 6);
      const frame = frameFor(scene, viewportFor(width, height, scene, state.zoom));
      frame.corners.forEach(corner => assert.ok(corner.x > 0 && corner.x < width && corner.y > 0 && corner.y < height, `${width}x${height} stage ${stage.toFixed(3)}`));
      assert.equal(frame.edges.filter(edge => edge.hidden).length, 3);
    }
});

test('every shown member stays in view through a whole loop', () => {
  for (const count of [1, 2, 12, 40]) {
    let state = createPlayback();
    for (let frame = 0; frame < 60 * 45; frame += 1) {
      state = advancePlayback(state, 1 / 60);
      if (frame % 10) continue;
      for (const [width, height] of [[1440, 590], [390, 540]]) {
        const scene = sceneFor(state, count);
        const viewport = viewportFor(width, height, scene, state.zoom);
        scene.positions.forEach((position, index) => {
          if (scene.alphas[index] < 0.05) return;
          const {x, y} = project(position, viewport);
          assert.ok(x > 0 && x < width && y > 0 && y < height, `${count} members, ${width}x${height}, stage ${state.stage.toFixed(3)}`);
        });
      }
    }
  }
});
