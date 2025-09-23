// ScrollSection.jsx
import * as THREE from 'three'
import React, { useState, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Image, ScrollControls, Scroll } from '@react-three/drei'
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
import { Product } from './component/Product.jsx'
import HalfDomeRimGlow from './home/HalfDomeRimGlow.jsx'
import ImagePlane from './ImagePlane.jsx'

import { Fish } from './upperWater/fish.jsx'
import { Seashell } from './upperWater/Seashell.jsx'
import RockStone from './rock/RockStone.jsx'

import CloudFloating from './component/CloudFloating.jsx'
import CloudFloatingBack from './component/CloudFloatingBack.jsx'
import NewCloudFloating from './component/NewCloudFloating.jsx'

export default function ScrollSection () {
  const sheet = getProject('myProject', { state: theatreeBBState }).sheet(
    'Scene'
  )
  const [mouse, setMouse] = useState([0, 0])

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 5 : 8.5

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
        {/* keep ScrollControls for html overlays but damping 0 so our custom controller handles feel */}
        <ScrollControls pages={pages} distance={2} damping={0}>
          <SheetProvider sheet={sheet}>
            <Scene />
          </SheetProvider>

          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>

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
      </Canvas>
    </div>
  )
}

/**
 * Scene with refined custom scroller:
 * - Reduced sensitivity (no big jumps on small wheel)
 * - Immediate override when opposite-direction input arrives
 * - No snap-back: virtualOffset only moves by integrated velocity and is clamped
 * - Gentle friction for smooth stopping
 */
function Scene () {
  const sheet = useCurrentSheet()
  const fishCtrl = useRef(null)

  useEffect(() => {
    fishCtrl.current?.setProgress?.(0.25)
    fishCtrl.current?.setSpeed?.(3)
    fishCtrl.current?.start?.()
  }, [])

  // ------------ state -------------
  const virtualOffset = useRef(0) // 0..1
  const velocity = useRef(0)      // offset units per second
  const isTouching = useRef(false)

  useEffect(() => {
    // ----- tuning (change these if you want different feel) -----
    const SENSITIVITY = 2 / 1800    // smaller -> less jump for small wheel moves
    const MAX_VELOCITY = 1.6       // clamp maximum speed
    const MIN_IMPULSE_TO_ADD = 0.00005 // ignore extremely tiny impulses

    // wheel handler
    const onWheel = (e) => {
      e.preventDefault()
      const raw = e.deltaY || e.wheelDelta || 0

      // convert raw delta to impulse; apply smooth non-linear scaling for better feel
      // use sign-preserving sqrt for more control on small deltas
      const sign = Math.sign(raw) || 1
      const mag = Math.sqrt(Math.abs(raw))
      const impulse = sign * mag * SENSITIVITY

      // ignore vanishing impulses
      if (Math.abs(impulse) < MIN_IMPULSE_TO_ADD) return

      // If opposite direction -> replace velocity immediately for instant response
      if (Math.sign(impulse) !== Math.sign(velocity.current) && Math.abs(velocity.current) > 0.0001) {
        velocity.current = impulse
      } else {
        // same direction -> accumulate but gently (prevents runaway)
        velocity.current += impulse * 1.85 //scroll speed
      }

      // clamp
      velocity.current = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity.current))
    }

    // touch handlers (mobile)
    let touchStartY = 0
    const onTouchStart = (ev) => {
      isTouching.current = true
      const t = ev.touches ? ev.touches[0] : ev
      touchStartY = t.clientY
      // immediately stop inertia so user has direct control
      velocity.current = 0
    }
    const onTouchMove = (ev) => {
      const t = ev.touches ? ev.touches[0] : ev
      const dy = touchStartY - t.clientY
      touchStartY = t.clientY
      const sign = Math.sign(dy) || 1
      const mag = Math.sqrt(Math.abs(dy))
      const impulse = sign * mag * SENSITIVITY

      if (Math.abs(impulse) < 0.00005) return

      if (Math.sign(impulse) !== Math.sign(velocity.current) && Math.abs(velocity.current) > 0.0001) {
        velocity.current = impulse
      } else {
        velocity.current += impulse * 0.95
      }
      velocity.current = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity.current))
    }
    const onTouchEnd = () => {
      isTouching.current = false
    }

    // attach listeners
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // animation loop: integrate velocity -> offset and apply friction
  useFrame((_, delta) => {
    // tweak friction for smooth stop: closer to 1 => slower decay (longer glide)
    const FRICTION = 0.88       // 0..1 (higher = longer glide). 0.88 is gentle & elegant.
    const INTEGRATE_SCALE = 1.0 // scale velocity -> offset per second

    // integrate
    virtualOffset.current += velocity.current * delta * INTEGRATE_SCALE

    // apply frame-rate independent friction
    velocity.current *= Math.pow(FRICTION, delta * 60)

    // if velocity very small, zero it to avoid tiny drift
    if (Math.abs(velocity.current) < 0.00001) velocity.current = 0

    // clamp
    virtualOffset.current = Math.max(0, Math.min(1, virtualOffset.current))

    // drive Theatre
    try {
      const sequenceLength = val(sheet.sequence.pointer.length)
      sheet.sequence.position = virtualOffset.current * sequenceLength
    } catch (err) {
      // sheet not ready yet — ignore
    }
  })

  // -------------------- scene JSX (unchanged) --------------------
  return (
    <>
      <PerspectiveCamera
        position={[0, 0, 0]}
        theatreKey='Camera'
        makeDefault
        near={0.1}
        far={5000}
        fov={15}
      />

      <ambientLight intensity={0.55} />
      <directionalLight intensity={0.6} />
      <e.mesh theatreKey='SandSurface' position={[0, 0, -1]}>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.mesh>

      <e.pointLight theatreKey='LightBlue' position={[0, 0, 1]} />
      <e.pointLight theatreKey='LightBlue 2' position={[0, 0, 1]} />

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

      <e.group theatreKey='RockStone' position={[0, 0, -1]}>
        <RockStone scale={30} />
      </e.group>
      <e.group theatreKey='Product' position={[0, 0, -1]}>
        <Product scale={30} />
      </e.group>

      <HalfDomeRimGlow
        radius={5500}
        edgeColor='#f2f0ff'
        midBlue='#f2f0ff'
        deepBlue='#f1f1f1'
        gradientPower={0.85}
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

      <e.group theatreKey='Cloud-front-of-camera' position={[0, 0, 1]}>
        <CloudFloating
          numPlanes={10}
          opacity={0.15}
          color1='#ffffff'
          color2='#8d8093'
          speed={0.9}
          xSpread={200}
          ySpread={50}
          zSpread={20}
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
          numPlanes={40}
          opacity={0.5}
          color1='#8d8093'
          color2='#ffffff'
          speed={0.8}
          sharedNoise={{
            worldScale: 0.5,
            warpAmt: 0.25,
            ridgePower: 0.82,
            ridgeMix: 0.95,
            dir: [-1.0, -0.3],
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
          speed={0.8}
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

      <e.group theatreKey='Cloud-bottom' position={[0, 0, 1]}>
        <CloudFloating
          numPlanes={25}
          opacity={0.45}
          color1='#fb0404'
          color2='#e43e07'
          xSpread={500}
          ySpread={60}
          zSpread={60}
          speed={0}
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
    </>
  )
}
