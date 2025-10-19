import { useEffect, useRef } from "react";
import { useProgress } from "@react-three/drei";

export default function PreloaderSync({ onDone }) {
  const { progress } = useProgress(); // 0–100 real loading
  const base = 38; // first CSS stage done till 38%
  const remain = 100 - base;
  const sent = useRef(-1);

  useEffect(() => {
    const api = window.__PRELOADER_API__;
    if (!api || !window.__PRELOADER_INITIAL_DONE__) return;

    const real = Math.min(100, Math.max(0, progress));
    const combined = base + Math.round((real / 100) * remain);

    if (sent.current !== combined) {
      sent.current = combined;
      api.update(combined);
    }

    if (combined >= 100) {
      setTimeout(() => {
        api.finish(500);
        onDone?.();
      }, 300);
    }
  }, [progress, onDone]);

  return null;
}
