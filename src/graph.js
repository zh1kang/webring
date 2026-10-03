/**
 * A port of Paradigm's Erdős sequence, drawn with webring nodes.
 * One stage value from 0 to 1 drives the whole scene: the origin, its twelve unit neighbours, the lift of a
 * 12-fold cyclotomic lattice into 3D inside a box, a side view of its layers, the cut-and-project top view, and
 * the unit-distance graph drawing out from the centre. Autoplay holds twice, then collapses and loops.
 * Members take the lattice points in order from the centre, so the first member is the origin.
 */

const SYMMETRY = 12;
const CONJUGATE = 5;
const WINDOW = 2.8;
const POINT_CAP = 1200;

export const BOUNDS = Object.freeze(Array.from({ length: 7 }, (_, index) => index / 6));
const LIFT_START = 0.204;
const CENTRE_START = (BOUNDS[4] + BOUNDS[5]) / 2;
const NEIGHBOUR_PAUSE = 0.135;

export const STAGES = Object.freeze([
  { label: "Origin", at: 0, jump: 0 },
  { label: "Unit neighbours", at: 0.084, jump: BOUNDS[1] },
  { label: "Lift", at: LIFT_START, jump: 0.3 },
  { label: "Cyclotomic lattice", at: BOUNDS[2], jump: 0.5 },
  { label: "Cut-and-project", at: BOUNDS[4], jump: 0.75 },
  { label: "Unit-distance graph", at: 0.85, jump: 1 },
]);

const ZOOM = 0.58;
const ZOOM_START = 2.4;
const ZOOM_CENTRE = 0.9;
const ZOOM_OUTRO = 0.12;
const POINT_SIZE = 3;
const POINT_SIZE_START = 2;
const REVEAL_SCALE = 0.93;
const REVEAL_SWIRL = 0.065;
const DEG = Math.PI / 180;
const POLAR = [45 * DEG, 55 * DEG, 55 * DEG, 90 * DEG];
const AZIMUTH = [0, 45 * DEG, 90 * DEG, 90 * DEG];
const JUMP_SECONDS = 0.3;
const ORBIT_RETURN = 0.9;

const clamp = (value, min = 0, max = 1) => (value < min ? min : value > max ? max : value);
const lerp = (from, to, amount) => from + (to - from) * amount;
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const quart = (value) => {
  const t = clamp(value);
  return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2;
};
const quint = (value) => {
  const t = clamp(value);
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
};
const expo = (value) => {
  const t = clamp(value);
  return t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
};
/** Frame-rate independent approach to a target, with time constant `tau` seconds. */
const approach = (value, target, tau, seconds) => (tau <= 1e-5 ? target : value + (target - value) * (1 - Math.exp(-seconds / tau)));
const ramp = (value, from, to, ease = smooth) => (to <= from ? (value >= to ? 1 : 0) : ease((value - from) / (to - from)));
const angleBetween = (from, to) => Math.atan2(Math.sin(from - to), Math.cos(from - to));

function unitEdges(points) {
  const cells = new Map();
  const key = (x, y) => `${x},${y}`;
  points.forEach((point, index) => {
    const cell = key(Math.floor(point.x), Math.floor(point.y));
    (cells.get(cell) ?? cells.set(cell, []).get(cell)).push(index);
  });
  const edges = [];
  points.forEach((point, index) => {
    const cx = Math.floor(point.x),
      cy = Math.floor(point.y);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const other of cells.get(key(cx + dx, cy + dy)) ?? []) {
          if (other <= index) continue;
          const distance = Math.hypot(points[other].x - point.x, points[other].y - point.y);
          if (Math.abs(distance - 1) < 1e-6) edges.push([index, other]);
        }
  });
  const middle = ([from, to]) => Math.hypot(points[from].x + points[to].x, points[from].y + points[to].y);
  return edges.sort((a, b) => middle(a) - middle(b));
}

let lattice = null;
/**
 * The cut-and-project lattice: integer points of Z^4 whose internal-space image lies in a disk.
 * Each point keeps its physical position in the plane and lifts by its internal coordinate.
 * Order: the origin, the twelve unit neighbours by angle, then every other point by radius.
 */
export function buildLattice() {
  if (lattice) return lattice;
  const step = (2 * Math.PI) / SYMMETRY;
  const basis = Array.from({ length: 4 }, (_, index) => ({
    x: Math.cos(step * index),
    y: Math.sin(step * index),
    u: Math.cos(step * CONJUGATE * index),
    v: Math.sin(step * CONJUGATE * index),
  }));
  const reach = Math.max(7, Math.min(13, Math.round(WINDOW * 1.7) + 3));
  const candidates = [];
  const coordinate = [0, 0, 0, 0];
  const visit = (axis) => {
    if (axis === 4) {
      let x = 0,
        y = 0,
        u = 0,
        v = 0;
      for (let index = 0; index < 4; index++) {
        x += coordinate[index] * basis[index].x;
        y += coordinate[index] * basis[index].y;
        u += coordinate[index] * basis[index].u;
        v += coordinate[index] * basis[index].v;
      }
      if (u * u + v * v <= WINDOW * WINDOW + 1e-9) candidates.push({ x, y, lift: u, r2: x * x + y * y });
      return;
    }
    for (let value = -reach; value <= reach; value++) {
      coordinate[axis] = value;
      visit(axis + 1);
    }
  };
  visit(0);
  candidates.sort((a, b) => a.r2 - b.r2);
  const kept = candidates.slice(0, POINT_CAP);
  const origin = kept.findIndex((point) => point.r2 < 1e-9);
  const neighbours = kept
    .filter((point, index) => index !== origin && Math.abs(Math.sqrt(point.r2) - 1) < 1e-5)
    .sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  const rest = kept.filter((point, index) => index !== origin && Math.abs(Math.sqrt(point.r2) - 1) >= 1e-5);
  const ordered = [kept[origin], ...neighbours, ...rest];
  const mean = ordered.reduce((sum, point) => sum + point.lift, 0) / ordered.length;
  const radius = Math.max(...ordered.map((point) => Math.sqrt(point.r2)));
  const spread = Math.max(...ordered.map((point) => Math.abs(point.lift - mean)));
  const maxLift = 0.87 * radius;
  const points = ordered.map((point) => ({ x: point.x, y: point.y, lift: ((point.lift - mean) * maxLift) / spread }));
  lattice = Object.freeze({ points, edges: unitEdges(points), radius, maxLift, neighbours: neighbours.length });
  return lattice;
}

/** Camera and layer values for one stage, following Paradigm's choreography. */
export function stageView(stage) {
  let polar = 0,
    azimuth = AZIMUTH[AZIMUTH.length - 1];
  if (stage < LIFT_START) azimuth = 0;
  else if (stage < BOUNDS[2]) {
    const amount = quart((stage - LIFT_START) / (BOUNDS[2] - LIFT_START));
    polar = POLAR[1] * amount;
    azimuth = AZIMUTH[1] * amount;
  } else if (stage < BOUNDS[4]) {
    const progress = clamp((stage - BOUNDS[2]) / (BOUNDS[4] - BOUNDS[2]));
    const half = progress < 0.5 ? 0 : 1;
    const amount = quart(half === 0 ? progress / 0.5 : (progress - 0.5) / 0.5);
    polar = lerp(POLAR[1 + half], POLAR[2 + half], amount);
    azimuth = lerp(AZIMUTH[1 + half], AZIMUTH[2 + half], amount);
  } else if (stage < BOUNDS[5]) polar = POLAR[POLAR.length - 1] * (1 - quint((stage - BOUNDS[4]) / (BOUNDS[5] - BOUNDS[4])));
  const frameStart = LIFT_START - 0.03;
  const frameOpacity =
    stage <= frameStart
      ? 0
      : stage <= BOUNDS[3]
        ? smooth((stage - frameStart) / (BOUNDS[3] - frameStart))
        : stage <= BOUNDS[4]
          ? 1
          : stage <= BOUNDS[5]
            ? 1 - ramp(stage, BOUNDS[4], BOUNDS[5], quart)
            : 0;
  return {
    lift: quart((stage - LIFT_START) / (BOUNDS[2] - LIFT_START)),
    polar,
    azimuth,
    frameOpacity,
    edgeOpacity: ramp(stage, BOUNDS[5], lerp(BOUNDS[5], BOUNDS[6], 0.35), expo),
    edgeFront: ramp(stage, BOUNDS[5], BOUNDS[6], expo),
  };
}

/**
 * Playback state. `target` is the autoplay position; `stage` follows it closely.
 * `loop` is one of fwd, holdNeighbours, holdCentre, holdEnd, collapse, fadeIn.
 */
export function createPlayback(stage = 0) {
  return {
    loop: "fwd",
    loopTime: 0,
    target: stage,
    stage,
    pausedNeighbours: stage >= BOUNDS[1],
    pausedCentre: stage >= BOUNDS[5],
    collapse: 1,
    outro: false,
    fade: 1,
    zoom: stage < BOUNDS[1] ? ZOOM_START : ZOOM,
    jump: null,
    orbit: null,
  };
}

/** Segment speeds, in stage units per sixteen seconds. */
function speedAt(target) {
  if (target > BOUNDS[2] && target < BOUNDS[4]) return 0.9;
  if (target > BOUNDS[4] && target < BOUNDS[5]) return 0.5;
  if (target > BOUNDS[5] && target < BOUNDS[6]) return 0.24;
  if (target > BOUNDS[1] && target < BOUNDS[2]) return 0.7;
  return 1;
}

function autoplay(state, seconds) {
  switch (state.loop) {
    case "fwd": {
      state.target += (seconds * speedAt(state.target)) / 16;
      if (!state.pausedNeighbours && state.target >= NEIGHBOUR_PAUSE) {
        Object.assign(state, { target: BOUNDS[1], pausedNeighbours: true, loop: "holdNeighbours", loopTime: 1.5 });
      } else if (!state.pausedCentre && state.target >= BOUNDS[5]) {
        Object.assign(state, { target: BOUNDS[5], pausedCentre: true, loop: "holdCentre", loopTime: 2.15 });
      } else if (state.target >= 1) {
        Object.assign(state, { target: 1, loop: "holdEnd", loopTime: 1.1 });
      }
      break;
    }
    case "holdNeighbours":
    case "holdCentre":
      state.loopTime -= seconds;
      if (state.loopTime <= 0) state.loop = "fwd";
      break;
    case "holdEnd":
      state.loopTime -= seconds;
      if (state.loopTime <= 0) Object.assign(state, { loop: "collapse", loopTime: 0 });
      break;
    case "collapse": {
      state.loopTime += seconds;
      const progress = Math.min(1, state.loopTime / 1.6);
      state.outro = true;
      state.collapse = 1 - expo(progress);
      state.fade = 1 - (1 - 0.06) * clamp((progress - 0.4) / (0.78 - 0.4));
      if (progress >= 0.78) Object.assign(state, createPlayback(), { loop: "fadeIn", fade: 0.06 });
      break;
    }
    case "fadeIn":
      state.loopTime += seconds;
      state.fade = 0.06 + (1 - 0.06) * clamp(state.loopTime / 0.45);
      if (state.loopTime >= 0.45 + 0.7) Object.assign(state, { fade: 1, loop: "fwd" });
      break;
    default: {
      const unknown = state.loop;
      throw new Error(`Unknown playback loop: ${unknown}`);
    }
  }
  if (state.loop === "holdEnd" || state.loop === "collapse") state.target = 1;
}

/** Advance playback. A paused playback still settles its stage, jump, zoom, and camera, but does not move on. */
export function advancePlayback(previous, seconds, { playing = true } = {}) {
  if (seconds <= 0) return previous;
  const state = { ...previous };
  if (playing && !state.jump && !state.orbit?.dragging) autoplay(state, seconds);
  if (state.jump) {
    const elapsed = state.jump.elapsed + seconds;
    const progress = clamp(elapsed / JUMP_SECONDS);
    state.stage = lerp(state.jump.from, state.jump.to, quart(progress));
    state.jump = progress >= 1 ? null : { ...state.jump, elapsed };
  } else state.stage = approach(state.stage, state.target, 0.045, seconds);
  const { zoom, tau } = zoomTarget(state);
  state.zoom = approach(state.zoom, zoom, tau, seconds);
  if (state.orbit && !state.orbit.dragging) {
    const view = stageView(state.stage);
    const left = state.orbit.left - seconds;
    state.orbit =
      left <= 0
        ? null
        : {
            ...state.orbit,
            left,
            polar: approach(state.orbit.polar, view.polar, 0.18, seconds),
            azimuth: view.azimuth + approach(angleBetween(state.orbit.azimuth, view.azimuth), 0, 0.18, seconds),
          };
  }
  return state;
}

/** Jump straight to a stage, as the stage labels do; autoplay continues from there unless paused. */
export function jumpPlayback(previous, stage) {
  const to = clamp(stage);
  return {
    ...previous,
    loop: "fwd",
    loopTime: 0,
    outro: false,
    collapse: 1,
    fade: 1,
    target: to,
    pausedNeighbours: to >= BOUNDS[1],
    pausedCentre: to >= BOUNDS[5],
    jump: { from: previous.stage, to, elapsed: 0 },
  };
}

/** Drag to orbit the camera to a view; on release it eases back to the choreographed view. */
export function orbitPlayback(previous, polar, azimuth) {
  return { ...previous, orbit: { dragging: true, left: ORBIT_RETURN, polar: clamp(polar, 0, Math.PI / 2), azimuth } };
}
export function releaseOrbit(previous) {
  return previous.orbit ? { ...previous, orbit: { ...previous.orbit, dragging: false, left: ORBIT_RETURN } } : previous;
}

function zoomTarget(state) {
  if (state.outro) return { zoom: lerp(ZOOM_OUTRO, ZOOM, state.collapse), tau: 0.06 };
  const { stage } = state;
  if (stage >= CENTRE_START)
    return {
      zoom: stage < BOUNDS[5] ? lerp(ZOOM, ZOOM_CENTRE, smooth((stage - CENTRE_START) / (BOUNDS[5] - CENTRE_START))) : lerp(ZOOM_CENTRE, ZOOM, expo((stage - BOUNDS[5]) / (BOUNDS[6] - BOUNDS[5]))),
      tau: 0.05,
    };
  return { zoom: lerp(ZOOM_START, ZOOM, expo((stage - BOUNDS[1]) / (BOUNDS[2] - BOUNDS[1]))), tau: 0.05 };
}

export function cameraFor(state) {
  const view = stageView(state.stage);
  return state.orbit ? { polar: state.orbit.polar, azimuth: state.orbit.azimuth } : { polar: view.polar, azimuth: view.azimuth };
}

/** Points beyond `radius` fade over `soft`; Paradigm narrows this to the centre, then opens it to the whole graph. */
function centreFade(state, radius) {
  const { stage } = state;
  if (state.outro || stage < CENTRE_START) return { radius: radius * 2, soft: 1, mix: 0 };
  let core, scale;
  if (stage < BOUNDS[5]) {
    const amount = smooth((stage - CENTRE_START) / (BOUNDS[5] - CENTRE_START));
    core = lerp(radius, radius * 0.2, amount);
    scale = lerp(ZOOM, 1.8, amount) / lerp(ZOOM, ZOOM_CENTRE, amount);
  } else {
    const amount = expo((stage - BOUNDS[5]) / (BOUNDS[6] - BOUNDS[5]));
    core = lerp(radius * 0.2, radius * 2, amount);
    scale = lerp(1.8, ZOOM, amount) / lerp(ZOOM_CENTRE, ZOOM, amount);
  }
  return { radius: core * scale, soft: scale, mix: 1 };
}

/**
 * Everything needed to draw one frame: world positions, per-point alpha, the point size in pixels,
 * the box extent, and the edge opacity and front.
 */
export function sceneFor(state) {
  const { points, edges, radius, maxLift, neighbours } = buildLattice();
  const view = stageView(state.stage);
  const count = points.length;
  const ring = 1 + neighbours;
  const reveal =
    state.stage < BOUNDS[1]
      ? lerp(1, ring, expo((state.stage - 0.02) / 0.11))
      : lerp(ring, count, quint((state.stage - BOUNDS[1]) / (BOUNDS[2] - BOUNDS[1])));
  const front = 1 / Math.max(1, Math.min(20, reveal * 0.08));
  const ringStep = ring > 2 ? 1 / (ring - 1) : front;
  const lift = Math.max(0, view.lift) * maxLift;
  const fade = centreFade(state, radius);
  const positions = new Array(count);
  const alphas = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const point = points[index];
    const shown = clamp(index >= 1 && index < ring ? (reveal - 1) * ringStep : (reveal - index) * front);
    let { x, y } = point;
    if (index > 0 && shown < 1) {
      const scale = REVEAL_SCALE + (1 - REVEAL_SCALE) * shown;
      const distance = Math.hypot(x, y);
      const swirl = (REVEAL_SWIRL / (distance > 1 ? distance : 1)) * (1 - shown);
      const cos = Math.cos(swirl),
        sin = Math.sin(swirl);
      [x, y] = [(x * cos - y * sin) * scale, (x * sin + y * cos) * scale];
    }
    positions[index] = { x, y, z: point.lift * Math.max(0, view.lift) };
    const distance = Math.hypot(point.x, point.y);
    const centre = 1 - fade.mix * smooth((distance - fade.radius) / fade.soft);
    alphas[index] = shown * state.fade * centre;
  }
  const growth = smooth((state.stage - 0.245) / (BOUNDS[2] - 0.245));
  let size = lerp(POINT_SIZE_START, POINT_SIZE, growth);
  if (state.outro) size = lerp(POINT_SIZE_START, size, state.collapse);
  return {
    positions,
    alphas,
    edges,
    pointSize: size * (state.zoom / ZOOM),
    edgeOpacity: view.edgeOpacity * 0.3 * state.fade,
    edgeFront: state.outro ? state.collapse * state.collapse : view.edgeFront,
    frameOpacity: view.frameOpacity * state.fade,
    extent: { radius: radius * 1.06, height: lift * 1.06 },
    camera: cameraFor(state),
    reach: radius + lift * Math.abs(Math.sin(cameraFor(state).polar)),
  };
}

/** The active stage label: the last label whose start the stage has passed. */
export function stageIndex(stage) {
  let active = 0;
  STAGES.forEach((entry, index) => {
    if (stage >= entry.at - 1e-9) active = index;
  });
  return active;
}

/**
 * An orthographic camera on the sphere around the origin; polar 0 looks straight down on the plane.
 * The frustum fits the lattice reach to the graph, scaled by the playback zoom, as in Paradigm.
 */
export function viewportFor(width, height, scene, zoom) {
  const { polar, azimuth } = scene.camera;
  const sp = Math.sin(polar),
    cp = Math.cos(polar),
    sa = Math.sin(azimuth),
    ca = Math.cos(azimuth);
  const forward = { x: sp * sa, y: -sp * ca, z: cp };
  const up = { x: -cp * sa, y: cp * ca, z: sp };
  const right = {
    x: up.y * forward.z - up.z * forward.y,
    y: up.z * forward.x - up.x * forward.z,
    z: up.x * forward.y - up.y * forward.x,
  };
  const aspect = width / Math.max(1, height);
  const frustum = (scene.reach * Math.max(1, 1 / aspect) * 1.08) / Math.max(0.2, zoom);
  return { width, height, forward, up, right, scale: height / 2 / frustum };
}

export function project(point, viewport) {
  const { right, up, forward, scale, width, height } = viewport;
  return {
    x: width / 2 + (point.x * right.x + point.y * right.y + point.z * right.z) * scale,
    y: height / 2 - (point.x * up.x + point.y * up.y + point.z * up.z) * scale,
    depth: point.x * forward.x + point.y * forward.y + point.z * forward.z,
  };
}

const CORNERS = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({ x, y, z }))));
const BOX_EDGES = CORNERS.flatMap((corner, from) =>
  CORNERS.map((other, to) => [from, to]).filter(
    ([a, b]) => a < b && Math.abs(CORNERS[a].x - CORNERS[b].x) + Math.abs(CORNERS[a].y - CORNERS[b].y) + Math.abs(CORNERS[a].z - CORNERS[b].z) === 2,
  ),
);

/** The box around the lattice. Edges at the corner farthest from the camera are hidden, so they are drawn dashed. */
export function frameFor(scene, viewport) {
  const { radius, height } = scene.extent;
  const corners = CORNERS.map((corner) => project({ x: corner.x * radius, y: corner.y * radius, z: corner.z * height }, viewport));
  const back = corners.reduce((far, corner, index) => (corner.depth < corners[far].depth ? index : far), 0);
  return {
    corners,
    edges: BOX_EDGES.map(([from, to]) => ({ from: corners[from], to: corners[to], hidden: from === back || to === back })),
  };
}
