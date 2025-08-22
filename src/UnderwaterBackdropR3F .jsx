import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useEffect } from 'react'

const vert = /* glsl */`
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Simple 2D worley-ish fbm (cheap), depth linearization & refraction blend
const frag = /* glsl */`
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform vec2 resolution;
uniform float time;
uniform vec3 waterA;
uniform vec3 waterB;
uniform float refractStrength;
uniform float shallowEdge;
uniform float deepEdge;

varying vec2 vUv;

float linearizeDepth(float z) {
  // z is non-linear depth buffer (0..1); convert to view-space linear depth
  float n = cameraNear;
  float f = cameraFar;
  return (2.0 * n) / (f + n - z * (f - n));
}

// cheap hash
float hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

// cheap worley-ish noise
float worley(vec2 uv) {
  uv *= 4.0;
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float m = 1.0;
  for (int y=-1; y<=1; y++) {
    for (int x=-1; x<=1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(i + g), hash(i + g + 19.19)) * 0.5 + 0.25;
      float d = length(g + o - f);
      m = min(m, d);
    }
  }
  return smoothstep(0.0, 1.0, m);
}

void main() {
  // animate noise
  float n0 = worley(vUv + vec2(0.0,  0.25 * time));
  float n1 = worley(vUv * 0.5 + vec2(0.0,  0.15 * time));
  float n  = n0 * n1;

  // vertical refraction (like demo uses screenUV + vec2(0, intensity))
  vec2 refractUV = vUv + vec2(0.0, n * refractStrength);

  // sample scene color at refracted uv & non-refracted (fallback)
  vec3 sceneBase = texture2D(tScene, vUv).rgb;
  vec3 sceneRefr = texture2D(tScene, refractUV).rgb;

  // depth-based alpha and color mix
  float depthRaw = texture2D(tDepth, refractUV).r;
  float depthLin = linearizeDepth(depthRaw);

  // shallow/deep blend (tweak ranges to taste)
  float edge = smoothstep(shallowEdge, deepEdge, depthLin); // 0 near -> 1 far
  vec3 waterCol = mix(waterA, waterB, clamp(n * 1.4, 0.0, 1.0));

  // blend refracted scene with water color by depth
  vec3 col = mix(sceneRefr, sceneRefr * waterCol, edge);

  // some vignette to taste (optional)
  vec2 q = vUv - 0.5;
  float vign = 1.0 - smoothstep(0.6, 0.95, dot(q,q) * 2.0);
  col *= mix(0.95, 1.0, vign);

  // final with a little transparency (more transparent when shallow)
  float alpha = mix(0.35, 0.9, edge);
  gl_FragColor = vec4(col, alpha);
}
`

/**
 * UnderwaterBackdropR3F
 * - Renders the entire current scene to an offscreen color+depth target each frame
 * - Then draws a full-screen-aligned water plane in front that refracts that color by noise
 * - Place it once in your scene (z in front of most content, y=0 is fine)
 * Props:
 *  - y: water height (world)
 *  - colorA, colorB: water gradient colors
 *  - refractStrength: distortion amount (0.0..0.2)
 *  - shallowEdge, deepEdge: linear-depth thresholds (tune per scene scale)
 */
export default function UnderwaterBackdropR3F({
  y = 0.0,
  colorA = '#0487e2',
  colorB = '#74ccf4',
  refractStrength = 0.08,
  shallowEdge = 0.02,
  deepEdge = 0.25,
}) {
  const mesh = useRef()
  const mat = useRef()

  const { gl, size, camera, scene } = useThree()

  // Render target with depthTexture
  const target = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(size.width, size.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    })
    rt.depthTexture = new THREE.DepthTexture(size.width, size.height)
    rt.depthTexture.type = THREE.UnsignedShortType
    rt.depthTexture.format = THREE.DepthFormat
    return rt
  }, []) // create once

  // Resize RT when viewport changes
  useEffect(() => {
    target.setSize(size.width, size.height)
    target.depthTexture.image = { width: size.width, height: size.height }
  }, [size, target])

  // Fullscreen plane in view space (always fills viewport)
  // We'll keep it as a big plane in world space, but resize every frame to cover frustum
  const geom = useMemo(() => new THREE.PlaneGeometry(2, 2, 1, 1), [])

  // Material
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        tScene: { value: null },
        tDepth: { value: null },
        cameraNear: { value: camera.near },
        cameraFar:  { value: camera.far },
        resolution: { value: new THREE.Vector2(size.width, size.height) },
        time: { value: 0 },
        waterA: { value: new THREE.Color(colorA) },
        waterB: { value: new THREE.Color(colorB) },
        refractStrength: { value: refractStrength },
        shallowEdge: { value: shallowEdge },
        deepEdge: { value: deepEdge },
      },
      transparent: true,
      depthWrite: false,
    })
    return m
  }, [])

  // Keep uniforms in sync with props / viewport
  useEffect(() => {
    material.uniforms.waterA.value.set(colorA)
    material.uniforms.waterB.value.set(colorB)
    material.uniforms.refractStrength.value = refractStrength
    material.uniforms.shallowEdge.value = shallowEdge
    material.uniforms.deepEdge.value = deepEdge
  }, [colorA, colorB, refractStrength, shallowEdge, deepEdge])

  useEffect(() => {
    material.uniforms.cameraNear.value = camera.near
    material.uniforms.cameraFar.value  = camera.far
  }, [camera.near, camera.far])

  useEffect(() => {
    material.uniforms.resolution.value.set(size.width, size.height)
  }, [size])

  useFrame(({ clock }) => {
    // 1) Render scene to color+depth target
    const prevAutoClear = gl.autoClear
    gl.autoClear = true
    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.autoClear = prevAutoClear

    // 2) Feed textures + time into shader, render the water plane last
    material.uniforms.tScene.value = target.texture
    material.uniforms.tDepth.value = target.depthTexture
    material.uniforms.time.value = clock.getElapsedTime()

    // Position plane right above y (slightly) so it overlays
    if (mesh.current) {
      mesh.current.position.set(0, y, 0)
      mesh.current.rotation.set(-Math.PI / 2, 0, 0)
      // scale large to fill frustum
      const s = 5000
      mesh.current.scale.setScalar(s)
    }
  })

  return (
    <mesh ref={mesh} geometry={geom} material={material} />
  )
}
