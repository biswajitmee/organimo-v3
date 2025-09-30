// src/component/SteppingStoneInstanced.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

/**
 * Instanced stepping stones along a helix
 *
 * Props:
 *  - count, turns, coilRadius, height, scale
 *  - brick: { width, height, depth }  (geometry units)
 *  - radialOffset (distance outward from pipe)
 *  - texturePath, noiseW, noiseH, seed
 *  - position, rotation
 */
class HelixCurve extends THREE.Curve {
  constructor ({ turns = 1, radius = 1, height = 1 } = {}) {
    super()
    this.turns = turns
    this.radius = radius
    this.height = height
  }
  // CENTERED helix: y in [-height/2, +height/2]
  getPoint (t, optionalTarget = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2
    const x = Math.cos(angle) * this.radius
    const z = Math.sin(angle) * this.radius
    const y = (t - 0.5) * this.height
    return optionalTarget.set(x, y, z)
  }
}

export default function springParams  ({
  count = 20,
  turns = 0.9,
  coilRadius = 1.0,
  height = 2.5,
  scale = 5,
  brick = { width: 3, height: 2, depth: 8 }, // smaller "world" defaults
  radialOffset = 0.08,
  texturePath = '/textures/brick-texture.jpg',
  noiseW = 128,
  noiseH = 64,
  seed = 42,
  position = [0, 0, 0],
  rotation = [0, 0, 0]
}) {
  // load color texture (optional)
  let colorMap = null
  try {
    colorMap = useLoader(THREE.TextureLoader, texturePath)
    colorMap.encoding = THREE.sRGBEncoding
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping
    colorMap.repeat.set(1.2, 1.0)
  } catch (e) {
    colorMap = null
  }

  // small noise texture
  const noiseTex = useMemo(() => {
    const w = Math.max(8, Math.floor(noiseW))
    const h = Math.max(4, Math.floor(noiseH))
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

  // single material for all instances
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: colorMap || undefined,
      roughnessMap: noiseTex,
      bumpMap: noiseTex,
      bumpScale: 0.02,
      roughness: 0.82,
      metalness: 0.02,
      color: new THREE.Color(0.93, 0.86, 0.88)
    })
  }, [colorMap, noiseTex])

  // geometry for a single brick (units: use small sizes if scale is world-scale)
  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(brick.width, brick.height, brick.depth, 6, 2, 2)
  }, [brick.width, brick.height, brick.depth])

  // curve in local space (unscaled)
  const curve = useMemo(() => new HelixCurve({ turns, radius: coilRadius, height }), [turns, coilRadius, height])

  const instRef = useRef()

  // compute transforms and fill instances
  useEffect(() => {
    if (!instRef.current) return
    const mesh = instRef.current
    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(1, 1, 1)

    for (let i = 0; i < count; i++) {
      // even spacing, offset half-step
      const t = (i + 0.5) / count
      const localPoint = new THREE.Vector3()
      curve.getPointAt(t, localPoint) // local coordinates (centered)

      // convert to world coordinates by applying provided "scale" as multiplier
      const worldPoint = localPoint.clone().multiplyScalar(scale)

      // radial outward in XZ plane (based on localPoint)
      const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
      if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)

      // outward offset (note: radialOffset is in same pre-scale units; we applied scale to worldPoint)
      const outwardDist = (brick.depth / 2 + radialOffset) * scale
      const outward = radial.clone().multiplyScalar(outwardDist)

      // final position (world)
      tmpPos.set(
        worldPoint.x + outward.x + position[0],
        worldPoint.y + position[1],
        worldPoint.z + outward.z + position[2]
      )

      // orientation: depth axis faces outward => set z-axis = radial
      const zAxis = radial.clone().normalize()
      const yAxis = new THREE.Vector3(0, 1, 0)
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
      const yOrtho = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
      const mat = new THREE.Matrix4().makeBasis(xAxis, yOrtho, zAxis)
      tmpQuat.setFromRotationMatrix(mat)

      // compose matrix (we keep instance scale 1:1 relative to geometry; geometry already uses brick sizes)
      tmpMat.compose(tmpPos, tmpQuat, tmpScale)

      mesh.setMatrixAt(i, tmpMat)
    }

    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true

    return () => {
      // no special cleanup per instance
    }
  }, [count, curve, brick.depth, radialOffset, scale, position, geometry, material])

  // cleanup geometry/material/textures on unmount
  useEffect(() => {
    return () => {
      try {
        geometry.dispose()
        material.dispose()
        if (colorMap && colorMap.dispose) colorMap.dispose()
        if (noiseTex && noiseTex.dispose) noiseTex.dispose()
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <group position={[0, 0, 0]} rotation={[0, 0, 0]}>
      <instancedMesh ref={instRef} args={[geometry, material, Math.max(1, count)]} castShadow receiveShadow />
    </group>
  )
}
