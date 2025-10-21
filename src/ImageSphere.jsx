// src/ImageSphere.jsx
import * as THREE from 'three'
import React, { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useControls } from 'leva'

export default function ImageSphere() {
  const texture = useLoader(
    THREE.TextureLoader,
    'https://threejs.org/examples/textures/uv_grid_opengl.jpg' // same image repeat
  )

  // Leva GUI control
  const { gap, planeSize, radius } = useControls('Sphere Controls', {
    radius: { value: 3, min: 1, max: 6, step: 0.1 },
    planeSize: { value: 0.4, min: 0.1, max: 1, step: 0.05 },
    gap: { value: 0.25, min: 0, max: 1, step: 0.01 }
  })

  const instRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const W = 16
  const H = 8
  const total = (W + 1) * (H + 1)

  const matrices = useMemo(() => {
    const arr = []
    for (let y = 0; y <= H; y++) {
      const v = y / H
      const theta = v * Math.PI
      for (let x = 0; x <= W; x++) {
        const u = x / W
        const phi = u * Math.PI * 2

        const r = radius + Math.sin(theta) * gap // add gap outward
        const xpos = r * Math.sin(theta) * Math.cos(phi)
        const ypos = r * Math.cos(theta)
        const zpos = r * Math.sin(theta) * Math.sin(phi)

        dummy.position.set(xpos, ypos, zpos)
        dummy.lookAt(new THREE.Vector3(0, 0, 0))
        dummy.scale.set(planeSize, planeSize, planeSize)
        dummy.updateMatrix()
        arr.push(dummy.matrix.clone())
      }
    }
    return arr
  }, [W, H, gap, planeSize, radius])

  React.useEffect(() => {
    const inst = instRef.current
    if (!inst) return
    matrices.forEach((m, i) => inst.setMatrixAt(i, m))
    inst.instanceMatrix.needsUpdate = true
  }, [matrices])

  useFrame(() => {
    // optional auto spin
    // instRef.current.rotation.y += 0.001
  })

  return (
    <>
      <instancedMesh ref={instRef} args={[null, null, total]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          side={THREE.DoubleSide}
          transparent
        />
      </instancedMesh>
     </>
  )
}
