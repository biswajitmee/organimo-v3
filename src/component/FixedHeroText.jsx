// src/component/FixedHeroText.jsx
import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

export default function FixedHeroText({
  cameraRef,
  sheet = null,
  durationSec = 7,
  fadeMs = 1000,
  // how many viewport heights to keep visible when using scroll fallback
  useScrollHeightVhs = 2,
  localOffset = [0, -0.8, -4],
  fontSize = 0.45,
  maxWidth = 8
}) {
  const groupRef = useRef(null)
  const matRef = useRef(null)
  const rafRef = useRef(null)
  const mountedRef = useRef(true)
  const currentOpacityRef = useRef(1)
  const [visible, setVisible] = useState(true)

  // attach to camera once
  useEffect(() => {
    const cam = cameraRef && cameraRef.current
    const g = groupRef.current
    if (!cam || !g) return
    if (g.parent && g.parent !== cam) g.parent.remove(g)
    cam.add(g)
    if (Array.isArray(localOffset)) {
      g.position.set(localOffset[0], localOffset[1], localOffset[2])
    } else if (localOffset && typeof localOffset === 'object') {
      g.position.copy(localOffset)
    } else {
      g.position.set(0, -0.8, -4)
    }
    g.quaternion.set(0, 0, 0, 1)
    g.scale.set(1, 1, 1)
    g.renderOrder = 9999
    g.traverse(node => {
      if (node.isMesh) node.frustumCulled = false
    })
    return () => {
      try {
        if (g.parent === cam) cam.remove(g)
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRef])

  // helper: read theatre sequence seconds robustly
  function getSeqSeconds() {
    try {
      if (!sheet || !sheet.sequence) return null
      const rawPos = Number(sheet.sequence.position || 0)
      let fps = 60
      const ptr = sheet.sequence && sheet.sequence.pointer
      if (ptr) {
        if (typeof ptr.fps === 'number' && ptr.fps > 0) fps = ptr.fps
        else if (typeof ptr.frameRate === 'number' && ptr.frameRate > 0)
          fps = ptr.frameRate
      }
      return rawPos > 100 ? rawPos / fps : rawPos
    } catch (e) {
      return null
    }
  }

  // theatre-based opacity (0..1) or null if not applicable
  function theatreOpacity() {
    const seqSec = getSeqSeconds()
    if (seqSec === null) return null
    const fadeSec = Math.max(0.001, fadeMs / 1000)
    if (seqSec < 0) return 0
    if (seqSec < fadeSec) return seqSec / fadeSec
    if (seqSec < durationSec - fadeSec) return 1
    if (seqSec < durationSec)
      return 1 - (seqSec - (durationSec - fadeSec)) / fadeSec
    return 0
  }

  // scroll-based opacity using global offset (preferred), fallback to window.scrollY
  function scrollOpacity() {
    try {
      // prefer virtual offset exposed by Scene (0..1)
      const off = typeof window !== 'undefined' ? window._springScrollOffset : null
      if (typeof off === 'number') {
        // map offset (0..1) to pixels equivalence: use total visible range = useScrollHeightVhs * vh
        const vh = window.innerHeight || 1
        const limitPx = useScrollHeightVhs * vh
        // approximate scrollY = off * totalScrollablePx; but simpler: treat off*1 mapped to 0..limitPx
        // We assume offset=0 => top, offset increases => scrolled down.
        // We'll treat off * limitPx as 'y'
        const y = off * Math.max(limitPx, 1)
        if (y <= limitPx) return 1
        const over = Math.min(y - limitPx, fadeMs)
        const frac = Math.min(1, over / Math.max(1, fadeMs))
        return Math.max(0, 1 - frac)
      }

      // fallback to window.scrollY if no global offset available
      const vh2 = window.innerHeight || 1
      const limit = useScrollHeightVhs * vh2
      const y2 = window.scrollY || window.pageYOffset || 0
      if (y2 <= limit) return 1
      const over2 = Math.min(y2 - limit, fadeMs)
      const frac2 = Math.min(1, over2 / Math.max(1, fadeMs))
      return Math.max(0, 1 - frac2)
    } catch (e) {
      return 1
    }
  }

  // RAF loop: pick the more-visible source (max of theatre and scroll) and lerp opacity toward it
  useEffect(() => {
    mountedRef.current = true
    const lerpAmount = 0.14

    function tick() {
      if (!mountedRef.current) return
      const tOp = theatreOpacity() // null or 0..1
      const sOp = scrollOpacity() // 0..1
      const desired = Math.max(tOp === null ? 0 : tOp, sOp)

      const cur = currentOpacityRef.current
      const next = THREE.MathUtils.lerp(cur, desired, lerpAmount)
      currentOpacityRef.current = Number(next.toFixed(3))

      if (matRef.current) {
        matRef.current.opacity = currentOpacityRef.current
        matRef.current.transparent = true
        matRef.current.depthTest = false
      }

      const willShow = currentOpacityRef.current > 0.02
      if (willShow !== visible) setVisible(willShow)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      mountedRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, fadeMs, useScrollHeightVhs, durationSec])

  // also listen to native scroll as a fallback trigger to be snappy (touch devices)
  useEffect(() => {
    function onScrollNative() {
      // force one tick of RAF to re-evaluate quickly
      try {
        if (rafRef.current) return
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
        })
      } catch (e) {}
    }
    window.addEventListener('scroll', onScrollNative, { passive: true })
    window.addEventListener('touchmove', onScrollNative, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScrollNative)
      window.removeEventListener('touchmove', onScrollNative)
    }
  }, [])

  if (!visible) return null

  return (
    <group ref={groupRef}>
      <Text
        anchorX="left"
        anchorY="bottom"
        fontSize={fontSize}
        maxWidth={maxWidth}
        lineHeight={1}
        letterSpacing={-0.02}
        position={[0, 0, 0]}
      >
        {`Limitless\nbegins here.`}
        <meshBasicMaterial
          ref={matRef}
          attach="material"
          transparent
          depthTest={false}
          depthWrite={false}
          opacity={1}
        />
      </Text>
    </group>
  )
}
