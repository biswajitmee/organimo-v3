// src/LoaderBridge.jsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useProgress } from "@react-three/drei";

/**
 * Debuggable LoaderBridge:
 * - Logs useProgress() values
 * - Creates a THREE.LoadingManager and exposes it on window.__LOADER_MANAGER__
 * - Calls window.__LOADER__.aim(...) with best-effort progress
 * - Adds a small fallback auto-increment when stuck
 */
export default function LoaderBridge() {
  const { active, progress, loaded, total, errors } = useProgress();
  const managerRef = useRef(null);
  const stuckTimerRef = useRef(null);
  const lastReported = useRef(0);
  const firedComplete = useRef(false);
  const fallbackProgress = useRef(0);
  const fallbackInterval = useRef(null);

  useEffect(() => {
    // create and expose LoadingManager so other parts can use it
    if (!managerRef.current) {
      const manager = new THREE.LoadingManager();
      manager.onStart = (url, itemsLoaded, itemsTotal) => {
        console.log("[LM] start", url, itemsLoaded, itemsTotal);
      };
      manager.onProgress = (url, itemsLoaded, itemsTotal) => {
        const p = Math.round((itemsLoaded / itemsTotal) * 100);
        console.log("[LM] progress", url, itemsLoaded, itemsTotal, p);
      };
      manager.onLoad = () => {
        console.log("[LM] all assets loaded");
      };
      manager.onError = (url) => {
        console.warn("[LM] error loading", url);
      };
      managerRef.current = manager;
      window.__LOADER_MANAGER__ = manager;
    }

    // ensure window.__LOADER__ exists
    if (!window.__LOADER__) {
      console.warn("window.__LOADER__ missing — index.html loader API not found");
    }

    return () => {
      // cleanup
      window.__LOADER_MANAGER__ = null;
      if (fallbackInterval.current) clearInterval(fallbackInterval.current);
    };
  }, []);

  useEffect(() => {
    // log drei useProgress values
    console.log("[useProgress]", { active, progress, loaded, total, errors });

    // choose source of truth:
    // prefer drei progress (0..100) when total > 0
    let aimValue = Math.round(progress);

    // If drei reports nothing (total == 0), fallback to our fallbackProgress
    if (total === 0) {
      aimValue = Math.max(aimValue, Math.round(fallbackProgress.current));
    }

    // monotonic enforcement: never go backward for visual stability
    aimValue = Math.max(lastReported.current, aimValue);
    lastReported.current = aimValue;

    try {
      window.__LOADER__ && window.__LOADER__.aim(aimValue);
    } catch (e) {
      // ignore
    }

    // if there are assets (total>0) and loaded==total -> trigger complete
    if (total > 0 && loaded >= total && !firedComplete.current) {
      firedComplete.current = true;
      console.log("[LoaderBridge] all tracked assets loaded -> requestCompleteSwap()");
      setTimeout(() => {
        try {
          window.__LOADER__ && window.__LOADER__.requestCompleteSwap && window.__LOADER__.requestCompleteSwap();
        } catch (e) {}
      }, 80);
    }

    // start fallback auto-increment if progress stuck low for a while
    if (!fallbackInterval.current) {
      let stuckSince = performance.now();
      fallbackInterval.current = setInterval(() => {
        const now = performance.now();
        // if no increase for > 600ms, nudge progress slightly (only up to 90)
        if (lastReported.current < 90) {
          fallbackProgress.current = Math.min(90, (fallbackProgress.current || 0) + 1);
          // push aim if drei not moving much
          if (total === 0 || Math.abs(progress - lastReported.current) < 0.5) {
            try { window.__LOADER__ && window.__LOADER__.aim(Math.max(lastReported.current, Math.round(fallbackProgress.current))); } catch {}
          }
        } else {
          // clear if we've reached near completion
          clearInterval(fallbackInterval.current);
          fallbackInterval.current = null;
        }
      }, 250); // nudge every 250ms
    }

    return () => {
      // don't clear fallback here—keep alive until unmount cleanup
    };
  }, [active, progress, loaded, total, errors]);

  return null;
}
