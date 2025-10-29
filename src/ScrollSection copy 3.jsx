// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, Suspense, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ScrollControls,
  useScroll,
  Scroll,
  Float,
  Text,
  Html
} from '@react-three/drei'

import FixedHeroText from './component/FixedHeroText.jsx'

import { useControls, monitor, Leva } from 'leva'
import { getProject, val } from '@theatre/core'
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

// -----------------------/component/------------
import WaterScene from './component/WaterScene'
import UnderwaterFog from './component/underwater/UnderwaterFog'
import SandSurface from './component/underwater/SandSurface'
import CausticsLightProjector from './component/underwater/CausticsLightProjector'
import CloudFloating from './component/CloudFloating.jsx'
// -----------------------/rock/-------------
import { L1stone } from './rock/L1-stone.jsx'
import { L2stone } from './rock/L2-stone.jsx'
import { L3stone } from './rock/L3-stone.jsx'
import { R1stone } from './rock/R1-stone.jsx'
import RockStone from './rock/RockStone.jsx'
import { Pillarstone } from './rock/Pillarstone.jsx'
// -----------------------/assets/----------
import sandUrl from '../src/assets/sand.jpg?url'
import videoUrl from '../src/assets/caustics.mp4?url'
// -----------------------/upperWater/----------
import { Fish } from './upperWater/fish.jsx'
import { Seashell } from './upperWater/Seashell.jsx'
// -----------------------/----------
import SpringPath from './SpringPath'
import { ConchShell } from './ConchShell.jsx'
import ScrollOffsetBridge from './ScrollOffsetBridge.jsx'
import ImagePlane from './ImagePlane.jsx'
// -----------------------------------------------

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Product } from './component/Product.jsx'
import CloudFloatingNew from './component/CloudFloatingNew.jsx'

import TextBoxUnderWater from './component/underwater/TextBoxUnderWater.jsx'
import ScrollLockControllerWithCarry from './ScrollLockControllerWithCarry.jsx'
import UnderwaterSleeve from './component/underwater/UnderwaterSleeve.jsx'
import ShaderSingleBeam from './component/underwater/ShaderSingleBeam.jsx'
import { UnderWaterMountainSide } from './component/underwater/UnderWaterMountainSide.jsx'
gsap.registerPlugin(ScrollTrigger)

/* ---------------- Config ---------------- */
const PAGES = 21
const SPHERE_RADIUS = 0.07

// theatre override window (seconds)
const AUTOSTART_SEC = 28
const AUTOEND_SEC = 1000

// default timings (can be overridden via GUI)
const DEFAULT_FADE_ENTER_MS = 40
const DEFAULT_FADE_EXIT_MS = 500
const DEFAULT_FADE_HOLD_MS = 20
const DEFAULT_FORCED_BLEND_MS = 500
const DEFAULT_FADE_COOLDOWN_MS = 300

const BLEND_MS = 200

/* ---------------- HelixCurve (needed by Scene) ---------------- */
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

/* ---------------- Responsive helpers ---------------- */
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

/* ---------------- camera blend helper ---------------- */
function smoothBlendCamera (
  cameraRef,
  targetPos,
  targetQuat,
  duration = BLEND_MS
) {
  if (!cameraRef?.current) return () => {}
  const startPos = cameraRef.current.position.clone()
  const startQuat = cameraRef.current.quaternion.clone()
  const startTime = performance.now()
  let cancelled = false
  function step () {
    if (cancelled || !cameraRef.current) return
    const now = performance.now()
    const t = Math.min(1, (now - startTime) / duration)
    cameraRef.current.position.lerpVectors(startPos, targetPos, t)
    cameraRef.current.quaternion.slerpQuaternions(startQuat, targetQuat, t)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  return () => {
    cancelled = true
  }
}

/* ---------------- Leva monitor (small) ---------------- */
function CameraDebugGUI ({ cameraRef, isOverriding }) {
  useControls(
    'Camera Debug',
    {
      OverrideActive: monitor(() => (isOverriding ? 'YES' : 'no'), {
        interval: 250
      }),
      PositionXYZ: monitor(
        () => {
          const c = cameraRef.current
          if (!c) return '—'
          const p = c.position
          return `${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}`
        },
        { interval: 250 }
      ),
      RotationEulerDeg_YXZ: monitor(
        () => {
          const c = cameraRef.current
          if (!c) return '—'
          const e = new THREE.Euler().setFromQuaternion(c.quaternion, 'YXZ')
          return `${THREE.MathUtils.radToDeg(e.x).toFixed(
            1
          )}, ${THREE.MathUtils.radToDeg(e.y).toFixed(
            1
          )}, ${THREE.MathUtils.radToDeg(e.z).toFixed(1)}`
        },
        { interval: 250 }
      ),
      Quaternion: monitor(
        () => {
          const c = cameraRef.current
          if (!c) return '—'
          const q = c.quaternion
          return `${q.x.toFixed(4)}, ${q.y.toFixed(4)}, ${q.z.toFixed(
            4
          )}, ${q.w.toFixed(4)}`
        },
        { interval: 250 }
      )
    },
    { collapsed: false }
  )
  return null
}

/* ---------------- Small DOM overlay to copy values ---------------- */
function CameraCopyOverlay ({ cameraRef }) {
  const [pos, setPos] = useState('—')
  const [eulerYXZ, setEulerYXZ] = useState('—')
  const [quat, setQuat] = useState('—')

  useEffect(() => {
    let mounted = true
    const id = setInterval(() => {
      if (!mounted) return
      const c = cameraRef.current
      if (!c) {
        setPos('—')
        setEulerYXZ('—')
        setQuat('—')
        return
      }
      const p = c.position
      setPos(`${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}`)
      const e = new THREE.Euler().setFromQuaternion(c.quaternion, 'YXZ')
      setEulerYXZ(
        `${THREE.MathUtils.radToDeg(e.x).toFixed(
          3
        )}, ${THREE.MathUtils.radToDeg(e.y).toFixed(
          3
        )}, ${THREE.MathUtils.radToDeg(e.z).toFixed(3)}`
      )
      const q = c.quaternion
      setQuat(
        `${q.x.toFixed(6)}, ${q.y.toFixed(6)}, ${q.z.toFixed(6)}, ${q.w.toFixed(
          6
        )}`
      )
    }, 120)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [cameraRef])

  const copyToClipboard = text => {
    try {
      navigator.clipboard.writeText(text)
    } catch (e) {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 9999,
        background: 'rgba(10,10,12,0.75)',
        color: '#eee',
        padding: '10px 12px',
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: 12,
        maxWidth: 400,
        display: 'none'
      }}
    >
      <div style={{ marginBottom: 6, fontWeight: 600 }}>
        Camera (copy for Theatre)
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ color: '#9aaaaa' }}>Position (XYZ)</div>
        <div>{pos}</div>
        <button style={{ marginTop: 6 }} onClick={() => copyToClipboard(pos)}>
          Copy Position
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ color: '#9aa' }}>Rotation (Euler YXZ in degrees)</div>
        <div>{eulerYXZ}</div>
        <button
          style={{ marginTop: 6 }}
          onClick={() => copyToClipboard(eulerYXZ)}
        >
          Copy Euler (YXZ)
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ color: '#9aa' }}>Quaternion (x, y, z, w)</div>
        <div style={{ wordBreak: 'break-all' }}>{quat}</div>
        <button style={{ marginTop: 6 }} onClick={() => copyToClipboard(quat)}>
          Copy Quaternion
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
        Tip: paste quaternion into Theatre if possible — it preserves rotation
        exactly.
      </div>
    </div>
  )
}

/* ---------------- Controlled fade overlay (reads controller) ---------------- */
function ControlledFadeOverlay ({
  color = '#050417',
  exitDuration = DEFAULT_FADE_EXIT_MS,
  holdMs = DEFAULT_FADE_HOLD_MS
}) {
  const [mode, setMode] = useState('hidden') // 'hidden' | 'entered' | 'exiting'
  useEffect(() => {
    let mounted = true
    let holdTimer = null

    function checkController () {
      const ctrl = window._springFadeController
      if (!ctrl) return
      // Only respond if controller has a valid sessionId
      if (!ctrl.sessionId) return

      // ENTER: only once per controller.session
      if (ctrl.enter && !ctrl.entered) {
        ctrl.entered = true
        ctrl.exited = false
        window._springFadeController = ctrl
        setMode('entered')
        // hold period before allowing automatic exit to start (so quick toggles don't retrigger)
        if (holdMs > 0) {
          clearTimeout(holdTimer)
          holdTimer = setTimeout(() => {
            // after hold, we remain in 'entered' until ctrl.exit flips
          }, holdMs)
        }
      }
      // EXIT: trigger fade out once
      if (ctrl.exit && !ctrl.exited) {
        ctrl.exited = true
        window._springFadeController = ctrl
        setMode('exiting')
        setTimeout(() => {
          if (mounted) setMode('hidden')
        }, Math.max(40, exitDuration + 80))
      }
    }
    const id = setInterval(checkController, 80)
    checkController()
    return () => {
      mounted = false
      clearInterval(id)
      clearTimeout(holdTimer)
    }
  }, [exitDuration, holdMs])

  if (mode === 'hidden') return null
  const base = {
    pointerEvents: 'none',
    position: 'fixed',
    left: 0,
    top: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 99999,
    background: color
  }
  if (mode === 'entered') {
    return <div style={{ ...base, opacity: 1 }} />
  }
  // exiting: fade out
  return (
    <div
      style={{
        ...base,
        opacity: 1,
        transition: `opacity ${exitDuration}ms cubic-bezier(.2,.0,.0,1)`
      }}
      ref={el => {
        if (!el) return
        requestAnimationFrame(() => {
          if (el) el.style.opacity = 0
        })
      }}
    />
  )
}

/* ---------------- Main component ---------------- */
export default function ScrollSection () {
  const project = getProject('myProject', { state: theatreeBBState })

  window.__THEATRE_PROJECT__ = project

  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 22 : PAGES

  // --- LEVA: keep all existing GUI controls intact; add Fade group (color + timings + cooldown)
  const { fadeColor, forcedBlendMs, fadeExitMs, fadeHoldMs, fadeCooldownMs } =
    useControls('Fade', {
      fadeColor: { value: '#f2cdc4' },
      forcedBlendMs: {
        value: DEFAULT_FORCED_BLEND_MS,
        min: 50,
        max: 3000,
        step: 10
      },
      fadeExitMs: { value: DEFAULT_FADE_EXIT_MS, min: 50, max: 3000, step: 10 },
      fadeHoldMs: { value: DEFAULT_FADE_HOLD_MS, min: 0, max: 2000, step: 10 },
      fadeCooldownMs: {
        value: DEFAULT_FADE_COOLDOWN_MS,
        min: 0,
        max: 2000,
        step: 10
      }
    })

  // NEW: Fade toggles for up/down enter/exit
  const { upEnterEnabled, upExitEnabled, downEnterEnabled, downExitEnabled } =
    useControls('Fade Toggles', {
      upEnterEnabled: { label: 'Up-scroll: ENTER enabled', value: true },
      upExitEnabled: { label: 'Up-scroll: EXIT enabled', value: true },
      downEnterEnabled: { label: 'Down-scroll: ENTER enabled', value: true },
      downExitEnabled: { label: 'Down-scroll: EXIT enabled', value: true }
    })

  // make these available to the Scene/bridge via global defaults
  useEffect(() => {
    window._springFadeDefaults = {
      forcedBlendMs: forcedBlendMs,
      fadeExitMs: fadeExitMs,
      fadeHoldMs: fadeHoldMs,
      fadeCooldownMs: fadeCooldownMs,
      fadeColor: fadeColor
    }
  }, [forcedBlendMs, fadeExitMs, fadeHoldMs, fadeCooldownMs, fadeColor])

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Leva hidden={isMobile} />

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

        <ScrollOffsetBridge />
        <ScrollControls pages={pages} distance={2} damping={0.35}>
          <SheetProvider sheet={sheet}>
            <Scene
              sheet={sheet}
              guiFadeDefaults={{
                forcedBlendMs,
                fadeExitMs,
                fadeHoldMs,
                fadeCooldownMs,
                fadeColor,
                // pass toggles so Scene logic can read them immediately
                upEnterEnabled,
                upExitEnabled,
                downEnterEnabled,
                downExitEnabled
              }}
            />

            <ScrollOffsetBridge />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
          {/* <ScrollLockControllerWithCarry/> */}
        </ScrollControls>
      </Canvas>

      {/* overlays */}
      <CameraOverlayBridge />
      <FadeOverlayBridge />
    </div>
  )
}

/* ---------------- Bridge components ---------------- */
function CameraOverlayBridge () {
  const [cameraRef, setCameraRef] = useState(null)
  useEffect(() => {
    const id = setInterval(() => {
      if (window._springCamRef && window._springCamRef.current)
        setCameraRef(window._springCamRef)
    }, 200)
    return () => clearInterval(id)
  }, [])
  if (!cameraRef) return null
  return <CameraCopyOverlay cameraRef={cameraRef} />
}

function FadeOverlayBridge () {
  const defaults =
    (typeof window !== 'undefined' && window._springFadeDefaults) || {}
  const color = defaults.fadeColor || '#f2cdc4'
  const exitDuration = defaults.fadeExitMs || DEFAULT_FADE_EXIT_MS
  const holdMs = defaults.fadeHoldMs || DEFAULT_FADE_HOLD_MS
  return (
    <ControlledFadeOverlay
      color={color}
      exitDuration={exitDuration}
      holdMs={holdMs}
    />
  )
}

/* ---------------- Scene (inside Canvas) ---------------- */
function Scene ({ sheet, guiFadeDefaults = {} }) {
  const scroll = useScroll()
  const { set } = useThree()

  const cameraRef = useRef()
  const springGroupRef = useRef()
  const sphereRef = useRef()
  const wrapperRef = useRef()

  // expose cameraRef externally for overlay copy
  useEffect(() => {
    window._springCamRef = cameraRef
  }, [cameraRef])
  // Scene component-এর ভিতরে:
  useEffect(() => {
    window._springSheetRef = sheet
  }, [sheet])

  useResponsiveSetup({ wrapperRef, cameraRef })

  const {
    turns,
    coilRadius,
    tubeRadius,
    pathHeight,
    pathScale,
    radialOffset,

    mode,
    startAt,
    brickCount,
    cameraSideOffset,
    cameraUpOffset,
    yOffsetDeg,
    xOffsetDeg,
    zOffsetDeg,
    positionSmoothing,
    rotationSmoothing,
    showDebugMarker,

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
  } = useControls({
    turns: { value: 0.95, min: 0.1, max: 4, step: 0.01 },
    coilRadius: { value: 5.0, min: 0.1, max: 20, step: 0.1 },
    tubeRadius: { value: 0.6, min: 0, max: 5, step: 0.01 },
    pathHeight: { value: 10, min: 0.1, max: 100, step: 0.1 },
    pathScale: { value: 5, min: 0.1, max: 50, step: 0.1 },
    radialOffset: { value: 0, min: -10, max: 10, step: 0.01 },

    mode: {
      value: 'oppositeSideMove',
      options: ['normal', 'oppositeSide', 'oppositeSideMove']
    },
    startAt: { value: 'top', options: ['top', 'bottom'] },
    brickCount: { value: 20, min: 1, max: 400, step: 1 },
    cameraSideOffset: { value: -10, min: -40, max: 40, step: 0.01 },
    cameraUpOffset: { value: 5.0, min: -20, max: 50, step: 0.01 },
    yOffsetDeg: { value: -64, min: -180, max: 180, step: 0.1 },
    xOffsetDeg: { value: -8, min: -180, max: 180, step: 0.1 },
    zOffsetDeg: { value: 0, min: -180, max: 180, step: 0.1 },
    positionSmoothing: { value: 0.38, min: 0, max: 1, step: 0.01 },
    rotationSmoothing: { value: 0.2, min: 0, max: 1, step: 0.005 },
    showDebugMarker: { value: true },

    hiddenDepth: { value: 70, min: 0, max: 400, step: 1 },
    activationRange: { value: 60, min: 1, max: 400, step: 0.5 },
    riseSpeed: { value: 10, min: 0.1, max: 30, step: 0.1 },

    activeRadius: { value: 3, min: 0, max: 80, step: 1 },
    activeFade: { value: 5, min: 0, max: 80, step: 0.5 },
    downAmplitude: { value: 22.0, min: 0, max: 80, step: 0.1 },
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

    minCameraDistance: { value: 19, min: 1, max: 400, step: 1 },

    minCamY: { value: -5, min: -200, max: 200, step: 1 },
    maxCamY: { value: 80, min: -200, max: 200, step: 1 },
    maxMovePerFrameFactor: { value: 0.15, min: 0.01, max: 10, step: 0.01 }
  })

  const brickSpec = useMemo(() => ({ width: 3, height: 2, depth: 8 }), [])
  const curve = useMemo(
    () => new HelixCurve({ turns, radius: coilRadius, height: pathHeight }),
    [turns, coilRadius, pathHeight]
  )

  function ensureMatrixWorld () {
    if (!springGroupRef.current) return new THREE.Matrix4()
    springGroupRef.current.updateMatrixWorld(true)
    return springGroupRef.current.matrixWorld.clone()
  }

  const activeIndexRef = useRef(0)
  const bricksActiveRef = useRef(0)
  const smoothedIndexRef = useRef(0)
  const lastRawRef = useRef(0)

  // override state tracking
  const [isOverriding, setIsOverriding] = useState(false)
  const prevOverrideRef = useRef(false)
  const blendCancelRef = useRef(null)

  // forced blend state (local refs)
  const forcedBlendRef = useRef({
    active: false,
    startTime: 0,
    duration:
      (guiFadeDefaults && guiFadeDefaults.forcedBlendMs) ||
      (typeof window !== 'undefined' &&
        window._springFadeDefaults?.forcedBlendMs) ||
      DEFAULT_FORCED_BLEND_MS,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    toQuat: new THREE.Quaternion(),
    sessionId: null,
    sessionDir: 'down' // 'down' | 'up'
  })

  // soft pause ref: used to implement the 1s soft-start behavior
  // structure: { active: bool, start: number(ms), duration: number(ms) }
  const softPauseRef = useRef({ active: false, start: 0, duration: 1000 })

  // stability detection
  const stableFramesRef = useRef(0)
  const STABLE_REQUIRED = 3
  const POS_THRESHOLD = 0.12
  const ANGLE_THRESHOLD_DEG = 1.5

  // fade trigger cooldown: avoid repeated quick toggles
  const lastFadeTriggerRef = useRef(0)

  // helper to create unique session id
  function makeSessionId () {
    return `fade-${Date.now().toString(36)}-${Math.floor(
      Math.random() * 1e6
    ).toString(36)}`
  }

  // map scroll -> theatre timeline (keeps theatre in sync)
  useFrame(() => {
    if (!sheet || !scroll) return
    const sequenceLength = Math.max(
      1,
      Number(val(sheet.sequence.pointer.length) || 1)
    )
    sheet.sequence.position = scroll.offset * sequenceLength
  })

  // detect override window (enter / exit)  — leave this unchanged except soft-pause insertion
  useFrame(() => {
    if (!sheet) return
    const rawPos = Number(sheet.sequence.position || 0)
    let fps = 60
    try {
      const ptr = sheet.sequence && sheet.sequence.pointer
      if (ptr) {
        if (typeof ptr.fps === 'number' && ptr.fps > 0) fps = ptr.fps
        else if (typeof ptr.frameRate === 'number' && ptr.frameRate > 0)
          fps = ptr.frameRate
      }
    } catch (e) {}
    const seqPosSeconds = rawPos > 100 ? rawPos / fps : rawPos
    const shouldOverride =
      seqPosSeconds >= AUTOSTART_SEC && seqPosSeconds < AUTOEND_SEC

    // compute scroll direction using lastRawRef (previous frame) and current scroll.offset if available
    let currScrollOffset = null
    try {
      currScrollOffset = scroll
        ? THREE.MathUtils.clamp(scroll.offset, 0, 1)
        : null
    } catch (e) {
      currScrollOffset = null
    }
    const directionDown =
      currScrollOffset == null
        ? true
        : currScrollOffset > (lastRawRef.current || 0)

    if (shouldOverride !== prevOverrideRef.current) {
      // read latest defaults (allow live GUI changes)
      const defaults =
        (typeof window !== 'undefined' && window._springFadeDefaults) ||
        guiFadeDefaults ||
        {}
      const color = defaults.fadeColor || guiFadeDefaults.fadeColor || '#f2cdc4'
      const forcedBlendMs =
        defaults.forcedBlendMs ||
        guiFadeDefaults.forcedBlendMs ||
        DEFAULT_FORCED_BLEND_MS
      const fadeExitMs =
        defaults.fadeExitMs ||
        guiFadeDefaults.fadeExitMs ||
        DEFAULT_FADE_EXIT_MS
      const fadeHoldMs =
        defaults.fadeHoldMs ||
        guiFadeDefaults.fadeHoldMs ||
        DEFAULT_FADE_HOLD_MS
      const fadeCooldownMs =
        defaults.fadeCooldownMs ||
        guiFadeDefaults.fadeCooldownMs ||
        DEFAULT_FADE_COOLDOWN_MS

      const now = performance.now()
      const timeSinceLast = now - (lastFadeTriggerRef.current || 0)
      const allowTrigger =
        timeSinceLast >= (fadeCooldownMs || DEFAULT_FADE_COOLDOWN_MS)

      if (shouldOverride) {
        // ENTER override:
        try {
          sheet.sequence.pause()
        } catch (e) {}

        // compute springPath target and setup forced blend
        let sessionId = makeSessionId()
        try {
          const rawOffset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
          const t = startAt === 'top' ? 1 - rawOffset : rawOffset
          const count = Math.max(1, Math.floor(brickCount))
          const approxIdx = Math.floor(t * count)
          const brickIndex = THREE.MathUtils.clamp(approxIdx, 0, count - 1)
          const brickT = (brickIndex + 0.5) / count
          const localPoint = curve
            .getPointAt(brickT)
            .clone()
            .multiplyScalar(pathScale)
          const radial = new THREE.Vector3(
            localPoint.x,
            0,
            localPoint.z
          ).normalize()
          if (!isFinite(radial.x) || radial.lengthSq() < 1e-6)
            radial.set(1, 0, 0)
          const outwardDist = (brickSpec.depth / 2 + radialOffset) * pathScale
          const outward = radial.clone().multiplyScalar(outwardDist)
          const brickLocalPos = new THREE.Vector3(
            localPoint.x + outward.x,
            localPoint.y,
            localPoint.z + outward.z
          )
          const groupMat = ensureMatrixWorld()
          const worldPos = brickLocalPos.clone().applyMatrix4(groupMat)

          // keep aheadT = brickT to avoid camera looking slightly ahead (prevents jerk)
          const aheadT = brickT
          const aheadPoint = curve
            .getPointAt(aheadT)
            .clone()
            .multiplyScalar(pathScale)
            .applyMatrix4(groupMat)

          // compute desired camera quaternion
          const zAxis_brick = radial.clone().normalize()
          const yAxis_brick = new THREE.Vector3(0, 1, 0)
          const xAxis_brick = new THREE.Vector3()
            .crossVectors(yAxis_brick, zAxis_brick)
            .normalize()
          const yOrtho = new THREE.Vector3()
            .crossVectors(zAxis_brick, xAxis_brick)
            .normalize()
          const groupQuat = new THREE.Quaternion().setFromRotationMatrix(
            groupMat
          )
          const camZ = zAxis_brick
            .clone()
            .multiplyScalar(-1)
            .applyQuaternion(groupQuat)
            .normalize()
          const camY = yOrtho.clone().applyQuaternion(groupQuat).normalize()
          const camX = new THREE.Vector3().crossVectors(camY, camZ).normalize()
          const camBasisMat = new THREE.Matrix4().makeBasis(camX, camY, camZ)
          const camQuatFromBasis = new THREE.Quaternion().setFromRotationMatrix(
            camBasisMat
          )
          const camEuler = new THREE.Euler().setFromQuaternion(
            camQuatFromBasis,
            'YXZ'
          )
          if (mode === 'oppositeSide' || mode === 'oppositeSideMove')
            camEuler.y += Math.PI
          camEuler.y += THREE.MathUtils.degToRad(yOffsetDeg)
          camEuler.x += THREE.MathUtils.degToRad(xOffsetDeg || 0)
          camEuler.z += THREE.MathUtils.degToRad(zOffsetDeg || 0)
          const finalQuat = new THREE.Quaternion().setFromEuler(camEuler)

          // start forced blend from current camera to target
          if (cameraRef && cameraRef.current) {
            forcedBlendRef.current.active = true
            forcedBlendRef.current.startTime = performance.now()
            forcedBlendRef.current.duration = forcedBlendMs
            forcedBlendRef.current.fromPos = cameraRef.current.position.clone()
            forcedBlendRef.current.fromQuat =
              cameraRef.current.quaternion.clone()
            forcedBlendRef.current.toPos = worldPos.clone()
            forcedBlendRef.current.toQuat = finalQuat.clone()
            // attach the session id so forced blend knows which fade session to finish
            forcedBlendRef.current.sessionId = sessionId
            forcedBlendRef.current.sessionDir = directionDown ? 'down' : 'up'
          } else {
            if (cameraRef && cameraRef.current) {
              cameraRef.current.position.copy(worldPos)
              cameraRef.current.quaternion.copy(finalQuat)
              cameraRef.current.updateMatrixWorld()
            }
          }

          // START soft pause on ENTER: this will create a 1s soft-start (ramp-up)
          softPauseRef.current = {
            active: true,
            start: performance.now(),
            duration: 1000 // 1 second soft pause
          }
        } catch (e) {
          console.warn('[FORCED BLEND] compute failed', e)
        }

        // ensure renderer uses our camera next frame
        requestAnimationFrame(() => {
          try {
            set({ camera: cameraRef.current })
          } catch (e) {}
        })

        // trigger fade ENTER with controller and defaults (color + timings)
        // BUT only if cooldown passed and the user toggle for this direction allows it
        try {
          if (allowTrigger) {
            lastFadeTriggerRef.current = now
            const sessionId = makeSessionId()
            const sessionDir = directionDown ? 'down' : 'up'
            // check toggle for this direction (enter)
            const enterAllowed =
              (sessionDir === 'down' &&
                (guiFadeDefaults.downEnterEnabled ??
                  window._springFadeDefaults?.downEnterEnabled ??
                  true)) ||
              (sessionDir === 'up' &&
                (guiFadeDefaults.upEnterEnabled ??
                  window._springFadeDefaults?.upEnterEnabled ??
                  true))

            // If enterAllowed is true, create controller with enter flag; otherwise create defaults only
            if (enterAllowed) {
              window._springFadeController = {
                sessionId,
                enter: true,
                entered: false,
                exit: false,
                exited: false,
                color: color,
                forcedBlendMs,
                fadeExitMs,
                fadeHoldMs,
                sessionDir
              }
              // store defaults for overlay bridge
              window._springFadeDefaults = {
                forcedBlendMs,
                fadeExitMs,
                fadeHoldMs,
                fadeCooldownMs,
                fadeColor: color,
                // persist toggles as well so other code can read them
                upEnterEnabled: guiFadeDefaults.upEnterEnabled,
                upExitEnabled: guiFadeDefaults.upExitEnabled,
                downEnterEnabled: guiFadeDefaults.downEnterEnabled,
                downExitEnabled: guiFadeDefaults.downExitEnabled
              }
              // remember this session id on forcedBlendRef too (if present)
              if (forcedBlendRef.current)
                forcedBlendRef.current.sessionId = sessionId
            } else {
              // not allowed: still set defaults so overlay has values, but don't start fade controller
              window._springFadeDefaults = {
                forcedBlendMs,
                fadeExitMs,
                fadeHoldMs,
                fadeCooldownMs,
                fadeColor: color,
                upEnterEnabled: guiFadeDefaults.upEnterEnabled,
                upExitEnabled: guiFadeDefaults.upExitEnabled,
                downEnterEnabled: guiFadeDefaults.downEnterEnabled,
                downExitEnabled: guiFadeDefaults.downExitEnabled
              }
            }
          } else {
            // if cooldown not passed, still ensure defaults are available
            window._springFadeDefaults = {
              forcedBlendMs,
              fadeExitMs,
              fadeHoldMs,
              fadeCooldownMs,
              fadeColor: color,
              upEnterEnabled: guiFadeDefaults.upEnterEnabled,
              upExitEnabled: guiFadeDefaults.upExitEnabled,
              downEnterEnabled: guiFadeDefaults.downEnterEnabled,
              downExitEnabled: guiFadeDefaults.downExitEnabled
            }
          }
        } catch (e) {
          console.warn('[FADE ENTER] failed', e)
        }
      } else {
        // EXIT override: resume theatre and cancel blends.
        // IMPORTANT: Do NOT trigger fade here — fade should only start on ENTER.
        try {
          sheet.sequence.play()
        } catch (e) {}
        if (blendCancelRef.current) blendCancelRef.current()

        // clear any soft pause if user leaves override early
        softPauseRef.current = { active: false, start: 0, duration: 1000 }

        // keep defaults available, but do not modify the controller
        window._springFadeDefaults = {
          forcedBlendMs,
          fadeExitMs,
          fadeHoldMs,
          fadeCooldownMs,
          fadeColor: color,
          upEnterEnabled: guiFadeDefaults.upEnterEnabled,
          upExitEnabled: guiFadeDefaults.upExitEnabled,
          downEnterEnabled: guiFadeDefaults.downEnterEnabled,
          downExitEnabled: guiFadeDefaults.downExitEnabled
        }
      }

      prevOverrideRef.current = shouldOverride
      setIsOverriding(shouldOverride)
    }
  })

  // main camera/bricks logic (runs every frame) — modified to apply soft-pause ramp
  useFrame((state, delta) => {
    if (!scroll || !springGroupRef.current) return
    const rawOffset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    const t = startAt === 'top' ? 1 - rawOffset : rawOffset

    const count = Math.max(1, Math.floor(brickCount))
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

    const approxIdx = Math.floor(t * count)
    const brickIndex = THREE.MathUtils.clamp(approxIdx, 0, count - 1)
    const brickT = (brickIndex + 0.5) / count

    const localPoint = curve.getPointAt(brickT).clone()
    const worldPointLocalUnits = localPoint.clone().multiplyScalar(pathScale)

    const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
    if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
    const outwardDist = (brickSpec.depth / 2 + radialOffset) * pathScale
    const outward = radial.clone().multiplyScalar(outwardDist)

    const zAxis_brick = radial.clone().normalize()
    const yAxis_brick = new THREE.Vector3(0, 1, 0)
    const xAxis_brick = new THREE.Vector3()
      .crossVectors(yAxis_brick, zAxis_brick)
      .normalize()
    const yOrtho = new THREE.Vector3()
      .crossVectors(zAxis_brick, xAxis_brick)
      .normalize()

    const brickLocalPos = new THREE.Vector3(
      worldPointLocalUnits.x + outward.x,
      worldPointLocalUnits.y,
      worldPointLocalUnits.z + outward.z
    )
    const brickMat = new THREE.Matrix4().makeBasis(
      xAxis_brick,
      yOrtho,
      zAxis_brick
    )
    const brickQuat = new THREE.Quaternion().setFromRotationMatrix(brickMat)

    const groupMatrix = ensureMatrixWorld()
    const brickWorldPos = brickLocalPos.clone().applyMatrix4(groupMatrix)
    const groupQuat = new THREE.Quaternion().setFromRotationMatrix(groupMatrix)
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

    const cameraLocalOffset = new THREE.Vector3(
      -extraAcrossMoveLocal,
      cameraUpOffset + sign * sideOffset,
      0
    )
    const cameraOffsetWorld = cameraLocalOffset
      .clone()
      .applyQuaternion(brickWorldQuat)
    const camDesiredWorld = brickWorldPos.clone().add(cameraOffsetWorld)

    const camZ = zAxis_brick
      .clone()
      .multiplyScalar(-1)
      .applyQuaternion(groupQuat)
      .normalize()
    const camY = yOrtho.clone().applyQuaternion(groupQuat).normalize()
    const camX = new THREE.Vector3().crossVectors(camY, camZ).normalize()
    const camBasisMat = new THREE.Matrix4().makeBasis(camX, camY, camZ)
    const camQuatFromBasis = new THREE.Quaternion().setFromRotationMatrix(
      camBasisMat
    )

    // use same Euler order 'YXZ' as earlier and convert to final quat
    const camEuler = new THREE.Euler().setFromQuaternion(
      camQuatFromBasis,
      'YXZ'
    )
    if (mode === 'oppositeSide' || mode === 'oppositeSideMove')
      camEuler.y += Math.PI
    camEuler.y += THREE.MathUtils.degToRad(yOffsetDeg)
    camEuler.x += THREE.MathUtils.degToRad(xOffsetDeg || 0)
    camEuler.z += THREE.MathUtils.degToRad(zOffsetDeg || 0)

    const maxPitchRad = THREE.MathUtils.degToRad(
      Math.max(0, Math.min(90, maxPitchDeg || 90))
    )
    camEuler.x = THREE.MathUtils.clamp(camEuler.x, -maxPitchRad, maxPitchRad)
    const camFinalQuat = new THREE.Quaternion().setFromEuler(camEuler)

    if (camDesiredWorld.y < minCamY) camDesiredWorld.y = minCamY
    if (camDesiredWorld.y > maxCamY) camDesiredWorld.y = maxCamY

    const minDist = Math.max(1, minCameraDistance)
    const fromBrick = camDesiredWorld.clone().sub(brickWorldPos)
    const distFromBrick = fromBrick.length()
    if (distFromBrick < minDist) {
      const dir =
        fromBrick.length() > 1e-6
          ? fromBrick.normalize()
          : camZ.clone().multiplyScalar(-1)
      camDesiredWorld.copy(brickWorldPos).add(dir.multiplyScalar(minDist))
    }

    // compute soft-pause factor (0..1) — ease with smoothstep-like cubic
    let pauseFactor = 1.0
    if (softPauseRef.current && softPauseRef.current.active) {
      const now = performance.now()
      const { start, duration } = softPauseRef.current
      const u = duration > 0 ? (now - start) / duration : 1
      if (u >= 1) {
        softPauseRef.current.active = false
        pauseFactor = 1.0
      } else if (u <= 0) {
        pauseFactor = 0.0
      } else {
        // smoothstep-like ease (smooth cubic)
        const easeU = u * u * (3 - 2 * u)
        pauseFactor = easeU
      }
    }

    // forced blend override
    if (forcedBlendRef.current.active && cameraRef.current) {
      const now = performance.now()
      const fb = forcedBlendRef.current
      const elapsed = Math.max(0, now - fb.startTime)
      const u = Math.min(1, fb.duration <= 0 ? 1 : elapsed / fb.duration)
      const easeU = u * u * (3 - 2 * u)
      cameraRef.current.position.lerpVectors(fb.fromPos, fb.toPos, easeU)
      cameraRef.current.quaternion.slerpQuaternions(
        fb.fromQuat,
        fb.toQuat,
        easeU
      )
      cameraRef.current.updateMatrixWorld()

      if (u >= 1) {
        forcedBlendRef.current.active = false
        // signal fade exit (read controller) ONLY for the same session
        const ctrl = window._springFadeController || null
        if (
          ctrl &&
          ctrl.sessionId &&
          fb.sessionId &&
          ctrl.sessionId === fb.sessionId
        ) {
          // check exit toggle associated with this sessionDir
          const sessionDir = fb.sessionDir || ctrl.sessionDir || 'down'
          const exitAllowed =
            (sessionDir === 'down' &&
              (guiFadeDefaults.downExitEnabled ??
                window._springFadeDefaults?.downExitEnabled ??
                true)) ||
            (sessionDir === 'up' &&
              (guiFadeDefaults.upExitEnabled ??
                window._springFadeDefaults?.upExitEnabled ??
                true))

          if (exitAllowed) {
            if (!ctrl.exit && !ctrl.exited) {
              ctrl.exit = true
              window._springFadeController = ctrl
            }
          } else {
            // not allowed: leave controller as-is (entered) but do not trigger exit
            window._springFadeController = ctrl
          }
        }
      }
    } else {
      if (isOverriding && cameraRef.current) {
        const desiredDelta = camDesiredWorld
          .clone()
          .sub(cameraRef.current.position)
        const maxMove = Math.max(
          0.0001,
          minDist * (state.clock.delta * 60) * (maxMovePerFrameFactor || 1)
        )

        if (desiredDelta.length() > maxMove) {
          // when moving large distance we still want the pauseFactor to reduce movement.
          cameraRef.current.position.add(
            desiredDelta.normalize().multiplyScalar(maxMove * pauseFactor)
          )
        } else {
          const posSmoothBase = THREE.MathUtils.clamp(
            1 - Math.exp(-positionSmoothing * 10 * delta),
            0,
            1
          )
          const posSmooth = posSmoothBase * pauseFactor
          cameraRef.current.position.lerp(camDesiredWorld, posSmooth)
        }
        const rotSmoothBase = THREE.MathUtils.clamp(
          1 - Math.exp(-rotationSmoothing * 20 * delta),
          0,
          1
        )
        const rotSmooth = rotSmoothBase * pauseFactor
        cameraRef.current.quaternion.slerp(camFinalQuat, rotSmooth)
        cameraRef.current.updateMatrixWorld()

        // stability fallback
        const posDist = cameraRef.current.position.distanceTo(camDesiredWorld)
        const q1 = cameraRef.current.quaternion
        const q2 = camFinalQuat
        const dot = Math.abs(
          THREE.MathUtils.clamp(
            q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w,
            -1,
            1
          )
        )
        const angle = 2 * Math.acos(Math.min(1, dot))
        const angleDeg = THREE.MathUtils.radToDeg(angle)
        if (posDist <= POS_THRESHOLD && angleDeg <= ANGLE_THRESHOLD_DEG) {
          stableFramesRef.current = stableFramesRef.current + 1
        } else {
          stableFramesRef.current = 0
        }
        if (stableFramesRef.current >= STABLE_REQUIRED) {
          const ctrl = window._springFadeController || {}
          // only request exit if this controller was the one that started enter
          if (ctrl && ctrl.sessionId && !(ctrl.exit || ctrl.exited)) {
            // we only set exit if ctrl.enter is true (means an enter happened previously)
            if (ctrl.enter) {
              // check exit toggle stored on controller.sessionDir (or forcedBlendRef fallback)
              const sessionDir =
                ctrl.sessionDir || forcedBlendRef.current.sessionDir || 'down'
              const exitAllowed =
                (sessionDir === 'down' &&
                  (guiFadeDefaults.downExitEnabled ??
                    window._springFadeDefaults?.downExitEnabled ??
                    true)) ||
                (sessionDir === 'up' &&
                  (guiFadeDefaults.upExitEnabled ??
                    window._springFadeDefaults?.upExitEnabled ??
                    true))

              if (exitAllowed) {
                ctrl.exit = true
                window._springFadeController = ctrl
              } else {
                // do not set exit if toggle disabled
                window._springFadeController = ctrl
              }
            }
          }
        }
      } else {
        stableFramesRef.current = 0
      }
    }

    if (sphereRef.current) {
      sphereRef.current.visible = showDebugMarker
      if (showDebugMarker) sphereRef.current.position.copy(brickWorldPos)
    }

    lastRawRef.current = rawOffset
  })

  return (
    <>
      {isOverriding ? (
        <perspectiveCamera
          ref={cameraRef}
          makeDefault
          near={0.1}
          far={5000}
          fov={45}
          position={[0, 2, 10]}
        />
      ) : (
        <PerspectiveCamera
          ref={cameraRef}
          theatreKey='Camera'
          makeDefault
          near={0.1}
          far={5000}
          fov={35}
        />
      )}

      <CameraDebugGUI cameraRef={cameraRef} isOverriding={isOverriding} />

      <group ref={wrapperRef}>
        <e.group
          theatreKey='SpringGroup'
          ref={springGroupRef}
          position={[0, 0, 0]}
        >
          <SpringPath
            count={brickCount}
            turns={turns}
            coilRadius={coilRadius}
            height={pathHeight}
            scale={pathScale}
            radialOffset={radialOffset}
            texturePath='/textures/brick-texture.jpg'
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
          <meshStandardMaterial
            color={'#ff4444'}
            metalness={0.1}
            roughness={0.4}
          />
        </mesh>
        <e.group theatreKey='RockStone' position={[0, 0, -1]}>
          <RockStone scale={30} />
        </e.group>
        <hemisphereLight
          args={['#cfe7ff', '#6b4f5f', 0.35]}
          castShadow={false}
        />
        <directionalLight position={[30, 40, 10]} intensity={0.25} castShadow />

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
          <Float
            speed={2}
            rotationIntensity={0.1}
            floatIntensity={0.7}
            floatingRange={[-2, 2]}
          >
            <L1stone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='L2stone' position={[0, 0, -1]}>
          <Float
            speed={5}
            rotationIntensity={0.1}
            floatIntensity={0.7}
            floatingRange={[-2, 2]}
          >
            <L2stone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='L3stone' position={[0, 0, -1]}>
          <L3stone scale={50} />
        </e.group>
        <e.group theatreKey='R1stone' position={[0, 0, -1]}>
          <R1stone scale={50} />
        </e.group>

        <e.group theatreKey='Pillarstone' position={[0, 0, -1]}>
          <Float
            speed={1.5}
            rotationIntensity={0.1}
            floatIntensity={0.5}
            floatingRange={[-2, 2]}
          >
            <Pillarstone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='Fish' position={[0, 0, 1]}>
          <Fish scale={100} />
        </e.group>
        <e.group theatreKey='Seashell' position={[0, 0, 1]}>
          <Seashell scale={20} />
        </e.group>

        <e.mesh theatreKey='Image' position={[0, 0, -1]}>
          <ImagePlane url='./sky.png' position={[0, 0, -5]} />
        </e.mesh>

        <e.group theatreKey='Cloud-front-of-camera' position={[0, 0, 1]}>
          <CloudFloating
            numPlanes={10}
            opacity={0.22}
            color1='#ffffff'
            color2='#a292aa'
            speed={0.9}
            xSpread={700}
            ySpread={70}
            zSpread={150}
            sharedNoise={{
              worldScale: 0.0098,
              warpAmt: 0.55,
              ridgePower: 1.2,
              ridgeMix: 0.95,
              dir: [-1.0, 0.09],
              driftSpeed: 0.018,
              wobbleFreq: 0.05,
              wobbleMag: 0.12,
              dissolveScale: 3.8,
              dissolveSpeed: 0.03,
              dissolveWidth: 0.11
            }}
          />
        </e.group>

        <e.group theatreKey='Cloud-front' position={[0, 0, 1]}>
          <CloudFloating
            numPlanes={20}
            opacity={0.5}
            xSpread={700}
            ySpread={70}
            zSpread={150}
            color1='#8d8093'
            color2='#ffffff'
            speed={1.0}
            sharedNoise={{
              worldScale: 50,
              warpAmt: 0.25,
              ridgePower: 0.1,
              ridgeMix: 0.1,
              dir: [-1.0, -0.9],
              driftSpeed: 0.018,
              wobbleFreq: 0.01,
              wobbleMag: 0.02,
              dissolveScale: 3.8,
              dissolveSpeed: 0.03,
              dissolveWidth: 0.11
            }}
          />
        </e.group>

        <e.group theatreKey='Cloud-front-New' position={[0, 0, 1]}>
          <CloudFloatingNew
            numPlanes={20}
            opacity={0.5}
            color1='#8d8093'
            color2='#ffffff'
            speed={1.0}
            xSpread={700}
            ySpread={70}
            zSpread={150}
            sharedNoise={{
              worldScale: 50,
              warpAmt: 0.25,
              ridgePower: 0.1,
              ridgeMix: 0.1,
              dir: [-1.0, -0.9],
              driftSpeed: 0.018,
              wobbleFreq: 0.01,
              wobbleMag: 0.02,
              dissolveScale: 3.8,
              dissolveSpeed: 0.03,
              dissolveWidth: 0.11
            }}
          />
        </e.group>

        <e.group theatreKey='Cloud-Back' position={[0, 0, 1]}>
          <CloudFloating
            numPlanes={25}
            opacity={0.15}
            color1='#ffffff'
            color2='#1004b9'
            xSpread={700}
            ySpread={70}
            zSpread={150}
            speed={2.0}
            sharedNoise={{
              worldScale: 300.0098,
              warpAmt: 0.55,
              ridgePower: 0.2,
              ridgeMix: 0.95,
              dir: [-1.0, 0.52],
              driftSpeed: 0.058,
              wobbleFreq: 0.02,
              wobbleMag: 0.12,
              dissolveScale: 3.8,
              dissolveSpeed: 0.03,
              dissolveWidth: 0.11
            }}
          />
        </e.group>

        <e.pointLight theatreKey='LightBlue' position={[0, 0, 1]} />
        <e.pointLight theatreKey='LightBlue 2' position={[0, 0, 1]} />

        <ambientLight intensity={1} />

        <e.group theatreKey='Product' position={[0, 0, 1]}>
          <Product scale={30} />
        </e.group>

        <e.group theatreKey='TextBoxUnderWater-1' position={[0, 0, 1]}>
          <TextBoxUnderWater
            startAt={140} // এই কম্পোনেন্ট 30s এ শুরু করবে
            duration={6} // 4 seconds-এর স্ক্রল পজিশনে পুরো growth হবে (0->1)
            scrollTimelineLength={145}
            title='Skin Health'
            bullets={[
              'Anti-aging, collagen production, reduces acne, hydrates skin and decreases excessive sebum oil in the skin.',
              'Helps with severe skin conditions like eczema and psoriasis.'
            ]}
            bubbleSrc='/textures/bubble1.png'
            position={[0, 0.8, 0]}
            scale={15}
          />
        </e.group>

        <e.group theatreKey='TextBoxUnderWater-2' position={[0, 0, 1]}>
          <TextBoxUnderWater
            startAt={140} // এই কম্পোনেন্ট 30s এ শুরু করবে
            duration={6} // 4 seconds-এর স্ক্রল পজিশনে পুরো growth হবে (0->1)
            scrollTimelineLength={145}
            title='Skin Health'
            bullets={[
              'Anti-aging, collagen production, reduces acne, hydrates skin and decreases excessive sebum oil in the skin.',
              'Helps with severe skin conditions like eczema and psoriasis.'
            ]}
            bubbleSrc='/textures/bubble1.png'
            position={[0, 0.8, 0]}
            scale={15}
          />
        </e.group>

        <UnderwaterSleeve />
        <e.mesh
          rotation={[0, 0, Math.PI / 4]}
          theatreKey='ShaderSingleBeam_C'
          position={[-607, -23, 1368]}
        >
          <ShaderSingleBeam
            position={[30, -310, -380]}
            rotation={[THREE.MathUtils.degToRad(-6), 0, 2.5]}
            seedOffset={100}
          />
        </e.mesh>

        <e.group theatreKey='under-water-maoutain-side' position={[0, 0, 1]}>
          <UnderWaterMountainSide scale={20} />
        </e.group>

        <UnderwaterFog  position={[0, -1, 0]}/>
      </group>
    </>
  )
}
