import { useEffect, useMemo, useState, useRef } from "react";
import * as THREE from "three";
import { useProgress } from "@react-three/drei";

export default function useSceneReadyGate() {
  const { active, loaded, total, progress } = useProgress();
  const [domReady, setDomReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [theatreReady, setTheatreReady] = useState(true); // default true if not using theatre

  // monotonic percent
  const [lastPercent, setLastPercent] = useState(0);
  const percentDerived = useMemo(() => {
    if (total > 0) return Math.min(100, Math.round(progress || 0));
    return busy ? 50 : 100;
  }, [total, progress, busy]);

  useEffect(() => { setLastPercent(prev => Math.max(prev, percentDerived)); }, [percentDerived]);

  // dark background to prevent white flash
  useEffect(() => {
    document.documentElement.style.background = "#111";
    document.body.style.background = "#111";
  }, []);

  // DOM ready
  useEffect(() => {
    if (document.readyState === "complete") setDomReady(true);
    else {
      const fn = () => setDomReady(true);
      window.addEventListener("load", fn, { once: true });
      return () => window.removeEventListener("load", fn);
    }
  }, []);

  // fonts ready
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { if (document.fonts?.ready) await document.fonts.ready; } catch(e){}
      if (mounted) setFontsReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  // first frame: poll for window.__R3F_FIRST_FRAME__ set by FirstFrameSignal or similar
  useEffect(() => {
    let raf;
    const tick = () => {
      try {
        if (window.__R3F_FIRST_FRAME__) setFirstFrame(true);
        else raf = requestAnimationFrame(tick);
      } catch(e) { raf = requestAnimationFrame(tick); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // camera ready polling (set by CameraReadySignal)
  useEffect(() => {
    if (window.__R3F_CAMERA_READY__) { setCameraReady(true); return; }
    let id = setInterval(() => {
      if (window.__R3F_CAMERA_READY__) { setCameraReady(true); clearInterval(id); }
    }, 120);
    const fallback = setTimeout(() => { if (!window.__R3F_CAMERA_READY__) setCameraReady(true); clearInterval(id); }, 6000);
    return () => { clearInterval(id); clearTimeout(fallback); };
  }, []);

  // DefaultLoadingManager covering custom loaders
  useEffect(() => {
    const M = THREE.DefaultLoadingManager;
    const prev = { onStart: M.onStart, onLoad: M.onLoad, onError: M.onError, onProgress: M.onProgress };
    M.onStart = () => setBusy(true);
    M.onLoad = () => setBusy(false);
    M.onError = () => setBusy(false);
    M.onProgress = prev.onProgress || (() => {});
    return () => {
      M.onStart = prev.onStart; M.onLoad = prev.onLoad; M.onError = prev.onError; M.onProgress = prev.onProgress;
    };
  }, []);

  const assetsDone = useMemo(() => {
    if (total > 0) return (loaded >= total && active === 0);
    return !busy;
  }, [total, loaded, active, busy]);

  // final readiness
  const isFullyReady = assetsDone && domReady && fontsReady && firstFrame && cameraReady && theatreReady && !busy && lastPercent === 100;

  // debug console group
  useEffect(() => {
    console.groupCollapsed("[useSceneReadyGate] status");
    console.log("percent", lastPercent);
    console.log("assetsDone", assetsDone);
    console.log("domReady", domReady);
    console.log("fontsReady", fontsReady);
    console.log("firstFrame", firstFrame);
    console.log("cameraReady", cameraReady);
    console.log("busy", busy);
    console.log("isFullyReady", isFullyReady);
    console.groupEnd();
  }, [lastPercent, assetsDone, domReady, fontsReady, firstFrame, cameraReady, busy, isFullyReady]);

  return { percent: lastPercent, isFullyReady };
}
