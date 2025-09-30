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

// local components
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

/* ---------------- Tunables (default) ---------------- */
const PAGES = 8.5
const SPHERE_RADIUS = 0.07

/* Centered HelixCurve — matches SpringPath (y in [-height/2, +height/2]) */
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

  // spring params + camera & UI controls (defaults set from your screenshot)
  const {
    turns,
    coilRadius,
    tubeRadius,
    pathHeight,
    pathScale,
    radialOffset,
    springCount,

    mode,
    startAt,
    brickCount,
    cameraSideOffset,
    cameraUpOffset,
    yOffsetDeg,
    positionSmoothing,
    rotationSmoothing,
    showDebugMarker
  } = useControls({
    // spring controls (reactive)
    turns: { value: 0.95, min: 0.1, max: 4, step: 0.01, label: 'Turns' },
    coilRadius: { value: 5.0, min: 0.1, max: 20, step: 0.1, label: 'Coil radius' },
    tubeRadius: { value: 0.6, min: 0, max: 5, step: 0.01, label: 'Tube radius' },
    pathHeight: { value: 10, min: 0.1, max: 100, step: 0.1, label: 'Path height' },
    pathScale: { value: 5, min: 0.1, max: 50, step: 0.1, label: 'Path scale' },
    radialOffset: { value: 0, min: -10, max: 10, step: 0.01, label: 'Radial offset' },
    springCount: { value: 40, min: 1, max: 400, step: 1, label: 'Spring instance count' },

    // camera/UI (defaults from your screenshot)
    mode: { value: 'oppositeSideMove', options: ['normal', 'oppositeSide', 'oppositeSideMove'], label: 'Camera side mode' },
    startAt: { value: 'top', options: ['top', 'bottom'], label: 'Start at (top/bottom)' },
    brickCount: { value: 40, min: 1, max: 400, step: 1, label: 'Brick count (snap)' },
    cameraSideOffset: { value: 0.20, min: -20, max: 20, step: 0.01, label: 'Camera side offset' },
    cameraUpOffset: { value: 5.0, min: -20, max: 50, step: 0.01, label: 'Camera up offset' },
    yOffsetDeg: { value: -75, min: -180, max: 180, step: 0.1, label: 'Yaw offset (deg)' },
    positionSmoothing: { value: 0.59, min: 0, max: 1, step: 0.01, label: 'Position smoothing' },
    rotationSmoothing: { value: 0.09, min: 0, max: 1, step: 0.005, label: 'Rotation smoothing' },
    showDebugMarker: { value: true, label: 'Show debug marker' }
  })

  // brick spec (match SpringPath defaults)
  const brickSpec = useMemo(() => ({ width: 3, height: 2, depth: 8 }), [])

  // reactive curve (recomputes when spring params change)
  const curve = useMemo(() => {
    return new HelixCurve({
      turns: turns,
      radius: coilRadius,
      height: pathHeight
    })
  }, [turns, coilRadius, pathHeight])

  function ensureMatrixWorld() {
    if (!springGroupRef.current) return new THREE.Matrix4()
    springGroupRef.current.updateMatrixWorld(true)
    return springGroupRef.current.matrixWorld.clone()
  }

  useFrame((state, delta) => {
    if (!scroll || !cameraRef.current || !springGroupRef.current) return

    // map scroll to t according to startAt
    const rawOffset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    const t = startAt === 'top' ? 1 - rawOffset : rawOffset

    // choose brick index (snap to centers)
    const count = Math.max(1, Math.floor(brickCount))
    const approxIdx = Math.floor(t * count)
    const brickIndex = THREE.MathUtils.clamp(approxIdx, 0, count - 1)
    const brickT = (brickIndex + 0.5) / count

    // local point (centered) and world-scale local units
    const localPoint = curve.getPointAt(brickT).clone()
    const worldPointLocalUnits = localPoint.clone().multiplyScalar(pathScale)

    // radial/outward (depends on radialOffset and pathScale)
    const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
    if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
    const outwardDist = (brickSpec.depth / 2 + radialOffset) * pathScale
    const outward = radial.clone().multiplyScalar(outwardDist)

    // brick basis (xAxis_brick, yOrtho, zAxis_brick)
    const zAxis_brick = radial.clone().normalize()
    const yAxis_brick = new THREE.Vector3(0, 1, 0)
    const xAxis_brick = new THREE.Vector3().crossVectors(yAxis_brick, zAxis_brick).normalize()
    const yOrtho = new THREE.Vector3().crossVectors(zAxis_brick, xAxis_brick).normalize()

    const brickLocalPos = new THREE.Vector3(
      worldPointLocalUnits.x + outward.x,
      worldPointLocalUnits.y,
      worldPointLocalUnits.z + outward.z
    )

    const brickMat = new THREE.Matrix4().makeBasis(xAxis_brick, yOrtho, zAxis_brick)
    const brickQuat = new THREE.Quaternion().setFromRotationMatrix(brickMat)

    // transform brick local -> world
    const groupMatrix = ensureMatrixWorld()
    const brickWorldPos = brickLocalPos.clone().applyMatrix4(groupMatrix)
    const groupQuat = new THREE.Quaternion().setFromRotationMatrix(groupMatrix)
    const brickWorldQuat = brickQuat.clone().premultiply(groupQuat)

    // compute camera local offset (Y-based side logic retained)
    const sideOffset = (brickSpec.width / 2) * pathScale + cameraSideOffset

    let sign = 1
    let extraAcrossMoveLocal = 0
    if (mode === 'normal') sign = 1
    else if (mode === 'oppositeSide') sign = -1
    else if (mode === 'oppositeSideMove') { sign = -1; extraAcrossMoveLocal = (brickSpec.width * pathScale) * 0.6 }

    const cameraLocalOffset = new THREE.Vector3(
      -extraAcrossMoveLocal,
      cameraUpOffset + sign * sideOffset,
      0
    )

    const cameraOffsetWorld = cameraLocalOffset.clone().applyQuaternion(brickWorldQuat)
    const camDesiredWorld = brickWorldPos.clone().add(cameraOffsetWorld)

    // orientation: brick-basis (preserve pitch/roll) but flip yaw 180deg for opposite modes
    const camZ = zAxis_brick.clone().multiplyScalar(-1).applyQuaternion(groupQuat).normalize()
    const camY = yOrtho.clone().applyQuaternion(groupQuat).normalize()
    const camX = new THREE.Vector3().crossVectors(camY, camZ).normalize()
    const camBasisMat = new THREE.Matrix4().makeBasis(camX, camY, camZ)
    const camQuatFromBasis = new THREE.Quaternion().setFromRotationMatrix(camBasisMat)

    const camEuler = new THREE.Euler().setFromQuaternion(camQuatFromBasis, 'YXZ')
    if (mode === 'oppositeSide' || mode === 'oppositeSideMove') camEuler.y += Math.PI
    camEuler.y += THREE.MathUtils.degToRad(yOffsetDeg)
    const camFinalQuat = new THREE.Quaternion().setFromEuler(camEuler)

    // smoothing
    const posSmooth = THREE.MathUtils.clamp(1 - Math.exp(-positionSmoothing * 10 * delta), 0, 1)
    const rotSmooth = THREE.MathUtils.clamp(1 - Math.exp(-rotationSmoothing * 20 * delta), 0, 1)

    // apply
    cameraRef.current.position.lerp(camDesiredWorld, posSmooth)
    cameraRef.current.quaternion.slerp(camFinalQuat, rotSmooth)
    cameraRef.current.updateMatrixWorld()

    // debug marker
    if (sphereRef.current) {
      sphereRef.current.visible = showDebugMarker
      if (showDebugMarker) sphereRef.current.position.copy(brickWorldPos)
    }
  })

  return (
    <>
      <PerspectiveCamera ref={cameraRef} theatreKey="Camera" makeDefault near={0.1} far={5000} fov={35} />

      <e.group theatreKey="SpringGroup" ref={springGroupRef} position={[0, 0, 0]}>
        <SpringPath
          count={springCount}
          turns={turns}
          coilRadius={coilRadius}
          height={pathHeight}
          scale={pathScale}
          radialOffset={radialOffset}
          texturePath="/textures/brick-texture.jpg"
        />
      </e.group>

      {/* debug marker */}
      <mesh ref={sphereRef} visible>
        <sphereGeometry args={[SPHERE_RADIUS, 12, 10]} />
        <meshStandardMaterial color={'#ff4444'} metalness={0.1} roughness={0.4} />
      </mesh>

      {/* environment */}
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
