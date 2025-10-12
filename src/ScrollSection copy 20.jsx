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

/* ------------------ FrontCopy component ------------------ */
function FrontCopy({
  curveRef,
  cameraRef,
  curveT = 0,
  enabled = true,
  show = true,
  segPoints = 32,
  windowHalf = 0.02, // half-window in t-space
  lengthFix = 0.0,   // if >0 use as absolute t-length
  forwardOffset = 1.5,
  color = '#ffd6a5',
  opacity = 0.95,
  depthTest = false
}) {
  const lineRef = useRef()
  const geoRef = useRef()

  useEffect(() => {
    const pts = Math.max(4, Math.floor(segPoints || 32))
    const positions = new Float32Array(pts * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geoRef.current = { geo, segPoints: pts }
    if (lineRef.current) {
      try { lineRef.current.geometry = geoRef.current.geo } catch (e) {}
    }
    return () => {
      try { if (geo) geo.dispose() } catch (e) {}
    }
  }, [segPoints])

  useFrame(() => {
    if (!enabled || !show) {
      if (lineRef.current) lineRef.current.visible = false
      return
    }
    if (!curveRef || !curveRef.current || !cameraRef || !cameraRef.current) return
    if (!geoRef.current) return

    const curve = curveRef.current
    const cam = cameraRef.current
    const geo = geoRef.current.geo
    const seg = geoRef.current.segPoints
    const arr = geo.attributes.position.array

    let half = Math.max(0.0001, windowHalf || 0.02)
    if (lengthFix && lengthFix > 0) half = (lengthFix / 2)

    const startT = THREE.MathUtils.clamp(curveT - half, 0, 1)
    const endT = THREE.MathUtils.clamp(curveT + half, 0, 1)

    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize()
    const forwardOffsetVec = camForward.clone().multiplyScalar(Math.max(0, forwardOffset || 1.5))

    const curveMatrixWorld = (curveRef.current && curveRef.current.matrixWorld) ? curveRef.current.matrixWorld : new THREE.Matrix4()

    for (let i = 0; i < seg; i++) {
      const s = i / (seg - 1)
      const tt = THREE.MathUtils.lerp(startT, endT, s)
      let localPoint
      try {
        // Try using imperative getPoint if available
        if (typeof curve.getPoint === 'function') {
          localPoint = curve.getPoint(tt, new THREE.Vector3())
        } else if (typeof curve.getPoseAt === 'function') {
          const pose = curve.getPoseAt(tt)
          localPoint = pose ? pose.position.clone() : new THREE.Vector3()
        } else {
          localPoint = new THREE.Vector3()
        }
      } catch (e) {
        localPoint = new THREE.Vector3()
      }
      const worldPoint = localPoint.clone().applyMatrix4(curveMatrixWorld)
      const pFinal = worldPoint.add(forwardOffsetVec)
      arr[i * 3] = pFinal.x
      arr[i * 3 + 1] = pFinal.y
      arr[i * 3 + 2] = pFinal.z
    }

    geo.attributes.position.needsUpdate = true

    if (lineRef.current && lineRef.current.material) {
      try {
        lineRef.current.material.color.set(color || '#ffffff')
        lineRef.current.material.opacity = Math.max(0, Math.min(1, opacity || 1.0))
        lineRef.current.material.depthTest = !!depthTest
        lineRef.current.material.needsUpdate = true
      } catch (e) {}
    }

    if (lineRef.current) lineRef.current.visible = true
  })

  return (
    <line ref={lineRef} visible={false}>
      <bufferGeometry attach="geometry" />
      <lineBasicMaterial attach="material" color={color} linewidth={1} transparent opacity={opacity} depthTest={depthTest} />
    </line>
  )
}

/* ------------------ Helpers & HelixCurve ------------------ */
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

function smoothstep (edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
function easeOutCubic (t) {
  return 1 - Math.pow(1 - t, 3)
}

/* ------------------ Main ScrollSection ------------------ */
export default function ScrollSection () {
  const project = getProject('myProject', { state: theatreeBBState })
  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 9 : PAGES

  const overlayRefHolder = useRef(null)
  function overlayRefSetter(el) { overlayRefHolder.current = el }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>
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
            <Scene overlayRefHolder={overlayRefHolder} />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>
      </Canvas>

      <div
        id="transition-overlay"
        ref={overlayRefSetter}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'none',
          mixBlendMode: 'normal',
          background: 'transparent'
        }}
      />
    </div>
  )
}

/* ------------------ Scene ------------------ */
function Scene ({ overlayRefHolder }) {
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  const cameraRef = useRef()
  const springGroupRef = useRef()
  const curveGroupRef = useRef()
  const sphereRef = useRef()
  const wrapperRef = useRef()
  const curveRef = useRef()
  const phaseRef = useRef(null)

  // NEW: indicator (red ball) ref that will move along the curve based on curveT
  const indicatorRef = useRef()
  const curveTRef = useRef(0)
  const initialCurveEulerRef = useRef(null)

  // Track whether we've applied the GUI camera-start placement
  const appliedCameraStartRef = useRef(false)

  useResponsiveSetup({ wrapperRef, cameraRef })

  // fade overlay refs
  const fadeActiveRef = useRef(false)
  const fadeStartRef = useRef(0)
  const fadeDurationRef = useRef(1.0)
  const fadeColorRef = useRef('#000000')
  const overlayDOMRef = useRef(null)

  /* ------------------ Separate GUIs ------------------ */
  const springControls = useControls({
    turns: { value: 0.95, min: 0.1, max: 4, step: 0.01 },
    coilRadius: { value: 5.0, min: 0.1, max: 20, step: 0.1 },
    pathHeight: { value: 10, min: 0.1, max: 100, step: 0.1 },
    pathScale: { value: 5, min: 0.1, max: 50, step: 0.1 },
    radialOffset: { value: 0, min: -10, max: 10, step: 0.01 },

    mode: {
      value: 'oppositeSideMove',
      options: ['normal', 'oppositeSide', 'oppositeSideMove']
    },
    brickCount: { value: 25, min: 1, max: 400, step: 1 },
    cameraSideOffset: { value: -10, min: -40, max: 40, step: 0.01 },
    cameraUpOffset: { value: 5.0, min: -20, max: 50, step: 0.01 },
    yOffsetDeg: { value: -75, min: -180, max: 180, step: 0.1 },
    xOffsetDeg: { value: -8, min: -180, max: 180, step: 0.1 },

    positionSmoothing: { value: 0.38, min: 0, max: 1, step: 0.01 },
    rotationSmoothing: { value: 0.2, min: 0, max: 1, step: 0.005 },
    showDebugMarker: { value: true },

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

  // CURVE controls: in an expandable group
  const curveControls = useControls('CurvePath', {
    curve_turns: { value: 0.50, min: 0.1, max: 4, step: 0.01 },
    curve_coilRadius: { value: 3.0, min: 0.1, max: 20, step: 0.1 },
    curve_pathHeight: { value: 1, min: 0.1, max: 100, step: 0.1 },
    curve_pathScale: { value: 2, min: 0.1, max: 50, step: 0.1 },
    curve_radialOffset: { value: 0, min: -10, max: 10, step: 0.01 },

    curve_lineColor: { value: '#ff9f7f' },
    curve_showFrontCopy: { value: true },
    curveMaxAxisDeg: { value: 10, min: 0, max: 45, step: 1 },

    camLocalOffsetX: { value: 0, min: -50, max: 50, step: 0.1 },
    camLocalOffsetY: { value: 0, min: -50, max: 50, step: 0.1 },
    camLocalOffsetZ: { value: 0, min: -50, max: 50, step: 0.1 },

    camExtraYawDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    camExtraPitchDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    camExtraRollDeg: { value: 0, min: -180, max: 180, step: 0.1 },

    curveMaxXPercent: { value: 0.10, min: 0.0, max: 1.0, step: 0.01 },

    frontCopyEnabled: { value: true },
    frontCopyOffset: { value: 1.5, min: 0, max: 20, step: 0.1 },
    frontCopySegPoints: { value: 32, min: 4, max: 128, step: 1 },
    frontCopyWindow: { value: 0.04, min: 0.001, max: 0.5, step: 0.001 },
    frontCopyLengthFix: { value: 0.0, min: 0.0, max: 1.0, step: 0.01 },
    frontCopyColor: { value: '#ffd6a5' },
    frontCopyOpacity: { value: 0.95, min: 0, max: 1, step: 0.01 },
    frontCopyDepthTest: { value: false },

    curvePortion: { value: 0.28, min: 0.02, max: 0.9, step: 0.01 },
    curveAhead: { value: 0.02, min: 0.0, max: 0.1, step: 0.001 },

    curveGroupPosX: { value: 0, min: -500, max: 500, step: 0.1 },
    curveGroupPosY: { value: 0, min: -500, max: 500, step: 0.1 },
    curveGroupPosZ: { value: 0, min: -500, max: 500, step: 0.1 },
    curveGroupRotXDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    curveGroupRotYDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    curveGroupRotZDeg: { value: 0, min: -180, max: 180, step: 0.1 },

    // new camera start GUI toggles
    cameraStartPosition: { value: 'start', options: ['start', 'end'] },
    cameraStartFacingDeg: { value: 180, options: [0, 180] },

    // manual rotation toggles (x/y/z) - kept simple; you had LEVA warnings earlier for unexpected shape,
    // so keep these as flat controls
    manualRotationEnabled: { value: false },
    manualRotationTriggerT: { value: 0.95, min: 0, max: 1, step: 0.001 },
    manualRotationSmooth: { value: 0.25, min: 0, max: 1, step: 0.01 },
    manualRotationXDeg: { value: 10, min: -180, max: 180, step: 0.1 },
    manualRotationYDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    manualRotationZDeg: { value: 0, min: -180, max: 180, step: 0.1 }
  }, { collapsed: true })

  // transition fade small group
  const misc = useControls('Misc', {
    transitionFadeColor: { value: '#000000' },
    transitionFadeDuration: { value: 1.0, min: 0.05, max: 5.0, step: 0.05 }
  }, { collapsed: true })

  useEffect(() => { fadeDurationRef.current = Math.max(0.01, Number(misc.transitionFadeDuration) || 1.0) }, [misc.transitionFadeDuration])
  useEffect(() => { fadeColorRef.current = misc.transitionFadeColor || '#000000' }, [misc.transitionFadeColor])

  useEffect(() => {
    if (overlayRefHolder && overlayRefHolder.current) overlayDOMRef.current = overlayRefHolder.current
  }, [overlayRefHolder])

  const defaultBrickSpec = useMemo(() => ({ width: 3, height: 2, depth: 8 }), [])

  // --- helix curves: separate for curve and spring ---
  const curveHelix = useMemo(() => new HelixCurve({
    turns: curveControls.curve_turns,
    radius: curveControls.curve_coilRadius,
    height: curveControls.curve_pathHeight
  }), [curveControls.curve_turns, curveControls.curve_coilRadius, curveControls.curve_pathHeight])

  const fallbackCurveHelix = useMemo(() => new HelixCurve({
    turns: curveControls.curve_turns,
    radius: Math.max(0.001, (curveControls.curve_coilRadius || 1) * 0.4),
    height: curveControls.curve_pathHeight
  }), [curveControls.curve_turns, curveControls.curve_coilRadius, curveControls.curve_pathHeight])

  const springHelix = useMemo(() => new HelixCurve({
    turns: springControls.turns,
    radius: springControls.coilRadius,
    height: springControls.pathHeight
  }), [springControls.turns, springControls.coilRadius, springControls.pathHeight])

  const fallbackSpringHelix = useMemo(() => new HelixCurve({
    turns: springControls.turns,
    radius: Math.max(0.001, (springControls.coilRadius || 1) * 0.4),
    height: springControls.pathHeight
  }), [springControls.turns, springControls.coilRadius, springControls.pathHeight])

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

  const TRANSITION_EPS = 0.035

  // computeSpringCamDesired uses only springControls & springHelix
  function computeSpringCamDesired (brickT, groupMatrix, preferOpposite = false) {
    const localPoint = springHelix.getPointAt(brickT).clone()
    const worldPointLocalUnits = localPoint.clone().multiplyScalar(springControls.pathScale)

    const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
    if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
    const outwardDist = (defaultBrickSpec.depth / 2 + springControls.radialOffset) * springControls.pathScale
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

    const sideOffset = (defaultBrickSpec.width / 2) * springControls.pathScale + springControls.cameraSideOffset
    let sign = 1
    let extraAcrossMoveLocal = 0
    if (springControls.mode === 'normal') sign = 1
    else if (springControls.mode === 'oppositeSide') sign = -1
    else if (springControls.mode === 'oppositeSideMove') {
      sign = -1
      extraAcrossMoveLocal = defaultBrickSpec.width * springControls.pathScale * 0.6
    }

    const cameraLocalOffset = new THREE.Vector3(-extraAcrossMoveLocal, springControls.cameraUpOffset + sign * sideOffset, 0)

    if (preferOpposite) {
      cameraLocalOffset.x *= -1
      cameraLocalOffset.y = springControls.cameraUpOffset + sign * sideOffset
      cameraLocalOffset.z += (defaultBrickSpec.depth * 0.6) * springControls.pathScale
    }

    const cameraOffsetWorld = cameraLocalOffset.clone().applyQuaternion(brickWorldQuat)
    const camDesiredWorld = brickWorldPos.clone().add(cameraOffsetWorld)

    const camZ = zAxis_brick.clone().multiplyScalar(-1).applyQuaternion(groupQuat).normalize()
    const camY = yOrtho.clone().applyQuaternion(groupQuat).normalize()
    const camX = new THREE.Vector3().crossVectors(camY, camZ).normalize()
    const camBasisMat = new THREE.Matrix4().makeBasis(camX, camY, camZ)
    const camQuatFromBasis = new THREE.Quaternion().setFromRotationMatrix(camBasisMat)
    const camEuler = new THREE.Euler().setFromQuaternion(camQuatFromBasis, 'YXZ')
    if (springControls.mode === 'oppositeSide' || springControls.mode === 'oppositeSideMove') camEuler.y += Math.PI
    camEuler.y += THREE.MathUtils.degToRad(springControls.yOffsetDeg || 0)
    camEuler.x += THREE.MathUtils.degToRad(springControls.xOffsetDeg || 0)
    const camFinalQuat = new THREE.Quaternion().setFromEuler(camEuler)

    return { camDesiredWorld, camFinalQuat, brickWorldPos }
  }

  function startTransitionFade(now) {
    const overlay = overlayDOMRef.current
    if (!overlay) return
    fadeActiveRef.current = true
    fadeStartRef.current = now
    const color = fadeColorRef.current || '#000000'
    overlay.style.background = color
    overlay.style.opacity = '1'
    overlay.style.transition = 'none'
  }

  function animateTransitionOverlay(now) {
    const overlay = overlayDOMRef.current
    if (!overlay) return
    if (!fadeActiveRef.current) return
    const elapsed = now - fadeStartRef.current
    const dur = Math.max(0.001, fadeDurationRef.current || 1.0)
    const t = elapsed / dur
    if (t >= 1.0) {
      overlay.style.opacity = '0'
      fadeActiveRef.current = false
      try { overlay.style.background = 'transparent' } catch (e) {}
    } else {
      const opacity = Math.max(0, 1.0 - t)
      overlay.style.opacity = String(opacity)
    }
  }

  // Helper: compute world quaternion from pose (localQuat), groupMatrix, optional local extra and world-facing yaw
  function computeWorldQuatFromPose (localQuat, groupMatrix, extraEulerLocal = new THREE.Euler(0,0,0,'YXZ'), worldFacingDeg = 0) {
    // apply extra local rotation on the right (local space)
    const extraQ = new THREE.Quaternion().setFromEuler(extraEulerLocal)
    const composedLocal = localQuat.clone().multiply(extraQ) // localQuat * extraQ

    // group quat (world rotation of curve group)
    const groupQuat = new THREE.Quaternion().setFromRotationMatrix(groupMatrix)

    // world quaternion: groupQuat * composedLocal
    const worldQuat = groupQuat.clone().multiply(composedLocal)

    // apply optional world-facing yaw (premultiply on left so it's world-space yaw)
    const yawRad = THREE.MathUtils.degToRad(Number(worldFacingDeg || 0))
    if (Math.abs(yawRad) > 1e-6) {
      const facingQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yawRad)
      return facingQuat.clone().multiply(worldQuat)
    }
    return worldQuat
  }

  // temp vector for reuse
  const tmpVec = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    if (!scroll || !cameraRef.current || !springGroupRef.current) return

    if (!overlayDOMRef.current && overlayRefHolder && overlayRefHolder.current) {
      overlayDOMRef.current = overlayRefHolder.current
    }

    // read curve portion from curveControls (separate)
    const rawOffset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    const tRaw = rawOffset

    const split = THREE.MathUtils.clamp(curveControls.curvePortion, 0.02, 0.9)
    const inCurvePhase = tRaw <= split
    const curveT = THREE.MathUtils.clamp(split > 0 ? tRaw / split : 0, 0, 1)
    const springT = THREE.MathUtils.clamp(split < 1 ? (tRaw - split) / (1 - split) : 0, 0, 1)

    curveTRef.current = curveT

    const currentPhase = inCurvePhase ? 'curve' : 'spring'
    if (phaseRef.current !== currentPhase) {
      // we've switched phase
      startTransitionFade(state.clock.elapsedTime)
      phaseRef.current = currentPhase
      // reset applied flag when entering curve phase so start GUI will apply once
      if (currentPhase === 'curve') {
        appliedCameraStartRef.current = false
      }
      console.log(`📸 Camera now on: ${currentPhase === 'curve' ? 'CurvePath 🌀' : 'SpringPath 🧱'}`)
    }

    // ----------------- CURVE PHASE camera behavior -----------------
    // We try to get pose from CurvePath if available
    let poseLocal = null
    if (curveRef.current && typeof curveRef.current.getPoseAt === 'function') {
      poseLocal = curveRef.current.getPoseAt(curveT)
    }

    const curveMatrixWorld = ensureCurveMatrixWorld()
    const curveGroupQuat = new THREE.Quaternion().setFromRotationMatrix(curveMatrixWorld)
    const curveTargetPos = new THREE.Vector3()
    const curveTargetQuat = new THREE.Quaternion()

    if (poseLocal) {
      const localPos = poseLocal.position.clone()
      const localQuat = poseLocal.quaternion.clone()

      const userLocalOffset = new THREE.Vector3(
        curveControls.camLocalOffsetX || 0,
        curveControls.camLocalOffsetY || 0,
        curveControls.camLocalOffsetZ || 0
      )
      const posWithLocalOffset = localPos.clone().add(userLocalOffset)

      const extraYaw = THREE.MathUtils.degToRad(curveControls.camExtraYawDeg || 0)
      const extraPitch = THREE.MathUtils.degToRad(curveControls.camExtraPitchDeg || 0)
      const extraRoll = THREE.MathUtils.degToRad(curveControls.camExtraRollDeg || 0)
      const extraEulerLocal = new THREE.Euler(extraPitch, extraYaw, extraRoll, 'YXZ')
      const extraQuatLocal = new THREE.Quaternion().setFromEuler(extraEulerLocal)

      const composedLocalQuat = localQuat.clone().multiply(extraQuatLocal)

      const worldPos = posWithLocalOffset.clone().applyMatrix4(curveMatrixWorld)
      const worldQuat = composedLocalQuat.clone().premultiply(curveGroupQuat)

      curveTargetPos.copy(worldPos)
      curveTargetQuat.copy(worldQuat)

      // --- APPLY GUI camera-start ONCE when entering the curve phase ---
      // If user selected start/end & facing by GUI, place camera immediately once at that point.
      if (!appliedCameraStartRef.current && phaseRef.current === 'curve') {
        try {
          const desiredT = curveControls.cameraStartPosition === 'end' ? 1.0 : 0.0
          const startPose = (curveRef.current.getPoseAt) ? curveRef.current.getPoseAt(desiredT) : null
          if (startPose && curveGroupRef.current && cameraRef.current) {
            const cm = ensureCurveMatrixWorld()
            const extraEulerAtStart = new THREE.Euler(
              THREE.MathUtils.degToRad(curveControls.camExtraPitchDeg || 0),
              THREE.MathUtils.degToRad(curveControls.camExtraYawDeg || 0),
              THREE.MathUtils.degToRad(curveControls.camExtraRollDeg || 0),
              'YXZ'
            )
            const worldQuatForStart = computeWorldQuatFromPose(startPose.quaternion, cm, extraEulerAtStart, curveControls.cameraStartFacingDeg || 0)
            const startWorldPos = startPose.position.clone().applyMatrix4(cm)
            cameraRef.current.position.copy(startWorldPos)
            cameraRef.current.quaternion.copy(worldQuatForStart)
            cameraRef.current.updateMatrixWorld()
            appliedCameraStartRef.current = true
          } else {
            // nothing to do now; will be retried next frames when curveRef becomes available
          }
        } catch (e) {
          // ignore, will retry next frames
        }
      }
    } else {
      // fallback if pose not available
      const tmpL = fallbackCurveHelix.getPoint(curveT).multiplyScalar(curveControls.curve_pathScale)
      curveTargetPos.copy(tmpL.applyMatrix4(curveMatrixWorld))
      const aheadTmp = fallbackCurveHelix.getPoint(THREE.MathUtils.clamp(curveT + (curveControls.curveAhead || 0.02), 0, 1)).multiplyScalar(curveControls.curve_pathScale).applyMatrix4(curveMatrixWorld)
      const m = new THREE.Matrix4()
      m.lookAt(curveTargetPos, aheadTmp, new THREE.Vector3(0, 1, 0))
      curveTargetQuat.setFromRotationMatrix(m)
    }

    // Camera behavior when in curve phase
    if (inCurvePhase) {
      const posSmooth = THREE.MathUtils.clamp(1 - Math.exp(-springControls.positionSmoothing * 10 * delta), 0, 1)
      const rotSmooth = THREE.MathUtils.clamp(1 - Math.exp(-springControls.rotationSmoothing * 8 * delta), 0, 1)

      const upOffsetWorld = new THREE.Vector3(0, (springControls.cameraUpOffset || 0), 0).applyQuaternion(curveTargetQuat)
      const finalTargetPos = curveTargetPos.clone().add(upOffsetWorld)

      // clamp rotations (so x/y rotation doesn't exceed allowed)
      const currentEuler = new THREE.Euler().setFromQuaternion(curveTargetQuat, 'YXZ')
      if (!initialCurveEulerRef.current) {
        initialCurveEulerRef.current = { x: currentEuler.x, y: currentEuler.y, z: currentEuler.z }
      }

      const initialPitch = initialCurveEulerRef.current ? initialCurveEulerRef.current.x : 0
      const deltaPitch = currentEuler.x - initialPitch
      const fallbackMaxDeg = Math.max(1, curveControls.curveMaxAxisDeg || 10)
      const fallbackMaxRad = THREE.MathUtils.degToRad(fallbackMaxDeg) * (curveControls.curveMaxXPercent || 0.10)
      const allowedMax = Math.max(Math.abs(initialPitch) * (curveControls.curveMaxXPercent || 0.10), fallbackMaxRad)
      const clampedDelta = THREE.MathUtils.clamp(deltaPitch, -allowedMax, allowedMax)

      const clampedEuler = new THREE.Euler(
        initialPitch + clampedDelta,
        THREE.MathUtils.clamp(currentEuler.y, -THREE.MathUtils.degToRad(curveControls.curveMaxAxisDeg || 10), THREE.MathUtils.degToRad(curveControls.curveMaxAxisDeg || 10)),
        0,
        'YXZ'
      )

      const clampedQuat = new THREE.Quaternion().setFromEuler(clampedEuler)

      cameraRef.current.position.lerp(finalTargetPos, posSmooth)
      cameraRef.current.quaternion.slerp(clampedQuat, rotSmooth)
      cameraRef.current.updateMatrixWorld()

      if (sphereRef.current) sphereRef.current.visible = false

      smoothedIndexRef.current = 0
      bricksActiveRef.current = 0
    } else {
      if (initialCurveEulerRef.current) initialCurveEulerRef.current = null

      // SPRING phase (unchanged)
      const count = Math.max(1, Math.floor(springControls.brickCount || 1))
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

      const camOppPos = springCandidateOpp.camDesiredWorld
      const camOppQuat = springCandidateOpp.camFinalQuat
      const camSpringPos = springCandidateNormal.camDesiredWorld
      const camSpringQuat = springCandidateNormal.camFinalQuat

      const targetPos = new THREE.Vector3().lerpVectors(camOppPos, camSpringPos, alpha)
      const targetQuat = new THREE.Quaternion().slerpQuaternions(camOppQuat, camSpringQuat, alpha)

      const posSmooth = THREE.MathUtils.clamp(1 - Math.exp(-springControls.positionSmoothing * 10 * delta), 0, 1)
      const rotSmooth = THREE.MathUtils.clamp(1 - Math.exp(-springControls.rotationSmoothing * 20 * delta), 0, 1)

      cameraRef.current.position.lerp(targetPos, posSmooth)
      cameraRef.current.quaternion.slerp(targetQuat, rotSmooth)
      cameraRef.current.updateMatrixWorld()

      if (sphereRef.current) {
        sphereRef.current.visible = springControls.showDebugMarker
        if (sphereRef.current.visible) sphereRef.current.position.copy(springCandidateNormal.brickWorldPos)
      }

      // bricks activation (spring-only)
      const t = springT
      const targetIndexF = t * count
      bricksActiveRef.current = targetIndexF
      activeIndexRef.current = bricksActiveRef.current

      const cur = smoothedIndexRef.current || 0
      let diff = targetIndexF - cur
      const absDiff = Math.abs(diff)

      const baseLerp =
        1 - Math.exp(-Math.max(0.0001, springControls.scrollResponsiveness) * 60 * delta)
      const scale =
        1 - Math.min(1, (absDiff * springControls.startupBias) / Math.max(1, count * 0.25))
      let lerpFactor = baseLerp * (0.2 + 0.8 * scale)
      const maxStepEffective = Math.max(0.001, springControls.maxStep) * (delta * 60)
      let step = diff * lerpFactor
      if (Math.abs(step) > maxStepEffective)
        step = Math.sign(step) * maxStepEffective

      const next = cur + step
      smoothedIndexRef.current = next
    }

    // ----------------- Indicator update (red ball on path) -----------------
    // Always update indicator to show camera-target position on the curve for current curveT
    try {
      if (curveRef.current && indicatorRef.current) {
        // get curve local point at curveT (CurvePath's API returns scaled position already)
        let localPoint = null
        if (typeof curveRef.current.getPoint === 'function') {
          localPoint = curveRef.current.getPoint(curveT, tmpVec).clone()
        } else if (typeof curveRef.current.getPoseAt === 'function') {
          const pose = curveRef.current.getPoseAt(curveT)
          localPoint = pose ? pose.position.clone() : null
        }
        if (localPoint) {
          // convert to world using curveGroup matrix
          const cm = ensureCurveMatrixWorld()
          localPoint.applyMatrix4(cm)
          indicatorRef.current.position.lerp(localPoint, 0.6) // smooth a bit
          indicatorRef.current.visible = true
        } else {
          indicatorRef.current.visible = false
        }
      }
    } catch (e) {
      // ignore errors - indicator optional
    }

    // animate overlay fade
    animateTransitionOverlay(state.clock.elapsedTime)

    lastRawRef.current = rawOffset
  })

  // keep overlay refs in sync
  useEffect(() => {
    if (overlayRefHolder && overlayRefHolder.current) overlayDOMRef.current = overlayRefHolder.current
  }, [overlayRefHolder])

  useEffect(() => { fadeDurationRef.current = Math.max(0.01, Number(misc.transitionFadeDuration) || 1.0) }, [misc.transitionFadeDuration])
  useEffect(() => { fadeColorRef.current = misc.transitionFadeColor || '#000000' }, [misc.transitionFadeColor])

  // If GUI changed while we're already in curve phase, attempt immediate re-apply
  useEffect(() => {
    if (!curveRef.current || !cameraRef.current || !curveGroupRef.current) return
    if (phaseRef.current !== 'curve') return
    // next tick ensure we apply start placement (if not applied)
    try {
      const desiredT = curveControls.cameraStartPosition === 'end' ? 1.0 : 0.0
      const startPose = (curveRef.current.getPoseAt) ? curveRef.current.getPoseAt(desiredT) : null
      if (startPose) {
        const cm = ensureCurveMatrixWorld()
        const extraEulerAtStart = new THREE.Euler(
          THREE.MathUtils.degToRad(curveControls.camExtraPitchDeg || 0),
          THREE.MathUtils.degToRad(curveControls.camExtraYawDeg || 0),
          THREE.MathUtils.degToRad(curveControls.camExtraRollDeg || 0),
          'YXZ'
        )
        const worldQuatForStart = computeWorldQuatFromPose(startPose.quaternion, cm, extraEulerAtStart, curveControls.cameraStartFacingDeg || 0)
        const startWorldPos = startPose.position.clone().applyMatrix4(cm)
        cameraRef.current.position.copy(startWorldPos)
        cameraRef.current.quaternion.copy(worldQuatForStart)
        cameraRef.current.updateMatrixWorld()
        appliedCameraStartRef.current = true
      }
    } catch (e) {
      // ignore
    }
  }, [curveControls.cameraStartPosition, curveControls.cameraStartFacingDeg, curveControls.camExtraYawDeg, curveControls.camExtraPitchDeg, curveControls.camExtraRollDeg])

  /* ------------------ JSX return ------------------ */
  const curveGroupRotationRadians = [
    THREE.MathUtils.degToRad(curveControls.curveGroupRotXDeg || 0),
    THREE.MathUtils.degToRad(curveControls.curveGroupRotYDeg || 0),
    THREE.MathUtils.degToRad(curveControls.curveGroupRotZDeg || 0)
  ]

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
        {/* CurvePath group: position & rotation controlled by curveControls only */}
        <e.group
          theatreKey='CurvePath'
          ref={curveGroupRef}
          position={[curveControls.curveGroupPosX || 0, curveControls.curveGroupPosY || 0, curveControls.curveGroupPosZ || 0]}
          rotation={curveGroupRotationRadians}
        >
          <CurvePath
            ref={curveRef}
            turns={curveControls.curve_turns}
            coilRadius={curveControls.curve_coilRadius}
            pathHeight={curveControls.curve_pathHeight}
            pathScale={curveControls.curve_pathScale}
            samples={160}
            lift={2.0}
            showLine={true} // ensure the full curve is visible always
            lineColor={curveControls.curve_lineColor}
            lineRadius={0.18}
            hiddenBrickCount={Math.max(64, Math.floor((springControls.brickCount || 25) * 4))}
            hiddenBrickSize={[0.01, 0.01, 0.01]}
            showHiddenHelpers={false}

            // bricks props (curve-specific)
            bricks={true}
            brickCount={Math.max(1, Math.floor((springControls.brickCount || 25)))}
            brick={defaultBrickSpec}
            radialOffset={curveControls.curve_radialOffset}
            brickColor={'#d16b50'}
            texturePath={'/textures/brick-texture.jpg'}
          />
        </e.group>

        {/* Front copy (camera-relative preview of small section of path) */}
        <FrontCopy
          curveRef={curveRef}
          cameraRef={cameraRef}
          curveT={curveTRef.current}
          enabled={curveControls.frontCopyEnabled}
          show={curveControls.curve_showFrontCopy}
          segPoints={curveControls.frontCopySegPoints}
          windowHalf={curveControls.frontCopyWindow}
          lengthFix={curveControls.frontCopyLengthFix}
          forwardOffset={curveControls.frontCopyOffset}
          color={curveControls.frontCopyColor}
          opacity={curveControls.frontCopyOpacity}
          depthTest={curveControls.frontCopyDepthTest}
        />

        {/* red indicator sphere that follows camera-target position on the curve */}
        <mesh ref={indicatorRef} visible position={[0,0,0]} renderOrder={999}>
          <sphereGeometry args={[0.12, 12, 10]} />
          <meshStandardMaterial color={'#ff4444'} emissive={'#660000'} emissiveIntensity={0.6} />
        </mesh>

        {/* SpringPath group: uses springControls only (kept separate & unchanged in behavior) */}
        <e.group theatreKey='SpringGroup' ref={springGroupRef} position={[0, 0, 0]}>
          <SpringPath
            count={Math.max(1, Math.floor(springControls.brickCount || 25))}
            turns={springControls.turns}
            coilRadius={springControls.coilRadius}
            height={springControls.pathHeight}
            scale={springControls.pathScale}
            radialOffset={springControls.radialOffset}
            texturePath='/textures/brick-texture.jpg'
            cameraRef={cameraRef}
            hiddenDepth={springControls.hiddenDepth}
            activationRange={springControls.activationRange}
            riseSpeed={springControls.riseSpeed}
            debugShowBricks={true}
            debugForceProgress={true}
            debugFallbackMeshes={true}
            activeIndexRef={bricksActiveRef}
            activeRadius={springControls.activeRadius}
            activeFade={springControls.activeFade}
            downAmplitude={springControls.downAmplitude}
            frontHold={springControls.frontHold}
            curvatureEnabled={springControls.curvatureEnabled}
            curvatureStrength={springControls.curvatureStrength}
            curvatureRange={springControls.curvatureRange}
            curvatureFalloff={springControls.curvatureFalloff}
            floatEnabled={springControls.floatEnabled}
            floatSpeed={springControls.floatSpeed}
            rotationIntensity={springControls.rotationIntensity}
            floatIntensity={springControls.floatIntensity}
            floatingRange={springControls.floatingRange}
            riseSmoothing={springControls.riseSmoothing}
            wave={{ enabled: false }}
            brickSpec={defaultBrickSpec}
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
          <RockStone scale={10} />
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
