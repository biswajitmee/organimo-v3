import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// optional Draco
// import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

let _manager = null;
export function getLoadingManager() {
  if (_manager) return _manager;
  _manager = new THREE.LoadingManager();
  return _manager;
}

// preload helpers
function preloadImages(urls = [], onFile) {
  return Promise.all(
    urls.map(
      (src) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => {
            onFile?.(src);
            res(src);
          };
          img.onerror = (e) => rej(e?.error || new Error("img failed: " + src));
          img.src = src;
        })
    )
  );
}
async function preloadJSON(urls = [], onFile) {
  const out = [];
  for (const u of urls) {
    const r = await fetch(u);
    const j = await r.json();
    onFile?.(u);
    out.push(j);
  }
  return out;
}
async function preloadGLBs(urls = [], onFile) {
  const manager = getLoadingManager();
  const gltfLoader = new GLTFLoader(manager);
  // const draco = new DRACOLoader(manager);
  // draco.setDecoderPath("/draco/");
  // gltfLoader.setDRACOLoader(draco);

  const results = [];
  for (const u of urls) {
    const glb = await gltfLoader.loadAsync(u);
    onFile?.(u);
    results.push(glb);
  }
  return results;
}

/**
 * useGlobalPreloader(assets, extraDomImages)
 * assets = { glbs:[], images:[], jsons:[] }
 * extraDomImages (optional) = CSS selector string for <img> in DOM to wait for
 */
export function useGlobalPreloader(assets, extraDomImages) {
  const manager = useMemo(getLoadingManager, []);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  const totalRef = useRef(0);
  const loadedRef = useRef(0);

  useEffect(() => {
    // body/root dark to prevent white flash
    document.documentElement.style.background = "#111";
    document.body.style.background = "#111";
  }, []);

  useEffect(() => {
    const glbs = assets?.glbs ?? [];
    const images = assets?.images ?? [];
    const jsons = assets?.jsons ?? [];

    // additionally include DOM <img> sources if asked
    const domImgs = [];
    if (extraDomImages) {
      document.querySelectorAll(extraDomImages).forEach((img) => {
        if (img?.src) domImgs.push(img.src);
      });
    }

    const listImages = [...images, ...domImgs];

    totalRef.current = glbs.length + listImages.length + jsons.length;
    loadedRef.current = 0;

    const bump = () => {
      loadedRef.current += 1;
      const p = Math.round((loadedRef.current / Math.max(1, totalRef.current)) * 100);
      setProgress(Math.min(100, p));
    };

    let cancelled = false;

    (async () => {
      try {
        await Promise.all([
          preloadGLBs(glbs, bump),
          preloadImages(listImages, bump),
          preloadJSON(jsons, bump),
        ]);

        if (cancelled) return;
        setDone(true);

        // double verification: fonts + document load + two RAFs
        const ensureAfterLoad = async () => {
          try {
            if (document.fonts?.ready) {
              await document.fonts.ready;
            }
          } catch (_) {}

          const onPaint = () =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                if (!cancelled) setReady(true);
              })
            );

          if (document.readyState === "complete") onPaint();
          else window.addEventListener("load", onPaint, { once: true });
        };

        await ensureAfterLoad();
      } catch (e) {
        console.error("Preload error:", e);
        setDone(true);
        setReady(true); // fail-open
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assets, manager, extraDomImages]);

  return { progress, done, ready, manager };
}
