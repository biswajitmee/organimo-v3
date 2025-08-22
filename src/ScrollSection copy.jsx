import * as THREE from 'three'
import { useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Gltf,
  ScrollControls,
  useScroll,
  Scroll,
  SpotLight
} from '@react-three/drei'
import { getProject, val } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import { Sky } from '@react-three/drei'
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

import BreakCode from './BreakCode'

import { Cloude } from './Cloude'
import { Iland } from './Iland'
import { Space } from './Space'
import { StoneHeight } from './StoneHeight'
import { Cocacola } from './Cocacola'
import { StoneArch } from './StoneArch'

import WaterScene from './component/WaterScene'
import TerrainRaycastPart from './TerrainRaycastPart'
import UnderwaterCausticsLight from './UnderwaterCausticsLight'
 
import SunlightUnderwater from './SunlightUnderwater'

import RectBeach from './RectBeach'

import SandSurface from './component/underwater/SandSurface'
import sandUrl from '../src/assets/sand.jpg?url'

import CausticsLightProjector from './component/underwater/CausticsLightProjector'
import videoUrl from '../src/assets/caustics.mp4?url'
import AnimatedGoboPlane from './component/underwater/AnimatedGoboPlane'
 

import GodRays from './component/underwater/GodRays'
import FocusLight from './component/underwater/FocusLight'
 
import UnderwaterShadowBeams from './component/underwater/UnderwaterShadowBeams'


export default function ScrollSection () {
  const sheet = getProject('myProject', { state: theatreeBBState }).sheet(
    'Scene'
  )
  const [mouse, setMouse] = useState([0, 0])
  const handleMouseMove = event => {
    setMouse([event.clientX, event.clientY])
  }

  const isMobile = window.innerWidth <= 768 // Adjust the width breakpoint as needed
  const pages = isMobile ? 9 : 8.5

  return (
    <div
      style={{ height: '100vh', overflow: 'hidden' }}
      onMouseMove={handleMouseMove}
    >
      <Canvas shadows 
        style={{ width: '100vw', height: '100vh' }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          toneMapping: THREE.NoToneMapping
        }}
      >
        <WaterScene position={[0, -5, 0]} />
        <ScrollControls pages={pages} distance={3} damping={0.5}>
          <SheetProvider sheet={sheet}>
            <Scene />
          </SheetProvider>

          <Scroll
            html
            style={{ position: 'absolute', width: '100vw' }}
          ></Scroll>
        </ScrollControls>
      </Canvas>
    </div>
  )
}

function Scene () {
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  useFrame(() => {
    const sequenceLength = val(sheet.sequence.pointer.length)

    sheet.sequence.position = scroll.offset * sequenceLength
  })
  const bgColor = '#000000'

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight intensity={0.6} position={[5, -250, 5]} />
 

<e.mesh theatreKey='SandSurface' position={[0, 0, -1]}>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.mesh>


  

      <CausticsLightProjector
        src={videoUrl}
        angleDeg={20} // footprint size
        height={1000}
        cookieSize={1024} // try 4096 if your GPU can handle it
        tile={7} // start at 1; increase to 2–3 only if you need finer cells
        intensity={5}
      />

      <color attach='background' args={[bgColor]} />

      <e.mesh theatreKey='StoneArch' position={[0, 0, -1]}>
        <StoneArch />
      </e.mesh>
      <fog attach='fog' args={['#000000', 10, 2000]} />
      <e.pointLight theatreKey='LightBlue' position={[0, 0, 1]} />
      <e.pointLight theatreKey='LightPurple' position={[0, 0, -2]} />
      <e.pointLight theatreKey='LightWhite' position={[-1, 0, -1]} />

      <Sky
        distance={450000}
        sunPosition={[0, 0.06, 1]} // very low sun
        inclination={0.49}
        azimuth={-0.1}
        turbidity={6}
        rayleigh={2}
        mieCoefficient={0.005}
        mieDirectionalG={0.99}
      />
      <PerspectiveCamera
        position={[0, 0, 0]}
        theatreKey='Camera'
        makeDefault
        near={5}
        far={5000}
        fov={15}
      />
      {/* <ambientLight intensity={0.45} color='#ffd4b2' /> */}
      {/* <directionalLight
        position={[0, 10, 0]}
        intensity={1}
        color='#ffd4b2'
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      /> */}
    </>
  )
}
