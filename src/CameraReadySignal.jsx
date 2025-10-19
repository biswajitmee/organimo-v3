import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export default function CameraReadySignal() {
  const { camera } = useThree();
  useEffect(() => {
    if (!camera) return;
    // set after next frame to ensure camera matrices applied
    requestAnimationFrame(() => {
      window.__R3F_CAMERA_READY__ = true;
      console.info("[CameraReadySignal] camera ready");
    });
  }, [camera]);
  return null;
}
