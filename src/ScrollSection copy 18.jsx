// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, Suspense, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll, Float } from '@react-three/drei'

import { useControls } from 'leva'

import { getProject } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import {
  editable as e,
  SheetProvider,
  PerspectiveCamera,
  useCurrentSheet
} from '@theatre/r3f'

import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
studio.initialize()
studio.extend(extension)

import WaterScene from './component/WaterScene'
import UnderwaterFog from './component/underwater/UnderwaterFog'
import SpringPath from './SpringPath'
import SandSurface from './component/underwater/SandSurface'
import sandUrl from '../src/assets/sand.jpg?url'
import CausticsLightProjector from './component/underwater/CausticsLightProjector'
import videoUrl from '../src/assets/caustics.mp4?url'
import CloudFloating from './component/CloudFloating.jsx'
import { Fish } from './upperWater/fish.jsx'
import { Seashell } from './upperWater/seashell.jsx'
import RockStone from './rock/RockStone.jsx'

import { ConchShell } from './ConchShell.jsx'
import { L1stone } from './rock/l1-stone.jsx'
import { L2stone } from './rock/l2-stone.jsx'
import { L3stone } from './rock/l3-stone.jsx'
import { R1stone } from './rock/r1-stone.jsx'
import { Pillarstone } from './rock/Pillarstone.jsx'

import CurvePath from './CurvePath' // forwarded ref component

const PAGES = 8.5
const SPHERE_RADIUS = 0.07

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

/* Responsive helpers */
function computeScaleForWidth (width) {
  if (!width) return 1
  if (width <= 380) return 0.6
  if (width <= 480) return 0.7
  if (width <= 768) return 0.85
  return 1
}
function useResponsiveSetup ({ wrapperRef, cameraRef }) {
  const { size } = useThree()
  useEffect(() => {
    if (!wrapperRef || !wrapperRef.current) return
    const s = computeScaleForWidth(size.width)
    wrapperRef.current.scale.set(s, s, s)
    if (cameraRef && cameraRef.current) {
      const cam = cameraRef.current
      const baseFov = 35
      let targetFov = baseFov
      if (size.width <= 380) targetFov = 60
      else if (size.width <= 480) targetFov = 70
      else if (size.width <= 768) targetFov = 38
      else targetFov = baseFov
      cam.fov = targetFov
      cam.updateProjectionMatrix()
      try {
        const origPos = cam.position.clone()
        const radial = new THREE.Vector3(origPos.x, 0, origPos.z)
        const len = radial.length()
        if (len > 0.001) {
          const comp = 1 / Math.max(0.4, s)
          const newLen = THREE.MathUtils.lerp(len, len * comp, 0.25)
          radial.setLength(newLen)
          cam.position.x = radial.x
          cam.position.z = radial.z
        }
      } catch (e) {}
    }
  }, [size.width, wrapperRef, cameraRef])
}

/* easing helpers */
function smoothstep (edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
function easeOutCubic (t) {
  return 1 - Math.pow(1 - t, 3)
}

/* ------------------ Main component ------------------ */

export default function ScrollSection () {
  const project = getProject('myProject', { state: theatreeBBState })
  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 9 : PAGES

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Canvas
        gl={{
          alpha: true,
          premultipliedAlpha: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping
        }}
        shadows
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <Suspense fallback={null}>
          <WaterScene />
          <UnderwaterFog
            waterY={0}
            surfaceColor='#E8C5D2'
            surfaceDensity={0.00042}
            underColor='#7E66A4'
            underDensity={0.0014}
            blendMeters={9}
          />
        </Suspense>

        <ScrollControls pages={pages} distance={3} damping={0.02}>
          <SheetProvider sheet={sheet}>
            <Scene />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>
      </Canvas>
    </div>
  )
}

/* Scene */
function Scene () {
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  const cameraRef = useRef()
  const springGroupRef = useRef()
  const curveGroupRef = useRef()
  const sphereRef = useRef()
  const wrapperRef = useRef()
  const curveRef = useRef()
  const phaseRef = useRef(null)

  useResponsiveSetup({ wrapperRef, cameraRef })

  // ---------- Split controls: SpringPath and CurvePath (Leva folders) ----------
  const springControls = useControls('SpringPath', {
    mode: { value: 'oppositeSideMove', options: ['normal', 'oppositeSide', 'oppositeSideMove'] },
    brickCount: { value: 25, min: 1, max: 400, step: 1 },
    cameraSideOffset: { value: -10, min: -40, max: 40, step: 0.01 },
    cameraUpOffset: { value: 5.0, min: -20, max: 50, step: 0.01 },
    yOffsetDeg: { value: -75, min: -180, max: 180, step: 0.1 },
    xOffsetDeg: { value: -8, min: -180, max: 180, step: 0.1 },

    // spring activation / motion
    positionSmoothing: { value: 0.38, min: 0, max: 1, step: 0.01 },
    rotationSmoothing: { value: 0.2, min: 0, max: 1, step: 0.005 },
    hiddenDepth: { value: 70, min: 0, max: 400, step: 1 },
    activationRange: { value: 60, min: 1, max: 400, step: 0.5 },
    riseSpeed: { value: 10, min: 0.1, max: 30, step: 0.1 },

    activeRadius: { value: 4, min: 0, max: 80, step: 1 },
    activeFade: { value: 3, min: 0, max: 80, step: 0.5 },
    downAmplitude: { value: 20.0, min: 0, max: 80, step: 0.1 },
    frontHold: { value: 1, min: 0, max: 40, step: 1 },

    curvatureEnabled: { value: true },
    curvatureStrength: { value: 2.0, min: -40, max: 40, step: 0.1 },
    curvatureRange: { value: 0, min: 0, max: 120, step: 1 },
    curvatureFalloff: { value: 0, min: 0.1, max: 80, step: 0.5 },

    floatEnabled: { value: true },
    floatSpeed: { value: 1.0, min: 0.0, max: 8, step: 0.01 },
    rotationIntensity: { value: 0.6, min: 0, max: 6, step: 0.01 },
    floatIntensity: { value: 1.0, min: 0, max: 8, step: 0.01 },
    floatingRange: { value: [-0.2, 0.2] },

    scrollResponsiveness: { value: 0.45, min: 0.01, max: 1.5, step: 0.01 },
    startupBias: { value: 0.9, min: 0, max: 1.0, step: 0.01 },
    maxStep: { value: 0.12, min: 0.001, max: 1.0, step: 0.001 },

    riseSmoothing: { value: 0.6, min: 0.01, max: 1.0, step: 0.01 },

    maxPitchDeg: { value: 60, min: 0, max: 90, step: 1 },

    minCameraDistance: { value: 8, min: 1, max: 200, step: 1 },
    minCamY: { value: -5, min: -200, max: 200, step: 1 },
    maxCamY: { value: 50, min: -200, max: 200, step: 1 },
    maxMovePerFrameFactor: { value: 1.0, min: 0.01, max: 10, step: 0.01 }
  })

  const curveControls = useControls('CurvePath', {
    // path geometry
    turns: { value: 0.95, min: 0.1, max: 4, step: 0.01 },
    coilRadius: { value: 5.0, min: 0.1, max: 20, step: 0.1 },
    pathHeight: { value: 10, min: 0.1, max: 100, step: 0.1 },
    pathScale: { value: 5, min: 0.1, max: 50, step: 0.1 },
    radialOffset: { value: 0, min: -10, max: 10, step: 0.01 },

    // camera on curve
    curvePortion: { value: 0.28, min: 0.05, max: 0.6, step: 0.01 },
    curveRadiusMul: { value: 1.2, min: 0.3, max: 3.0, step: 0.01 },
    curveAhead: { value: 0.02, min: 0.0, max: 0.1, step: 0.001 },

    // UI & front-copy
    lineColor: { value: '#ff9f7f' },
    showFrontCopy: { value: true },
    curveMaxAxisDeg: { value: 10, min: 0, max: 45, step: 1 },

    // camera local offset & extra rotation (applied in pose-local space)
    camLocalOffsetX: { value: 0, min: -50, max: 50, step: 0.1 },
    camLocalOffsetY: { value: 0, min: -50, max: 50, step: 0.1 },
    camLocalOffsetZ: { value: 0, min: -50, max: 50, step: 0.1 },

    camExtraYawDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    camExtraPitchDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    camExtraRollDeg: { value: 0, min: -180, max: 180, step: 0.1 },

    // bricks on curve (SpringPath-like)
    bricksEnabled: { value: true },
    brickCount: { value: 32, min: 1, max: 400, step: 1 },
    brickWidth: { value: 3, min: 0.1, max: 20, step: 0.1 },
    brickHeight: { value: 2, min: 0.1, max: 20, step: 0.1 },
    brickDepth: { value: 8, min: 0.1, max: 40, step: 0.1 },
    brickRadialOffset: { value: 0, min: -20, max: 40, step: 0.1 },
    brickColor: { value: '#d16b50' },
    brickTexture: { value: '/textures/brick-texture.jpg' },
    bricksCastShadow: { value: true },
    bricksReceiveShadow: { value: true }
  })

  // destructure (spring vs curve) to local variables used in logic
  const {
    mode,
    brickCount: springBrickCount,
    cameraSideOffset,
    cameraUpOffset,
    yOffsetDeg,
    xOffsetDeg,
    positionSmoothing,
    rotationSmoothing,
    hiddenDepth,
    activationRange,
    riseSpeed,
    activeRadius,
    activeFade,
    downAmplitude,
    frontHold,
    curvatureEnabled,
    curvatureStrength,
    curvatureRange,
    curvatureFalloff,
    floatEnabled,
    floatSpeed,
    rotationIntensity,
    floatIntensity,
    floatingRange,
    scrollResponsiveness,
    startupBias,
    maxStep,
    riseSmoothing,
    maxPitchDeg,
    minCameraDistance,
    minCamY,
    maxCamY,
    maxMovePerFrameFactor
  } = springControls

  const {
    turns,
    coilRadius,
    pathHeight,
    pathScale,
    radialOffset,

    curvePortion,
    curveRadiusMul,
    curveAhead,

    lineColor,
    showFrontCopy,
    curveMaxAxisDeg,

    camLocalOffsetX,
    camLocalOffsetY,
    camLocalOffsetZ,
    camExtraYawDeg,
    camExtraPitchDeg,
    camExtraRollDeg,

    bricksEnabled,
    brickCount: curveBrickCount,
    brickWidth,
    brickHeight,
    brickDepth,
    brickRadialOffset,
    brickColor,
    brickTexture,
    bricksCastShadow,
    bricksReceiveShadow
  } = curveControls

  // shared helpers & precomputed items
  const brickSpec = useMemo(() => ({ width: 3, height: 2, depth: 8 }), [])
  const helixCurve = useMemo(() => new HelixCurve({ turns, radius: coilRadius, height: pathHeight }), [turns, coilRadius, pathHeight])

  const fallbackHelix = useMemo(
    () => new HelixCurve({ turns, radius: Math.max(0.001, coilRadius * 0.4), height: pathHeight }),
    [turns, coilRadius, pathHeight]
  )

  function ensureMatrixWorld () {
    if (!springGroupRef.current) return new THREE.Matrix4()
    springGroupRef.current.updateMatrixWorld(true)
    return springGroupRef.current.matrixWorld.clone()
  }

  function ensureCurveMatrixWorld () {
    if (!curveGroupRef.current) return new THREE.Matrix4()
    curveGroupRef.current.updateMatrixWorld(true)
    return curveGroupRef.current.matrixWorld.clone()
  }

  const activeIndexRef = useRef(0)
  const bricksActiveRef = useRef(0)
  const smoothedIndexRef = useRef(0)
  const lastRawRef = useRef(0)

  // front-copy resources
  const frontLineRef = useRef(null)
  const frontGeoRef = useRef(null)

  useEffect(() => {
    // allocate a small geometry of 32 points (segment)
    const segPoints = 32
    const positions = new Float32Array(segPoints * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    frontGeoRef.current = { geo, segPoints }
    return () => {
      try { geo.dispose() } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (!frontLineRef.current || !frontGeoRef.current) return
    try {
      frontLineRef.current.geometry = frontGeoRef.current.geo
      frontLineRef.current.visible = !!showFrontCopy
    } catch (e) {}
  }, [frontLineRef.current, frontGeoRef.current, showFrontCopy])

  const TRANSITION_EPS = 0.035

  function computeSpringCamDesired (brickT, groupMatrix, preferOpposite = false) {
    const localPoint = helixCurve.getPointAt(brickT).clone()
    const worldPointLocalUnits = localPoint.clone().multiplyScalar(pathScale)

    const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
    if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
    const outwardDist = (brickSpec.depth / 2 + radialOffset) * pathScale
    const outward = radial.clone().multiplyScalar(outwardDist)

    const zAxis_brick = radial.clone().normalize()
    const yAxis_brick = new THREE.Vector3(0, 1, 0)
    const xAxis_brick = new THREE.Vector3().crossVectors(yAxis_brick, zAxis_brick).normalize()
    const yOrtho = new THREE.Vector3().crossVectors(zAxis_brick, xAxis_brick).normalize()

    const brickLocalPos = new THREE.Vector3(
      worldPointLocalUnits.x + outward.x,
      worldPointLocalUnits.y,
      worldPointLocalUnits.z + outward.z
    )

    const brickMat = new THREE.Matrix4().makeBasis(xAxis_brick, yOrtho, zAxis_brick)
    const brickQuat = new THREE.Quaternion().setFromRotationMatrix(brickMat)

    const groupQuat = new THREE.Quaternion().setFromRotationMatrix(groupMatrix)
    const brickWorldPos = brickLocalPos.clone().applyMatrix4(groupMatrix)
    const brickWorldQuat = brickQuat.clone().premultiply(groupQuat)

    const sideOffset = (brickSpec.width / 2) * pathScale + cameraSideOffset
    let sign = 1
    let extraAcrossMoveLocal = 0
    if (mode === 'normal') sign = 1
    else if (mode === 'oppositeSide') sign = -1
    else if (mode === 'oppositeSideMove') {
      sign = -1
      extraAcrossMoveLocal = brickSpec.width * pathScale * 0.6
    }

    const cameraLocalOffset = new THREE.Vector3(-extraAcrossMoveLocal, cameraUpOffset + sign * sideOffset, 0)

    if (preferOpposite) {
      cameraLocalOffset.x *= -1
      cameraLocalOffset.y = cameraUpOffset + sign * sideOffset
      cameraLocalOffset.z += (brickSpec.depth * 0.6) * pathScale
    }

    const cameraOffsetWorld = cameraLocalOffset.clone().applyQuaternion(brickWorldQuat)
    const camDesiredWorld = brickWorldPos.clone().add(cameraOffsetWorld)

    const camZ = zAxis_brick.clone().multiplyScalar(-1).applyQuaternion(groupQuat).normalize()
    const camY = yOrtho.clone().applyQuaternion(groupQuat).normalize()
    const camX = new THREE.Vector3().crossVectors(camY, camZ).normalize()
    const camBasisMat = new THREE.Matrix4().makeBasis(camX, camY, camZ)
    const camQuatFromBasis = new THREE.Quaternion().setFromRotationMatrix(camBasisMat)
    const camEuler = new THREE.Euler().setFromQuaternion(camQuatFromBasis, 'YXZ')
    if (mode === 'oppositeSide' || mode === 'oppositeSideMove') camEuler.y += Math.PI
    camEuler.y += THREE.MathUtils.degToRad(yOffsetDeg)
    camEuler.x += THREE.MathUtils.degToRad(xOffsetDeg || 0)
    const camFinalQuat = new THREE.Quaternion().setFromEuler(camEuler)

    return { camDesiredWorld, camFinalQuat, brickWorldPos }
  }

  useFrame((state, delta) => {
    if (!scroll || !cameraRef.current || !springGroupRef.current) return

    const rawOffset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    const tRaw = rawOffset

    const split = THREE.MathUtils.clamp(curvePortion, 0.02, 0.9)
    const inCurvePhase = tRaw <= split
    const curveT = THREE.MathUtils.clamp(split > 0 ? tRaw / split : 0, 0, 1)
    const springT = THREE.MathUtils.clamp(split < 1 ? (tRaw - split) / (1 - split) : 0, 0, 1)

    const currentPhase = inCurvePhase ? 'curve' : 'spring'
    if (phaseRef.current !== currentPhase) {
      phaseRef.current = currentPhase
      console.log(`📸 Camera now on: ${currentPhase === 'curve' ? 'CurvePath 🌀' : 'SpringPath 🧱'}`)
    }

    // compute curve pose (local) then transform to world by curveGroup matrix
    let poseLocal = null
    if (curveRef.current && typeof curveRef.current.getPoseAt === 'function') {
      poseLocal = curveRef.current.getPoseAt(curveT)
    }

    const curveMatrixWorld = ensureCurveMatrixWorld()
    const curveGroupQuat = new THREE.Quaternion().setFromRotationMatrix(curveMatrixWorld)
    const curveGroupPos = new THREE.Vector3().setFromMatrixPosition(curveMatrixWorld)

    const curveTargetPos = new THREE.Vector3()
    const curveTargetQuat = new THREE.Quaternion()
    const curveTangentWorld = new THREE.Vector3()

    if (poseLocal) {
      const localPos = poseLocal.position.clone()
      const localQuat = poseLocal.quaternion.clone()

      // APPLY user local position offset (new feature via curveControls)
      const userLocalOffset = new THREE.Vector3(camLocalOffsetX || 0, camLocalOffsetY || 0, camLocalOffsetZ || 0)
      const posWithLocalOffset = localPos.clone().add(userLocalOffset)

      // APPLY user extra local rotation (new feature)
      const extraYaw = THREE.MathUtils.degToRad(camExtraYawDeg || 0)
      const extraPitch = THREE.MathUtils.degToRad(camExtraPitchDeg || 0)
      const extraRoll = THREE.MathUtils.degToRad(camExtraRollDeg || 0)
      const extraEulerLocal = new THREE.Euler(extraPitch, extraYaw, extraRoll, 'YXZ')
      const extraQuatLocal = new THREE.Quaternion().setFromEuler(extraEulerLocal)

      // Compose localQuat * extraQuatLocal so rotation sticks with curve local frame
      const composedLocalQuat = localQuat.clone().multiply(extraQuatLocal)

      // Transform local to world using group matrix/quaternion
      const worldPos = posWithLocalOffset.clone().applyMatrix4(curveMatrixWorld)
      const worldQuat = composedLocalQuat.clone().premultiply(curveGroupQuat)

      curveTargetPos.copy(worldPos)
      curveTargetQuat.copy(worldQuat)
      curveTangentWorld.copy(poseLocal.tangent.clone().applyQuaternion(curveGroupQuat).normalize())
    } else {
      const tmpL = fallbackHelix.getPoint(curveT).multiplyScalar(pathScale)
      curveTargetPos.copy(tmpL.applyMatrix4(curveMatrixWorld))
      const aheadTmp = fallbackHelix.getPoint(THREE.MathUtils.clamp(curveT + curveAhead, 0, 1)).multiplyScalar(pathScale).applyMatrix4(curveMatrixWorld)
      const m = new THREE.Matrix4()
      m.lookAt(curveTargetPos, aheadTmp, new THREE.Vector3(0, 1, 0))
      curveTargetQuat.setFromRotationMatrix(m)
    }

    // --- compute spring camera candidate (uses springControls.brickCount) ---
    const count = Math.max(1, Math.floor(springBrickCount))
    const approxIdx = Math.floor(springT * count)
    const brickIndex = THREE.MathUtils.clamp(approxIdx, 0, count - 1)
    const brickT_forSpring = 1.0 - (brickIndex + 0.5) / count

    const groupMatrix = ensureMatrixWorld()
    const springCandidateOpp = computeSpringCamDesired(brickT_forSpring, groupMatrix, true)
    const springCandidateNormal = computeSpringCamDesired(brickT_forSpring, groupMatrix, false)

    const lo = split - TRANSITION_EPS
    const hi = split + TRANSITION_EPS
    const alphaRaw = smoothstep(lo, hi, tRaw)
    const alpha = easeOutCubic(alphaRaw)

    // ---------------- CURVE PHASE: center camera on path and clamp rotation ----------------
    if (inCurvePhase) {
      const posSmooth = THREE.MathUtils.clamp(1 - Math.exp(-positionSmoothing * 10 * delta), 0, 1)
      const rotSmooth = THREE.MathUtils.clamp(1 - Math.exp(-rotationSmoothing * 8 * delta), 0, 1)

      // final position and quaternion already account for user local offsets & extra local rotation
      const upOffsetWorld = new THREE.Vector3(0, (cameraUpOffset || 0), 0).applyQuaternion(curveTargetQuat)
      const finalTargetPos = curveTargetPos.clone().add(upOffsetWorld)

      // apply small y/x offset if still desired (these are extra local on top of camExtra)
      const yaw = THREE.MathUtils.degToRad(yOffsetDeg || 0)
      const pitch = THREE.MathUtils.degToRad(xOffsetDeg || 0)
      const extraEuler = new THREE.Euler(pitch, yaw, 0, 'YXZ')
      const extraQuat = new THREE.Quaternion().setFromEuler(extraEuler)
      const finalQuatWorld = curveTargetQuat.clone().multiply(extraQuat)

      // clamp to avoid big rotations
      const MAX_AXIS_RAD = THREE.MathUtils.degToRad(curveMaxAxisDeg || 10)
      const e = new THREE.Euler().setFromQuaternion(finalQuatWorld, 'YXZ')
      e.x = THREE.MathUtils.clamp(e.x, -MAX_AXIS_RAD, MAX_AXIS_RAD)
      e.y = THREE.MathUtils.clamp(e.y, -MAX_AXIS_RAD, MAX_AXIS_RAD)
      e.z = 0
      const clampedQuat = new THREE.Quaternion().setFromEuler(e)

      cameraRef.current.position.lerp(finalTargetPos, posSmooth)
      cameraRef.current.quaternion.slerp(clampedQuat, rotSmooth)
      cameraRef.current.updateMatrixWorld()

      if (sphereRef.current) sphereRef.current.visible = false

      bricksActiveRef.current = 0
      smoothedIndexRef.current = 0
    } else {
      // SPRING PHASE (unchanged)
      const camOppPos = springCandidateOpp.camDesiredWorld
      const camOppQuat = springCandidateOpp.camFinalQuat
      const camSpringPos = springCandidateNormal.camDesiredWorld
      const camSpringQuat = springCandidateNormal.camFinalQuat

      const targetPos = new THREE.Vector3().lerpVectors(camOppPos, camSpringPos, alpha)
      const targetQuat = new THREE.Quaternion().slerpQuaternions(camOppQuat, camSpringQuat, alpha)

      const posSmooth = THREE.MathUtils.clamp(1 - Math.exp(-positionSmoothing * 10 * delta), 0, 1)
      const rotSmooth = THREE.MathUtils.clamp(1 - Math.exp(-rotationSmoothing * 20 * delta), 0, 1)

      cameraRef.current.position.lerp(targetPos, posSmooth)
      cameraRef.current.quaternion.slerp(targetQuat, rotSmooth)
      cameraRef.current.updateMatrixWorld()

      if (sphereRef.current) {
        sphereRef.current.visible = true
        if (sphereRef.current.visible) sphereRef.current.position.copy(springCandidateNormal.brickWorldPos)
      }

      const t = springT
      const targetIndexF = t * count
      bricksActiveRef.current = targetIndexF
      activeIndexRef.current = bricksActiveRef.current

      const cur = smoothedIndexRef.current || 0
      let diff = targetIndexF - cur
      const absDiff = Math.abs(diff)

      const baseLerp =
        1 - Math.exp(-Math.max(0.0001, scrollResponsiveness) * 60 * delta)
      const scale =
        1 - Math.min(1, (absDiff * startupBias) / Math.max(1, count * 0.25))
      let lerpFactor = baseLerp * (0.2 + 0.8 * scale)
      const maxStepEffective = Math.max(0.001, maxStep) * (delta * 60)
      let step = diff * lerpFactor
      if (Math.abs(step) > maxStepEffective)
        step = Math.sign(step) * maxStepEffective

      const next = cur + step
      smoothedIndexRef.current = next
    }

    // --- FRONT COPY update ---
    if (showFrontCopy && frontGeoRef.current && curveRef.current && frontLineRef.current) {
      const geo = frontGeoRef.current.geo
      const seg = frontGeoRef.current.segPoints
      const arr = geo.attributes.position.array
      const halfWindow = 0.02
      const curveMatrixWorldNow = ensureCurveMatrixWorld()
      const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraRef.current.quaternion).normalize()
      const forwardOffset = camForward.clone().multiplyScalar(1.5)
      for (let i = 0; i < seg; i++) {
        const s = i / (seg - 1)
        const tt = THREE.MathUtils.lerp(Math.max(0, curveT - halfWindow), Math.min(1, curveT + halfWindow), s)
        const localPoint = curveRef.current.getPoint(tt, new THREE.Vector3())
        const worldPoint = localPoint.clone().applyMatrix4(curveMatrixWorldNow)
        const pFinal = worldPoint.add(forwardOffset)
        arr[i * 3] = pFinal.x
        arr[i * 3 + 1] = pFinal.y
        arr[i * 3 + 2] = pFinal.z
      }
      geo.attributes.position.needsUpdate = true
      if (frontLineRef.current) frontLineRef.current.visible = true
    } else {
      if (frontLineRef.current) frontLineRef.current.visible = false
    }

    lastRawRef.current = rawOffset
  })

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        theatreKey='Camera'
        makeDefault
        near={0.1}
        far={5000}
        fov={35}
      />

      <group ref={wrapperRef}>
        {/* CurvePath theatre group */}
        <e.group theatreKey='CurvePath' ref={curveGroupRef} position={[0, 0, 0]}>
          <CurvePath
            ref={curveRef}
            turns={turns}
            coilRadius={coilRadius}
            pathHeight={pathHeight}
            pathScale={pathScale}
            samples={160}
            lift={2.0}
            showLine={true}
            lineColor={lineColor}
            lineRadius={0.18}

            // bricks options (curve)
            bricks={bricksEnabled}
            brickCount={Math.max(1, Math.floor(curveBrickCount))}
            brick={{ width: brickWidth, height: brickHeight, depth: brickDepth }}
            radialOffset={brickRadialOffset}
            brickColor={brickColor}
            texturePath={brickTexture || null}
            castShadow={bricksCastShadow}
            receiveShadow={bricksReceiveShadow}
          />
        </e.group>

        {/* FRONT COPY line */}
        <line ref={frontLineRef} visible={false}>
          <bufferGeometry attach="geometry" />
          <lineBasicMaterial color={lineColor} linewidth={2} depthTest={false} transparent opacity={0.95} />
        </line>

        {/* Spring group unchanged (still uses springControls.brickCount etc) */}
        <e.group theatreKey='SpringGroup' ref={springGroupRef} position={[0, 0, 0]}>
          <SpringPath
            count={springBrickCount}
            turns={turns}
            coilRadius={coilRadius}
            height={pathHeight}
            scale={pathScale}
            radialOffset={radialOffset}
            texturePath='/textures/brick-texture.jpg'
            cameraRef={cameraRef}
            hiddenDepth={hiddenDepth}
            activationRange={activationRange}
            riseSpeed={riseSpeed}
            debugShowBricks={true}
            debugForceProgress={true}
            debugFallbackMeshes={true}
            activeIndexRef={bricksActiveRef}
            activeRadius={activeRadius}
            activeFade={activeFade}
            downAmplitude={downAmplitude}
            frontHold={frontHold}
            curvatureEnabled={curvatureEnabled}
            curvatureStrength={curvatureStrength}
            curvatureRange={curvatureRange}
            curvatureFalloff={curvatureFalloff}
            floatEnabled={floatEnabled}
            floatSpeed={floatSpeed}
            rotationIntensity={rotationIntensity}
            floatIntensity={floatIntensity}
            floatingRange={floatingRange}
            riseSmoothing={riseSmoothing}
            wave={{ enabled: false }}
          />
        </e.group>

        <mesh ref={sphereRef} visible>
          <sphereGeometry args={[SPHERE_RADIUS, 12, 10]} />
          <meshStandardMaterial color={'#ff4444'} metalness={0.1} roughness={0.4} />
        </mesh>

        <hemisphereLight args={['#cfe7ff', '#6b4f5f', 0.35]} castShadow={false} />

        <directionalLight
          position={[30, 40, 10]}
          intensity={0.25}
          castShadow={true}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />

        <e.mesh theatreKey='SandSurface' position={[0, 0, -1]}>
          <SandSurface textureUrl={sandUrl} size={3000} />
        </e.mesh>

        <e.mesh theatreKey='CausticsLightProjector' position={[0, 0, -1]}>
          <CausticsLightProjector
            src={videoUrl}
            target={[0, 0, 0]}
            fitRect={[9000, 9000]}
            worldCell={4}
            cookieSize={1024}
            intensity={50}
            playbackRate={2}
          />
        </e.mesh>

        <e.group theatreKey='sankho' position={[0, 0, -1]}>
          <ConchShell scale={50} />
        </e.group>

        <e.group theatreKey='L1stone' position={[0, 0, -1]}>
          <Float speed={2} rotationIntensity={0.1} floatIntensity={0.7} floatingRange={[-2, 2]}>
            <L1stone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='L2stone' position={[0, 0, -1]}>
          <Float speed={5} rotationIntensity={0.1} floatIntensity={0.7} floatingRange={[-2, 2]}>
            <L2stone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='L3stone' position={[0, 0, -1]}>
          <L3stone />
        </e.group>

        <e.group theatreKey='R1stone' position={[0, 0, -1]}>
          <R1stone />
        </e.group>

        <e.group theatreKey='Pillarstone' position={[0, 0, -1]}>
          <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5} floatingRange={[-2, 2]}>
            <Pillarstone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='RockStone' position={[0, 0, -1]}>
          <RockStone scale={30} />
        </e.group>

        <e.group theatreKey='CloudFront' position={[0, 0, 1]}>
          <CloudFloating numPlanes={20} opacity={0.4} />
        </e.group>

        <e.group theatreKey='Fish' position={[0, 0, 1]}>
          <Fish scale={100} />
        </e.group>

        <e.group theatreKey='Seashell' position={[0, 0, 1]}>
          <Seashell scale={20} />
        </e.group>
      </group>
    </>
  )
}
