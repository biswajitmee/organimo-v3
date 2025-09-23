// GlowRingWithBloom.jsx
import React, { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// IMPORTANT: these imports use Three's examples/ directory (vanilla composer)
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export default function GlowRingWithBloom({
  radius = 500,
  width = 60,
  intensity = 0.2,
  color = '#99d5ff',
  planeSize = 3000,
  opacity = 1.0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  billboard = false,
  // Bloom props (vanilla three UnrealBloomPass)
  useBloom = true,
  bloomStrength = 0.1,
  bloomRadius = 0.1,
  bloomThreshold = 0.1,
  // whether composer should replace normal renderer (true) or draw on top (false)
  composerActive = true,
  // z-index order: renderPass draws scene (the ring) then bloom; if you have other scene content,
  // consider how you order components in the Scene.
  ...props
}) {
  const meshRef = useRef()
  const materialRef = useRef()
  const composerRef = useRef()
  const { gl, scene, camera, size } = useThree()

  // --- SHADERS ---
  const vertex = /* glsl */ `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `
  const fragment = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_planeSize;
    uniform float ringRadius;
    uniform float ringWidth;
    uniform float intensity;
    uniform vec3 color;
    uniform float opacity;

    float gauss(float x, float sigma) {
      return exp(- (x*x) / (2.0 * sigma * sigma));
    }

    void main() {
      vec2 pos = (vUv - 0.5) * u_planeSize;
      float dist = length(pos);
      float halfW = max(0.0001, ringWidth * 0.5);
      float d = dist - ringRadius;
      float edge = 1.0 - smoothstep(-halfW, halfW, d);
      float glow = gauss(d / (ringWidth * 0.9), 1.0);
      float rim = pow(edge, 1.0);
      float combined = clamp(rim * 1.3 + glow * intensity, 0.0, 2.5);
      vec3 col = color * combined;
      float a = clamp(combined * opacity, 0.0, 1.0);
      gl_FragColor = vec4(col * a, a);
    }
  `

  // --- UNIFORMS ---
  const uniforms = useMemo(() => ({
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(size.width, size.height) },
    u_planeSize: { value: planeSize },
    ringRadius: { value: radius },
    ringWidth: { value: width },
    intensity: { value: intensity },
    color: { value: new THREE.Color(color) },
    opacity: { value: opacity }
  }), [planeSize, radius, width, intensity, color, opacity, size.width, size.height])

  // create material once
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }), [vertex, fragment])

  // keep material updated when props change
  useEffect(() => {
    material.uniforms.ringRadius.value = radius
    material.uniforms.ringWidth.value = width
    material.uniforms.intensity.value = intensity
    material.uniforms.opacity.value = opacity
    material.uniforms.u_planeSize.value = planeSize
    material.uniforms.color.value.set(color)
  }, [radius, width, intensity, opacity, planeSize, color, material])

  // --- POST-PROCESSING SETUP (vanilla Three.js) ---
  useEffect(() => {
    // create composer using the same gl renderer
    const composer = new EffectComposer(gl)
    composerRef.current = composer

    // RenderPass draws the full scene
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    // Bloom pass (only add if requested)
    let bloomPass = null
    if (useBloom) {
      bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), bloomStrength, bloomRadius, bloomThreshold)
      composer.addPass(bloomPass)
    }

    // resize handler
    function onResize() {
      composer.setSize(size.width, size.height)
      // update pixel ratio if you desire:
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    }
    onResize()

    return () => {
      // cleanup
      try {
        composer.dispose()
      } catch (e) {}
      composerRef.current = null
    }
    // note: we intentionally do not include scene or camera in deps because those are stable in r3f
    // include gl or size changes to recreate if renderer instance changes
  }, [gl, size.width, size.height, useBloom, bloomStrength, bloomRadius, bloomThreshold, scene, camera])

  // update composer size on react-three-fiber resize
  useEffect(() => {
    const comp = composerRef.current
    if (!comp) return
    comp.setSize(size.width, size.height)
    comp.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  }, [size.width, size.height])

  // update time uniform and render using composer in useFrame
  useFrame(({ clock }, delta) => {
    if (material) material.uniforms.u_time.value = clock.getElapsedTime()

    // If composerActive -> render via composer; otherwise let r3f render normally
    if (composerActive && composerRef.current) {
      // important: prevent r3f from clearing before composer runs
      // r3f automatically renders the scene; to avoid double render we render composer and request that r3f skip default?
      // Simpler approach: let r3f handle its normal render but then overwrite with composer render
      // so composer.render() after r3f render:
      composerRef.current.render(delta)
    }
  }, 1) // priority 1 to run after r3f render (default priority is 0). This ensures composer draws after r3f.
  // NOTE: If you see double renders or flicker, set gl.autoClear = false once on mount and manage clearing manually.

  // optional: set gl.autoClear = false to manage clears manually (uncomment if needed)
  // useEffect(() => { const prev = gl.autoClear; gl.autoClear = false; return () => { gl.autoClear = prev } }, [gl])

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      {...props}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <primitive object={material} attach="material" ref={materialRef} />
    </mesh>
  )
}
