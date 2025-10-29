// src/ScrollOffsetBridgeCanvas.jsx
import { useFrame, useThree } from '@react-three/fiber';
import React from 'react';

export default function ScrollOffsetBridgeCanvas() {
  const { viewport, camera, size } = useThree();

  useFrame(() => {
    // If you want to expose viewport/camera to the outside JS:
    window._r3fViewport = {
      width: viewport.width,
      height: viewport.height,
      vw: size.width,
      vh: size.height
    };
    // expose camera position/rotation (cheap snapshot)
    if (camera) {
      window._r3fCameraPosition = camera.position.toArray();
      window._r3fCameraRotation = [camera.rotation.x, camera.rotation.y, camera.rotation.z];
    }
    // also sync lenis-normalized offset if available
    window._r3fScrollOffset = window._springScrollOffset ?? 0;
  });

  return null;
}
