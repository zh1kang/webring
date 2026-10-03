import outline from './wordmark-outline.json';

const namespace = 'http://www.w3.org/2000/svg';
const HIT = 12, NEAR = 48, FAR = 96, ANCHOR = 8, CONTROL = 3.5, NUDGE = 2, BIG_NUDGE = 10;
const keyOf = (command, point) => `${command}:${point}`;
const parseKey = key => key.split(':').map(Number);

function element(name, attributes = {}) {
  const node = document.createElementNS(namespace, name);
  for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, value);
  return node;
}

/** A closed contour that ends on its start point shares one anchor between its M and final command. */
function findTwins(commands) {
  const twins = new Map();
  let start = null, last = null;
  commands.forEach((command, index) => {
    if (command.type === 'M') start = index;
    if (command.type === 'Z' && start !== null && last !== null && last !== start) {
      const [x0, y0] = commands[start].points[0];
      const [x1, y1] = commands[last].points.at(-1);
      if (Math.hypot(x1 - x0, y1 - y0) < 0.01) {
        const first = keyOf(start, 0), final = keyOf(last, commands[last].points.length - 1);
        twins.set(first, final); twins.set(final, first);
      }
    }
    if (command.points.length) last = index;
  });
  return twins;
}

export function mountWordmark(svg, resetButton) {
  const controller = new AbortController();
  const on = (target, type, handler) => target.addEventListener(type, handler, {signal: controller.signal});
  const original = structuredClone(outline.commands);
  const twins = findTwins(original);
  let commands = structuredClone(original);
  let selected = new Set();
  let mode = null;
  let hovered = null;
  let keyboard = false;

  const path = element('path', {fill: 'currentColor', 'aria-hidden': 'true'});
  const handles = element('g', {class: 'wordmark-handles'});
  const marquee = element('rect', {class: 'wordmark-marquee', visibility: 'hidden'});
  const readout = element('text', {class: 'wordmark-readout', visibility: 'hidden'});
  svg.setAttribute('viewBox', `0 0 ${outline.width} ${outline.height}`);
  svg.setAttribute('tabindex', '0');
  svg.append(path, handles, marquee, readout);

  const pixel = () => 1 / (svg.getScreenCTM()?.a || 1);
  function pointAt(clientX, clientY) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  }
  function* points() {
    for (let command = 0; command < commands.length; command++)
      for (let point = 0; point < commands[command].points.length; point++) {
        const key = keyOf(command, point);
        if (twins.has(key) && commands[command].type === 'M') continue;
        yield {key, command, point, value: commands[command].points[point]};
      }
  }
  const isAnchor = (command, point) => point === commands[command].points.length - 1;

  function renderPath() {
    path.setAttribute('d', commands.map(command => command.type + command.points.flat().join(' ')).join(' '));
  }
  function liveSelection() {
    if (mode?.kind !== 'marquee') return selected;
    const live = new Set(mode.base);
    const [left, right] = [Math.min(mode.origin.x, mode.current.x), Math.max(mode.origin.x, mode.current.x)];
    const [top, bottom] = [Math.min(mode.origin.y, mode.current.y), Math.max(mode.origin.y, mode.current.y)];
    for (const {key, value: [x, y]} of points()) if (x >= left && x <= right && y >= top && y <= bottom) live.add(key);
    return live;
  }
  function visibility(value, isSelected, unit) {
    if (keyboard || isSelected) return 1;
    if (!hovered) return 0;
    const distance = Math.hypot(value[0] - hovered.x, value[1] - hovered.y) / unit;
    return distance <= NEAR ? 1 : distance >= FAR ? 0 : 1 - (distance - NEAR) / (FAR - NEAR);
  }
  function render() {
    const unit = pixel();
    const live = liveSelection();
    handles.replaceChildren();
    const lines = [], marks = [];
    for (const {key, command, point, value} of points()) {
      const isSelected = live.has(key);
      const opacity = visibility(value, isSelected, unit);
      if (opacity <= 0) continue;
      const anchor = isAnchor(command, point);
      if (!anchor) {
        const owner = point === 0 ? commands[command - 1]?.points.at(-1) : commands[command].points.at(-1);
        if (owner) lines.push(element('line', {x1: owner[0], y1: owner[1], x2: value[0], y2: value[1], opacity}));
      }
      const size = (anchor ? ANCHOR : CONTROL * 2) * unit;
      const mark = anchor
        ? element('rect', {x: value[0] - size / 2, y: value[1] - size / 2, width: size, height: size})
        : element('circle', {cx: value[0], cy: value[1], r: size / 2});
      mark.setAttribute('opacity', opacity);
      mark.dataset.key = key;
      if (isSelected) mark.classList.add('selected');
      marks.push(mark);
    }
    handles.append(...lines, ...marks);
    if (mode?.kind === 'marquee') {
      const x = Math.min(mode.origin.x, mode.current.x), y = Math.min(mode.origin.y, mode.current.y);
      for (const [name, value] of Object.entries({x, y, width: Math.abs(mode.current.x - mode.origin.x), height: Math.abs(mode.current.y - mode.origin.y)})) marquee.setAttribute(name, value);
      marquee.setAttribute('visibility', 'visible');
    } else marquee.setAttribute('visibility', 'hidden');
    const near = hovered && (mode || [...points()].some(({value}) => Math.hypot(value[0] - hovered.x, value[1] - hovered.y) / unit < NEAR));
    if (near) {
      readout.setAttribute('x', hovered.x + 12 * unit);
      readout.setAttribute('y', hovered.y + 22 * unit);
      readout.setAttribute('font-size', 10 * unit);
      const pad = value => String(Math.max(0, Math.round(value))).padStart(4, '0');
      readout.replaceChildren(element('tspan', {x: hovered.x + 12 * unit}), element('tspan', {x: hovered.x + 12 * unit, dy: 13 * unit}));
      readout.children[0].textContent = `X:${pad(hovered.x)}`;
      readout.children[1].textContent = `Y:${pad(hovered.y)}`;
      readout.setAttribute('visibility', 'visible');
    } else readout.setAttribute('visibility', 'hidden');
  }

  /** Anchors carry their curve handles and any twin anchor that closes the same contour. */
  function movingKeys() {
    const moving = new Set();
    const addAnchor = command => {
      moving.add(keyOf(command, commands[command].points.length - 1));
      if (commands[command].type === 'C') moving.add(keyOf(command, 1));
      if (commands[command + 1]?.type === 'C') moving.add(keyOf(command + 1, 0));
    };
    for (const key of selected) {
      const [command, point] = parseKey(key);
      if (!isAnchor(command, point)) {moving.add(key); continue;}
      addAnchor(command);
      const twin = twins.get(key);
      if (twin) addAnchor(parseKey(twin)[0]);
    }
    return [...moving].map(parseKey);
  }
  const changed = () => commands.some((command, index) => command.points.some((value, point) => {
    const [x, y] = original[index].points[point];
    return Math.abs(value[0] - x) > 1e-6 || Math.abs(value[1] - y) > 1e-6;
  }));
  function moveSelection(dx, dy) {
    const moving = movingKeys();
    if (!moving.length) return;
    const values = moving.map(([command, point]) => commands[command].points[point]);
    const xs = values.map(value => value[0]), ys = values.map(value => value[1]);
    const appliedX = Math.max(3 - Math.min(...xs), Math.min(outline.width - 3 - Math.max(...xs), dx));
    const appliedY = Math.max(3 - Math.min(...ys), Math.min(outline.height - 3 - Math.max(...ys), dy));
    for (const value of values) {value[0] += appliedX; value[1] += appliedY;}
    resetButton.hidden = !changed();
    renderPath();
  }
  function nearest(point) {
    let found = null, distance = HIT * pixel();
    for (const candidate of points()) {
      const next = Math.hypot(candidate.value[0] - point.x, candidate.value[1] - point.y);
      if (next < distance) {distance = next; found = candidate.key;}
    }
    return found;
  }

  on(svg, 'pointerdown', event => {
    if (event.button !== 0) return;
    const point = pointAt(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    svg.focus({preventScroll: true});
    svg.setPointerCapture(event.pointerId);
    const key = nearest(point);
    if (key) {
      if (event.shiftKey) {
        selected = new Set(selected);
        if (selected.has(key)) selected.delete(key); else selected.add(key);
      } else if (!selected.has(key)) selected = new Set([key]);
      mode = selected.has(key) ? {kind: 'move', last: point} : null;
      if (mode) svg.classList.add('dragging');
    } else {
      const base = event.shiftKey ? new Set(selected) : new Set();
      selected = base;
      mode = {kind: 'marquee', origin: point, current: point, base};
    }
    hovered = point;
    render();
  });
  on(svg, 'pointermove', event => {
    const point = pointAt(event.clientX, event.clientY);
    if (!point) return;
    hovered = point;
    if (mode?.kind === 'move') {
      moveSelection(point.x - mode.last.x, point.y - mode.last.y);
      mode.last = point;
    } else if (mode?.kind === 'marquee') mode.current = point;
    render();
  });
  function finish() {
    if (mode?.kind === 'marquee') selected = liveSelection();
    mode = null;
    svg.classList.remove('dragging');
    render();
  }
  on(svg, 'pointerup', finish);
  on(svg, 'pointercancel', finish);
  on(svg, 'lostpointercapture', () => {if (mode) finish();});
  on(svg, 'pointerleave', () => {if (!mode) {hovered = null; render();}});
  on(svg, 'focus', () => {keyboard = svg.matches(':focus-visible'); render();});
  on(svg, 'blur', () => {keyboard = false; render();});
  on(svg, 'keydown', event => {
    if (event.key === 'Escape') {
      selected = new Set(); hovered = null;
      render();
      return;
    }
    if (event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      selected = new Set([...points()].map(({key}) => key));
      render();
      return;
    }
    const step = event.shiftKey ? BIG_NUDGE : NUDGE;
    const delta = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]}[event.key];
    if (!delta || !selected.size) return;
    event.preventDefault();
    moveSelection(...delta);
    render();
  });
  on(resetButton, 'click', () => {
    commands = structuredClone(original);
    selected = new Set();
    resetButton.hidden = true;
    renderPath(); render();
    svg.focus({preventScroll: true});
  });
  renderPath();
  return () => {controller.abort(); svg.replaceChildren();};
}
