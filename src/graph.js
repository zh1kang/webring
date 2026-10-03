/**
 * Paradigm's Erdős sequence, drawn only with the members of the ring.
 * One stage value from 0 to 1 drives the whole scene: the first site alone, the other members growing out of it,
 * the lift of the ring into 3D inside a box, a turn and a side view of its layers, the flat top view, and the ring
 * links drawing from member to member. Autoplay holds twice, then collapses and loops.
 */

const RING_RADIUS = 1;
const MAX_LIFT = 0.87 * RING_RADIUS;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

export const BOUNDS = Object.freeze(Array.from({ length: 7 }, (_, index) => index / 6));
const LIFT_START = 0.204;
const CENTRE_START = (BOUNDS[4] + BOUNDS[5]) / 2;
const NEIGHBOUR_PAUSE = 0.135;
const EMERGE_START = 0.02;
const EMERGE_END = 0.13;
const DRAW_END = BOUNDS[5] + (BOUNDS[6] - BOUNDS[5]) * 0.7;

export const STAGES = Object.freeze([
  { label: "First site", at: 0, jump: 0 },
  { label: "Members", at: 0.084, jump: BOUNDS[1] },
  { label: "Lift", at: LIFT_START, jump: 0.3 },
  { label: "Orbit", at: BOUNDS[2], jump: 0.5 },
  { label: "Flatten", at: BOUNDS[4], jump: 0.75 },
  { label: "Link", at: BOUNDS[5] + 0.01, jump: 1 },
]);

const ZOOM = 0.58;
const ZOOM_START = 2.4;
const ZOOM_CENTRE = 0.9;
const ZOOM_OUTRO = 0.12;
const POINT_SIZE = 3;
const POINT_SIZE_START = 2;
const SPREAD_START = 0.25;
const EMERGE_SPAN = 1.5;
const EMERGE_SWIRL = 0.35;
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

const layouts = new Map();
/**
 * Members sit on a ring in ring order, clockwise from the top of the final view; a single member sits at the centre.
 * The final camera turns 90 degrees, so the top of that view is the -x axis.
 * Each member lifts to its own layer, spaced by the golden ratio so ring neighbours sit at different heights.
 * The links join each member to the next and close the ring.
 */
export function ringLayout(count) {
  const cached = layouts.get(count);
  if (cached) return cached;
  const raw = Array.from({ length: count }, (_, index) => (index * GOLDEN) % 1);
  const mean = raw.reduce((sum, value) => sum + value, 0) / Math.max(1, count);
  const spread = Math.max(0, ...raw.map((value) => Math.abs(value - mean)));
  const slots = raw.map((value, index) => {
    const angle = Math.PI - (2 * Math.PI * index) / count;
    const lift = spread > 0 ? ((value - mean) * MAX_LIFT) / spread : 0;
    return count === 1 ? { x: 0, y: 0, lift } : { x: Math.cos(angle) * RING_RADIUS, y: Math.sin(angle) * RING_RADIUS, lift };
  });
  const edges = count < 2 ? [] : count === 2 ? [[0, 1]] : slots.map((_, index) => [index, (index + 1) % count]);
  const layout = Object.freeze({ slots, edges, radius: RING_RADIUS, maxLift: MAX_LIFT });
  layouts.set(count, layout);
  return layout;
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
    edgeOpacity: ramp(stage, BOUNDS[5], BOUNDS[5] + 0.01),
    edgeFront: ramp(stage, BOUNDS[5], DRAW_END),
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

/**
 * Everything needed to draw one frame for `count` members: world positions, per-member alpha, the point size in
 * pixels, the box extent, and the ring strokes drawn so far.
 * The first member starts alone at the centre; the others grow out of it in ring order and the ring opens to full size.
 */
export function sceneFor(state, count) {
  const { slots, edges, radius, maxLift } = ringLayout(count);
  const view = stageView(state.stage);
  const emerge = expo((state.stage - EMERGE_START) / (EMERGE_END - EMERGE_START));
  const spread = lerp(SPREAD_START, 1, quint((state.stage - BOUNDS[1]) / (BOUNDS[2] - BOUNDS[1])));
  const progress = emerge * Math.max(0, count - 2 + EMERGE_SPAN);
  const lift = Math.max(0, view.lift);
  const positions = new Array(count);
  const alphas = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const slot = slots[index];
    const shown = index === 0 ? 1 : clamp((progress - (index - 1)) / EMERGE_SPAN);
    const travel = (index === 0 ? emerge : shown) * spread;
    const swirl = EMERGE_SWIRL * (1 - (index === 0 ? emerge : shown));
    const cos = Math.cos(swirl),
      sin = Math.sin(swirl);
    positions[index] = { x: (slot.x * cos - slot.y * sin) * travel, y: (slot.x * sin + slot.y * cos) * travel, z: slot.lift * lift };
    alphas[index] = shown * state.fade;
  }
  const front = (state.outro ? state.collapse * state.collapse : view.edgeFront) * edges.length;
  const strokes = edges.slice(0, Math.ceil(front - 1e-9)).map(([from, to], index) => ({ from, to, amount: clamp(front - index) }));
  const growth = smooth((state.stage - 0.245) / (BOUNDS[2] - 0.245));
  let size = lerp(POINT_SIZE_START, POINT_SIZE, growth);
  if (state.outro) size = lerp(POINT_SIZE_START, size, state.collapse);
  const camera = cameraFor(state);
  return {
    positions,
    alphas,
    strokes,
    pointSize: size * (state.zoom / ZOOM),
    edgeOpacity: view.edgeOpacity * state.fade,
    frameOpacity: view.frameOpacity * state.fade,
    extent: { radius: radius * 1.12, height: maxLift * lift * 1.12 },
    camera,
    reach: radius * 1.12 + maxLift * lift * Math.abs(Math.sin(camera.polar)),
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
 * The frustum fits the ring reach to the graph, scaled by the playback zoom, as in Paradigm.
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

/** The box around the ring. Edges at the corner farthest from the camera are hidden, so they are drawn dashed. */
export function frameFor(scene, viewport) {
  const { radius, height } = scene.extent;
  const corners = CORNERS.map((corner) => project({ x: corner.x * radius, y: corner.y * radius, z: corner.z * height }, viewport));
  const back = corners.reduce((far, corner, index) => (corner.depth < corners[far].depth ? index : far), 0);
  return {
    corners,
    edges: BOX_EDGES.map(([from, to]) => ({ from: corners[from], to: corners[to], hidden: from === back || to === back })),
  };
}
