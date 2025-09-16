// GradientSky.jsx — inverted dome with 3-stop vertical gradient
import * as THREE from 'three'
import React, { useMemo } from 'react'
import { useThree } from '@react-three/fiber'

export default function GradientSky({
  radius = 8000,
  topColor = '#f7cfe7',      // soft lavender-pink
  midColor = '#f5ddea',      // lighter band
  horizonColor = '#ffeef7',  // near-white at horizon
  midHeight = 0.35,          // 0..1 vertical stop for mid band
  horizonHeight = 0.12,      // 0..1 where it blends to horizon
  feather = 0.25,            // softness of bands
  exposure = 1.0,            // overall brightness
  renderOrder = -50,
  ...props
}) {
  const { gl } = useThree()

  const uniforms = useMemo(() => ({
    uTop:     { value: new THREE.Color(topColor).convertSRGBToLinear() },
    uMid:     { value: new THREE.Color(midColor).convertSRGBToLinear() },
    uHorizon: { value: new THREE.Color(horizonColor).convertSRGBToLinear() },
    uMidH:    { value: midHeight },
    uHorH:    { value: horizonHeight },
    uFeather: { value: feather },
    uExpo:    { value: exposure },
  }), [])

  const vert = /* glsl */`
    varying vec3 vWorld;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `

  const frag = /* glsl */`
    precision highp float;
    varying vec3 vWorld;

    uniform vec3 uTop, uMid, uHorizon;
    uniform float uMidH, uHorH, uFeather, uExpo;

    // remap helper
    float smoothBand(float x, float a, float b, float k){
      // softened step between a..b with feather k
      float t = smoothstep(a - k, a + k, x) * (1.0 - smoothstep(b - k, b + k, x));
      return clamp(t, 0.0, 1.0);
    }

    void main(){
      // normalize Y to 0..1 across a big dome (~world up)
      float y = clamp((normalize(vWorld).y * 0.5 + 0.5), 0.0, 1.0);

      // three-way mix: top -> mid -> horizon
      float tTop = smoothstep(uMidH, uMidH + uFeather, y);
      float tMid = smoothBand(y, uHorH, uMidH, uFeather*0.75);
      float tHor = 1.0 - smoothstep(uHorH, uHorH + uFeather, y);

      vec3 col = vec3(0.0);
      col += uTop     * tTop;
      col += uMid     * tMid;
      col += uHorizon * tHor;

      gl_FragColor = vec4(col * uExpo, 1.0);
    }
  `

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,    // look from inside
    depthWrite: false,
    depthTest: false,
    toneMapped: true,
  }), [])

  return (
    <mesh renderOrder={renderOrder} {...props} material={mat} scale={[radius, radius, radius]}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  )
}
