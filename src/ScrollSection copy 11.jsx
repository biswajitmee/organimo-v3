// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll } from '@react-three/drei'
import { useControls } from 'leva'

import { getProject } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import { editable as e, SheetProvider, PerspectiveCamera, useCurrentSheet } from '@theatre/r3f'

import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
studio.initialize()
studio.extend(extension)

import WaterScene from './component/WaterScene'
import UnderwaterFog from './component/underwater/UnderwaterFog'
import SpringPath from './SpringPath'
import SandSurface from './component/underwater/SandSurface'
import sandUrl from '../src/assets/sand.jpg?url'
import CausticsLightProjector from './component/underwater/CausticsLightProjector'
import videoUrl from '../src/assets/caustics.mp4?url'
import CloudFloating from './component/CloudFloating.jsx'
import { Fish } from './upperWater/fish.jsx'
import { Seashell } from './upperWater/seashell.jsx'
import RockStone from './rock/RockStone.jsx'

/* ---------------- Defaults & smoothing ---------------- */
const PAGES = 8.5
const SPHERE_RADIUS = 0.12
const INSTANT_FOLLOW = false // make default smooth follow
const SPHERE_SMOOTHNESS = 8.0  // higher = snappier (used in exp lerp)
const CAMERA_SMOOTHNESS = 6.0  // higher = snappier camera position
const ROTATION_SMOOTHNESS = 8.0 // camera rotation slerp speed

/* HelixCurve — match SpringPath (centered Y) */
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

  // spring params — keep in sync with SpringPath
  const springParams = useMemo(() => ({
    turns: 0.95,
    coilRadius: 1.0,
    tubeRadius: 0.6,
    height: 10,
    scale: 5,
    radialOffset: 0,
  }), [])

  // curve in world units
  const curve = useMemo(() => new HelixCurve({
    turns: springParams.turns,
    radius: springParams.coilRadius * springParams.scale,
    height: springParams.height * springParams.scale
  }), [springParams])

  // GUI (leva) — expanded ranges
  const { sphereX, sphereY, sphereZ, cameraOffset, cameraBase, cameraLift, cameraFov } = useControls('Camera & Marker', {
    sphereX: { value: 0, min: -200, max: 200, step: 0.5 },
    sphereY: { value: 0.3, min: -200, max: 200, step: 0.5 },
    sphereZ: { value: 0, min: -200, max: 200, step: 0.5 },
    cameraOffset: { value: 0, min: -50, max: 50, step: 0.1 },
    cameraBase: { value: 3, min: -100, max: 100, step: 0.1 },
    cameraLift: { value: 0, min: -50, max: 50, step: 0.1 },
    cameraFov: { value: 35, min: 8, max: 90, step: 1 },
  })

  // apply fov immediately if camera present
  if (cameraRef.current) {
    cameraRef.current.fov = cameraFov
    cameraRef.current.updateProjectionMatrix?.()
  }

  function ensureMatrixWorld() {
    if (!springGroupRef.current) return new THREE.Matrix4()
    springGroupRef.current.updateMatrixWorld(true)
    return springGroupRef.current.matrixWorld.clone()
  }

  // helper: frame-rate independent lerp factor (exp smoothing)
  const expFactor = (smoothness, delta) => 1 - Math.exp(-smoothness * delta)

  useFrame((state, delta) => {
    if (!scroll || !cameraRef.current || !springGroupRef.current || !sphereRef.current) return

    // parameter along curve (preserve end->start mapping)
    const t = 1 - THREE.MathUtils.clamp(scroll.offset, 0, 1)

    // sample curve local -> world
    const localPoint = curve.getPointAt(t).clone()
    const matrixWorld = ensureMatrixWorld()
    const baseWorldPoint = localPoint.clone().applyMatrix4(matrixWorld)

    // desired sphere position = path + GUI offset
    const desiredSpherePos = baseWorldPoint.clone().add(new THREE.Vector3(sphereX, sphereY, sphereZ))

    // smooth sphere movement
    const sLerp = expFactor(SPHERE_SMOOTHNESS, delta) // 0..1
    sphereRef.current.position.lerp(desiredSpherePos, sLerp)

    // compute tangent/normal (based on base path)
    const localTang = curve.getTangentAt(t).clone().normalize()
    const worldTang = localTang.clone().transformDirection(matrixWorld).normalize()
    const worldUp = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(worldTang, worldUp).normalize()
    const normal = new THREE.Vector3().crossVectors(right, worldTang).normalize()

    // compute desired camera position using sphereRef.current.position (smoothed)
    const totalDist = (cameraBase || 0) + (cameraOffset || 0)
    const desiredCamPos = sphereRef.current.position.clone()
      .addScaledVector(worldTang, totalDist)
      .addScaledVector(normal, cameraLift)

    // smooth camera position
    const cLerp = INSTANT_FOLLOW ? 1.0 : expFactor(CAMERA_SMOOTHNESS, delta)
    cameraRef.current.position.lerp(desiredCamPos, cLerp)

    // compute desired camera rotation (lookAt sphere) and slerp
    const target = sphereRef.current.position.clone()
    const m = new THREE.Matrix4().lookAt(cameraRef.current.position, target, worldUp)
    const desiredQuat = new THREE.Quaternion().setFromRotationMatrix(m)

    if (INSTANT_FOLLOW) {
      cameraRef.current.quaternion.copy(desiredQuat)
    } else {
      const rLerp = expFactor(ROTATION_SMOOTHNESS, delta)
      cameraRef.current.quaternion.slerp(desiredQuat, rLerp)
    }

    cameraRef.current.updateMatrixWorld()
  })

  return (
    <>
      <PerspectiveCamera ref={cameraRef} theatreKey="Camera" makeDefault near={0.1} far={5000} fov={35} />

      <e.group theatreKey="SpringGroup" ref={springGroupRef} position={[0, -2.5, 0]}>
        <SpringPath
          count={40}
          turns={springParams.turns}
          coilRadius={springParams.coilRadius}
          height={springParams.height}
          scale={springParams.scale}
          radialOffset={springParams.radialOffset}
          texturePath="/textures/brick-texture.jpg"
        />
      </e.group>

      {/* red sphere marker */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[SPHERE_RADIUS, 24, 20]} />
        <meshStandardMaterial color="red" metalness={0.1} roughness={0.4} />
      </mesh>

      <ambientLight intensity={0.55} />
      <directionalLight intensity={0.6} />

      <e.mesh theatreKey="SandSurface" position={[0, 0, -1]}>
        <SandSurface textureUrl={sandUrl} size={3000} />
      </e.mesh>

      <e.mesh theatreKey="CausticsLightProjector" position={[0, 0, -1]}>
        <CausticsLightProjector src={videoUrl} target={[0, 0, 0]} fitRect={[9000, 9000]} worldCell={4} cookieSize={1024} intensity={50} playbackRate={2} />
      </e.mesh>

      <e.group theatreKey="RockStone" position={[0, 0, -1]}><RockStone scale={30} /></e.group>
      <e.group theatreKey="CloudFront" position={[0, 0, 1]}><CloudFloating numPlanes={20} opacity={0.4} /></e.group>
      <e.group theatreKey="Fish" position={[0, 0, 1]}><Fish scale={100} /></e.group>
      <e.group theatreKey="Seashell" position={[0, 0, 1]}><Seashell scale={10} /></e.group>
    </>
  )
}
