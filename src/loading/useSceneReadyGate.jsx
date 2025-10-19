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

  // extra checks
  const [cameraReady, setCameraReady] = useState(false);
  const [theatreReady, setTheatreReady] = useState(false);

  // monotonic percent (never decrease)
  const [lastPercent, setLastPercent] = useState(0);
  const percentDerived = useMemo(() => {
    if (total > 0) return Math.min(100, Math.round(progress));
    return busy ? 50 : 100; // fallback
  }, [total, progress, busy]);

  useEffect(() => {
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
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // CAMERA ready polling (in case CameraReadySignal sets a global flag)
  useEffect(() => {
    if (window.__R3F_CAMERA_READY__) {
      setCameraReady(true);
      console.info("[useSceneReadyGate] saw initial window.__R3F_CAMERA_READY__ = true");
      return;
    }
    let id = null;
    const check = () => {
      if (window.__R3F_CAMERA_READY__) {
        setCameraReady(true);
        console.info("[useSceneReadyGate] camera ready detected by polling");
        if (id) clearInterval(id);
      }
    };
    id = setInterval(check, 150);
    // fallback: after X ms assume camera ok (avoid indefinite hang)
    const fallback = setTimeout(() => {
      if (!window.__R3F_CAMERA_READY__) {
        console.warn("[useSceneReadyGate] camera readiness timeout — forcing cameraReady = true after 6000ms");
        setCameraReady(true);
      }
      if (id) clearInterval(id);
    }, 6000);
    return () => { if (id) clearInterval(id); clearTimeout(fallback); };
  }, []);

  // THEATRE project detection and ready wait
  useEffect(() => {
    let cancelled = false;
    async function waitForTheatre() {
      // first try any exported global project
      try {
        // common patterns people use: they import project and sometimes attach to window
        const win = window;
        // 1) if user placed their project on window explicitly
        if (win.__THEATRE_PROJECT__) {
          const p = win.__THEATRE_PROJECT__;
          if (p.ready) {
            // some versions have project.ready() returning a promise
            if (typeof p.ready === "function") {
              await p.ready();
            }
          }
          if (!cancelled) {
            setTheatreReady(true);
            console.info("[useSceneReadyGate] found window.__THEATRE_PROJECT__ and awaited ready()");
            return;
          }
        }

        // 2) If theatre core is available on window (studio integration), try to use getProject if exposed
        if (win.theatre?.getProject) {
          try {
            const maybeProject = win.theatre.getProject(); // if they used default name
            if (maybeProject) {
              if (maybeProject.ready) await maybeProject.ready();
              if (!cancelled) {
                setTheatreReady(true);
                console.info("[useSceneReadyGate] found theatre.getProject() and awaited ready()");
                return;
              }
            }
          } catch (e) {
            // ignore
          }
        }

        // 3) Poll for typical pattern: user imports projectState json and calls getProject(...) in their app.
        // We poll a bit for any project-like object on window
        const start = Date.now();
        while (!cancelled && Date.now() - start < 5000) {
          // quick scan for any object with ready/isReady
          for (const k in window) {
            try {
              const v = window[k];
              if (v && (typeof v === "object" || typeof v === "function")) {
                if ((v.ready && typeof v.ready === "function") || (typeof v.isReady !== "undefined")) {
                  // assume this is a Theatre Project or similar
                  if (v.ready) await v.ready();
                  if (!cancelled) {
                    setTheatreReady(true);
                    console.info("[useSceneReadyGate] discovered theatre-like object on window and awaited ready()");
                    return;
                  }
                }
              }
            } catch (e) {}
          }
          await new Promise((res) => setTimeout(res, 200));
        }

        // 4) fallback: if no theatre found within timeout, assume no theatre or not necessary
        if (!cancelled) {
          console.warn("[useSceneReadyGate] no Theatre project detected within timeout — marking theatreReady = true");
          setTheatreReady(true);
        }
      } catch (err) {
        console.error("[useSceneReadyGate] error while waiting theatre:", err);
        if (!cancelled) setTheatreReady(true);
      }
    }

    waitForTheatre();
    return () => { cancelled = true; };
  }, []);

  // DefaultLoadingManager busy state (covers custom loaders)
  useEffect(() => {
    const M = THREE.DefaultLoadingManager;
    const prev = { onStart: M.onStart, onLoad: M.onLoad, onError: M.onError, onProgress: M.onProgress };

    M.onStart = () => setBusy(true);
    M.onLoad = () => setBusy(false);
    M.onError = () => setBusy(false);
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

  const isFullyReadyComputed =
    assetsDone &&
    domReady &&
    fontsReady &&
    firstFrame &&
    cameraReady &&
    theatreReady &&
    !busy &&
    lastPercent === 100;

  if (isFullyReadyComputed) readyOnceRef.current = true;
  const isFullyReady = readyOnceRef.current || isFullyReadyComputed;

  // DEBUG logs (optional, helpful)
  useEffect(() => {
    console.groupCollapsed("[useSceneReadyGate] status");
    console.log("percent", lastPercent);
    console.log("assetsDone", assetsDone);
    console.log("domReady", domReady);
    console.log("fontsReady", fontsReady);
    console.log("firstFrame", firstFrame);
    console.log("cameraReady", cameraReady);
    console.log("theatreReady", theatreReady);
    console.log("busy", busy);
    console.log("isFullyReadyComputed", isFullyReadyComputed);
    console.log("isFullyReady (latched)", isFullyReady);
    console.groupEnd();
  }, [lastPercent, assetsDone, domReady, fontsReady, firstFrame, cameraReady, theatreReady, busy, isFullyReadyComputed, isFullyReady]);

  return { percent: lastPercent, isFullyReady };
}
