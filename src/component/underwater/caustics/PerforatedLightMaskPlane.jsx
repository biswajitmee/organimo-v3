// component/underwater/PerforatedLightMaskPlane.jsx
import * as THREE from 'three'
import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function PerforatedLightMaskPlane({
  visible = true,
  size = [4000, 4000],
  position = [0, -250, 0],
  rotation = [-Math.PI / 2, 0, 0],
  holeScale = 0.0008,
  holeThreshold = 0.45,
  feather = 0.08,
  speed = 0.05,
}) {
  const mesh = useRef()

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: false,   // use alphaTest cutout for shadow maps
    alphaTest: 0.5,
    depthWrite: true,
    uniforms: {
      uTime:   { value: 0 },
      uScale:  { value: holeScale },
      uThresh: { value: holeThreshold },
      uFeather:{ value: feather },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform float uTime;
      uniform float uScale;
      uniform float uThresh;
      uniform float uFeather;

      float hash(vec2 p){
        p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) +
               (c - a) * u.y * (1.0 - u.x) +
               (d - b) * u.x * u.y;
      }

      void main(){
        vec2 uv = vWorld.xz * uScale + vec2(uTime * 0.2, -uTime * 0.15);
        float n = 0.5 * noise(uv) + 0.5 * noise(uv * 1.9 + 7.31);
        float edge = smoothstep(uThresh - uFeather, uThresh + uFeather, n);
        if (edge < 0.5) discard;         // hole (lets light through)
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // solid
      }
    `,
  }), [holeScale, holeThreshold, feather])

  useFrame((_, dt) => { mat.uniforms.uTime.value += dt })

  return (
    <mesh
      ref={mesh}
      visible={visible}
      position={position}
      rotation={rotation}
      castShadow
    >
      <planeGeometry args={size} />
      <primitive attach="material" object={mat} />
    </mesh>
  )
}
