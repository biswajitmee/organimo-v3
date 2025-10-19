// src/SpringPath.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useLoader, useFrame } from '@react-three/fiber'

class HelixCurve extends THREE.Curve {
  constructor({ turns = 1, radius = 1, height = 1 } = {}) {
    super()
    this.turns = turns
    this.radius = radius
    this.height = height
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2
    const x = Math.cos(angle) * this.radius
    const z = Math.sin(angle) * this.radius
    const y = (t - 0.5) * this.height
    return optionalTarget.set(x, y, z)
  }
}

export default function SpringPath({
  count = 40,
  turns = 0.95,
  coilRadius = 5.0,
  height = 10,
  scale = 5,
  brick = { width: 2, height: 2, depth: 5 },
  radialOffset = 0.0,
  texturePath = '/textures/brick-texture.jpg',
  noiseW = 128,
  noiseH = 64,
  seed = 42,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  showPath = true,
  pathColor = '#00ffff',
  pathSegments = 400,
  startOffset = 0.0, // NEW: shift along path (0..1, wraps)

  // camera-driven props (these come from ScrollSection)
  activeIndexRef = { current: 0 }, // fractional index from scroll (raw)
  activeRadius = 4,
  activeFade = 3,
  downAmplitude = 7.0,
  frontHold = 1,

  // curvature
  curvatureEnabled = true,
  curvatureStrength = 2.0,
  curvatureRange = 6,
  curvatureFalloff = 3,

  // floating
  floatEnabled = false,
  floatSpeed = 1.0,
  rotationIntensity = 0.6,
  floatIntensity = 1.0,
  floatingRange = [-0.2, 0.2],

  // smoothing for Y animation (0..1, higher = faster follow)
  riseSmoothing = 0.12
}) {
  const instRef = useRef()

  // texture loader (Suspense in Canvas)
  let colorMap = null
  try {
    colorMap = useLoader(THREE.TextureLoader, texturePath)
    colorMap.encoding = THREE.sRGBEncoding
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping
    colorMap.repeat.set(1.2, 1.0)
  } catch (e) {
    colorMap = null
  }

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
        let v =
          Math.floor(
            128 + 70 * (rand() - 0.5) + 20 * Math.sin((nx + ny * 0.5) * Math.PI * 4)
          )
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

  const curve = useMemo(() => new HelixCurve({ turns, radius: coilRadius, height }), [turns, coilRadius, height])

  // base matrices + animated Y store
  const baseMatricesRef = useRef(null)
  const currentYsRef = useRef(null)
  // per-instance metadata for floating/phase
  const baseMetaRef = useRef(null)

  // live prop refs (to avoid re-registering closures in useFrame)
  const activeRadiusRef = useRef(activeRadius)
  const activeFadeRef = useRef(activeFade)
  const downAmpRef = useRef(downAmplitude)
  const frontHoldRef = useRef(frontHold)

  const curvatureEnabledRef = useRef(curvatureEnabled)
  const curvatureStrengthRef = useRef(curvatureStrength)
  const curvatureRangeRef = useRef(curvatureRange)
  const curvatureFalloffRef = useRef(curvatureFalloff)

  const floatEnabledRef = useRef(floatEnabled)
  const floatSpeedRef = useRef(floatSpeed)
  const rotationIntensityRef = useRef(rotationIntensity)
  const floatIntensityRef = useRef(floatIntensity)
  const floatingRangeRef = useRef(floatingRange)

  useEffect(() => { activeRadiusRef.current = activeRadius }, [activeRadius])
  useEffect(() => { activeFadeRef.current = activeFade }, [activeFade])
  useEffect(() => { downAmpRef.current = downAmplitude }, [downAmplitude])
  useEffect(() => { frontHoldRef.current = frontHold }, [frontHold])

  useEffect(() => { curvatureEnabledRef.current = curvatureEnabled }, [curvatureEnabled])
  useEffect(() => { curvatureStrengthRef.current = curvatureStrength }, [curvatureStrength])
  useEffect(() => { curvatureRangeRef.current = curvatureRange }, [curvatureRange])
  useEffect(() => { curvatureFalloffRef.current = curvatureFalloff }, [curvatureFalloff])

  useEffect(() => { floatEnabledRef.current = floatEnabled }, [floatEnabled])
  useEffect(() => { floatSpeedRef.current = floatSpeed }, [floatSpeed])
  useEffect(() => { rotationIntensityRef.current = rotationIntensity }, [rotationIntensity])
  useEffect(() => { floatIntensityRef.current = floatIntensity }, [floatIntensity])
  useEffect(() => { floatingRangeRef.current = floatingRange }, [floatingRange])

  // normalize startOffset into [0,1)
  const normalizedOffset = ((startOffset % 1) + 1) % 1

  // build base instance matrices and metadata once (or when inputs change)
  useEffect(() => {
    const mesh = instRef.current
    if (!mesh) return

    mesh.frustumCulled = false

    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(1, 1, 1)

    const baseMats = []
    const currentYs = []
    const meta = []

    // deterministic pseudo-random for per-instance phase values
    let s = seed
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }

    for (let i = 0; i < count; i++) {
      // apply startOffset: shift along path for every instance
      const tRaw = (i + 0.5) / count
      const t = (tRaw + normalizedOffset) % 1

      const localPoint = new THREE.Vector3()
      curve.getPointAt(t, localPoint)

      const worldPoint = localPoint.clone().multiplyScalar(scale)

      const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
      if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)

      const outwardDist = (brick.depth / 2 + radialOffset) * scale
      const outward = radial.clone().multiplyScalar(outwardDist)

      tmpPos.set(
        worldPoint.x + outward.x + position[0],
        worldPoint.y + position[1],
        worldPoint.z + outward.z + position[2]
      )

      const zAxis = radial.clone().normalize()
      const yAxis = new THREE.Vector3(0, 1, 0)
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
      const yOrtho = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
      const mat = new THREE.Matrix4().makeBasis(xAxis, yOrtho, zAxis)
      tmpQuat.setFromRotationMatrix(mat)

      tmpMat.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMat)

      const mClone = tmpMat.clone()
      baseMats.push({ mat: mClone, pos: new THREE.Vector3().setFromMatrixPosition(mClone) })

      // initialize currentY same as base pos.y
      currentYs.push(tmpPos.y)

      // per-instance floating phases
      meta.push({
        floatPhase: rand() * Math.PI * 2,
        rotPhase: rand() * Math.PI * 2
      })
    }

    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    baseMatricesRef.current = baseMats
    currentYsRef.current = currentYs
    baseMetaRef.current = meta

    try { mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere() } catch (e) {}
    return () => {}
  }, [count, curve, brick.depth, radialOffset, scale, position, geometry, material, seed, normalizedOffset])

  // per-frame animation: drive Y based on activeIndexRef (fractional)
  useFrame((state) => {
    const mesh = instRef.current
    const base = baseMatricesRef.current
    const currentYs = currentYsRef.current
    const meta = baseMetaRef.current
    if (!mesh || !base || !currentYs) return

    const time = state.clock.elapsedTime
    const actIdxF = (activeIndexRef?.current != null) ? activeIndexRef.current : 0

    const radius = Math.max(0, activeRadiusRef.current || 0)
    const fade = Math.max(0.0001, activeFadeRef.current || 1)
    const amp = downAmpRef.current || 0
    const front = Math.max(0, frontHoldRef.current || 0)

    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(1, 1, 1)

    // stable dt clamp
    const dt = Math.min(0.06, state.clock.delta) || (1/60)
    // per-frame lerp derived from riseSmoothing
    const perFrameLerp = 1 - Math.exp(- (Math.max(0.01, riseSmoothing) * 60) * dt)

    for (let i = 0; i < Math.min(base.length, mesh.count); i++) {
      const b = base[i]
      const m = b.mat
      const basePos = b.pos.clone()

      const brickCenterIdx = i + 0.5
      let distance
      if (brickCenterIdx > actIdxF) {
        distance = brickCenterIdx - (actIdxF + front)
        if (distance < 0) distance = 0
      } else {
        distance = Math.abs(brickCenterIdx - actIdxF)
      }

      // determine target Y: inside radius => base Y; outside => lowered by amp (interpolated by fade)
      let targetY
      if (distance <= radius) {
        targetY = basePos.y
      } else {
        const over = distance - radius
        const factor = Math.min(1, over / fade)
        targetY = basePos.y - amp * factor
      }

      // lerp currentY toward target using perFrameLerp
      const curY = currentYs[i] != null ? currentYs[i] : basePos.y
      const newY = THREE.MathUtils.lerp(curY, targetY, perFrameLerp)
      currentYs[i] = newY
      tmpPos.copy(basePos)
      tmpPos.y = newY

      // start with base quaternion
      tmpQuat.setFromRotationMatrix(m)

      // curvature: lateral offset & slight yaw
      if (curvatureEnabledRef.current) {
        let distanceForCurve
        if (brickCenterIdx > actIdxF) {
          distanceForCurve = brickCenterIdx - (actIdxF + front)
          if (distanceForCurve < 0) distanceForCurve = 0
        } else {
          distanceForCurve = Math.abs(brickCenterIdx - actIdxF)
        }

        const range = Math.max(0, curvatureRangeRef.current || 0)
        const fall = Math.max(0.0001, curvatureFalloffRef.current || 1)

        if (distanceForCurve <= range + fall) {
          const over = Math.max(0, distanceForCurve - range)
          const influence = 1 - Math.min(1, over / fall)

          const radialXZ = new THREE.Vector3(basePos.x, 0, basePos.z).normalize()
          if (!isFinite(radialXZ.x) || radialXZ.lengthSq() < 1e-6) radialXZ.set(1, 0, 0)
          const lateral = new THREE.Vector3(-radialXZ.z, 0, radialXZ.x).normalize()

          const wiggle = Math.sin((i - actIdxF) * 0.6)
          const offsetMag = curvatureStrengthRef.current * influence * wiggle

          const offset = lateral.multiplyScalar(offsetMag)
          tmpPos.add(offset)

          const yaw = Math.atan2(offset.x, offset.z) * 0.35 * influence
          const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
          tmpQuat.multiply(yawQ)
        }
      }

      // floating: subtle time-based bob & rotation on top of target Y
      if (floatEnabledRef.current && meta && meta[i]) {
        const speed = floatSpeedRef.current || 1.0
        const fIntensity = floatIntensityRef.current || 1.0
        const rotInt = rotationIntensityRef.current || 0.6
        const [rmin, rmax] = floatingRangeRef.current && floatingRangeRef.current.length === 2
          ? floatingRangeRef.current
          : [-0.1, 0.1]
        const famp = (rmax - rmin) * 0.5 * fIntensity
        const fmid = (rmax + rmin) * 0.5

        const yOff = Math.sin(time * speed + (meta[i].floatPhase || 0)) * famp + fmid
        tmpPos.y += yOff

        const rx = Math.sin(time * speed * 0.9 + (meta[i].rotPhase || 0)) * 0.02 * rotInt
        const ry = Math.cos(time * speed * 1.1 + (meta[i].rotPhase || 0)) * 0.02 * rotInt
        const rz = Math.sin(time * speed * 1.3 + (meta[i].floatPhase || 0)) * 0.02 * rotInt

        const rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))
        tmpQuat.multiply(rotQ)
      }

      tmpMat.compose(tmpPos, tmpQuat, tmpScale)
      mesh.setMatrixAt(i, tmpMat)
    }

    mesh.instanceMatrix.needsUpdate = true
  })

  const pathGeometry = useMemo(() => {
    if (!showPath) return null
    const pts = []
    const outwardDist = (brick.depth / 2 + radialOffset) * scale
    const v = new THREE.Vector3()
    for (let i = 0; i <= pathSegments; i++) {
      const t = ((i / pathSegments) + normalizedOffset) % 1
      curve.getPointAt(t, v)
      const worldPoint = v.clone().multiplyScalar(scale)
      const radial = new THREE.Vector3(v.x, 0, v.z).normalize()
      if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
      const outward = radial.clone().multiplyScalar(outwardDist)
      const final = new THREE.Vector3(
        worldPoint.x + outward.x + position[0],
        worldPoint.y + position[1],
        worldPoint.z + outward.z + position[2]
      )
      pts.push(final)
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [showPath, pathSegments, curve, brick.depth, radialOffset, scale, position, normalizedOffset])

  useEffect(() => {
    return () => {
      try {
        geometry.dispose()
        material.dispose()
        if (colorMap && colorMap.dispose) colorMap.dispose()
        if (noiseTex && noiseTex.dispose) noiseTex.dispose()
      } catch (e) {}
    }
  }, []) // eslint-disable-line

  return (
    <group position={[0, 0, 0]} rotation={[...rotation]}>
      <instancedMesh ref={instRef} args={[geometry, material, Math.max(1, count)]} castShadow receiveShadow />
      {showPath && pathGeometry ? (
        <line geometry={pathGeometry}>
          <lineBasicMaterial color={pathColor} linewidth={2} depthTest={true} />
        </line>
      ) : null}
    </group>
  )
}
