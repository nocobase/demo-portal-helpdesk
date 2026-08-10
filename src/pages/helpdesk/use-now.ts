import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

let snapshot = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      snapshot = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
};

/**
 * One shared half-minute tick for every SLA countdown on screen. A per-cell
 * interval would work too, but a list of thirty tickets would then run thirty
 * timers that drift apart and re-render out of step.
 */
export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot
  );
}
