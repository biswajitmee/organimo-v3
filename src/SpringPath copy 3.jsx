// src/SpringPath.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useLoader, useFrame } from '@react-three/fiber'

const vecFromArray = (a) => new THREE.Vector3(a[0], a[1], a[2])
const vecFromObj = (o) => new THREE.Vector3(o.x, o.y, o.z)

function evalCubicBezierVec(p0, p1, p2, p3, t, target = new THREE.Vector3()) {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t
  const v = new THREE.Vector3(0, 0, 0)
  v.addScaledVector(p0, uuu)
  v.addScaledVector(p1, 3 * uu * t)
  v.addScaledVector(p2, 3 * u * tt)
  v.addScaledVector(p3, ttt)
  return target.copy(v)
}
function sampleCubic(p0, p1, p2, p3, n) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push(evalCubicBezierVec(p0, p1, p2, p3, t, new THREE.Vector3()))
  }
  return out
}

function extractSamplesFromPathWorkshop(json, opts = {}) {
  const samplesPerSegment = typeof opts.samplesPerSegment === 'number' ? opts.samplesPerSegment : 40
  const out = []
  if (!json) return out
  const path = Array.isArray(json.paths) && json.paths.length ? json.paths[0] : null
  if (!path) return out

  // 1) prefer computed.samples
  if (path.computed && Array.isArray(path.computed.samples) && path.computed.samples.length > 0) {
    for (const p of path.computed.samples) {
      if (p && typeof p.x === 'number') out.push(new THREE.Vector3(p.x, p.y, p.z))
    }
    return out
  }

  // 2) computed.p0..p3
  if (path.computed && path.computed.p0 && path.computed.p3) {
    const p0 = vecFromObj(path.computed.p0)
    const p3 = vecFromObj(path.computed.p3)
    const p1 = path.computed.p1 ? vecFromObj(path.computed.p1) : null
    const p2 = path.computed.p2 ? vecFromObj(path.computed.p2) : null
    if (p1 && p2) {
      return sampleCubic(p0, p1, p2, p3, samplesPerSegment)
    } else {
      out.push(p0, p3)
      return out
    }
  }

  // 3) path.points
  if (Array.isArray(path.points) && path.points.length > 1) {
    for (const p of path.points) {
      if (Array.isArray(p) && p.length >= 3) out.push(vecFromArray(p))
      else if (p && typeof p.x === 'number') out.push(vecFromObj(p))
    }
    if (out.length > 1) return out
  }

  // 4) endpoints fallback -> cubic from rotations
  if (path.endpoints && (path.endpoints.aPos || path.endpoints.bPos)) {
    const a = path.endpoints.aPos ? vecFromObj(path.endpoints.aPos) : null
    const b = path.endpoints.bPos ? vecFromObj(path.endpoints.bPos) : null
    if (a && b) {
      const rotToForward = (rot) => {
        if (!rot) return new THREE.Vector3(0, 0, 1)
        const e = new THREE.Euler(
          THREE.MathUtils.degToRad(rot.x || 0),
          THREE.MathUtils.degToRad(rot.y || 0),
          THREE.MathUtils.degToRad(rot.z || 0),
          'YXZ'
        )
        return new THREE.Vector3(0, 0, 1).applyEuler(e).normalize()
      }
      const aDir = rotToForward(path.endpoints.aRot)
      const bDir = rotToForward(path.endpoints.bRot)
      const dist = a.distanceTo(b)
      const tangentScale = typeof opts.endpointTangentScale === 'number' ? opts.endpointTangentScale : 0.33
      const p1 = a.clone().add(aDir.multiplyScalar(dist * tangentScale))
      const p2 = b.clone().sub(bDir.multiplyScalar(dist * tangentScale))
      return sampleCubic(a, p1, p2, b, samplesPerSegment)
    }
  }

  // 5) deep find
  function deepCollect(node, collect = []) {
    if (!node) return collect
    if (Array.isArray(node)) {
      if (node.length === 3 && node.every((n) => typeof n === 'number')) {
        collect.push(new THREE.Vector3(node[0], node[1], node[2]))
        return collect
      }
      for (const el of node) deepCollect(el, collect)
    } else if (typeof node === 'object') {
      if (typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
        collect.push(new THREE.Vector3(node.x, node.y, node.z))
        return collect
      }
      for (const k in node) deepCollect(node[k], collect)
    }
    return collect
  }

  const deepFound = deepCollect(json, [])
  if (deepFound.length > 1) return deepFound

  return out
}

export default function SpringPath({
 
  count = 40,
  brick = { width: 3, height: 2, depth: 8 },
  radialOffset = 0,
  texturePath = '/textures/brick-texture.jpg',
  pathJson = null,
  pathPoints = null,
  samplesPerSegment = 40,
  cameraRef = null,
  hiddenDepth = 70,
  activationRange = 60,
  riseSpeed = 10,
  riseSmoothing = 0.6,
  showPath = true,
  pathColor = '#00ff00',
  pathSegments = 200,
  noiseW = 128,
  noiseH = 64,
  seed = 42,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1
}) {
  if (!pathJson && !pathPoints) {
    throw new Error('SpringPath: pathJson or pathPoints is required — no fallback path allowed.')
  }

  const instRef = useRef()

  /* textures/material */
  const colorMap = useLoader(THREE.TextureLoader, texturePath)
  try {
    colorMap.encoding = THREE.sRGBEncoding
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping
    colorMap.repeat.set(1.2, 1.0)
  } catch (e) {}

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

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: colorMap || undefined,
      roughnessMap: noiseTex,
      bumpMap: noiseTex,
      bumpScale: 0.02,
      roughness: 0.82,
      metalness: 0.02,
      color: new THREE.Color(0.93, 0.86, 0.88),
      side: THREE.DoubleSide
    })
  }, [colorMap, noiseTex])

  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(brick.width, brick.height, brick.depth, 6, 2, 2)
  }, [brick.width, brick.height, brick.depth])

  /* sampled points */
  const sampledPoints = useMemo(() => {
    if (Array.isArray(pathPoints) && pathPoints.length >= 2) {
      return pathPoints.map((p) => (Array.isArray(p) ? vecFromArray(p) : vecFromObj(p))).map(p => p.multiplyScalar(scale))
    }
    if (pathJson) {
      const pts = extractSamplesFromPathWorkshop(pathJson, { samplesPerSegment })
      if (pts && pts.length >= 2) return pts.map(p => p.clone().multiplyScalar(scale))
    }
    return [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]
  }, [pathJson, pathPoints, samplesPerSegment, scale])

  const curve = useMemo(() => {
    const pts = sampledPoints
    const closed = pts.length >= 3 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6
    return new THREE.CatmullRomCurve3(pts, closed, 'centripetal', 0.5)
  }, [sampledPoints])

  /* debug path geometry */
  const pathGeometry = useMemo(() => {
    if (!showPath) return null
    const pts = []
    const tmp = new THREE.Vector3()
    for (let i = 0; i <= pathSegments; i++) {
      curve.getPoint(i / pathSegments, tmp)
      pts.push(tmp.clone())
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [showPath, pathSegments, curve])

  /* instance state */
  const instanceBasePosRef = useRef([])
  const currentYRef = useRef(null)
  const velocityRef = useRef(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const n = Math.max(1, Math.floor(count))
    const base = []
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const p = new THREE.Vector3()
      curve.getPointAt(t, p)
      base.push(p)
    }
    instanceBasePosRef.current = base
    currentYRef.current = new Float32Array(n)
    velocityRef.current = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      currentYRef.current[i] = instanceBasePosRef.current[i].y - Math.abs(hiddenDepth)
      velocityRef.current[i] = 0
    }
    initializedRef.current = true

    // ensure instancedMesh has correct count & avoid frustum culling surprises
    const mesh = instRef.current
    if (mesh) {
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false // IMPORTANT: avoid whole-mesh invisible when instances spread
    }
  }, [curve, count, hiddenDepth])

  useFrame((state, delta) => {
    const mesh = instRef.current
    if (!mesh || !initializedRef.current) return

    const cam = cameraRef && cameraRef.current ? cameraRef.current : null
    const camPos = cam ? cam.position : null

    const n = Math.max(1, Math.floor(count))
    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(1, 1, 1)

    const dt = Math.min(0.05, delta)
    const riseFactor = Math.max(0.001, riseSpeed)

    for (let i = 0; i < n; i++) {
      const base = instanceBasePosRef.current[i]
      if (!base) continue

      let targetY = base.y - Math.abs(hiddenDepth)
      if (camPos) {
        const dist = camPos.distanceTo(base)
        if (dist < Math.max(0.0001, activationRange)) {
          let s = (activationRange - dist) / activationRange
          if (dist <= 4) s = 1
          const hold = 1.0
          const ascend = THREE.MathUtils.lerp(-Math.abs(hiddenDepth), hold, s)
          targetY = base.y + ascend
        } else {
          targetY = base.y - Math.abs(hiddenDepth)
        }
      }

      let curY = currentYRef.current[i]
      let vel = velocityRef.current[i] || 0
      vel += (targetY - curY) * riseFactor * dt
      vel *= Math.exp(-riseSmoothing * 6 * dt)
      let curNew = curY + vel * dt
      if (!isFinite(curNew)) curNew = targetY
      if (!isFinite(vel)) vel = 0
      currentYRef.current[i] = curNew
      velocityRef.current[i] = vel

      const t = (i + 0.5) / n
      const localPoint = new THREE.Vector3()
      curve.getPointAt(t, localPoint)

      const tangent = new THREE.Vector3()
      curve.getTangentAt(t, tangent).normalize()

      const up = new THREE.Vector3(0, 1, 0)
      let side = new THREE.Vector3().crossVectors(tangent, up).normalize()
      if (!isFinite(side.x) || side.lengthSq() < 1e-6) {
        side = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
        if (!isFinite(side.x) || side.lengthSq() < 1e-6) side.set(1, 0, 0)
      }

      const outwardDist = (brick.depth / 2 + radialOffset)
      const outward = side.clone().multiplyScalar(outwardDist)

      tmpPos.set(localPoint.x + outward.x + position[0], curNew + position[1], localPoint.z + outward.z + position[2])

      const zAxis = tangent.clone().normalize()
      const xAxis = side.clone().normalize()
      const yOrtho = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
      const mat = new THREE.Matrix4().makeBasis(xAxis, yOrtho, zAxis)
      tmpQuat.setFromRotationMatrix(mat)

      tmpMat.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMat)
    }

    // IMPORTANT: mark update and also ensure draw count ok
    mesh.count = Math.max(1, Math.floor(count))
    mesh.instanceMatrix.needsUpdate = true
    // avoid frustum culling hiding mesh unexpectedly
    mesh.frustumCulled = false
  })

  useEffect(() => {
    const mesh = instRef.current
    if (!mesh) return
    mesh.count = Math.max(1, Math.floor(count))
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
  }, [count])

  useEffect(() => {
    return () => {
      try {
        geometry.dispose()
        material.dispose()
        if (noiseTex && noiseTex.dispose) noiseTex.dispose()
      } catch (e) {}
    }
  }, [geometry, material, noiseTex])

  return (
    <group position={[0, 0, 0]} rotation={[...rotation]}>
      <instancedMesh ref={instRef} args={[geometry, material, Math.max(1, Math.floor(count))]} castShadow receiveShadow />
      {showPath && pathGeometry ? (
        <line geometry={pathGeometry}>
          <lineBasicMaterial color={pathColor} linewidth={2} depthTest={true} />
        </line>
      ) : null}
    </group>
  )
}
