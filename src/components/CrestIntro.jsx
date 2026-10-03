"use client";

import { useEffect, useRef } from "react";
import paths from "../crest-paths.json";

const COLUMNS = 6;
const DURATION = 2650;

/** Clip the crest to the part of each curtain column that still covers it, so the lift wipes it away in place. */
function clipToCurtain(artwork, columns) {
  const box = artwork.getBoundingClientRect();
  const strips = [];
  for (const column of columns) {
    const rect = column.getBoundingClientRect();
    if (!rect.width) continue;
    const left = Math.max(rect.left, box.left),
      right = Math.min(rect.right, box.right);
    if (right <= left) continue;
    strips.push({
      left: left - box.left,
      right: right - box.left,
      bottom: Math.max(0, Math.min(rect.bottom, box.bottom) - box.top),
    });
  }
  if (!strips.length || strips.every((strip) => strip.bottom >= box.height)) {
    artwork.style.clipPath = "";
    return;
  }
  const edge = strips
    .slice()
    .reverse()
    .flatMap((strip) => [`${strip.right}px ${strip.bottom}px`, `${strip.left}px ${strip.bottom}px`]);
  artwork.style.clipPath = `polygon(${strips[0].left}px 0, ${strips.at(-1).right}px 0, ${edge.join(", ")})`;
}

export default function CrestIntro({ onComplete }) {
  const artwork = useRef(null),
    curtain = useRef(null);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      onComplete();
      return;
    }
    let frame = requestAnimationFrame(function follow() {
      if (artwork.current && curtain.current) clipToCurtain(artwork.current, curtain.current.children);
      frame = requestAnimationFrame(follow);
    });
    const timer = setTimeout(onComplete, DURATION);
    const reduce = () => {
      if (motion.matches) onComplete();
    };
    motion.addEventListener("change", reduce);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      motion.removeEventListener("change", reduce);
    };
  }, [onComplete]);
  return (
    <div className="crest-intro" aria-hidden="true">
      <div className="curtain" ref={curtain}>
        {Array.from({ length: COLUMNS }, (_, index) => (
          <span key={index} className="curtain-column" />
        ))}
      </div>
      <svg ref={artwork} className="crest-artwork" viewBox="-10 -10 823 1044">
        {paths.map((path, index) => (
          <path
            key={index}
            d={path.d}
            pathLength="1"
            style={{ "--draw-delay": `${350 + Math.min(index * 14, 220)}ms` }}
          />
        ))}
      </svg>
    </div>
  );
}
