// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { Suspense } from 'react'
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

// your existing components (adjust paths if needed)
import WaterScene from './component/WaterScene'
import UnderwaterFog from './component/underwater/UnderwaterFog'

// robust debug hijack component
 import CameraHijackRobustDebug from './component/CameraHijackRobustDebug.jsx'

export default function ScrollSection() {
  const sheet = getProject('myProject', { state: theatreeBBState }).sheet('Scene')
  const isMobile = window.innerWidth <= 768
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
            surfaceColor='#E8C5D2'
            surfaceDensity={0.00042}
            underColor='#7E66A4'
            underDensity={0.0014}
            blendMeters={9}
          />
        </Suspense>

        <ScrollControls pages={pages} distance={3} damping={0.5}>
          <SheetProvider sheet={sheet}>
            <Scene />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>
      </Canvas>
    </div>
  )
}

function Scene() {
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  // keep sequence driven by scroll ALWAYS
  useFrame(() => {
    const sequenceLength = val(sheet.sequence.pointer.length)
    sheet.sequence.position = scroll.offset * sequenceLength
  })

  return (
    <>
      {/* SINGLE theatre camera — makeDefault MUST be true so that's the active renderer camera */}
      <PerspectiveCamera
        theatreKey="Camera"
        makeDefault={true}
        position={[0, 0, 0]}
        near={0.1}
        far={5000}
        fov={15}
      />

      {/* pink marker to visualize trigger */}
      <mesh position={[125, 111, -213]}>
        <sphereGeometry args={[4, 16, 12]} />
        <meshBasicMaterial color="hotpink" />
      </mesh>

      {/* robust debug hijack controller */}
     <CameraHijackRobustDebug
  startPos={[125,111,-213]}
  startEuler={[0,0,0]}
  endEuler={[-3.141,0.323,3.141]}
  enterBlend={0.12}
  rotateDuration={1.2}
  exitBlend={0.12}
  tolerance={0.25}
  autoTriggerOnce={true}   // <-- important: now it will auto-trigger once
  autoStartForDebug={false}
/>


      {/* rest of your scene */}
      <ambientLight intensity={0.55} />
      <directionalLight intensity={0.6} />

      <e.mesh theatreKey='SandSurface' position={[0, 0, -1]}>
        {/* your SandSurface component content */}
      </e.mesh>
      {/* ...other scene content... */}
    </>
  )
}
