import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function CloudeGradiantShader({
  position = [0, 10, 0],
  scale = [5, 5, 5],
  color = '#FA8999',
  opacity = 0.5,
  speed = 0.1
}) {
  const mesh = useRef()
  const shaderMaterial = useRef()

  useFrame(({ clock }) => {
    if (shaderMaterial.current) {
      shaderMaterial.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh ref={mesh} position={position} scale={scale}>
      <planeGeometry args={[450, 50, 132, 132]} />
    <shaderMaterial
  ref={shaderMaterial}
  transparent
  depthWrite={false}
  side={THREE.DoubleSide}
  uniforms={{
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color('#ffffff') }, // Top color (pinkish)
    uColor2: { value: new THREE.Color('#FA8999') }, // Bottom color (white)
    uOpacity: { value: opacity },
    uSpeed: { value: speed }
  }}
  vertexShader={vertexShader}
  fragmentShader={fragmentShader}
/>

    </mesh>
  )
}

// Vertex Shader
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

// Fragment Shader with depth fading
const fragmentShader = `

varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor1; // Top
uniform vec3 uColor2; // Bottom
uniform float uOpacity;

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    total += noise(p) * amplitude;
    p *= 2.0;
    amplitude *= 0.5;
  }
  return total;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float dist = length(uv);

  vec2 offset = vec2(uTime * 0.03, uTime * 0.02);
  float n = fbm(uv * 3.0 + offset);

  float baseAlpha = smoothstep(0.8, 0.4, dist - n * 0.5);
  float edgeFade = smoothstep(0.8, 1.0, dist);

  float particle = step(0.5, fract(sin(dot(uv * 40.0, vec2(12.9898,78.233))) * 43758.5453 + uTime * 5.0));
  float particleAlpha = mix(1.0, particle, edgeFade);

  float finalAlpha = baseAlpha * particleAlpha * uOpacity;

  // 🎨 Gradient Color based on vUv.y
  vec3 gradientColor = mix(uColor2, uColor1, vUv.y); // bottom (0.0) to top (1.0)

  if(finalAlpha < 0.01) discard;

  gl_FragColor = vec4(gradientColor, finalAlpha);
}

`
