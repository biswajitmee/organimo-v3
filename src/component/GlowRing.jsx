// GlowRing.jsx
import * as THREE from 'three'
import React, { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const BLOOM_LAYER = 0
const bloomLayer = new THREE.Layers()
bloomLayer.set(BLOOM_LAYER)

export default function GlowRing({
  inner = 480,
  outer = 520,
  y = 5,
  color = '#ff66aa',
  bloomStrength = 0.3,
  bloomRadius = 0.6,
  bloomThreshold = 0.15
}) {
  const { scene, gl, camera, size } = useThree()
  const ringRef = useRef(null)
  const composerRef = useRef(null)
  const storedMaterials = useRef(new WeakMap())
  const darkMat = useRef(new THREE.MeshBasicMaterial({ color: 0x000000 })).current

  useEffect(() => {
    // create ring geometry + bright material (toneMapped=false so bloom picks it up reliably)
    const geo = new THREE.RingGeometry(inner, outer, 256)
    geo.rotateX(-Math.PI / 2)

    // use MeshBasicMaterial but make color very bright by multiplying; toneMapped=false is important
    const col = new THREE.Color(color)
    // multiply to make it "brighter" in HDR sense; bloom uses bright pixels
    col.multiplyScalar(4.0)

    const mat = new THREE.MeshBasicMaterial({
      color: col,
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true
    })

    const ring = new THREE.Mesh(geo, mat)
    ring.position.y = y
    ring.frustumCulled = false
    ring.renderOrder = 10000
    ring.layers.set(BLOOM_LAYER) // only this object goes to bloom pass
    scene.add(ring)
    ringRef.current = ring

    // setup composer
    const composer = new EffectComposer(gl)
    composer.setSize(size.width, size.height)
    composer.addPass(new RenderPass(scene, camera))

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    )
    composer.addPass(bloomPass)

    composerRef.current = { composer, bloomPass }

    // cleanup
    return () => {
      try { composer.dispose?.() } catch (e) {}
      try { geo.dispose() } catch (e) {}
      try { mat.dispose() } catch (e) {}
      try { scene.remove(ring) } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, gl, camera, size.width, size.height, inner, outer, y, color, bloomStrength, bloomRadius, bloomThreshold])

  // functions for selective bloom: darken non-bloom objects
  function darkenNonBloom(obj) {
    if (obj.isMesh) {
      // ensure material exists
      const mat = obj.material
      if (!mat) return
      if (!bloomLayer.test(obj.layers)) {
        if (!storedMaterials.current.has(obj)) storedMaterials.current.set(obj, mat)
        obj.material = darkMat
      }
    }
  }
  function restoreMaterials(obj) {
    if (obj.isMesh && storedMaterials.current.has(obj)) {
      obj.material = storedMaterials.current.get(obj)
      storedMaterials.current.delete(obj)
    }
  }

  // render loop: first bloom-only composer.render(); then normal gl.render
  useFrame(() => {
    const ref = composerRef.current
    if (!ref) {
      // fallback normal render handled by r3f
      return
    }

    // 1) render bloom pass: hide everything except bloom layer by replacing materials
    scene.traverse(darkenNonBloom)
    const prevMask = camera.layers.mask
    camera.layers.set(BLOOM_LAYER)

    try {
      ref.composer.render()
    } catch (e) {
      // ignore render errors
    }

    // restore
    scene.traverse(restoreMaterials)
    camera.layers.mask = prevMask

    // 2) normal render handled by r3f afterwards — we still allow r3f to do final render,
    // but ensure we don't double-render the composer result.
    // Because r3f will render scene normally, we don't call gl.render here.
    // If your app disables r3f auto render, uncomment next line:
    // gl.render(scene, camera)
  }, 1)

  return null
}
