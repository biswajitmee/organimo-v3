// src/ScrollOffsetBridge.jsx
import React, { useEffect } from 'react';

/**
 * Hook-free ScrollOffsetBridge
 * - Does NOT use any react-three-fiber hooks
 * - Safe to render outside <Canvas>
 * - Publishes normalized offset and raw scrollY/velocity on window for other code to consume
 */
export default function ScrollOffsetBridge() {
  useEffect(() => {
    let rafId = null;

    function loop() {
      const offset = (typeof window !== 'undefined' && typeof window._springScrollOffset === 'number')
        ? window._springScrollOffset
        : 0;

      // publish convenience globals (your code / overlay can read these)
      window._r3fScrollOffset = offset;
      window._r3fScrollY = window._springScrollY ?? 0;
      window._r3fScrollVelocity = window._springScrollVelocity ?? 0;

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      // optional cleanup:
      // delete window._r3fScrollOffset;
      // delete window._r3fScrollY;
      // delete window._r3fScrollVelocity;
    };
  }, []);

  return null;
}
