// UnderwaterBackdrop.jsx
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";

export default function UnderwaterBackdrop({
  waterRef,
  waterLevel = 0,
  radius = 6000,
  topColor = "#8A5BD1",
  bottomColor = "#1F1536",
  density = 0.0025,   // distance gradient strength
  feather = 3.0,      // match controller feather
}) {
  const { camera } = useThree();
  const mesh = useRef();

  const mat = useMemo(() => {
    const uniforms = {
      uTop:      { value: new THREE.Color(topColor) },
      uBottom:   { value: new THREE.Color(bottomColor) },
      uWaterY:   { value: 0 },
      uVisible:  { value: 0 },     // 0..1 fade based on underwater factor
      uDensity:  { value: density },
    };

    const v = /* glsl */`
      varying float vWorldY;
      varying float vViewZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldY = wp.y;
        vec4 mv = viewMatrix * wp;
        vViewZ = -mv.z;           // camera-space distance (positive forward)
        gl_Position = projectionMatrix * mv;
      }
    `;

    const f = /* glsl */`
      precision highp float;
      varying float vWorldY;
      varying float vViewZ;
      uniform vec3  uTop, uBottom;
      uniform float uWaterY, uVisible, uDensity;

      // Tiny blue noise to avoid banding (screen-space)
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

      void main(){
        // Height factor: 0 near surface, 1 deeper down
        float h = clamp((uWaterY - vWorldY) / 60.0, 0.0, 1.0);

        // Distance (exp fog curve in the backdrop itself)
        float d = 1.0 - exp(-uDensity * vViewZ);

        // Combine height + distance for a nice volumetric falloff
        float t = clamp(d * (0.35 + 0.65*h), 0.0, 1.0);

        vec3 col = mix(uTop, uBottom, t);

        // Dither
        float n = hash(gl_FragCoord.xy);
        col += (n - 0.5) * 0.01;

        gl_FragColor = vec4(col, uVisible);
      }
    `;

    const m = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: v,
      fragmentShader: f,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: false,    // draw behind everything, no z-fighting
    });
    return m;
  }, [topColor, bottomColor, density]);

  useFrame((_, dt) => {
    const waterY = waterRef?.current?.position?.y ?? waterLevel;
    // Follow camera so the dome always surrounds the view
    if (mesh.current) {
      mesh.current.position.copy(camera.position);
      // keep slightly under surface to avoid the clip plane edge
      mesh.current.position.y = Math.min(camera.position.y, waterY - 0.25);
    }
    // Fade in/out based on camera height relative to water
    const h = camera.position.y - waterY;
    const target = h >= 0 ? 0.0 : h <= -feather ? 1.0 : (-h / feather);
    mat.uniforms.uVisible.value += (target - mat.uniforms.uVisible.value) * Math.min(1.0, dt * 8.0);
    mat.uniforms.uWaterY.value = waterY;
  });

  return (
    <mesh ref={mesh} renderOrder={-1000}>
      <sphereGeometry args={[radius, 48, 32]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
