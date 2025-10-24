// src/MountainSide.jsx
import * as THREE from 'three'
import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { TextureLoader, RepeatWrapping, LinearFilter } from 'three'

/**
 * MountainSide
 *
 * Drop-in component that renders a long, high-subdivided plane
 * displaced by a displacement map and shaded with a custom shader.
 *
 * Usage:
 *   <MountainSide />
 * or
 *   <MountainSide
 *     colorTextureURL="/textures/rock_color.jpg"
 *     displacementURL="/textures/rock_disp.jpg"
 *     normalMapURL="/textures/rock_nrm.jpg"
 *     width={12}
 *     height={28}
 *   />
 *
 * The component loads its own textures (defaults provided) so you can
 * simply import and place it inside your Canvas/Scene.
 */
export default function MountainSide({
  // geometry
  width = 12,
  height = 28,
  segmentsWidth = 256,
  segmentsHeight = 512,
  // displacement & look
  amplitude = 3.2,
  depth = 1.2,
  repeat = [4, 8], // tiling for the color map and displacement
  // texture urls (defaults - replace with your assets in /public/textures)
  colorTextureURL = '/textures/rock_color.jpg',
  displacementURL = '/textures/rock_disp.jpg',
  normalMapURL = '/textures/rock_nrm.jpg',
  // placement & misc
  rotation = [-Math.PI / 2, 0, 0],
  position = [0, -6, 0],
  timeSpeed = 0.08,
  wireframe = false,
  castShadow = false,
  receiveShadow = true,
  onLoaded = () => {},
}) {
  const meshRef = useRef()
  const materialRef = useRef()

  // load textures (color, displacement, normal optional)
  const urls = [colorTextureURL, displacementURL]
  if (normalMapURL) urls.push(normalMapURL)
  const textures = useLoader(TextureLoader, urls.filter(Boolean))

  const colorMap = textures[0] || null
  const dispMap = textures[1] || null
  const nMap = normalMapURL ? textures[2] : null

  // texture setup (tiling, filters)
  useEffect(() => {
    if (colorMap) {
      colorMap.wrapS = colorMap.wrapT = RepeatWrapping
      colorMap.repeat.set(repeat[0], repeat[1])
      colorMap.anisotropy = 8
      colorMap.minFilter = LinearFilter
    }
    if (dispMap) {
      dispMap.wrapS = dispMap.wrapT = RepeatWrapping
      dispMap.repeat.set(repeat[0], repeat[1])
      dispMap.minFilter = LinearFilter
    }
    if (nMap) {
      nMap.wrapS = nMap.wrapT = RepeatWrapping
      nMap.repeat.set(repeat[0], repeat[1])
      nMap.minFilter = LinearFilter
    }
    onLoaded({ colorMap, dispMap, nMap })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorMap, dispMap, nMap])

  // geometry args
  const geometryArgs = useMemo(() => [width, height, segmentsWidth, segmentsHeight], [
    width,
    height,
    segmentsWidth,
    segmentsHeight,
  ])

  // uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: amplitude },
      uDepth: { value: depth },
      uDisp: { value: dispMap || new THREE.Texture() },
      uMap: { value: colorMap || new THREE.Texture() },
      uNormalMap: { value: nMap || new THREE.Texture() },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.6).normalize() },
      uAmbient: { value: 0.35 },
      uSpecular: { value: 0.06 },
      uTimeSpeed: { value: timeSpeed },
      uViewPos: { value: new THREE.Vector3() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispMap, colorMap, nMap, amplitude, depth, timeSpeed]
  )

  // vertex shader: displacement along normal, slight animated noise for underwater subtle motion
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    uniform float uTime;
    uniform float uAmplitude;
    uniform float uDepth;
    uniform sampler2D uDisp;
    uniform float uTimeSpeed;

    // simple 2D noise (cheap)
    float snoise(vec2 p){
      return fract(sin(dot(p ,vec2(127.1,311.7))) * 43758.5453123);
    }

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);

      float disp = texture2D(uDisp, vUv).r;

      float t = uTime * uTimeSpeed;
      // micro-noise to avoid flat shading artifacts underwater
      float noise = (sin((vUv.x + vUv.y) * 40.0 + t * 3.0) * 0.5 + 0.5) * 0.02;
      // additional random jitter
      noise += (snoise(vUv * 100.0 + t) - 0.5) * 0.01;

      vec3 displaced = position + normal * (disp * uAmplitude - uDepth) + normal * noise;

      vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `

  // fragment shader: textured base, simple lambert + Blinn spec, distance fog for underwater blending
  const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    uniform sampler2D uMap;
    uniform sampler2D uNormalMap;
    uniform vec3 uLightDir;
    uniform float uAmbient;
    uniform float uSpecular;
    uniform vec3 uViewPos;

    void main() {
      vec3 base = texture2D(uMap, vUv).rgb;

      // use geometry normal (normalMap could be integrated for stronger features)
      vec3 N = normalize(vNormal);

      // lighting
      vec3 L = normalize(uLightDir);
      float NdotL = max(dot(N, L), 0.0);
      vec3 diffuse = base * NdotL;

      vec3 V = normalize(uViewPos - vWorldPos);
      vec3 H = normalize(L + V);
      float spec = pow(max(dot(N, H), 0.0), 16.0) * uSpecular;

      vec3 lit = base * (uAmbient + NdotL) + vec3(spec);

      // distance-based fog (underwater tint)
      float fogDist = 30.0;
      float fogFactor = smoothstep(0.0, fogDist, length(vWorldPos));
      vec3 waterTint = vec3(0.03, 0.07, 0.12);
      vec3 final = mix(lit, waterTint, clamp(fogFactor * 0.9, 0.0, 1.0));

      gl_FragColor = vec4(final, 1.0);
    }
  `

  // keep uniforms up to date when props change
  useEffect(() => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uAmplitude.value = amplitude
    materialRef.current.uniforms.uDepth.value = depth
    materialRef.current.uniforms.uDisp.value = dispMap || new THREE.Texture()
    materialRef.current.uniforms.uMap.value = colorMap || new THREE.Texture()
    materialRef.current.uniforms.uNormalMap.value = nMap || new THREE.Texture()
    materialRef.current.uniforms.uTimeSpeed.value = timeSpeed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amplitude, depth, dispMap, colorMap, nMap, timeSpeed])

  // animate uTime and view position for spec/fresnel calculations
  useFrame((state, delta) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value += delta
    // update view pos uniform
    materialRef.current.uniforms.uViewPos.value.copy(state.camera.position)
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {/* high-subdiv plane for displacement */}
      <planeGeometry args={geometryArgs} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        wireframe={wireframe}
      />
    </mesh>
  )
}
