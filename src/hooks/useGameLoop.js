// src/hooks/useGameLoop.js
// Reusable requestAnimationFrame loop hook

import { useEffect, useRef } from 'react';

/**
 * Drives a fixed-step game loop using requestAnimationFrame.
 *
 * @param {function} tick - (deltaMs: number, timestamp: number) => void
 * @param {boolean} active - whether the loop should run
 * @param {any[]} deps - extra dependencies that reset the loop
 */
export function useGameLoop(tick, active = true, deps = []) {
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const tickRef = useRef(tick);

  // Keep tick ref fresh without restarting the loop
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!active) return;

    lastTsRef.current = null;

    const loop = (ts) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const delta = Math.min(ts - lastTsRef.current, 50); // cap 50ms
      lastTsRef.current = ts;
      tickRef.current(delta, ts);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, ...deps]);
}
