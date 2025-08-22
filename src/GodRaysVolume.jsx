// GodRaysVolume.jsx
import * as THREE from 'three'
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'

export default function GodRaysVolume({
  origin = [0, -100, 0],
  target = [0, -800, -200],
  length = 900,
  endRadius = 10000,
  color = '#caa3ff',
  intensity = 0.3,
  noiseScale = 0.008,
  noiseSpeed = 0.15,
  opacity = 0.5,
}) {
  const mesh = useRef()

  const geom = useMemo(
    () => new THREE.ConeGeometry(endRadius, length, 64, 1, true),
    [endRadius, length]
  )

  // align cone Y+ to (target - origin), center cone mid-way
  useEffect(() => {
    const o = new THREE.Vector3().fromArray(origin)
    const t = new THREE.Vector3().fromArray(target)
    const dir = new THREE.Vector3().subVectors(t, o).normalize()
    const mid = o.clone().addScaledVector(dir, length * 0.5)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    mesh.current.position.copy(mid)
    mesh.current.quaternion.copy(q)
  }, [origin, target, length])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uOpacity: { value: opacity },
      uNoiseScale: { value: noiseScale },
      uNoiseSpeed: { value: noiseSpeed },
      uLen: { value: length }
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vPos;
      uniform vec3  uColor;
      uniform float uTime, uIntensity, uOpacity, uNoiseScale, uNoiseSpeed, uLen;

      // cheap 3d noise
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7, 74.7))) * 43758.5453123); }
      float noise(vec3 x){
        vec3 i = floor(x), f = fract(x);
        f = f*f*(3.0-2.0*f);
        float n =
          mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                  mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                  mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
        return n;
      }

      void main() {
        // radial fade to the cone wall
        float r = clamp(length(vPos.xz) / (abs(vPos.y) + 1.0), 0.0, 1.0);
        float edge = smoothstep(1.0, 0.2, 1.0 - r);

        // longitudinal fade (towards tip)
        float y = (vPos.y + 0.5*uLen) / uLen; // 0..1 along cone
        float axial = smoothstep(0.0, 0.25, y) * smoothstep(1.0, 0.6, y);

        // animated streaks
        float n = noise(vec3(vPos * uNoiseScale + uTime * uNoiseSpeed));
        float streaks = mix(0.6, 1.3, n);

        float a = edge * axial * streaks * uOpacity * uIntensity;
        gl_FragColor = vec4(uColor, a);
      }
    `
  }), [color, intensity, opacity, noiseScale, noiseSpeed, length])

  useFrame((_, dt) => { mat.uniforms.uTime.value += dt })

  return <mesh ref={mesh} geometry={geom} material={mat} />
}
