// InstancedSmokeTest.jsx
import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export default function NewCloudFloating({ count = 60 }) {
  const ref = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const positions = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      arr.push([(Math.random()-0.5)*200, (Math.random()-0.5)*60 + 10, (Math.random()-0.5)*60])
    }
    return arr
  }, [count])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (!ref.current) return
    for (let i = 0; i < count; i++) {
      const p = positions[i]
      const x = p[0] + (t * 10 * (0.4 + (i % 5)*0.05))
      const y = p[1] + Math.sin(t*0.6 + i)*3
      const z = p[2]
      dummy.position.set((x % 400) - 200, y, z)
      const s = 30 + (i % 5)*6
      dummy.scale.set(s, s*0.6, 1)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[null, null, count]}>
      <planeGeometry args={[1,1]} />
      <meshBasicMaterial color={'#ffffff'} transparent={true} opacity={0.9} />
    </instancedMesh>
  )
}
