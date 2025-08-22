import * as THREE from 'three'
import React, { useMemo, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

export default function PerforatedLightMaskPlane({
  size = [3000, 1600],
  color = '#bcbcbc',
  density = 2.2,
  threshold = 0.48,
  warp = 0.35,
  speed = 0.35,
  ...props
}) {
  const stdMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide, // show both faces
    }),
    [color]
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDensity: { value: density },
      uThreshold: { value: threshold },
      uWarp: { value: warp },
      uSpeed: { value: speed },
    }),
    [density, threshold, warp, speed]
  )

  const HOLE_GLSL = `
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
    float n2(vec2 p){
      vec2 i=floor(p), f=fract(p);
      float a=h2(i), b=h2(i+vec2(1.,0.)), c=h2(i+vec2(0.,1.)), d=h2(i+vec2(1.,1.));
      vec2 u=f*f*(3.-2.*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
    }
    float fbm(vec2 p){
      float v=0., a=0.5; mat2 m=mat2(1.6,-1.2,1.2,1.6);
      for(int i=0;i<6;i++){ v+=a*n2(p); p=m*p; a*=0.5; }
      return v;
    }
    float holeField(vec2 uv, float t, float warp){
      vec2 q = uv;
      q += vec2(fbm(uv*3.0 + t*0.15), fbm(uv*3.0 - t*0.18)) * warp;
      return fbm(q*4.0 + t*0.10);
    }
  `

  // color pass (keeps PBR & shadows)
  useEffect(() => {
    stdMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)

      shader.vertexShader =
        `varying vec2 vUv;\n` +
        shader.vertexShader.replace(
          'void main() {',
          'void main(){ vUv = uv;'
        )

      shader.fragmentShader =
        `
        uniform float uTime, uDensity, uThreshold, uWarp, uSpeed;
        varying vec2 vUv;
        ${HOLE_GLSL}
        ` +
        shader.fragmentShader.replace(
          '#include <alphatest_fragment>',
          `
          float fld = holeField(vUv * uDensity + vec2(uTime * 0.05 * uSpeed), uTime * uSpeed, uWarp);
          float edge = smoothstep(uThreshold - 0.02, uThreshold + 0.02, fld);
          if (edge < 0.5) discard; // HOLE — let light pass
          #include <alphatest_fragment>
          `
        )
    }
    stdMat.needsUpdate = true
  }, [stdMat])

  // shadow passes need the same discard
  const depthMat = useMemo(
    () => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }),
    []
  )
  const distMat = useMemo(
    () => new THREE.MeshDistanceMaterial({ side: THREE.DoubleSide }),
    []
  )
  useEffect(() => {
    const patch = (mat) => {
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms)
        shader.vertexShader =
          `varying vec2 vUv;\n` +
          shader.vertexShader.replace('void main() {', 'void main(){ vUv = uv;')
        shader.fragmentShader =
          `
          uniform float uTime, uDensity, uThreshold, uWarp, uSpeed;
          varying vec2 vUv;
          ${HOLE_GLSL}
          ` +
          shader.fragmentShader.replace(
            'void main() {',
            `
            void main(){
              float fld = holeField(vUv * uDensity + vec2(uTime * 0.05 * uSpeed), uTime * uSpeed, uWarp);
              float edge = smoothstep(uThreshold - 0.02, uThreshold + 0.02, fld);
              if (edge < 0.5) discard; // keep holes in shadow maps
            `
          )
      }
      mat.needsUpdate = true
    }
    patch(depthMat)
    patch(distMat)
  }, [depthMat, distMat])

  useFrame((_, dt) => { uniforms.uTime.value += dt })

  return (
    <mesh
      material={stdMat}
      customDepthMaterial={depthMat}
      customDistanceMaterial={distMat}
      castShadow
      receiveShadow={false}
      {...props}
    >
      <planeGeometry args={[size[0], size[1], 1, 1]} />
    </mesh>
  )
}

function Ground() {
  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#383b45" roughness={1} metalness={0} />
    </mesh>
  )
}
