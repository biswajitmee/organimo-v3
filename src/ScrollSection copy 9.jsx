// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll } from '@react-three/drei'

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
import HalfDomeRimGlow from './home/HalfDomeRimGlow.jsx'
import ImagePlane from './ImagePlane.jsx'
import { Fish } from './upperWater/fish.jsx'
import { Seashell } from './upperWater/seashell.jsx'
import RockStone from './rock/RockStone.jsx'
import CloudFloating from './component/CloudFloating.jsx'
import SteppingStone from './component/SteppingStone.jsx'
import SpringPath from './SpringPath.jsx'
import BoxWithTexture from './BoxWithTexture.jsx'

/* -----------------------
   HelixCurve
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
   ScrollSection
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
   Scene
   ========================= */
function Scene() {
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  const springGroupRef = useRef(null)
  const sphereRef = useRef(null)

  // spring parameters
  const springParams = useMemo(
    () => ({
      turns: 0.5,
      coilRadius: 15.0,
      tubeRadius: 0.1,
      height: 30,
      scale: 5,
      color: '#2ea3ff',
      radialOffset: 0.28
    }),
    []
  )

  // curve for sphere animation
  const curve = useMemo(
    () =>
      new HelixCurve({
        turns: springParams.turns,
        radius: springParams.coilRadius * springParams.scale,
        height: springParams.height * springParams.scale
      }),
    [springParams]
  )

  // animate sphere along the curve
  useFrame(() => {
  if (!scroll || !sphereRef.current || !springGroupRef.current) return

  const offset = 1 -THREE.MathUtils.clamp(scroll.offset, 0, 1)
  const localPoint = curve.getPointAt(offset).clone()

  // group এর full world transform apply করতে হবে
  localPoint.applyMatrix4(springGroupRef.current.matrixWorld)

  sphereRef.current.position.copy(localPoint)
})


  return (
    <>
      <PerspectiveCamera theatreKey="Camera" makeDefault near={0.1} far={5000} fov={35} />

      <e.group theatreKey="plain-Spring" ref={springGroupRef} position={[0, 0, 0]}>
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

      {/* sphere marker moving along spring */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[3, 32, 32]} />
        <meshStandardMaterial color="red" />
      </mesh>

      <e.group theatreKey="briks-Spring" position={[0, 0, 0]}>
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

      {/* rest of your environment */}
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
      <e.group theatreKey="RockStone" position={[0, 0, -1]}>
        <RockStone scale={30} />
      </e.group>
      <e.group theatreKey="Product" position={[0, 0, -1]}>
        <ImagePlane url="./sky.png" position={[0, 0, -5]} />
      </e.group>
      <HalfDomeRimGlow radius={4500} />
      <e.group theatreKey="Cloud-front" position={[0, 0, 1]}>
        <CloudFloating numPlanes={20} opacity={0.4} />
      </e.group>
      <e.group theatreKey="Fish" position={[0, 0, 1]}>
        <Fish scale={100} />
      </e.group>
      <e.group theatreKey="Seashell" position={[0, 0, 1]}>
        <Seashell scale={10} />
      </e.group>

      <e.group theatreKey="BoxWithTexture" position={[0, 0, 1]}>
        <BoxWithTexture />
      </e.group>
    </>
  )
}
