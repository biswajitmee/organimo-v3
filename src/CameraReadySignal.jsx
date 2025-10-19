// src/CameraReadySignal.jsx
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export default function CameraReadySignal({ onReady }) {
  const once = useRef(false);
  const { camera } = useThree();

  useFrame(() => {
    if (once.current) return;

    if (!camera) return;

    // Basic sanity checks for camera being fully initialised:
    //  - position is finite
    //  - matrixWorld elements are finite
    //  - projectionMatrix elements are finite
    const ok = (() => {
      const p = camera.position;
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) return false;

      const mw = camera.matrixWorld?.elements;
      if (!mw || mw.length < 16) return false;
      for (let i = 0; i < mw.length; i++) if (!isFinite(mw[i])) return false;

      const pm = camera.projectionMatrix?.elements;
      if (!pm || pm.length < 16) return false;
      for (let i = 0; i < pm.length; i++) if (!isFinite(pm[i])) return false;

      return true;
    })();

    if (ok) {
      once.current = true;
      try { window.__R3F_CAMERA_READY__ = true; } catch (e) {}
      console.info("[CameraReadySignal] camera ready — setting window.__R3F_CAMERA_READY__ = true");
      onReady?.();
    }
  });

  return null;
}
