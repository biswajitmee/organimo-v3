// src/FirstFrameSignal.jsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function FirstFrameSignal({ onReady }) {
  const once = useRef(false);

  useFrame(() => {
    if (!once.current) {
      once.current = true;
      // paint settle next RAF — and set a persistent global flag (only once)
      requestAnimationFrame(() => {
        try {
          // only set once and never revert
          if (!window.__R3F_FIRST_FRAME__) window.__R3F_FIRST_FRAME__ = true;
        } catch (e) {
          // ignore restricted envs
        }
        onReady?.();
      });
    }
  }, 1);

  return null;
}
