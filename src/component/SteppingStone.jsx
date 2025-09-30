// src/component/SteppingStoneOnSpring.jsx
import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

/**
 SteppingStoneOnSpring (export default as SteppingStone)
 - place bricks along a helix (same helix params you give to SpringPath)
 - props:
    count, turns, coilRadius, height, scale, brick, radialOffset, texturePath, seed
 - usage:
    <SteppingStone count={28} turns={...} coilRadius={...} scale={...} />
*/

class HelixCurve extends THREE.Curve {
  constructor ({ turns = 1, radius = 1, height = 1 } = {}) {
    super()
    this.turns = turns
    this.radius = radius
    this.height = height
  }
  getPoint (t, optionalTarget = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2
    const x = Math.cos(angle) * this.radius
    const z = Math.sin(angle) * this.radius
    const y = (t - 0.5) * this.height
    return optionalTarget.set(x, y, z)
  }
}

export default function SteppingStone ({
  count = 20,
  turns = 0.9,
  coilRadius = 1.0,
  height = 2.5,
  scale = 5,
  brick = { width: 10, height: 5, depth: 20 },
  radialOffset = 0.3,
  texturePath = '/textures/brick-texture.jpg',
  noiseW = 128,
  noiseH = 64,
  seed = 42,
  position = [0, 0, 0],
  rotation = [0, 0, 0]
}) {
  // load color texture
  const colorMap = useLoader(THREE.TextureLoader, texturePath)
  colorMap.encoding = THREE.sRGBEncoding
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping
  colorMap.repeat.set(1.2, 1.0)

  // small noise data texture for bump/roughness
  const noiseTex = useMemo(() => {
    const w = noiseW
    const h = noiseH
    const data = new Uint8Array(w * h)
    let s = seed
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x / w
        const ny = y / h
        let v = Math.floor(128 + 70 * (rand() - 0.5) + 20 * Math.sin((nx + ny * 0.5) * Math.PI * 4))
        v -= Math.floor(20 * Math.abs(Math.sin(ny * Math.PI * 6)))
        data[y * w + x] = Math.max(0, Math.min(255, v))
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.LuminanceFormat)
    tex.needsUpdate = true
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(2, 1)
    tex.encoding = THREE.LinearEncoding
    return tex
  }, [noiseW, noiseH, seed])

  // materials (6-face array) so top can be slightly different
  const materials = useMemo(() => {
    const sideMat = new THREE.MeshStandardMaterial({
      map: colorMap,
      roughnessMap: noiseTex,
      bumpMap: noiseTex,
      bumpScale: 0.04,
      roughness: 0.92,
      metalness: 0.02,
      color: new THREE.Color(0.92, 0.78, 0.82),
      side: THREE.FrontSide
    })
    const topMat = new THREE.MeshStandardMaterial({
      map: colorMap,
      roughness: 0.78,
      bumpMap: noiseTex,
      bumpScale: 0.012,
      metalness: 0.01,
      color: new THREE.Color(0.95, 0.86, 0.88),
      side: THREE.FrontSide
    })
    const bottomMat = new THREE.MeshStandardMaterial({
      map: colorMap,
      roughness: 0.96,
      bumpMap: noiseTex,
      bumpScale: 0.06,
      metalness: 0.0,
      color: new THREE.Color(0.6, 0.6, 0.65),
      side: THREE.FrontSide
    })
    return [sideMat, sideMat.clone(), topMat, bottomMat, sideMat.clone(), sideMat.clone()]
  }, [colorMap, noiseTex])

  // local curve and geometry
  const curve = useMemo(() => new HelixCurve({ turns, radius: coilRadius, height }), [
    turns,
    coilRadius,
    height
  ])

  const geometry = useMemo(
    () => new THREE.BoxGeometry(brick.width, brick.height, brick.depth, 6, 2, 2),
    [brick.width, brick.height, brick.depth]
  )

  // compute brick transforms
  const bricks = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      const t = i / count
      const localPoint = curve.getPointAt(t) // local coords (centered)
      const worldPoint = localPoint.clone().multiplyScalar(scale)

      // radial: outward in XZ plane (based on localPoint)
      const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
      if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)

      const outward = radial.clone().multiplyScalar((brick.depth / 2 + radialOffset) * scale)

      const finalPos = new THREE.Vector3(
        worldPoint.x + outward.x + position[0],
        worldPoint.y + position[1],
        worldPoint.z + outward.z + position[2]
      )

      // orientation: make brick depth face outward (z axis => radial), width roughly tangent
      const zAxis = radial.clone().normalize()
      const yAxis = new THREE.Vector3(0, 1, 0)
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
      const yOrtho = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
      const mat = new THREE.Matrix4().makeBasis(xAxis, yOrtho, zAxis)
      const quat = new THREE.Quaternion().setFromRotationMatrix(mat)

      arr.push({
        position: [finalPos.x, finalPos.y, finalPos.z],
        quaternion: quat.clone(),
        index: i
      })
    }
    return arr
  }, [count, curve, brick.depth, radialOffset, scale, position, brick.width, brick.height])

  return (
    <group position={position} rotation={rotation}>
      {bricks.map((b) => (
        <mesh
          key={b.index}
          geometry={geometry}
          material={materials}
          position={b.position}
          quaternion={b.quaternion}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
