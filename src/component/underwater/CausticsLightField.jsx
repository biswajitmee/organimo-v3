// CausticsLightField.jsx
import React, { useMemo, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import CausticsLightProjector from './CausticsLightProjector'
import * as THREE from 'three'

export default function CausticsLightField({
  cell = 6000,
  density = 3,
  groundY = 0,
  // NEW: pass the actual moving camera/object (ref or object). If omitted, uses default camera.
  tracked = null,
  ...projProps
}) {
  const { camera } = useThree()
  const half = Math.max(0, Math.floor((density | 0) / 2))
  const count = useMemo(() => (2 * half + 1) ** 2, [half])
  const [gridCenter, setGridCenter] = useState({ cx: 0, cz: 0 })

  const tmp = new THREE.Vector3()

  useFrame(() => {
    // Read WORLD position from either the provided tracked object or the default camera
    const obj = tracked?.current ?? tracked ?? camera
    obj.getWorldPosition(tmp) // <-- critical when Theatre wraps the camera in groups
    const cx = Math.round(tmp.x / cell)
    const cz = Math.round(tmp.z / cell)
    // trigger rerender only when the snapped cell changes
    if (cx !== gridCenter.cx || cz !== gridCenter.cz) setGridCenter({ cx, cz })
  })

  const centers = useMemo(() => {
    const arr = []
    for (let dz = -half; dz <= half; dz++) {
      for (let dx = -half; dx <= half; dx++) {
        arr.push([ (gridCenter.cx + dx) * cell, groundY, (gridCenter.cz + dz) * cell ])
      }
    }
    return arr
  }, [gridCenter, cell, groundY, half])

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <CausticsLightProjector
          key={i}
          target={centers[i]}
          // pass through the same tracked object so distance gating uses world pos too
          tracked={tracked}
          {...projProps}
        />
      ))}
    </>
  )
}
