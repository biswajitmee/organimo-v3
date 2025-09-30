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
  count = 30,
  turns = 0.95,
  coilRadius = 5.0,
  height = 10,
  scale = 2,
  brick = { width: 3, height: 1, depth: 8 },
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

  // camera-driven props
  activeIndexRef = { current: 0 }, // now fractional index expected
  activeRadius = 6,
  activeFade = 3,
  downAmplitude = 7.0,
  frontHold = 1,
  wave = { enabled: false },

  // curvature props
  curvatureEnabled = true,
  curvatureStrength = 2.0,
  curvatureRange = 6,
  curvatureFalloff = 3,

  // floating props
  floatEnabled = false,
  floatSpeed = 1.0,
  rotationIntensity = 0.6,
  floatIntensity = 1.0,
  floatingRange = [-0.2, 0.2],

  // smoothing for Y animation (new)
  riseSmoothing = 0.12 // 0..1 (higher = faster follow). tweak from ScrollSection via prop if wanted
}) {
  const instRef = useRef()

  // texture loader (Suspense)
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

  const curve = useMemo(() => new HelixCurve({ turns, radius: coilRadius, height }), [turns, coilRadius, height])

  // store base matrices and per-instance metadata
  const baseMatricesRef = useRef(null)
  // store current animated Y per instance for smooth interpolation
  const currentYsRef = useRef(null)

  // refs for live props
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

    // deterministic pseudo-random for per-instance phase
    let s = seed
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count
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

      const m = tmpMat.clone()
      const pos = new THREE.Vector3().setFromMatrixPosition(m)
      const floatPhase = rand() * Math.PI * 2
      const rotPhase = rand() * Math.PI * 2
      baseMats.push({ mat: m.clone(), pos, floatPhase, rotPhase })

      // initialize currentY same as base pos.y
      currentYs.push(pos.y)
    }

    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    baseMatricesRef.current = baseMats
    currentYsRef.current = currentYs

    try { mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere() } catch (e) {}
    return () => {}
  }, [count, curve, brick.depth, radialOffset, scale, position, geometry, material, seed])

  // per-frame: decide target Y (based on fractional activeIndexRef) and lerp currentYs toward it
  useFrame((state) => {
    const mesh = instRef.current
    const base = baseMatricesRef.current
    const currentYs = currentYsRef.current
    if (!mesh || !base || !currentYs) return

    const time = state.clock.elapsedTime
    // activeIndexRef is now fractional (e.g. 12.34) so keep as-is
    const actIdxF = (activeIndexRef?.current != null) ? activeIndexRef.current : 0
    const radius = Math.max(0, activeRadiusRef.current || 0)
    const fade = Math.max(0.0001, activeFadeRef.current || 1)
    const amp = downAmpRef.current || 0
    const front = Math.max(0, frontHoldRef.current || 0)

    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3(1, 1, 1)

    // compute lerp factor from riseSmoothing and delta time (approx)
    const dt = Math.min(0.06, state.clock.delta) || (1/60)
    // convert riseSmoothing(0..1) to per-frame lerp: higher riseSmoothing -> faster follow
    const perFrameLerp = 1 - Math.exp(- (riseSmoothing * 60) * dt) // stable across framerate

    for (let i = 0; i < Math.min(base.length, mesh.count); i++) {
      const b = base[i]

      // first compute the targetY according to camera proximity (smooth via fractional actIdxF)
      // define brick center index as i + 0.5 (same convention as placement)
      const brickCenterIdx = i + 0.5
      let distance
      if (brickCenterIdx > actIdxF) {
        // bricks ahead: consider frontHold (camera keeps bricks ahead up to 'front')
        distance = brickCenterIdx - (actIdxF + front)
        if (distance < 0) distance = 0
      } else {
        distance = Math.abs(brickCenterIdx - actIdxF)
      }

      let targetY
      if (distance <= radius) {
        targetY = b.pos.y
      } else {
        const over = distance - radius
        const factor = Math.min(1, over / fade)
        targetY = b.pos.y - amp * factor
      }

      // update current Y with lerp towards targetY
      const curY = currentYs[i] != null ? currentYs[i] : b.pos.y
      const newY = THREE.MathUtils.lerp(curY, targetY, perFrameLerp)
      currentYs[i] = newY
      tmpPos.copy(b.pos)
      tmpPos.y = newY

      tmpQuat.setFromRotationMatrix(b.mat)

      // curvature (unchanged) — apply lateral offset & yaw if needed
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

          const radialXZ = new THREE.Vector3(b.pos.x, 0, b.pos.z).normalize()
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

      // floating: add sin-based vertical offset and slight rotation on top of newY
      if (floatEnabledRef.current) {
        const speed = floatSpeedRef.current || 1.0
        const fIntensity = floatIntensityRef.current || 1.0
        const rotInt = rotationIntensityRef.current || 0.6
        const [rmin, rmax] = floatingRangeRef.current && floatingRangeRef.current.length === 2
          ? floatingRangeRef.current
          : [-0.1, 0.1]
        const famp = (rmax - rmin) * 0.5 * fIntensity
        const fmid = (rmax + rmin) * 0.5

        const yOff = Math.sin(time * speed + (b.floatPhase || 0)) * famp + fmid
        tmpPos.y += yOff

        const rx = Math.sin(time * speed * 0.9 + (b.rotPhase || 0)) * 0.02 * rotInt
        const ry = Math.cos(time * speed * 1.1 + (b.rotPhase || 0)) * 0.02 * rotInt
        const rz = Math.sin(time * speed * 1.3 + (b.floatPhase || 0)) * 0.02 * rotInt

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
      const t = i / pathSegments
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
  }, [showPath, pathSegments, curve, brick.depth, radialOffset, scale, position])

  useEffect(() => {
    return () => {
      try {
        geometry.dispose()
        material.dispose()
        if (colorMap && colorMap.dispose) colorMap.dispose()
        if (noiseTex && noiseTex.dispose) noiseTex.dispose()
      } catch (e) {}
    }
  }, [])

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
