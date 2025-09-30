// ScrollSection.jsx
import * as THREE from 'three'
import React, { useState, useRef, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Image, ScrollControls, useScroll, Scroll } from '@react-three/drei'
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

// scene imports...
import WaterScene from './component/WaterScene'
import SandSurface from './component/underwater/SandSurface'
import sandUrl from '../src/assets/sand.jpg?url'
import CausticsLightProjector from './component/underwater/CausticsLightProjector'
import videoUrl from '../src/assets/caustics.mp4?url'
import UnderwaterFog from './component/underwater/UnderwaterFog'
import UnderwaterSleeve from './component/underwater/UnderwaterSleeve'
import ShaderSingleBeam from './component/underwater/ShaderSingleBeam'
import { Newproduct } from './rock/NewProduct.jsx'
import { HeroRock } from './rock/HeroRock.jsx'
import CloudFloating from './component/CloudFloating.jsx'
import { Fish } from './upperWater/fish.jsx'
import { Seashell } from './upperWater/Seashell.jsx'
import HalfDomeRimGlow from './home/HalfDomeRimGlow.jsx'
import ImagePlane from './ImagePlane.jsx'

// try to load cameraPath.json if present
let cameraPathState = null
try {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  cameraPathState = require('./cameraPath.json')
} catch (e) {
  cameraPathState = null
}

/* CONFIG */
const AUTOSTART_SEC = 12
const AUTOEND_SEC = 30
const BLEND_MS = 300

/* defaults */
const defaultPoints = [
  [206, 146, -46],
  [206, 146, -46],
  [206, 146, -46],
  [206, 146, -46],
  [206, 146, -46],
  [206, 146, -46]
]
const defaultRotations = [
  [0, 0, 0],
  [0, 30, 0],
  [0, 60, 0],
  [0, 90, 0],
  [0, 120, 0],
  [0, 150, 0]
]

/* small blend helper */
function smoothBlendCamera(cameraRef, targetPos, targetQuat, duration = BLEND_MS) {
  if (!cameraRef?.current) return () => {}
  const startPos = cameraRef.current.position.clone()
  const startQuat = cameraRef.current.quaternion.clone()
  const startTime = performance.now()
  let cancelled = false
  function step() {
    if (cancelled || !cameraRef.current) return
    const now = performance.now()
    const t = Math.min(1, (now - startTime) / duration)
    cameraRef.current.position.lerpVectors(startPos, targetPos, t)
    const tmp = startQuat.clone().slerp(targetQuat, t)
    cameraRef.current.quaternion.copy(tmp)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  return () => { cancelled = true }
}

/* ====================
   Delta-based CameraPath
   Smooth, low-damping rotation on scroll
   ==================== */
function CameraPath({
  cameraRef,
  scroll,
  points,
  rotations,
  manualT = undefined,
  posSmooth = 0.012,       // position smoothing
  speedMultiplier = 0.002, // core speed control (0.05..0.25 recommended)
  rotLerp = 0.006,         // rotation per-frame lerp alpha (smaller = slower)
  lookAhead = 0.02 
}) {
  const lastT = useRef(0)
  const posSmoothed = useRef(new THREE.Vector3())
  const quatSmoothed = useRef(new THREE.Quaternion())

  const { curve, quats, n } = useMemo(() => {
    const vecs = points.map(p => new THREE.Vector3(...p))
    const curve = new THREE.CatmullRomCurve3(vecs, false, 'catmullrom', 0.5)
    let quats = null
    if (rotations && rotations.length === points.length) {
      quats = rotations.map(r => {
        const e = new THREE.Euler(
          THREE.MathUtils.degToRad(r[0]),
          THREE.MathUtils.degToRad(r[1]),
          THREE.MathUtils.degToRad(r[2]),
          'XYZ'
        )
        return new THREE.Quaternion().setFromEuler(e)
      })
    }
    return { curve, quats, n: points.length }
  }, [points, rotations])

  useFrame(() => {
    if (!cameraRef?.current || !scroll) return

    // desired t (0..1)
    const desiredT = (typeof manualT === 'number')
      ? THREE.MathUtils.clamp(manualT, 0, 1)
      : THREE.MathUtils.clamp(scroll.offset, 0, 1)

    // delta-based approach: move lastT toward desiredT by scaled delta
    const delta = desiredT - lastT.current
    const applied = THREE.MathUtils.clamp(delta * speedMultiplier, -1, 1)
    lastT.current = THREE.MathUtils.clamp(lastT.current + applied, 0, 1)

    // position (points may be identical) — lerp for stability
    const targetPos = curve.getPointAt(lastT.current)
    posSmoothed.current.lerp(targetPos, 1 - Math.pow(1 - posSmooth, 2))
    cameraRef.current.position.copy(posSmoothed.current)

    // rotation: quaternion segments
    if (quats) {
      const segLen = 1 / Math.max(1, n - 1)
      let i = Math.floor(lastT.current / segLen)
      if (i >= n - 1) i = n - 2
      if (i < 0) i = 0
      const localT = segLen <= 0 ? 0 : (lastT.current - i * segLen) / segLen
      const qa = quats[i]
      const qb = quats[i + 1]

      // compute qTarget safely
      let qTarget
      try {
        qTarget = qa.clone().slerp(qb, isFinite(localT) ? localT : 0)
        if (![qTarget.x, qTarget.y, qTarget.z, qTarget.w].every(isFinite)) {
          throw new Error('invalid quaternion')
        }
      } catch (err) {
        qTarget = quatSmoothed.current.clone()
      }

      // per-frame rot lerp (smaller = slower rotation)
      quatSmoothed.current.slerp(qTarget, THREE.MathUtils.clamp(rotLerp, 0, 1))
      cameraRef.current.quaternion.copy(quatSmoothed.current)
    } else {
      const aheadT = Math.min(1, lastT.current + lookAhead)
      const lookPos = curve.getPointAt(aheadT)
      cameraRef.current.lookAt(lookPos)
    }
  })

  return null
}

/* DOM overlay for camera debug */
function CameraDebugDOM({ cameraData, isOverriding }) {
  if (!isOverriding) return null
  const pos = cameraData?.position || ['0.00', '0.00', '0.00']
  const rot = cameraData?.rotation || ['0.0', '0.0', '0.0']
  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 20,
      background: 'rgba(12,12,12,0.88)',
      color: '#fff',
      padding: '10px 12px',
      borderRadius: 8,
      fontSize: 13,
      fontFamily: 'Inter, Roboto, monospace',
      zIndex: 10000,
      pointerEvents: 'none',
      minWidth: 180
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Camera Path (live)</div>
      <div style={{ fontSize: 12, color: '#ddd' }}>Position</div>
      <div style={{ fontFamily: 'monospace', marginBottom: 8 }}>{pos.join(' , ')}</div>
      <div style={{ fontSize: 12, color: '#ddd' }}>Rotation (deg)</div>
      <div style={{ fontFamily: 'monospace' }}>{rot.join(' , ')}</div>
    </div>
  )
}

/* Main wrapper */
export default function ScrollSection() {
  const sheet = getProject('myProject', { state: theatreeBBState }).sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 9 : 8.5

  const cameraRef = useRef()
  const [isOverriding, setIsOverriding] = useState(false)
  const [cameraData, setCameraData] = useState({ position: ['0.00','0.00','0.00'], rotation: ['0.0','0.0','0.0'] })

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

        <ScrollControls pages={pages} distance={2} damping={0.3}>
          <SheetProvider sheet={sheet}>
            <Scene
              cameraRef={cameraRef}
              setIsOverriding={(v) => setIsOverriding(v)}
              setCameraDebugData={(d) => setCameraData(d)}
            />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>
      </Canvas>

      {/* DOM overlay (outside canvas) */}
      <CameraDebugDOM cameraData={cameraData} isOverriding={isOverriding} />
    </div>
  )
}

/* Scene component */
function Scene({ cameraRef, setIsOverriding, setCameraDebugData }) {
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  const points = (cameraPathState && cameraPathState.points) ? cameraPathState.points : defaultPoints
  const rotations = (cameraPathState && cameraPathState.rotations) ? cameraPathState.rotations : defaultRotations

  const [isOverridingLocal, setIsOverridingLocal] = useState(false)
  const blendCancelRef = useRef(null)
  const prevRef = useRef(false)

  // map scroll -> theatre timeline
  useFrame(() => {
    if (!sheet || !scroll) return
    const sequenceLength = Math.max(1, Number(val(sheet.sequence.pointer.length) || 1))
    sheet.sequence.position = scroll.offset * sequenceLength
  })

  // decide override window
  useFrame(() => {
    if (!sheet) return
    const seqPos = Number(sheet.sequence.position || 0)
    const should = seqPos >= AUTOSTART_SEC && seqPos < AUTOEND_SEC
    if (should !== isOverridingLocal) {
      setIsOverridingLocal(should)
      if (typeof setIsOverriding === 'function') setIsOverriding(should)
    }
  })

  // relative progress 0..1
  const seqPosNow = Number(sheet?.sequence?.position || 0)
  const relNow = THREE.MathUtils.clamp((seqPosNow - AUTOSTART_SEC) / Math.max(0.000001, (AUTOEND_SEC - AUTOSTART_SEC)), 0, 1)

  // on enter/exit: snap to current path transform to avoid autoplay
  useEffect(() => {
    if (prevRef.current === isOverridingLocal) {
      prevRef.current = isOverridingLocal
      return
    }

    if (blendCancelRef.current) {
      blendCancelRef.current()
      blendCancelRef.current = null
    }

    if (isOverridingLocal) {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5)
      const targetPos = curve.getPointAt(relNow)
      let targetQuat = new THREE.Quaternion()
      if (rotations && rotations.length === points.length) {
        const n = points.length
        const segLen = 1 / Math.max(1, n - 1)
        let i = Math.floor(relNow / segLen)
        if (i >= n - 1) i = n - 2
        if (i < 0) i = 0
        const localT = (relNow - i * segLen) / segLen
        const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          THREE.MathUtils.degToRad(rotations[i][0]),
          THREE.MathUtils.degToRad(rotations[i][1]),
          THREE.MathUtils.degToRad(rotations[i][2]), 'XYZ'))
        const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          THREE.MathUtils.degToRad(rotations[i + 1][0]),
          THREE.MathUtils.degToRad(rotations[i + 1][1]),
          THREE.MathUtils.degToRad(rotations[i + 1][2]), 'XYZ'))
        targetQuat.copy(qa).slerp(qb, localT)
      } else {
        const ahead = Math.min(1, relNow + 0.02)
        const lookPos = curve.getPointAt(ahead)
        const m = new THREE.Matrix4().lookAt(targetPos, lookPos, new THREE.Vector3(0, 1, 0))
        targetQuat.setFromRotationMatrix(m)
      }

      if (cameraRef && cameraRef.current) {
        cameraRef.current.position.copy(targetPos)
        cameraRef.current.quaternion.copy(targetQuat)
      }
    } else {
      if (cameraRef && cameraRef.current) {
        const fallbackPos = cameraRef.current.position.clone()
        const fallbackQuat = cameraRef.current.quaternion.clone()
        blendCancelRef.current = smoothBlendCamera(cameraRef, fallbackPos, fallbackQuat, Math.min(BLEND_MS, 200))
      }
    }

    prevRef.current = isOverridingLocal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverridingLocal, relNow])

  // update debug overlay while overriding
  useFrame(() => {
    if (!isOverridingLocal) return
    if (!cameraRef || !cameraRef.current) return
    const c = cameraRef.current
    const pos = [c.position.x.toFixed(2), c.position.y.toFixed(2), c.position.z.toFixed(2)]
    const euler = new THREE.Euler().setFromQuaternion(c.quaternion, 'XYZ')
    const rotDeg = [
      THREE.MathUtils.radToDeg(euler.x).toFixed(1),
      THREE.MathUtils.radToDeg(euler.y).toFixed(1),
      THREE.MathUtils.radToDeg(euler.z).toFixed(1)
    ]
    if (typeof setCameraDebugData === 'function') {
      setCameraDebugData({ position: pos, rotation: rotDeg })
    }
  })

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        position={[0, 0, 0]}
        theatreKey='Camera'
        makeDefault
        near={0.1}
        far={5000}
        fov={15}
      />

      {isOverridingLocal && (
        <CameraPath
          cameraRef={cameraRef}
          scroll={scroll}
          points={points}
          rotations={rotations}
          manualT={relNow}
          posSmooth={0.12}
          speedMultiplier={0.12} // tuned for smooth, low-damping rotation
          rotLerp={0.06}         // small per-frame rotation lerp for slow rotation
          lookAhead={0.02}
        />
      )}

      {/* rest of scene unchanged */}
      <e.group theatreKey='Newproduct' position={[0, 0, -1]}>
        <Newproduct scale={26} />
      </e.group>

      <e.group theatreKey='HeroRock' position={[0, 0, -1]}>
        <HeroRock scale={80} />
      </e.group>

      <e.group theatreKey='Cloud-bottom-gradient' position={[0, 0, 1]}>
        <CloudFloating
          numPlanes={30}
          opacity={1}
          color1='#bc71d1'
          color2='#f1f1f1'
          speed={0}
          xSpread={300}
          ySpread={60}
          zSpread={30}
          sharedNoise={{
            worldScale: 0.0098,
            warpAmt: 0.55,
            ridgePower: 1.2,
            ridgeMix: 5.95,
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

      <e.group theatreKey='Fish' position={[0, 0, 1]}>
        <Fish scale={100} />
      </e.group>

      <e.group theatreKey='Seashell' position={[0, 0, 1]}>
        <Seashell scale={10} />
      </e.group>

      <ambientLight intensity={0.55} />
      <directionalLight intensity={0.6} />

      <e.mesh theatreKey='SandSurface' position={[0, 0, -1]}>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.mesh>

      <e.mesh theatreKey='CausticsLightProjector' position={[0, 0, -1]}>
        <CausticsLightProjector
          src={videoUrl}
          target={[0, 0, 0]}
          fitRect={[9000, 9000]}
          worldCell={4}
          maxTile={10}
          cookieSize={1024}
          intensity={50}
          playbackRate={2}
        />
      </e.mesh>

      <group>
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
      </group>

      <UnderwaterSleeve
        topY={-0.12}
        depth={12000}
        radius={5000}
        closeBottom
        topColor='#8E79BE'
        bottomColor='#2E264C'
      />

      <HalfDomeRimGlow
        radius={3500}
        edgeColor='#f2f0ff'
        midBlue='#f2f0ff'
        deepBlue='#322768'
        gradientPower={0.25}
        rimWidth={0.18}
        rimFeather={0.22}
        rimStrength={1.4}
        raysCount={28}
        raysSpeed={0.25}
        raysStrength={0.55}
        raysSharpness={2.0}
        noiseAmount={0.25}
      />

      <e.mesh theatreKey='Image' position={[0, 0, -1]}>
        <ImagePlane url='./sky.png' position={[0, 0, -5]} />
      </e.mesh>
    </>
  )
}
