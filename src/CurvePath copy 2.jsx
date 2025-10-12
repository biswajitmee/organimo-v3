// src/CurvePath.jsx
import React, { forwardRef, useImperativeHandle, useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'

const defaultProps = {
  turns: 0.6,
  coilRadius: 0.5,
  pathHeight: 2,
  pathScale: 1,
  samples: 160,
  showLine: true,
  lineColor: '#00ffff',
  lineRadius: 0.12,
  hiddenBrickCount: 128,
  hiddenBrickSize: [0.01, 0.01, 0.01],
  showHiddenHelpers: false,

  // bricks (visible) options - SpringPath like
  bricks: true,
  brickCount: 32,
  brick: { width: 3, height: 2, depth: 8 },
  radialOffset: 0,
  brickColor: '#d16b50',
  texturePath: null // optional: '/textures/brick-texture.jpg'
}

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

const CurvePath = forwardRef(function CurvePath (props, ref) {
  const p = { ...defaultProps, ...props }
  const {
    turns,
    coilRadius,
    pathHeight,
    pathScale,
    samples,
    showLine,
    lineColor,
    hiddenBrickCount,
    hiddenBrickSize,
    showHiddenHelpers,

    bricks,
    brickCount,
    brick,
    radialOffset,
    brickColor,
    texturePath
  } = p

  // refs
  const curveRef = useRef()
  const helperInstRef = useRef()
  const instBricksRef = useRef()
  const lineMeshRef = useRef()

  // curve object
  const curve = useMemo(() => new HelixCurve({ turns, radius: Math.max(0.0001, coilRadius), height: pathHeight }), [turns, coilRadius, pathHeight])

  // precompute points and Frenet frames
  const { points, tangents, normals, binormals } = useMemo(() => {
    const pts = []
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const v = new THREE.Vector3()
      curve.getPoint(t, v)
      pts.push(v.clone().multiplyScalar(pathScale))
    }
    const frames = curve.computeFrenetFrames(samples, true)
    const tangs = frames.tangents.map(v => v.clone())
    const norms = frames.normals.map(v => v.clone())
    const bins = frames.binormals.map(v => v.clone())
    return { points: pts, tangents: tangs, normals: norms, binormals: bins }
  }, [curve, samples, pathScale])

  // build line geometry once
  useEffect(() => {
    if (!showLine || points.length === 0) return
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    if (lineMeshRef.current) {
      try { lineMeshRef.current.geometry?.dispose() } catch (e) {}
      lineMeshRef.current.geometry = geo
    } else {
      lineMeshRef.current = { geometry: geo }
    }
    return () => {
      try { geo.dispose() } catch (e) {}
    }
  }, [points, showLine])

  // helper instanced tiny boxes (hidden debug)
  useEffect(() => {
    const mesh = helperInstRef.current
    if (!mesh) return
    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(...hiddenBrickSize)

    const count = Math.max(1, hiddenBrickCount)
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      const floatIdx = t * samples
      const idx = Math.floor(floatIdx)
      const idxNext = Math.min(samples, idx + 1)
      const frac = floatIdx - idx

      const pLow = points[idx]
      const pHigh = points[idxNext]
      const position = new THREE.Vector3().lerpVectors(pLow, pHigh, frac)

      const tA = tangents[idx].clone().lerp(tangents[idxNext], frac).normalize()
      const nA = normals[idx].clone().lerp(normals[idxNext], frac).normalize()

      const zAxis = tA.clone().normalize()
      let xAxis = nA.clone()
      xAxis.addScaledVector(zAxis, -xAxis.dot(zAxis)).normalize()
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()

      const mat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
      tmpQuat.setFromRotationMatrix(mat)
      tmpPos.copy(position)
      tmpMat.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMat)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = count
  }, [helperInstRef.current, points, tangents, normals, binormals, hiddenBrickCount, hiddenBrickSize, samples])

  // instantiate visible bricks along curve (SpringPath-like)
  useEffect(() => {
    const mesh = instBricksRef.current
    if (!mesh || !bricks) return

    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(1, 1, 1) // geometry already sized

    const count = Math.max(1, Math.floor(brickCount))
    for (let i = 0; i < count; i++) {
      // distribute along 0..1 (center each brick with 0.5/count offset like SpringPath)
      const t = (i + 0.5) / count
      // map t to curve sample (we can get continuous pose using linear interpolation between samples)
      const floatIdx = THREE.MathUtils.clamp(t * samples, 0, samples)
      const idx = Math.floor(floatIdx)
      const idxNext = Math.min(samples, idx + 1)
      const frac = floatIdx - idx

      // position in local (curve-group) space
      const pLow = points[idx]
      const pHigh = points[idxNext]
      const localPoint = new THREE.Vector3().lerpVectors(pLow, pHigh, frac) // already scaled by pathScale

      // radial (x,z) direction for outward vector
      const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
      if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)

      // outward offset like spring
      const outwardDist = (brick.depth / 2 + radialOffset) * pathScale
      const outward = radial.clone().multiplyScalar(outwardDist)

      // world/local final pos = localPoint + outward
      tmpPos.set(localPoint.x + outward.x, localPoint.y, localPoint.z + outward.z)

      // orientation: build basis from tangent/normal (use precomputed frames)
      const tA = tangents[idx].clone().lerp(tangents[idxNext], frac).normalize()
      const nA = normals[idx].clone().lerp(normals[idxNext], frac).normalize()

      const zAxis = tA.clone().normalize() // forward along path
      let xAxis = nA.clone()
      // ensure orthogonality
      xAxis.addScaledVector(zAxis, -xAxis.dot(zAxis)).normalize()
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()

      const mat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
      tmpQuat.setFromRotationMatrix(mat)

      tmpMat.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMat)
    }

    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    // compute bounds for raycasting / frustum
    try {
      mesh.geometry.computeBoundingBox()
      mesh.geometry.computeBoundingSphere()
    } catch (e) {}
  }, [instBricksRef.current, points, tangents, normals, samples, brickCount, brick.depth, radialOffset, pathScale, bricks])

  // expose API to parent like before
  useImperativeHandle(ref, () => ({
    getPoint: (t, target = new THREE.Vector3()) => {
      const tt = THREE.MathUtils.clamp(t, 0, 1)
      curve.getPoint(tt, target)
      return target.clone().multiplyScalar(pathScale)
    },
    getPoseAt: (t) => {
      const tt = THREE.MathUtils.clamp(t, 0, 1)
      const floatIdx = tt * samples
      const low = Math.floor(floatIdx)
      const high = Math.min(samples, low + 1)
      const frac = floatIdx - low

      const pLow = points[low]
      const pHigh = points[high]
      const position = new THREE.Vector3().lerpVectors(pLow, pHigh, frac)

      const tA = tangents[low].clone().lerp(tangents[high], frac).normalize()
      const nA = normals[low].clone().lerp(normals[high], frac).normalize()
      const bA = binormals[low].clone().lerp(binormals[high], frac).normalize()

      const zAxis = tA.clone().normalize()
      let xAxis = nA.clone()
      xAxis.addScaledVector(zAxis, -xAxis.dot(zAxis)).normalize()
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()

      const mat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(mat)

      return { position: position.clone(), quaternion, tangent: zAxis.clone() }
    },
    getSamplesCount: () => samples,
    getRawFrames: () => ({
      points: points.map(p => p.clone()),
      tangents: tangents.map(v => v.clone()),
      normals: normals.map(v => v.clone()),
      binormals: binormals.map(v => v.clone())
    })
  }), [curve, points, tangents, normals, binormals, pathScale, samples])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (lineMeshRef.current && lineMeshRef.current.geometry) lineMeshRef.current.geometry.dispose()
      } catch (e) {}
    }
  }, [])

  // prepare brick geometry & material only once (memo)
  const brickGeometry = useMemo(() => {
    return new THREE.BoxGeometry(brick.width, brick.height, brick.depth, 6, 2, 2)
  }, [brick.width, brick.height, brick.depth])

  const brickMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(brickColor),
      roughness: 0.8,
      metalness: 0.02,
      side: THREE.DoubleSide
    })
    if (texturePath) {
      try {
        const loader = new THREE.TextureLoader()
        const tx = loader.load(texturePath)
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping
        tx.encoding = THREE.sRGBEncoding
        tx.repeat.set(1.2, 1)
        mat.map = tx
      } catch (e) {}
    }
    return mat
  }, [brickColor, texturePath])

  // dispose material/geometry on unmount
  useEffect(() => {
    return () => {
      try {
        brickGeometry.dispose()
        brickMaterial.dispose()
      } catch (e) {}
    }
  }, [brickGeometry, brickMaterial])

  return (
    <group ref={curveRef} position={[0, 0, 0]}>
      {showLine && points && points.length > 0 ? (
        <line>
          <bufferGeometry attach="geometry" {...(lineMeshRef.current ? { args: [] } : {})} />
          <lineBasicMaterial color={lineColor} linewidth={1} />
        </line>
      ) : null}

      {/* visible bricks instanced like springPath */}
      {bricks ? (
        <instancedMesh
          ref={instBricksRef}
          args={[brickGeometry, brickMaterial, Math.max(1, Math.floor(brickCount))]}
          castShadow
          receiveShadow
        />
      ) : null}

      {/* hidden helper tiny boxes */}
      <instancedMesh
        ref={helperInstRef}
        args={[new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: showHiddenHelpers }), Math.max(1, hiddenBrickCount)]}
        visible={showHiddenHelpers}
      />
    </group>
  )
})

export default CurvePath
