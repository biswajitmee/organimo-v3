// ScrollSection.jsx
import * as THREE from 'three'
import React, { useState, useRef, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
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

import GlowRing from './component/GlowRing.jsx'

import SpringMesh from './SpringPath.jsx'

// optional cameraPath.json won't be used here, but kept for compatibility
let cameraPathState = null
try {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  cameraPathState = require('./cameraPath.json')
} catch (e) {
  cameraPathState = null
}

/* -----------------------
   CONFIG: override timing + blend
   ----------------------- */
const AUTOSTART_SEC = 12 // when theatre time >= this => start override
const AUTOEND_SEC = 20 // when theatre time >= this => end override
const EXIT_BLEND_MS = 300 // blend back when leaving override

/* -----------------------
   Helper: small blend for exit
   ----------------------- */
function smoothBlendCamera (
  cameraRef,
  targetPos,
  targetQuat,
  duration = EXIT_BLEND_MS
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
    const tmp = startQuat.clone().slerp(targetQuat, t)
    cameraRef.current.quaternion.copy(tmp)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  return () => {
    cancelled = true
  }
}

/* ------------------------------
   useTargetLookAtController (custom hook)
   - resolves scene objects by name
   - maps rel (0..1) into an index (floor behavior)
   - returns step(rel) to compute desired pos/quat
   ------------------------------ */
function useTargetLookAtController ({
  cameraRef,
  scene,
  targetNames = ['Fish', 'Seashell', 'HeroRock', 'Newproduct', 'Image'],
  smooth = 0.12
}) {
  // store targets and their resolved positions/objects
  const targetsRef = useRef([])

  // offsets for nice composition per-target (tweak to taste)
  const offsets = useMemo(
    () => ({
      Fish: new THREE.Vector3(0, 80, 220),
      Seashell: new THREE.Vector3(0, 40, 120),
      HeroRock: new THREE.Vector3(0, 160, 320),
      Newproduct: new THREE.Vector3(40, 120, 260),
      Image: new THREE.Vector3(0, 220, 400),
      default: new THREE.Vector3(0, 120, 260)
    }),
    []
  )

  // resolve target objects on mount and when scene or targetNames change
  useEffect(() => {
    const arr = targetNames.map(name => {
      const obj = scene.getObjectByName?.(name) ?? null
      if (obj) {
        const pos = new THREE.Vector3()
        obj.getWorldPosition(pos)
        return { name, object: obj, pos }
      }
      // try parse coords 'x,y,z'
      const maybeCoords =
        typeof name === 'string' ? name.split(',').map(Number) : null
      if (
        maybeCoords &&
        maybeCoords.length === 3 &&
        maybeCoords.every(n => !Number.isNaN(n))
      ) {
        return { name, object: null, pos: new THREE.Vector3(...maybeCoords) }
      }
      return { name, object: null, pos: new THREE.Vector3(0, 0, 0) }
    })
    targetsRef.current = arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, JSON.stringify(targetNames)]) // stringify to catch simple array changes

  // step function to compute desired pos/quat for given normalized rel (0..1)
  const step = rel => {
    if (!cameraRef?.current) return null
    const targets = targetsRef.current
    if (!targets || targets.length === 0) return null

    // Which index: floor mapping (pass-like)
    const N = targets.length
    const idx = Math.min(N - 1, Math.max(0, Math.floor(rel * N)))
    const cur = targets[idx]
    if (!cur) return null

    // refresh world pos if object exists and may move
    if (cur.object && typeof cur.object.getWorldPosition === 'function') {
      cur.object.getWorldPosition(cur.pos)
    }

    // pick offset by name or default
    const offset = offsets[cur.name] ? offsets[cur.name] : offsets.default
    const desiredPos = cur.pos.clone().add(offset)

    // look at slightly above target center
    const lookAt = cur.pos.clone().add(new THREE.Vector3(0, 20, 0))

    // compute desired quaternion
    const mat = new THREE.Matrix4().lookAt(
      desiredPos,
      lookAt,
      new THREE.Vector3(0, 1, 0)
    )
    const desiredQuat = new THREE.Quaternion().setFromRotationMatrix(mat)

    return { desiredPos, desiredQuat, idx, targetName: cur.name }
  }

  return { step, targetsRef, smooth }
}

/* ====================================================
   Main ScrollSection
   ==================================================== */
export default function ScrollSection () {
  const project = getProject('myProject', { state: theatreeBBState })
  const topSheet = project.sheet('Scene')
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
          {/* <GlowRing
            inner={5000}
            outer={10000}
            y={5}
            color='red'
            bloomStrength={10}
            bloomRadius={1}
            bloomThreshold={0.15}
            exposure={0.29}
          /> */}
          <UnderwaterFog
            waterY={0}
            surfaceColor='#E8C5D2'
            surfaceDensity={0.00042}
            underColor='#7E66A4'
            underDensity={0.0014}
            blendMeters={9}
          />
        </Suspense>

        <ScrollControls pages={pages} distance={3} damping={0.5}>
          <SheetProvider sheet={topSheet}>
            <Scene project={project} />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>
      </Canvas>
    </div>
  )
}

/* ------------------------------
   Scene: mounts per-target lookAt when theatre timeline in window
   ------------------------------ */
function Scene ({ project }) {
  const cameraRef = useRef()
  const sheet = useCurrentSheet()
  const scroll = useScroll()
  const blendRef = useRef(null)
  const prevOverRef = useRef(false)
  const prevQuat = useRef(new THREE.Quaternion())
  const prevPos = useRef(new THREE.Vector3())

  // get scene (for resolving object names)
  const { scene } = useThree()

  // configure target names - change to match your object names
  const targetNames = useMemo(
    () => ['Fish', 'Seashell', 'HeroRock', 'Newproduct', 'Image'],
    []
  )

  // IMPORTANT: call the custom hook at top-level of component (unconditional)
  const controller = useTargetLookAtController({
    cameraRef,
    scene,
    targetNames,
    smooth: 0.12
  })

  // drive theatre timeline from scroll (so UI/timeline moves)
  useFrame(() => {
    if (!sheet || !scroll) return
    const sequenceLength = Math.max(
      1,
      Number(val(sheet.sequence.pointer.length) || 1)
    )
    sheet.sequence.position = scroll.offset * sequenceLength
  })

  // compute whether we should override (per-frame) and map rel progress
  const seqPos = Number(sheet?.sequence?.position || 0)
  const shouldOverride = seqPos >= AUTOSTART_SEC && seqPos < AUTOEND_SEC
  const rel = THREE.MathUtils.clamp(
    (seqPos - AUTOSTART_SEC) / Math.max(0.000001, AUTOEND_SEC - AUTOSTART_SEC),
    0,
    1
  )

  // handle enable/disable theatre camera control (replace with your actual Theatre API)
  function disableTheatreCamera () {
    // TODO: Replace this with the specific call in your project that disables Theatre's camera control
    // e.g. project.pause(), or toggle camera track binding so Theatre stops writing camera transforms.
    try {
      if (project && typeof project.pause === 'function') project.pause()
    } catch (e) {}
  }
  function enableTheatreCamera () {
    // TODO: Replace this with the specific call in your project that re-enables Theatre's camera control
    try {
      if (project && typeof project.play === 'function') project.play()
    } catch (e) {}
  }

  // main per-frame override logic
  useFrame((_, delta) => {
    if (!cameraRef.current) return

    // Manage entering/exiting override window
    if (shouldOverride) {
      // on enter
      if (!prevOverRef.current) {
        if (blendRef.current) {
          blendRef.current()
          blendRef.current = null
        }
        disableTheatreCamera()
        prevOverRef.current = true
      }

      // while override active: use controller to compute desired pos/quat
      if (controller) {
        const res = controller.step(rel)
        if (!res) return
        const { desiredPos, desiredQuat, idx } = res

        // frame-rate independent lerp factor
        const lerpFactor = 1 - Math.pow(1 - controller.smooth, delta * 60)

        // smooth position & rotation
        cameraRef.current.position.lerp(desiredPos, lerpFactor)
        cameraRef.current.quaternion.slerp(desiredQuat, lerpFactor)

        prevPos.current.copy(cameraRef.current.position)
        prevQuat.current.copy(cameraRef.current.quaternion)

        // If we are on the last target and reach very near end of timeline, restore theatre (once)
        const N = controller.targetsRef.current.length || 1
        if (idx === N - 1 && rel > 0.995) {
          // Optionally write camera back to Theatre state here (TODO)
          enableTheatreCamera()
          prevOverRef.current = false
        }
      }
    } else {
      // not override: if we previously disabled theatre, re-enable and blend
      if (prevOverRef.current) {
        const fallbackPos = cameraRef.current.position.clone()
        const fallbackQuat = cameraRef.current.quaternion.clone()
        if (blendRef.current) {
          blendRef.current()
          blendRef.current = null
        }
        blendRef.current = smoothBlendCamera(
          cameraRef,
          fallbackPos,
          fallbackQuat,
          Math.min(EXIT_BLEND_MS, 300)
        )
        // optionally write camera to theatre state before re-enabling (TODO)
        enableTheatreCamera()
        prevOverRef.current = false
      }
    }
  })

  /* =============
     rest of scene (mostly unchanged)
     ============= */
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

      <e.mesh theatreKey='SpringMesh' position={[0, 274, 47]}>
      
       <SpringMesh scale={50}
        turns={8}
        coilRadius={0.6}
        tubeRadius={0.03}
        height={1.2}
        color="#d17a45"
        position={[2.6, 0.2, 0]}
      />
          </e.mesh>

      {/* ---------- rest of your scene (unchanged) ---------- */}
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
      {/* ---------- end scene ---------- */}
    </>
  )
}

/* ------------------------------
   NOTES & TROUBLESHOOTING
   - Replace the TODOs in disableTheatreCamera / enableTheatreCamera with your actual Theatre API calls
     (for example, pause/play or toggle camera binding).
   - If you still see "Invalid hook call" after this change:
     1) Ensure you don't have duplicate React versions: run `npm ls react` or `yarn why react`.
     2) Ensure react & react-dom versions match and match the renderer versions.
   - If object names differ, update `targetNames` array in Scene().
   - Tweak offsets map in useTargetLookAtController() for Organimo-like framing per-target.
*/
