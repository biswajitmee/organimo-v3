import { SpotLightHelper } from 'three';
import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export default function SunlightUnderwater({
  position = [0, 500, 0],     // above the water
  target = [0, -100, 0],      // pointing toward the terrain
  angle = 0.4,
  intensity = 3,
  distance = 2000,
  penumbra = 0.8,
  decay = 1,
  color = 0x88ccff,           // bluish light
}) {
  const lightRef = useRef();
  const targetRef = useRef();
  const { scene } = useThree();

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
      scene.add(targetRef.current);

      // Optional: visualize cone
      // const helper = new SpotLightHelper(lightRef.current);
      // scene.add(helper);
    }
  }, [scene]);

  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        angle={angle}
        intensity={intensity}
        distance={distance}
        penumbra={penumbra}
        decay={decay}
        color={color}
        castShadow
      />
      <object3D ref={targetRef} position={target} />
    </>
  );
}
