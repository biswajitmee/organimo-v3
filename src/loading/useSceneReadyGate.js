// src/loading/useSceneReadyGate.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import * as THREE from "three";
import { useProgress } from "@react-three/drei";

export default function useSceneReadyGate() {
  const { active, loaded, total, progress } = useProgress(); // drei asset track
  const [domReady, setDomReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [busy, setBusy] = useState(false);

  // Keep monotonic percent (never decrease) to avoid flashing back.
  const [lastPercent, setLastPercent] = useState(0);
  const percentDerived = useMemo(() => {
    if (total > 0) return Math.min(100, Math.round(progress));
    return busy ? 50 : 100; // fallback
  }, [total, progress, busy]);

  useEffect(() => {
    // never let percent drop — only increase
    setLastPercent((prev) => Math.max(prev, percentDerived));
  }, [percentDerived]);

  // dark bg to avoid white flash
  useEffect(() => {
    document.documentElement.style.background = "#111";
    document.body.style.background = "#111";
  }, []);

  // DOM ready
  useEffect(() => {
    if (document.readyState === "complete") setDomReady(true);
    else {
      const onLoad = () => setDomReady(true);
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  // fonts ready
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
      } catch {}
      if (mounted) setFontsReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  // first frame flag (set by FirstFrameSignal)
  useEffect(() => {
    let raf;
    const tick = () => {
      try {
        if (window.__R3F_FIRST_FRAME__) setFirstFrame(true);
        else raf = requestAnimationFrame(tick);
      } catch (e) {
        // in unusual envs, set firstFrame true after timeout
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // DefaultLoadingManager busy state (covers custom loaders)
  useEffect(() => {
    const M = THREE.DefaultLoadingManager;
    const prev = { onStart: M.onStart, onLoad: M.onLoad, onError: M.onError, onProgress: M.onProgress };

    M.onStart = () => setBusy(true);
    M.onLoad = () => setBusy(false);
    M.onError = () => setBusy(false);
    // keep previous onProgress if any
    M.onProgress = prev.onProgress || (() => {});

    return () => {
      M.onStart = prev.onStart;
      M.onLoad = prev.onLoad;
      M.onError = prev.onError;
      M.onProgress = prev.onProgress;
    };
  }, []);

  // Compute assetsDone
  const assetsDone = useMemo(() => {
    if (total > 0) return (loaded >= total && active === 0);
    return !busy;
  }, [total, loaded, active, busy]);

  // Once fully ready, latch it (do not revert)
  const readyOnceRef = useRef(false);
  const isFullyReadyComputed = assetsDone && domReady && fontsReady && firstFrame && !busy && lastPercent === 100;

  if (isFullyReadyComputed) readyOnceRef.current = true;
  const isFullyReady = readyOnceRef.current || isFullyReadyComputed;

  return { percent: lastPercent, isFullyReady };
}
