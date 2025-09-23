// ScrollSection.jsx
import * as THREE from 'three'
import React, { useState, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Gltf,
  Image,
  ScrollControls,
  useScroll,
  Scroll,
  SpotLight
} from '@react-three/drei'
import { getProject, val } from '@theatre/core'
import theatreeBBState from './theatreState.json'

import {
  editable as e,
  SheetProvider,
  PerspectiveCamera,
  useCurrentSheet
} from '@theatre/r3f'

// import studio from '@theatre/studio'
// import extension from '@theatre/r3f/dist/extension'
// studio.initialize()
// studio.extend(extension)

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
import { Newproduct } from './rock/NewProduct.jsx'

import CloudeGradiantShader from './component/CloudeGradiantShader.jsx'

import CloudFloating from './component/CloudFloating.jsx'
import CloudFloatingBack from './component/CloudFloatingBack.jsx'
import { HeroRock } from './rock/HeroRock.jsx'
import CloudFloatingInstanced from './CloudFloatingInstanced.jsx'
import { ConchShell } from './ConchShell.jsx'
// import GlowRingWithBloom from './GlowRingWithBloom.jsx'

export default function ScrollSection () {
  const sheet = getProject('myProject', { state: theatreeBBState }).sheet(
    'Scene'
  )
  const [mouse, setMouse] = useState([0, 0])

  const isMobile = window.innerWidth <= 768
  const pages = isMobile ? 9 : 8.5

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Canvas
        gl={{
          alpha: true,
          premultipliedAlpha: true, // important for Multiply
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping
        }}
        shadows
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping // ok
          gl.toneMappingExposure = 1.0 // ~1.0–1.1 recommended
          gl.outputColorSpace = THREE.SRGBColorSpace // three r152+
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

function Scene () {
  const cameraRef = useRef()

  const sheet = useCurrentSheet()
  const scroll = useScroll()
  const fishCtrl = useRef(null)

  useEffect(() => {
    // optional control calls
    fishCtrl.current?.setProgress(0.25)
    fishCtrl.current?.setSpeed(3)
    fishCtrl.current?.start()
  }, [])

  useFrame(() => {
    const sequenceLength = val(sheet.sequence.pointer.length)
    sheet.sequence.position = scroll.offset * sequenceLength
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

      <e.group theatreKey='Newproduct' position={[0, 0, -1]}>
        <Newproduct scale={26} />
      </e.group>

      <e.group theatreKey='HeroRock' position={[0, 0, -1]}>
        <HeroRock scale={80} />
      </e.group>

      {/* <e.group theatreKey='sankho' position={[0, 0, -1]}>
  <ConchShell scale={600}/>
      </e.group>  */}

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
            dir: [-1.0, 0.52], // positive X --> left-to-right flow; tweak sign if needed
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

      {/* <PathFishAuto speed={2.5} fishScale={0.05} showPath /> */}

      <e.group theatreKey='Seashell' position={[0, 0, 1]}>
        <Seashell scale={10} />
      </e.group>

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
          fitRect={[9000, 9000]} // full coverage
          worldCell={4} // ~60 units per cell (smaller = finer)
          maxTile={10} // allow finer tiling if needed
          cookieSize={1024} // sharper pattern
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
 

    {/* <e.mesh theatreKey='GlowRingWithBloom' position={[0, 0, -1]}>
     <GlowRingWithBloom radius={1000} width={80} color="#ffcc99" useBloom={true}
        bloomStrength={1.2} bloomRadius={1.0} bloomThreshold={0.05}
      />
       </e.mesh> */}

      <e.mesh theatreKey='Image' position={[0, 0, -1]}>
        <ImagePlane url='./sky.png' position={[0, 0, -5]} />
      </e.mesh>

      {/* ///////////////  front -frnt front  - front- ///////////////// */}

      <e.group theatreKey='Cloud-front-of-camera' position={[0, 0, 1]}>
        <CloudFloating
          numPlanes={3}
          opacity={0.22}
          color1='#ffffff'
          color2='#a292aa'
          speed={0.7}
          xSpread = {20}
          ySpread = {5}
          zSpread = {20}
          sharedNoise={{
            worldScale: 0.0098,
            warpAmt: 0.55,
            ridgePower: 1.2,
            ridgeMix: 0.95,
            dir: [-1.0, 0.09], // positive X --> left-to-right flow; tweak sign if needed
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
          opacity={0.50}
          color1='#ffffff'
          color2='#8d8093'
          speed={1.0}
          sharedNoise={{
            worldScale: 0.10,
            warpAmt: 0.25,
            ridgePower: 0.82,
            ridgeMix: 0.95,
            dir: [-1.0, -0.3], // positive X --> left-to-right flow; tweak sign if needed
            driftSpeed: 0.018,
            wobbleFreq: 0.01,
            wobbleMag: 0.02,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
        />
      </e.group>   

      ///////////////  back - back - back - back- back - back /////////////////

      <e.group theatreKey='Cloud-Back' position={[0, 0, 1]}>        

        <CloudFloating
          numPlanes={25}
          opacity={0.15}
          color1='#ffffff'
          color2='#1004b9'
          speed={1.0}
          sharedNoise={{
            worldScale: 0.0098,
            warpAmt: 0.55,
            ridgePower: 1.2,
            ridgeMix: 5.95,
            dir: [-1.0, 0.52], // positive X --> left-to-right flow; tweak sign if needed
            driftSpeed: 0.058,
            wobbleFreq: 0.02,
            wobbleMag: 0.12,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
        />
      </e.group>  

      {/* 

<e.group theatreKey='CloudFloatingInstanced' position={[0, 0, 1]}>        

        <CloudFloatingInstanced
          numPlanes={40}
          opacity={0.50}
          color1='#8d8093'
          color2='#ffffff'
          speed={1.0}
           xSpread = {700}
          ySpread = {70}
          zSpread = {100}
          baseScale = {100}
          sharedNoise={{
            worldScale: 0.10,
            warpAmt: 0.25,
            ridgePower: 0.82,
            ridgeMix: 0.45,
            dir: [-1.0, -0.3], // positive X --> left-to-right flow; tweak sign if needed
            driftSpeed: 0.018,
            wobbleFreq: 0.01,
            wobbleMag: 0.02,
            dissolveScale: 3.8,
            dissolveSpeed: 0.03,
            dissolveWidth: 0.11
          }}
        />
      </e.group>   */}


       {/* <e.group theatreKey='Cloud-bottom' position={[0, 0, 1]}>
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
            </e.group> */}

      {/* Lower volumetric box you pass through before entering water */}
    </>
  )
}
