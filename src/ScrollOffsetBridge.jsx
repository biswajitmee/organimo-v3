// src/ScrollOffsetBridge.jsx
import { useFrame } from '@react-three/fiber'
import { useScroll } from '@react-three/drei'
import React, { useEffect, useRef } from 'react'

export default function ScrollOffsetBridge () {
  const scroll = useScroll()
  const firstSet = useRef(false)

  useFrame(() => {
    if (!scroll) return
    const v = Math.max(0, Math.min(1, scroll.offset || 0))
    window._springScrollOffset = v
    if (!firstSet.current) {
      firstSet.current = true
      // mark first frame ready so overlay can kick initial reveal
      window.__R3F_FIRST_FRAME__ = true
      // also optionally camera ready
      window.__R3F_CAMERA_READY__ = true
    }
  })

  // just a component that hooks into r3f frame loop
  return null
}
