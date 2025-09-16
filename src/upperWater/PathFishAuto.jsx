// PathFishAuto.jsx
import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Fish } from './Fish'

export function PathFishAuto({
  points = [
    [0, 0.5, 0],
    [3, 0.5, -2],
    [6, 0.5, -4],
    [9, 0.5, -2],
    [6, 0.5, 1],
    [2, 0.5, 2.5],
  ],
  speed = 2,
  loop = true,
  showPath = true,
  fishScale = 0.02,
}) {
  const curve = useMemo(() => {
    const pts = points.map((p) => new THREE.Vector3(...p))
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
  }, [points])

  const linePoints = useMemo(() => curve.getSpacedPoints(200), [curve])
  const length = useMemo(() => curve.getLength(), [curve])

  const fishGroup = useRef()
  const progress = useRef(0)

  const tmpPos = new THREE.Vector3()
  const tmpTan = new THREE.Vector3()
  const tmpUp = new THREE.Vector3(0, 1, 0)
  const mat = new THREE.Matrix4()
  const quat = new THREE.Quaternion()

  useFrame((_, dt) => {
    progress.current = loop
      ? (progress.current + (speed * dt) / length) % 1
      : Math.min(progress.current + (speed * dt) / length, 1)

    const t = progress.current
    curve.getPointAt(t, tmpPos)
    curve.getTangentAt(t, tmpTan).normalize()

    const target = tmpPos.clone().add(tmpTan)
    mat.lookAt(tmpPos, target, tmpUp)
    quat.setFromRotationMatrix(mat)

    if (fishGroup.current) {
      fishGroup.current.position.copy(tmpPos)
      fishGroup.current.quaternion.copy(quat)
    }
  })

  return (
    <>
      {showPath && (
        <Line points={linePoints} color="white" lineWidth={2} transparent opacity={0.6} />
      )}
      <group ref={fishGroup} scale={fishScale}>
        <Fish />
      </group>
    </>
  )
}
