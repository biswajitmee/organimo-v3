import { useFrame } from '@react-three/fiber'
import { useScroll } from '@react-three/drei'
import React from 'react'

export default function ScrollOffsetBridge () {
  const scroll = useScroll()
  // keep last to avoid unnecessary writes
  let last = 0
  useFrame(() => {
    if (!scroll) return
    const v = typeof scroll.offset === 'number' ? scroll.offset : 0
    if (Math.abs(v - last) > 1e-5) {
      window._springScrollOffset = v
      last = v
    }
  })
  return null
}
