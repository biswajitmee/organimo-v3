// src/loading/FirstFrameSignal.jsx
import { useEffect } from "react";
export default function FirstFrameSignal({ onReady }) {
  useEffect(() => {
    let raf;
    const tick = () => {
      try {
        // try reading WebGL canvas pixels existence or just first RAF
        if (typeof window.__R3F_FIRST_FRAME__ === 'undefined' || !window.__R3F_FIRST_FRAME__) {
          window.__R3F_FIRST_FRAME__ = true;
          if (onReady) try { onReady(); } catch(e){}
        }
      } catch (e) {}
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onReady]);
  return null;
}

// src/loading/CameraReadySignal.jsx
import { useEffect } from "react";
export default function CameraReadySignal() {
  useEffect(() => {
    // if your app sets window.__R3F_CAMERA_READY__ somewhere else, this is a no-op
    // else set it after short delay or when canvas exists
    const id = setTimeout(() => {
      window.__R3F_CAMERA_READY__ = true;
      console.info('[CameraReadySignal] setting window.__R3F_CAMERA_READY__ = true');
    }, 300); // tweak if needed
    return () => clearTimeout(id);
  }, []);
  return null;
}
