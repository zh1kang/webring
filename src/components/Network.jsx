"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  advancePlayback,
  createPlayback,
  frameFor,
  jumpPlayback,
  orbitPlayback,
  project,
  releaseOrbit,
  sceneFor,
  stageIndex,
  STAGES,
  viewportFor,
} from "../graph.js";
import MemberSearch from "./MemberSearch.jsx";

const EMPTY = [];
const INK = "#171717";
const FRAME_GAP = 44;
const LEADER_GAP = 10;
const NODE_CLEARANCE = 14;
const EDGE_MARGIN = 12;
const ORBIT_SPEED = 0.006;
const ALPHA_LEVELS = 8;

function selectionFromProps(people, selectedIndex, selectedId) {
  if (selectedId !== undefined && selectedId !== null) {
    const index = people.findIndex((person) => person.id === selectedId);
    return index < 0 ? null : index;
  }
  return Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < people.length ? selectedIndex : null;
}

const within = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));
const pad = (value) => String(value).padStart(2, "0");
const hostOf = (person) => new URL(person.website).hostname;
const studyOf = (person) => [person.major, person.year ? `Class of ${person.year}` : ""].filter(Boolean).join(" · ");
const settled = (state) =>
  !state.jump && !state.orbit && Math.abs(state.stage - state.target) < 1e-4 && state.loop !== "collapse" && state.loop !== "fadeIn";

/** One callout line that types in character by character, after the lines above it. */
function Typed({ as: Tag = "span", text, line, className = "", ...rest }) {
  const chars = Math.max(1, Math.min(text.length, 36));
  return (
    <Tag className={`typed ${className}`} style={{ "--chars": chars, "--line": line }} {...rest}>
      {text}
    </Tag>
  );
}

export default function Network({ people = EMPTY, selectedIndex, selectedId, onSelectionChange, active = true, suspended = false }) {
  const members = Array.isArray(people) ? people : EMPTY;
  const controlled = selectedIndex !== undefined || selectedId !== undefined;
  const requested = selectionFromProps(members, selectedIndex, selectedId);
  const [internalSelection, setInternalSelection] = useState(requested);
  const activeSelection = controlled ? requested : internalSelection;
  const [stageLabel, setStageLabel] = useState(0);
  const [paused, setPaused] = useState(false);

  const graphRef = useRef(null),
    canvasRef = useRef(null),
    frameRef = useRef(null),
    hiddenFrameRef = useRef(null),
    linksRef = useRef(null),
    leaderRef = useRef(null),
    calloutRef = useRef(null),
    nameRef = useRef(null),
    nodeRefs = useRef([]);
  const sizeRef = useRef({ width: 0, height: 0, ratio: 1 });
  const playbackRef = useRef(createPlayback());
  const activeRef = useRef(active),
    reducedRef = useRef(false),
    reasonsRef = useRef(new Set());
  const rafRef = useRef(null),
    lastTimeRef = useRef(undefined),
    tickRef = useRef(null),
    drawRef = useRef(null);
  const positionsRef = useRef([]),
    alphasRef = useRef(new Float32Array(0)),
    orbitRef = useRef(null);
  const selectedRef = useRef(activeSelection),
    hoverRef = useRef(null),
    membersRef = useRef(members);
  membersRef.current = members;

  /** Set the label beside the graph, clear of it; on narrow screens stack it above or below. */
  function placeCallout(positions, bounds, width, height) {
    const callout = calloutRef.current,
      leader = leaderRef.current;
    const selection = selectedRef.current;
    const node = selection === null ? null : positions[selection];
    if (!callout || !leader) return;
    if (!node || callout.hidden) {
      leader.setAttribute("d", "");
      return;
    }
    const boxWidth = callout.offsetWidth,
      boxHeight = callout.offsetHeight;
    const name = nameRef.current;
    const anchorY = name ? name.offsetTop + name.offsetHeight / 2 : boxHeight / 2;
    const fits = (right) =>
      right ? bounds.right + FRAME_GAP + boxWidth <= width - EDGE_MARGIN : bounds.left - FRAME_GAP - boxWidth >= EDGE_MARGIN;
    const preferRight = node.x >= width / 2;
    const side = [preferRight, !preferRight].find(fits);
    let left, top, tip;
    if (side !== undefined) {
      left = side ? bounds.right + FRAME_GAP : bounds.left - FRAME_GAP - boxWidth;
      top = within(node.y - anchorY, EDGE_MARGIN, height - boxHeight - EDGE_MARGIN);
      tip = { x: side ? left - LEADER_GAP : left + boxWidth + LEADER_GAP, y: top + anchorY };
      callout.dataset.side = side ? "right" : "left";
    } else {
      const below = height - bounds.bottom >= bounds.top;
      top = within(below ? bounds.bottom + LEADER_GAP : bounds.top - LEADER_GAP - boxHeight, EDGE_MARGIN, height - boxHeight - EDGE_MARGIN);
      left = within(node.x - boxWidth / 2, EDGE_MARGIN, width - boxWidth - EDGE_MARGIN);
      tip = { x: within(node.x, left + 8, left + boxWidth - 8), y: below ? top - LEADER_GAP / 2 : top + boxHeight + LEADER_GAP / 2 };
      callout.dataset.side = below ? "below" : "above";
    }
    callout.style.transform = `translate(${left}px, ${top}px)`;
    const reach = Math.hypot(tip.x - node.x, tip.y - node.y);
    if (reach <= NODE_CLEARANCE) {
      leader.setAttribute("d", "");
      return;
    }
    const start = { x: node.x + ((tip.x - node.x) / reach) * NODE_CLEARANCE, y: node.y + ((tip.y - node.y) / reach) * NODE_CLEARANCE };
    leader.setAttribute("d", `M${start.x},${start.y}L${tip.x},${tip.y}`);
  }

  /** Lattice points and unit-distance edges, batched into a few alpha levels so a frame is a handful of canvas paths. */
  function paintLattice(context, scene, positions, memberCount) {
    const { alphas, edges, pointSize } = scene;
    const shownEdges = Math.floor(scene.edgeFront * edges.length);
    if (shownEdges > 0 && scene.edgeOpacity > 0.002) {
      context.strokeStyle = INK;
      context.lineWidth = 0.6;
      for (let level = 1; level <= 4; level++) {
        context.globalAlpha = scene.edgeOpacity * (level / 4);
        context.beginPath();
        for (let index = 0; index < shownEdges; index++) {
          const [from, to] = edges[index];
          if (Math.ceil(Math.min(alphas[from], alphas[to]) * 4) !== level) continue;
          context.moveTo(positions[from].x, positions[from].y);
          context.lineTo(positions[to].x, positions[to].y);
        }
        context.stroke();
      }
    }
    context.fillStyle = INK;
    const radius = pointSize / 2;
    for (let level = 1; level <= ALPHA_LEVELS; level++) {
      context.globalAlpha = level / ALPHA_LEVELS;
      context.beginPath();
      for (let index = memberCount; index < positions.length; index++) {
        if (Math.ceil(alphas[index] * ALPHA_LEVELS) !== level) continue;
        const { x, y } = positions[index];
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, Math.PI * 2);
      }
      context.fill();
    }
    context.globalAlpha = 1;
  }

  drawRef.current = () => {
    const graph = graphRef.current,
      canvas = canvasRef.current;
    const { width, height, ratio } = sizeRef.current;
    if (!graph || !canvas || !width) return;
    const playback = playbackRef.current;
    const scene = sceneFor(playback);
    const viewport = viewportFor(width, height, scene, playback.zoom);
    const positions = scene.positions.map((point) => project(point, viewport));
    positionsRef.current = positions;
    alphasRef.current = scene.alphas;
    const roster = membersRef.current;
    const memberCount = Math.min(roster.length, positions.length);

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    paintLattice(context, scene, positions, memberCount);

    const frame = frameFor(scene, viewport);
    const segment = ({ from, to }) => `M${from.x},${from.y}L${to.x},${to.y}`;
    const ticks = frame.corners.map((point) => `M${point.x - 3},${point.y}h6M${point.x},${point.y - 3}v6`).join("");
    frameRef.current?.setAttribute("d", frame.edges.filter((edge) => !edge.hidden).map(segment).join("") + ticks);
    hiddenFrameRef.current?.setAttribute("d", frame.edges.filter((edge) => edge.hidden).map(segment).join(""));
    graph.style.setProperty("--frame-alpha", String(scene.frameOpacity));

    const selection = selectedRef.current;
    const nodeSize = Math.max(6, scene.pointSize + 3);
    graph.style.setProperty("--dot-size", `${nodeSize}px`);
    nodeRefs.current.forEach((node, index) => {
      const position = positions[index];
      if (!node || !position) return;
      const alpha = selection === index ? 1 : scene.alphas[index];
      node.style.transform = `translate(${position.x - 14}px, ${position.y - 14}px)`;
      node.style.zIndex = String(index === selection ? 3 : 2);
      node.style.setProperty("--node-alpha", String(alpha));
      const interactive = alpha > 0.05;
      node.tabIndex = interactive ? 0 : -1;
      node.style.pointerEvents = interactive ? "auto" : "none";
    });

    const focus = hoverRef.current ?? selection;
    let links = "";
    if (focus !== null && memberCount > 1) {
      const point = positions[focus];
      for (const neighbour of new Set([(focus + 1) % memberCount, (focus - 1 + memberCount) % memberCount]))
        links += `M${point.x},${point.y}L${positions[neighbour].x},${positions[neighbour].y}`;
    }
    linksRef.current?.setAttribute("d", links);

    const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    const include = ({ x, y }) => {
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.bottom = Math.max(bounds.bottom, y);
    };
    positions.forEach((position, index) => {
      if (scene.alphas[index] > 0.05) include(position);
    });
    if (scene.frameOpacity > 0.05) frame.corners.forEach(include);
    if (bounds.left === Infinity) Object.assign(bounds, { left: width / 2, right: width / 2, top: height / 2, bottom: height / 2 });
    placeCallout(positions, bounds, width, height);
    setStageLabel(stageIndex(playback.stage));
  };

  const playing = () => activeRef.current && !reducedRef.current && reasonsRef.current.size === 0;
  const schedule = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame((time) => tickRef.current(time));
  }, []);
  tickRef.current = (time) => {
    rafRef.current = null;
    const previous = lastTimeRef.current;
    lastTimeRef.current = time;
    const seconds = previous === undefined ? 0 : Math.min(50, time - previous) / 1000;
    if (!document.hidden && seconds > 0 && activeRef.current && !reducedRef.current)
      playbackRef.current = advancePlayback(playbackRef.current, seconds, { playing: playing() });
    drawRef.current();
    if (!document.hidden && activeRef.current && !reducedRef.current && (playing() || !settled(playbackRef.current))) schedule();
    else lastTimeRef.current = undefined;
  };

  const setReason = useCallback(
    (reason, enabled) => {
      if (enabled) reasonsRef.current.add(reason);
      else reasonsRef.current.delete(reason);
      setPaused(reasonsRef.current.has("timeline"));
      schedule();
    },
    [schedule],
  );

  const holdForSearch = useCallback((open) => setReason("search", open), [setReason]);
  const selectMember = useCallback(
    (index) => {
      if (index < 0 || index >= members.length) return;
      if (!controlled) setInternalSelection(index);
      onSelectionChange?.(members[index]?.id ?? null);
    },
    [controlled, members, onSelectionChange],
  );
  const closeDetails = useCallback(() => {
    if (!controlled) setInternalSelection(null);
    onSelectionChange?.(null);
  }, [controlled, onSelectionChange]);

  function jumpTo(stage) {
    playbackRef.current = jumpPlayback(playbackRef.current, stage);
    setReason("timeline", true);
  }

  useEffect(() => {
    selectedRef.current = activeSelection;
    setReason("selected", activeSelection !== null);
    if (activeSelection !== null && (alphasRef.current[activeSelection] ?? 0) < 0.5)
      playbackRef.current = jumpPlayback(playbackRef.current, 1);
    drawRef.current();
  }, [activeSelection, setReason]);
  useEffect(() => {
    if (activeSelection === null) return;
    const escape = (event) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, #wordmark, #members-panel")) return;
      closeDetails();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [activeSelection, closeDetails]);
  useEffect(() => {
    if (!paused) return;
    const resume = (event) => {
      if (event.target instanceof Element && event.target.closest(".stages")) return;
      setReason("timeline", false);
    };
    document.addEventListener("pointerdown", resume, true);
    return () => document.removeEventListener("pointerdown", resume, true);
  }, [paused, setReason]);
  useEffect(() => {
    if (controlled) setInternalSelection(requested);
  }, [controlled, requested]);
  useEffect(() => {
    activeRef.current = active;
    drawRef.current();
    schedule();
  }, [active, schedule]);
  useEffect(() => {
    setReason("modal", suspended);
  }, [setReason, suspended]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotion = () => {
      reducedRef.current = media.matches;
      if (media.matches) playbackRef.current = createPlayback(1);
      drawRef.current();
      schedule();
    };
    handleMotion();
    media.addEventListener?.("change", handleMotion);
    const graph = graphRef.current,
      canvas = canvasRef.current;
    const resize = () => {
      const { width, height } = graph.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      sizeRef.current = { width, height, ratio };
      drawRef.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(graph);
    resize();
    const handleVisibility = () => {
      lastTimeRef.current = undefined;
      if (!document.hidden) schedule();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      media.removeEventListener?.("change", handleMotion);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [schedule]);

  function startOrbit(event) {
    if (event.button !== 0 || event.target !== event.currentTarget || reducedRef.current) return;
    const camera = sceneFor(playbackRef.current).camera;
    orbitRef.current = { x: event.clientX, y: event.clientY, camera, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveOrbit(event) {
    const orbit = orbitRef.current;
    if (!orbit) return;
    const dx = event.clientX - orbit.x,
      dy = event.clientY - orbit.y;
    if (!orbit.moved && Math.hypot(dx, dy) < 4) return;
    orbit.moved = true;
    event.currentTarget.classList.add("orbiting");
    playbackRef.current = orbitPlayback(playbackRef.current, orbit.camera.polar - dy * ORBIT_SPEED, orbit.camera.azimuth - dx * ORBIT_SPEED);
    schedule();
  }
  function endOrbit(event) {
    const orbit = orbitRef.current;
    if (!orbit) return;
    orbitRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    event.currentTarget.classList.remove("orbiting");
    if (orbit.moved) {
      playbackRef.current = releaseOrbit(playbackRef.current);
      schedule();
    } else closeDetails();
  }

  const detail = activeSelection === null ? null : members[activeSelection];
  const detailStudy = detail ? studyOf(detail) : "";
  useEffect(() => {
    drawRef.current();
  }, [detail]);
  return (
    <section className="network" aria-label="Interactive member graph">
      <div
        id="graph"
        className="graph"
        ref={graphRef}
        onPointerDown={startOrbit}
        onPointerMove={moveOrbit}
        onPointerUp={endOrbit}
        onPointerCancel={endOrbit}
      >
        <canvas ref={canvasRef} className="lattice" aria-hidden="true" />
        <svg aria-hidden="true">
          <path ref={hiddenFrameRef} className="graph-frame hidden-edges" />
          <path ref={frameRef} className="graph-frame" />
          <path ref={linksRef} className="ring-links" />
          <path ref={leaderRef} key={detail?.id ?? "none"} className="callout-leader" />
        </svg>
        <div id="nodes">
          {members.map((person, index) => (
            <button
              className="node"
              data-index={index}
              key={person.id}
              ref={(node) => {
                nodeRefs.current[index] = node;
              }}
              aria-pressed={String(activeSelection === index)}
              aria-controls="detail"
              aria-label={`${person.name}, show details`}
              onFocus={() => setReason("focus", true)}
              onBlur={() => setReason("focus", false)}
              onClick={() => selectMember(index)}
              onPointerEnter={() => {
                hoverRef.current = index;
                setReason("hover", true);
              }}
              onPointerLeave={() => {
                hoverRef.current = null;
                setReason("hover", false);
              }}
            >
              <span className="node-bracket" />
              <span className="node-dot" />
              <span className="node-label">{person.name}</span>
            </button>
          ))}
        </div>
        <ol className="stages" aria-label="Sequence" data-paused={paused || undefined}>
          {STAGES.map((entry, index) => (
            <li key={entry.label}>
              <button aria-current={stageLabel === index ? "step" : undefined} onClick={() => jumpTo(entry.jump)}>
                {entry.label}
              </button>
            </li>
          ))}
        </ol>
        <aside id="detail" ref={calloutRef} className="callout" aria-label="Member details" aria-live="polite" hidden={!detail}>
          {detail && (
            <div className="callout-body" key={detail.id}>
              <Typed as="p" className="callout-index" line={0} text={`${pad(activeSelection + 1)} / ${pad(members.length)}`} />
              <h2 className="callout-name" ref={nameRef}>
                <Typed className="ink-label" line={1} text={detail.name} />
              </h2>
              <Typed as="p" className="callout-host" line={2} text={hostOf(detail)} />
              {detailStudy && <Typed as="p" className="callout-study" line={3} text={detailStudy} />}
              {detail.message && (
                <p className="callout-message" style={{ "--line": 4 }}>
                  {detail.message}
                </p>
              )}
              <div className="callout-actions">
                <a className="callout-action" href={detail.website}>
                  Visit <span aria-hidden="true">↗</span>
                </a>
                <button
                  className="callout-action"
                  aria-label="Previous member"
                  onClick={() => selectMember((activeSelection - 1 + members.length) % members.length)}
                >
                  ←
                </button>
                <button
                  className="callout-action"
                  aria-label="Next member"
                  onClick={() => selectMember((activeSelection + 1) % members.length)}
                >
                  →
                </button>
                <button className="callout-action" aria-label="Close member details" onClick={closeDetails}>
                  esc
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
      <div className="graph-bar">
        <MemberSearch members={members} onPick={selectMember} onOpenChange={holdForSearch} />
      </div>
    </section>
  );
}
