// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll } from '@react-three/drei'

import { getProject, val } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import { editable as e, SheetProvider, PerspectiveCamera, useCurrentSheet } from '@theatre/r3f'

import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
studio.initialize()
studio.extend(extension)

 

// local components (adjust paths if needed)
import WaterScene from './component/WaterScene'
import SandSurface from './component/underwater/SandSurface'
import sandUrl from '../src/assets/sand.jpg?url'
import CausticsLightProjector from './component/underwater/CausticsLightProjector'
import videoUrl from '../src/assets/caustics.mp4?url'
import UnderwaterFog from './component/underwater/UnderwaterFog'
import UnderwaterSleeve from './component/underwater/UnderwaterSleeve'
import HalfDomeRimGlow from './home/HalfDomeRimGlow.jsx'
import ImagePlane from './ImagePlane.jsx'
import { Fish } from './upperWater/fish.jsx'
import { Seashell } from './upperWater/seashell.jsx'
import RockStone from './rock/RockStone.jsx'
import CloudFloating from './component/CloudFloating.jsx'
import SteppingStone from './component/SteppingStone.jsx'
import SpringPath from './SpringPath.jsx'

/* -----------------------
   CONFIG - tune these
   ----------------------- */
const AUTOSTART_SEC = 12      // theatre second to start camera override
const AUTOEND_SEC = 20       // theatre second to end override
const PARAM_LERP = 0.45      // how fast param t follows scroll.offset
const POS_LERP = 0.45        // camera position smoothing
const QUAT_LERP = 0.45       // camera rotation smoothing
const LOOK_AHEAD = 0.02      // sample ahead on curve for lookAt

/* -----------------------
   HelixCurve (same math as SpringPath)
   ----------------------- */
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

/* =========================
   ScrollSection (Canvas wrapper)
   ========================= */
export default function ScrollSection() {
  const project = getProject('myProject', { state: theatreeBBState })
  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 9 : 8.5

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
            surfaceColor="#E8C5D2"
            surfaceDensity={0.00042}
            underColor="#7E66A4"
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

/* =========================
   Scene: camera override + spring + stepping stones + scene content
   ========================= */
function Scene() {
  // theatre sheet & scroll
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  // refs
  const cameraRef = useRef()
  const springGroupRef = useRef()
  const currentT = useRef(0)
  const inOverride = useRef(false)

  // Spring params — keep in sync with SpringPath & SteppingStone usage below
  const springParams = useMemo(() => ({
    turns: 0.9,
    coilRadius: 1.0,   // local curve radius (SpringPath uses this)
    tubeRadius: 0.6,
    height: 3.5,
    scale: 5,          // SpringPath group scale
    color: '#2ea3ff',
    radialOffset: 0.28 // stepping stone radial offset
  }), [])

  // Camera sampling curve in world units: curve built with scaled radius/height
  const cameraCurve = useMemo(() => new HelixCurve({
    turns: springParams.turns,
    radius: springParams.coilRadius * springParams.scale,
    height: springParams.height * springParams.scale
  }), [springParams])

  // helper: read world transform of spring group (so changing group in Studio affects camera)
  function readSpringWorld() {
    if (!springGroupRef.current) return { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    springGroupRef.current.getWorldPosition(pos)
    springGroupRef.current.getWorldQuaternion(quat)
    return { pos, quat }
  }

  // drive theatre timeline from scroll (so timeline scrubs with scroll)
  useFrame(() => {
    if (!sheet || !scroll) return
    try {
      let sequenceLength = 1
      try {
        const maybeLen = Number(val?.(sheet.sequence.pointer.length))
        if (maybeLen && !Number.isNaN(maybeLen)) sequenceLength = maybeLen
      } catch (_) {
        if (sheet.sequence.length) sequenceLength = Number(sheet.sequence.length)
        else if (sheet.sequence.duration) sequenceLength = Number(sheet.sequence.duration)
      }
      // optional: you can slow/speed timeline by multiplying offset
      sheet.sequence.position = (scroll.offset || 0) * sequenceLength
    } catch (e) {
      // swallow errors so frame loop doesn't die
    }
  })

  // main per-frame camera override logic (enter at AUTOSTART_SEC, exit at AUTOEND_SEC)
  useFrame(() => {
    if (!cameraRef.current || !sheet || !scroll) return

    const seqPos = Number(sheet.sequence.position || 0)
    const shouldOverride = seqPos >= AUTOSTART_SEC && seqPos < AUTOEND_SEC
    const rel = THREE.MathUtils.clamp((seqPos - AUTOSTART_SEC) / Math.max(0.000001, AUTOEND_SEC - AUTOSTART_SEC), 0, 1)

    if (shouldOverride) {
      // entering override: snap to spring top on first frame
      if (!inOverride.current) {
        const gp = readSpringWorld()
        const startLocal = cameraCurve.getPointAt(0).clone()
        const startWorld = startLocal.add(gp.pos)
        cameraRef.current.position.copy(startWorld)
        cameraRef.current.quaternion.identity()
        currentT.current = 0
        inOverride.current = true
      }

      // map scroll.offset to curve param (you can use rel too; using scroll.offset makes scroll control feel direct)
      const targetT = scroll.offset // 0..1
      const nextT = THREE.MathUtils.lerp(currentT.current, targetT, PARAM_LERP)
      currentT.current = nextT

      // sample curve (local) then convert to world by adding spring group's world pos
      const gp = readSpringWorld()
      const localPoint = cameraCurve.getPointAt(nextT).clone()
      const worldPoint = localPoint.clone().add(gp.pos)

      // tangent for orientation and radial normal
      const tangent = cameraCurve.getTangentAt(nextT).clone().normalize()
      const worldUp = new THREE.Vector3(0, 1, 0)
      let normal = new THREE.Vector3().crossVectors(worldUp, tangent).normalize()
      if (!isFinite(normal.x) || normal.lengthSq() < 1e-6) normal.set(1, 0, 0)

      // camera sits above the stepping stone path: use same radialOffset as stones
      const camRadial = springParams.radialOffset * springParams.scale
      const desiredPos = worldPoint.clone().addScaledVector(normal, camRadial)
      // small vertical offset so camera looks down onto stones (tweak as needed)
      desiredPos.y += 1.2

      // smooth position
      cameraRef.current.position.lerp(desiredPos, POS_LERP)

      // look-ahead target (slightly downward) for train/stair effect
      const aheadLocal = cameraCurve.getPointAt(Math.min(1, nextT + LOOK_AHEAD)).clone()
      const aheadWorld = aheadLocal.add(gp.pos)
      // tilt the look target a bit downwards so stones come into view
      const lookTarget = aheadWorld.clone()
      lookTarget.y -= 1.0

      const m = new THREE.Matrix4().lookAt(cameraRef.current.position, lookTarget, worldUp)
      const desiredQuat = new THREE.Quaternion().setFromRotationMatrix(m)
      cameraRef.current.quaternion.slerp(desiredQuat, QUAT_LERP)

      cameraRef.current.updateMatrixWorld()
    } else {
      // when override ends, mark false so next entry snaps again
      if (inOverride.current) {
        inOverride.current = false
        // NOTE: we do NOT write back to Theatre here automatically.
        // If you want to persist camera to Studio at override-end, call:
        // sheet.sequence.position ... OR use theatre API to write camera transform.
      }
    }
  })

  /* =========================
     Render scene (camera + spring + stones + rest)
     ========================= */
  return (
    <>
      {/* theatre-wrapped camera (so Studio UI still can edit/view camera) */}
      <PerspectiveCamera ref={cameraRef} theatreKey="Camera" makeDefault near={0.1} far={5000} fov={35} />

      {/* Spring path (theatre-editable so you can move/rotate it in Studio) */}
      <e.group theatreKey="Spring" ref={springGroupRef} position={[0, 0, 0]}>
        <SpringPath
          turns={springParams.turns}
          coilRadius={springParams.coilRadius}
          tubeRadius={springParams.tubeRadius}
          height={springParams.height}
          scale={springParams.scale}
          color={springParams.color}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
        />
      </e.group>

      {/* Stepping stones placed along the same helix */}
      <e.group theatreKey="SteppingStone" position={[0, 0, 0]}>
        <SteppingStone
          count={28}
          turns={springParams.turns}
          coilRadius={springParams.coilRadius}
          height={springParams.height}
          scale={springParams.scale}
          radialOffset={springParams.radialOffset}
          texturePath="/textures/brick-texture.jpg"
        />
      </e.group>

      {/* lights / scene content */}
      <ambientLight intensity={0.55} />
      <directionalLight intensity={0.6} />

      <e.mesh theatreKey="SandSurface" position={[0, 0, -1]}>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.mesh>

      <e.mesh theatreKey="CausticsLightProjector" position={[0, 0, -1]}>
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

      <UnderwaterSleeve topY={-0.12} depth={12000} radius={5000} closeBottom />
      <e.group theatreKey="RockStone" position={[0, 0, -1]}><RockStone scale={30} /></e.group>
      <e.group theatreKey="Product" position={[0, 0, -1]}><ImagePlane url='./sky.png' position={[0,0,-5]} /></e.group>
      <HalfDomeRimGlow radius={4500} />
      <e.group theatreKey="Cloud-front" position={[0, 0, 1]}><CloudFloating numPlanes={20} opacity={0.4} /></e.group>
      <e.group theatreKey="Fish" position={[0, 0, 1]}><Fish scale={100} /></e.group>
      <e.group theatreKey="Seashell" position={[0, 0, 1]}><Seashell scale={10} /></e.group>
    </>
  )
}
