// src/SimpleLoader.jsx (UPDATED to match new API & rules)
import { useEffect, useRef } from "react";
import { useProgress } from "@react-three/drei";
import { gsap } from "gsap";

export default function SimpleLoader() {
  const { progress, active } = useProgress(); // progress 0..100, active true while loading
  const requestedMorph = useRef(false);

  // Drive the ring toward real loading (50→100), monotonic & speed-limited by index.html
  useEffect(() => {
    const L = window.__LOADER__;
    if (!L) return;
    const mapped = 50 + Math.max(0, Math.min(100, progress)) / 2; // 50..100
    L.aim(mapped);
  }, [progress]);

  // When truly ready: (progress==100 && active==false) then morph request.
  useEffect(() => {
    const L = window.__LOADER__;
    if (!L || requestedMorph.current) return;
    if (progress >= 100 && active === false) {
      // wait 2 RAF frames to guarantee first frame rendered behind loader
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestedMorph.current = true;
          L.requestCompleteSwap(); // circle -> pill after visual reaches 100% + 1s
        });
      });
    }
  }, [progress, active]);

  // Fade the actual app when loader proceeds (handled inside index.html after long-press)
  useEffect(() => {
    const onDone = () => gsap.to("#root", { opacity: 1, duration: 0.8, ease: "power2.out" });
    window.addEventListener("APP_LOADER_DONE", onDone, { once: true });
    return () => window.removeEventListener("APP_LOADER_DONE", onDone);
  }, []);

  return null;
}
