// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll } from '@react-three/drei'

import { getProject } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import { editable as e, SheetProvider, PerspectiveCamera, useCurrentSheet } from '@theatre/r3f'

import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
studio.initialize()
studio.extend(extension)

// local components (adjust imports if your project structure differs)
import WaterScene from './component/WaterScene'
import UnderwaterFog from './component/underwater/UnderwaterFog'
import SpringPath from './SpringPath'
import SteppingStone from './component/SteppingStone.jsx'
import SandSurface from './component/underwater/SandSurface'
import sandUrl from '../src/assets/sand.jpg?url'
import CausticsLightProjector from './component/underwater/CausticsLightProjector'
import videoUrl from '../src/assets/caustics.mp4?url'
import UnderwaterSleeve from './component/underwater/UnderwaterSleeve'
import HalfDomeRimGlow from './home/HalfDomeRimGlow.jsx'
import ImagePlane from './ImagePlane.jsx'
import CloudFloating from './component/CloudFloating.jsx'
import { Fish } from './upperWater/fish.jsx'
import { Seashell } from './upperWater/seashell.jsx'
import RockStone from './rock/RockStone.jsx'

/* ---------------- Tunables ---------------- */
const PAGES = 8.5
const CAMERA_DISTANCE = 20     // fixed distance behind sphere along tangent
const CAMERA_LIFT = 8         // upward lift (so camera sits above the helix pipe)
const SPHERE_RADIUS = 2
// NOTE: we set instant follow (no lag) to keep "magnet" behavior — change to lerp if you want smoothing:
const INSTANT_FOLLOW = true

/* HelixCurve used for sampling (same math as SpringPath) */
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
    const y = t * this.height
    return optionalTarget.set(x, y, z)
  }
}

/* ================ Main ================ */
export default function ScrollSection() {
  const project = getProject('myProject', { state: theatreeBBState })
  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 9 : PAGES

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Canvas
        gl={{ alpha: true, premultipliedAlpha: true, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.NoToneMapping }}
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
          <UnderwaterFog waterY={0} surfaceColor="#E8C5D2" surfaceDensity={0.00042} underColor="#7E66A4" underDensity={0.0014} blendMeters={9} />
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

/* ================ Scene ================ */
function Scene() {
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  const cameraRef = useRef()
  const springGroupRef = useRef()
  const sphereRef = useRef()

  // spring params — keep in sync with SpringPath and SteppingStone
  const springParams = useMemo(() => ({
    turns: 0.7,
    coilRadius: 5.0,
    tubeRadius: 0.6,
    height:0.1,
    scale: 10,    // world scale — tweak so spring fits your scene
    color: '#2ea3ff',
    radialOffset: 0.28
  }), [])

  // sampling curve in world units
  const curve = useMemo(() => new HelixCurve({
    turns: springParams.turns,
    radius: springParams.coilRadius * springParams.scale,
    height: springParams.height * springParams.scale
  }), [springParams])

  // helper to get spring group's world matrix / position
  function ensureMatrixWorld() {
    if (!springGroupRef.current) return new THREE.Matrix4()
    springGroupRef.current.updateMatrixWorld(true)
    return springGroupRef.current.matrixWorld.clone()
  }

  useFrame(() => {
    if (!scroll || !cameraRef.current || !sphereRef.current || !springGroupRef.current) return

    // sphere parameter: end -> start mapping (so scroll 0 -> t=1, scroll 1 -> t=0)
    const t = 1 - THREE.MathUtils.clamp(scroll.offset, 0, 1)

    // local point and world transform
    const localPoint = curve.getPointAt(t).clone()
    const matrixWorld = ensureMatrixWorld()
    const worldPoint = localPoint.clone().applyMatrix4(matrixWorld)

    // place the red sphere (marker)
    sphereRef.current.position.copy(worldPoint)

    // tangent (in local), convert to world direction
    const localTang = curve.getTangentAt(t).clone().normalize()
    const worldTang = localTang.clone().transformDirection(matrixWorld).normalize()

    // compute right and normal so "above" vector is stable relative to path
    const worldUp = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(worldTang, worldUp).normalize()
    const normal = new THREE.Vector3().crossVectors(right, worldTang).normalize()

    // desired camera position: behind the sphere along tangent, plus lift along normal
    const camDesired = worldPoint.clone()
      .addScaledVector(worldTang, CAMERA_DISTANCE)    // behind along path
      .addScaledVector(normal, CAMERA_LIFT)           // up from the pipe

    // FOLLOW: choose instant or lerped follow
    if (INSTANT_FOLLOW) {
      cameraRef.current.position.copy(camDesired)
    } else {
      cameraRef.current.position.lerp(camDesired, 0.2)
    }

    // CAMERA LOOKAT (direct/instant to avoid lag between pos and aim)
    const m = new THREE.Matrix4().lookAt(cameraRef.current.position, worldPoint, worldUp)
    const desiredQuat = new THREE.Quaternion().setFromRotationMatrix(m)
    if (INSTANT_FOLLOW) {
      cameraRef.current.quaternion.copy(desiredQuat)
    } else {
      cameraRef.current.quaternion.slerp(desiredQuat, 0.25)
    }

    cameraRef.current.updateMatrixWorld()
  })

  return (
    <>
      {/* theatre-wrapped camera, but runtime override will control transform */}
      <PerspectiveCamera ref={cameraRef} theatreKey="Camera" makeDefault near={0.1} far={5000} fov={35} />

      {/* theatre-editable spring group — move/rotate in Studio and camera/sphere follow automatically */}
      <e.group theatreKey="SpringGroup" ref={springGroupRef} position={[0, 0, 0]}>
        <SpringPath
          variant="line"
          turns={springParams.turns}
          coilRadius={springParams.coilRadius}
          height={springParams.height}
          scale={springParams.scale}
          color={springParams.color}
          samplePoints={512}
        />
      </e.group>

      {/* red sphere marker */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[SPHERE_RADIUS, 24, 20]} />
        <meshStandardMaterial color="red" metalness={0.1} roughness={0.4} />
      </mesh>

      {/* Stepping stones */}
      <e.group theatreKey="SteppingStones" position={[0, 0, 0]}>
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

      {/* rest of environment */}
      <ambientLight intensity={0.55} />
      <directionalLight intensity={0.6} />
      <e.mesh theatreKey="SandSurface" position={[0, 0, -1]}>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.mesh>

      <e.mesh theatreKey="CausticsLightProjector" position={[0, 0, -1]}>
        <CausticsLightProjector src={videoUrl} target={[0, 0, 0]} fitRect={[9000, 9000]} worldCell={4} cookieSize={1024} intensity={50} playbackRate={2} />
      </e.mesh>

      <UnderwaterSleeve topY={-0.12} depth={12000} radius={5000} closeBottom />
      <e.group theatreKey="RockStone" position={[0, 0, -1]}><RockStone scale={30} /></e.group>
      <e.group theatreKey="Product" position={[0, 0, -1]}><ImagePlane url="./sky.png" position={[0, 0, -5]} /></e.group>
      <HalfDomeRimGlow radius={4500} />
      <e.group theatreKey="CloudFront" position={[0, 0, 1]}><CloudFloating numPlanes={20} opacity={0.4} /></e.group>
      <e.group theatreKey="Fish" position={[0, 0, 1]}><Fish scale={100} /></e.group>
      <e.group theatreKey="Seashell" position={[0, 0, 1]}><Seashell scale={10} /></e.group>
    </>
  )
}
