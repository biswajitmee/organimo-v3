// UnderwaterController.jsx
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";

export default function UnderwaterController({
  waterRef,
  skyRef,
  waterLevel = 0,
  fogColorUnder = "#7D55C7",
  fogDensityUnder = 0.006,   // slightly lower = more “depth”, less solid
  feather = 3.0,
  tweakWater = true,
  clipAboveSurface = false,  // keep false so sand + caustics aren’t clipped
  useBackdrop = true,        // <<< NEW: when true, we don't set scene.background
  onUpdate,
}) {
  const { camera, scene, gl } = useThree();
  const fogColor = useMemo(() => new THREE.Color(fogColorUnder), [fogColorUnder]);

  useEffect(() => {
    if (!(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(fogColor.getHex(), 0.0);
    } else {
      scene.fog.color.copy(fogColor);
      scene.fog.density = 0.0;
    }
    return () => {
      gl.clippingPlanes = [];
      gl.localClippingEnabled = false;
    };
  }, [scene, fogColor, gl]);

  const waterBase = useRef({ reflectivity: 0.1, distortionScale: 3.7 });
  useEffect(() => {
    const w = waterRef?.current;
    if (w?.material?.uniforms) {
      const u = w.material.uniforms;
      if (typeof u.reflectivity?.value === "number") waterBase.current.reflectivity = u.reflectivity.value;
      if (typeof u.distortionScale?.value === "number") waterBase.current.distortionScale = u.distortionScale.value;
      w.material.side = THREE.DoubleSide;
      w.material.depthWrite = true;
      w.material.depthTest = true;
    }
  }, [waterRef]);

  const state = useRef({ u: 0 });
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const mapUnder = (h, f) => (h >= 0 ? 0 : h <= -f ? 1 : (f + -h) / f); // 0..1

  useFrame((_, dt) => {
    const waterY = waterRef?.current?.position?.y ?? waterLevel;
    const h = camera.position.y - waterY;
    const targetU = mapUnder(h, feather);
    const u = (state.current.u = damp(state.current.u, targetU, 8, dt));

    // Fog on geometry
    scene.fog.color.copy(fogColor);
    scene.fog.density = fogDensityUnder * u;

    // Sky visible only above water
    const underwater = u > 0.1;
    if (skyRef?.current) skyRef.current.visible = !underwater;

    // If we’re using a backdrop, leave scene.background alone (null).
    // Otherwise, fall back to a solid clear color.
    if (!useBackdrop) scene.background = underwater ? fogColor : null;

    // Optional water tweaks from below
    if (tweakWater && waterRef?.current?.material?.uniforms) {
      const U = waterRef.current.material.uniforms;
      if (U.reflectivity)    U.reflectivity.value    = THREE.MathUtils.lerp(waterBase.current.reflectivity, 0.04, u);
      if (U.distortionScale) U.distortionScale.value = THREE.MathUtils.lerp(waterBase.current.distortionScale, waterBase.current.distortionScale + 0.8, u);
    }

    // Don’t clip (keeps sand + caustics). If you ever re-enable, flip plane to keep underwater side.
    if (clipAboveSurface) {
      if (underwater) {
        gl.clippingPlanes = [ new THREE.Plane(new THREE.Vector3(0, -1, 0), waterY + 0.02) ];
        gl.localClippingEnabled = true;
      } else {
        gl.clippingPlanes = [];
        gl.localClippingEnabled = false;
      }
    }

    onUpdate?.({ u, waterY });
  });

  return null;
}
