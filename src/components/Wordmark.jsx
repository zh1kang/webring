'use client';

import {useEffect, useRef} from 'react';
import {mountWordmark} from '../wordmark.js';

export default function Wordmark() {
  const svg = useRef(null), reset = useRef(null);
  useEffect(() => mountWordmark(svg.current, reset.current), []);
  return <section className="wordmark-stage" aria-label="Firestoners wordmark">
    <h1 className="sr-only">Firestoners</h1>
    <svg ref={svg} id="wordmark" role="group" aria-label="Firestoners. Drag a box around the points to select them, then drag or use arrow keys to reshape the letters. Press Command or Control A to select all." />
    <div className="wordmark-tools"><button ref={reset} id="reset-wordmark" hidden>Reset</button></div>
  </section>;
}
