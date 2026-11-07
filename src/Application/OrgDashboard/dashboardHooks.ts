import { useEffect, useRef, useState } from "react";

/** Re-renders every `ms` so relative times ("12s ago") keep ticking. */
export function useNow(ms = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Counts up to `target` (and from the old value to a new one when a live update changes it). Timer-based rather than
 * requestAnimationFrame so it still finishes when the tab is in the background; jumps straight to the value for reduced motion.
 */
export function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  const shown = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || duration <= 0 || shown.current === target) {
      shown.current = target;
      setValue(target);
      return;
    }
    const from = shown.current;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const next = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      shown.current = next;
      setValue(next);
      if (t >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [target, duration]);
  return value;
}

/** True when the viewport matches the media query (e.g. the lg breakpoint). */
export function useMediaQuery(query: string) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return matches;
}
