// src/ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, Suspense, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll, Float } from '@react-three/drei'
import { HemisphereLight, DirectionalLight } from 'three' // clarity import

import { useControls } from 'leva'

import { getProject } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import {
  editable as e,
  SheetProvider,
  PerspectiveCamera,
  useCurrentSheet
} from '@theatre/r3f'

import customPath from'../public/customPath.json'
 


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

import { ConchShell } from './ConchShell.jsx'
import { L1stone } from './rock/l1-stone.jsx'
import { L2stone } from './rock/l2-stone.jsx'
import { L3stone } from './rock/l3-stone.jsx'
import { R1stone } from './rock/r1-stone.jsx'
import { Pillarstone } from './rock/Pillarstone.jsx'

const PAGES = 8.5
const SPHERE_RADIUS = 0.07

class HelixCurve extends THREE.Curve {
  constructor ({ turns = 1, radius = 1, height = 1 } = {}) {
    super()
    this.turns = turns
    this.radius = radius
    this.height = height
  }
  getPoint (t, optionalTarget = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2
    const x = Math.cos(angle) * this.radius
    const z = Math.sin(angle) * this.radius
    const y = (t - 0.5) * this.height
    return optionalTarget.set(x, y, z)
  }
}

/* ------------------ Responsive helpers ------------------ */

function computeScaleForWidth (width) {
  if (!width) return 1
  // তুমি এখানে মান পরিবর্তন করে নিজের টাচ দেবো
  if (width <= 380) return 0.6
  if (width <= 480) return 0.7
  if (width <= 768) return 0.85
  return 1
}

/**
 * useResponsiveSetup
 * - wrapperRef: ref to a <group> whose scale we set directly
 * - cameraRef: ref to PerspectiveCamera to adjust fov and small positional nudge
 * This avoids relying solely on JSX props and ensures immediate effect.
 */
function useResponsiveSetup ({ wrapperRef, cameraRef }) {
  const { size } = useThree()

  useEffect(() => {
    if (!wrapperRef || !wrapperRef.current) return
    const s = computeScaleForWidth(size.width)
    // apply scale directly
    wrapperRef.current.scale.set(s, s, s)

    // camera compensation
    if (cameraRef && cameraRef.current) {
      const cam = cameraRef.current
      const baseFov = 35
      let targetFov = baseFov
      if (size.width <= 380) targetFov = 60
      else if (size.width <= 480) targetFov = 70
      else if (size.width <= 768) targetFov = 38
      else targetFov = baseFov

      cam.fov = targetFov
      cam.updateProjectionMatrix()

      // gentle positional nudge so perceived distance feels similar after scaling
      try {
        const origPos = cam.position.clone()
        const radial = new THREE.Vector3(origPos.x, 0, origPos.z)
        const len = radial.length()
        if (len > 0.001) {
          const comp = 1 / Math.max(0.4, s) // clamp to avoid huge jumps
          const newLen = THREE.MathUtils.lerp(len, len * comp, 0.25) // only 25% toward full compensation
          radial.setLength(newLen)
          cam.position.x = radial.x
          cam.position.z = radial.z
        }
      } catch (e) {
        // ignore safety fallback
      }
    }
  }, [size.width, wrapperRef, cameraRef])
}

/* ------------------ Main component ------------------ */

export default function ScrollSection () {
  const project = getProject('myProject', { state: theatreeBBState })
  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 9 : PAGES

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

/* Scene */
function Scene () {
  const sheet = useCurrentSheet()
  const scroll = useScroll()

  const cameraRef = useRef()
  const springGroupRef = useRef()
  const sphereRef = useRef()
  const wrapperRef = useRef()

  // enable responsive behavior (applies scale on wrapperRef and camera compensation)
  useResponsiveSetup({ wrapperRef, cameraRef })

  // controls (same as before)
  const {
    turns,
    coilRadius,
    tubeRadius,
    pathHeight,
    pathScale,
    radialOffset,

    mode,
    startAt,
    brickCount,
    cameraSideOffset,
    cameraUpOffset,
    yOffsetDeg,
    xOffsetDeg, // optional static X offset
    positionSmoothing,
    rotationSmoothing,
    showDebugMarker,

    // bricks-rise
    hiddenDepth,
    activationRange,
    riseSpeed,

    // camera-driven wave
    activeRadius,
    activeFade,
    downAmplitude,
    frontHold,

    // curvature
    curvatureEnabled,
    curvatureStrength,
    curvatureRange,
    curvatureFalloff,

    // floating
    floatEnabled,
    floatSpeed,
    rotationIntensity,
    floatIntensity,
    floatingRange,

    // smooth scroll tuning (camera smoothing)
    scrollResponsiveness,
    startupBias,
    maxStep,

    // rise smoothing for bricks (makes bricks respond faster/slower)
    riseSmoothing,

    // camera pitch clamp (degrees)
    maxPitchDeg,

    // camera safety clamps
    minCameraDistance,
    minCamY,
    maxCamY,
    maxMovePerFrameFactor
  } = useControls({
    turns: { value: 0.95, min: 0.1, max: 4, step: 0.01 },
    coilRadius: { value: 5.0, min: 0.1, max: 20, step: 0.1 },
    tubeRadius: { value: 0.6, min: 0, max: 5, step: 0.01 },
    pathHeight: { value: 10, min: 0.1, max: 100, step: 0.1 },
    pathScale: { value: 5, min: 0.1, max: 50, step: 0.1 },
    radialOffset: { value: 0, min: -10, max: 10, step: 0.01 },

    mode: {
      value: 'oppositeSideMove',
      options: ['normal', 'oppositeSide', 'oppositeSideMove']
    },
    startAt: { value: 'top', options: ['top', 'bottom'] },
    brickCount: { value: 25, min: 1, max: 400, step: 1 },
    cameraSideOffset: { value: -10, min: -40, max: 40, step: 0.01 },
    cameraUpOffset: { value: 5.0, min: -20, max: 50, step: 0.01 },
    yOffsetDeg: { value: -75, min: -180, max: 180, step: 0.1 },
    xOffsetDeg: { value: -8, min: -180, max: 180, step: 0.1 },
    positionSmoothing: { value: 0.38, min: 0, max: 1, step: 0.01 },
    rotationSmoothing: { value: 0.2, min: 0, max: 1, step: 0.005 },
    showDebugMarker: { value: true },

    // bricks-rise
    hiddenDepth: { value: 70, min: 0, max: 400, step: 1 },
    activationRange: { value: 60, min: 1, max: 400, step: 0.5 },
    riseSpeed: { value: 10, min: 0.1, max: 30, step: 0.1 },

    // camera-driven wave
    activeRadius: { value: 4, min: 0, max: 80, step: 1 },
    activeFade: { value: 3, min: 0, max: 80, step: 0.5 },
    downAmplitude: { value: 20.0, min: 0, max: 80, step: 0.1 },
    frontHold: { value: 1, min: 0, max: 40, step: 1 },

    // curvature
    curvatureEnabled: { value: true },
    curvatureStrength: { value: 2.0, min: -40, max: 40, step: 0.1 },
    curvatureRange: { value: 0, min: 0, max: 120, step: 1 },
    curvatureFalloff: { value: 0, min: 0.1, max: 80, step: 0.5 },

    // floating
    floatEnabled: { value: true },
    floatSpeed: { value: 1.0, min: 0.0, max: 8, step: 0.01 },
    rotationIntensity: { value: 0.6, min: 0, max: 6, step: 0.01 },
    floatIntensity: { value: 1.0, min: 0, max: 8, step: 0.01 },
    floatingRange: { value: [-0.2, 0.2] },

    // smooth scroll tuning (camera smoothing)
    scrollResponsiveness: { value: 0.45, min: 0.01, max: 1.5, step: 0.01 },
    startupBias: { value: 0.9, min: 0, max: 1.0, step: 0.01 },
    maxStep: { value: 0.12, min: 0.001, max: 1.0, step: 0.001 },

    // rise smoothing for bricks (0..1, higher = faster follow; set higher if you want very snappy bricks)
    riseSmoothing: { value: 0.6, min: 0.01, max: 1.0, step: 0.01 },

    // camera pitch clamp (degrees)
    maxPitchDeg: { value: 60, min: 0, max: 90, step: 1 },

    // camera safety clamps
    minCameraDistance: { value: 8, min: 1, max: 200, step: 1 },
    minCamY: { value: -5, min: -200, max: 200, step: 1 },
    maxCamY: { value: 50, min: -200, max: 200, step: 1 },
    maxMovePerFrameFactor: { value: 1.0, min: 0.01, max: 10, step: 0.01 }
  })

  const brickSpec = useMemo(() => ({ width: 3, height: 2, depth: 8 }), [])
  const curve = useMemo(
    () => new HelixCurve({ turns, radius: coilRadius, height: pathHeight }),
    [turns, coilRadius, pathHeight]
  )

  function ensureMatrixWorld () {
    if (!springGroupRef.current) return new THREE.Matrix4()
    springGroupRef.current.updateMatrixWorld(true)
    return springGroupRef.current.matrixWorld.clone()
  }

  const activeIndexRef = useRef(0)
  const bricksActiveRef = useRef(0)

  const smoothedIndexRef = useRef(0)
  const lastRawRef = useRef(0)

  useFrame((state, delta) => {
    if (!scroll || !cameraRef.current || !springGroupRef.current) return

    const rawOffset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    const t = startAt === 'top' ? 1 - rawOffset : rawOffset

    const count = Math.max(1, Math.floor(brickCount))
    const targetIndexF = t * count

    // BRICKS immediate index
    bricksActiveRef.current = targetIndexF
    activeIndexRef.current = bricksActiveRef.current

    // CAMERA smoothing
    const cur = smoothedIndexRef.current || 0
    let diff = targetIndexF - cur
    const absDiff = Math.abs(diff)

    const baseLerp =
      1 - Math.exp(-Math.max(0.0001, scrollResponsiveness) * 60 * delta)
    const scale =
      1 - Math.min(1, (absDiff * startupBias) / Math.max(1, count * 0.25))
    let lerpFactor = baseLerp * (0.2 + 0.8 * scale)
    const maxStepEffective = Math.max(0.001, maxStep) * (delta * 60)
    let step = diff * lerpFactor
    if (Math.abs(step) > maxStepEffective)
      step = Math.sign(step) * maxStepEffective

    const next = cur + step
    smoothedIndexRef.current = next

    const approxIdx = Math.floor(t * count)
    const brickIndex = THREE.MathUtils.clamp(approxIdx, 0, count - 1)
    const brickT = (brickIndex + 0.5) / count

    const localPoint = curve.getPointAt(brickT).clone()
    const worldPointLocalUnits = localPoint.clone().multiplyScalar(pathScale)

    const radial = new THREE.Vector3(localPoint.x, 0, localPoint.z).normalize()
    if (!isFinite(radial.x) || radial.lengthSq() < 1e-6) radial.set(1, 0, 0)
    const outwardDist = (brickSpec.depth / 2 + radialOffset) * pathScale
    const outward = radial.clone().multiplyScalar(outwardDist)

    const zAxis_brick = radial.clone().normalize()
    const yAxis_brick = new THREE.Vector3(0, 1, 0)
    const xAxis_brick = new THREE.Vector3()
      .crossVectors(yAxis_brick, zAxis_brick)
      .normalize()
    const yOrtho = new THREE.Vector3()
      .crossVectors(zAxis_brick, xAxis_brick)
      .normalize()

    const brickLocalPos = new THREE.Vector3(
      worldPointLocalUnits.x + outward.x,
      worldPointLocalUnits.y,
      worldPointLocalUnits.z + outward.z
    )
    const brickMat = new THREE.Matrix4().makeBasis(
      xAxis_brick,
      yOrtho,
      zAxis_brick
    )
    const brickQuat = new THREE.Quaternion().setFromRotationMatrix(brickMat)

    const groupMatrix = ensureMatrixWorld()
    const brickWorldPos = brickLocalPos.clone().applyMatrix4(groupMatrix)
    const groupQuat = new THREE.Quaternion().setFromRotationMatrix(groupMatrix)
    const brickWorldQuat = brickQuat.clone().premultiply(groupQuat)

    const sideOffset = (brickSpec.width / 2) * pathScale + cameraSideOffset

    let sign = 1
    let extraAcrossMoveLocal = 0
    if (mode === 'normal') sign = 1
    else if (mode === 'oppositeSide') sign = -1
    else if (mode === 'oppositeSideMove') {
      sign = -1
      extraAcrossMoveLocal = brickSpec.width * pathScale * 0.6
    }

    const cameraLocalOffset = new THREE.Vector3(
      -extraAcrossMoveLocal,
      cameraUpOffset + sign * sideOffset,
      0
    )
    const cameraOffsetWorld = cameraLocalOffset
      .clone()
      .applyQuaternion(brickWorldQuat)
    const camDesiredWorld = brickWorldPos.clone().add(cameraOffsetWorld)

    const camZ = zAxis_brick
      .clone()
      .multiplyScalar(-1)
      .applyQuaternion(groupQuat)
      .normalize()
    const camY = yOrtho.clone().applyQuaternion(groupQuat).normalize()
    const camX = new THREE.Vector3().crossVectors(camY, camZ).normalize()
    const camBasisMat = new THREE.Matrix4().makeBasis(camX, camY, camZ)
    const camQuatFromBasis = new THREE.Quaternion().setFromRotationMatrix(
      camBasisMat
    )

    const camEuler = new THREE.Euler().setFromQuaternion(
      camQuatFromBasis,
      'YXZ'
    )
    if (mode === 'oppositeSide' || mode === 'oppositeSideMove')
      camEuler.y += Math.PI
    camEuler.y += THREE.MathUtils.degToRad(yOffsetDeg)
    camEuler.x += THREE.MathUtils.degToRad(xOffsetDeg || 0)

    const maxPitchRad = THREE.MathUtils.degToRad(
      Math.max(0, Math.min(90, maxPitchDeg || 90))
    )
    camEuler.x = THREE.MathUtils.clamp(camEuler.x, -maxPitchRad, maxPitchRad)

    const camFinalQuat = new THREE.Quaternion().setFromEuler(camEuler)

    if (camDesiredWorld.y < minCamY) camDesiredWorld.y = minCamY
    if (camDesiredWorld.y > maxCamY) camDesiredWorld.y = maxCamY

    const minDist = Math.max(1, minCameraDistance)
    const fromBrick = camDesiredWorld.clone().sub(brickWorldPos)
    const distFromBrick = fromBrick.length()
    if (distFromBrick < minDist) {
      const dir =
        fromBrick.length() > 1e-6
          ? fromBrick.normalize()
          : camZ.clone().multiplyScalar(-1)
      camDesiredWorld.copy(brickWorldPos).add(dir.multiplyScalar(minDist))
    }

    const desiredDelta = camDesiredWorld.clone().sub(cameraRef.current.position)
    const maxMove = Math.max(
      0.0001,
      minDist * (state.clock.delta * 60) * (maxMovePerFrameFactor || 1)
    )
    if (desiredDelta.length() > maxMove) {
      cameraRef.current.position.add(
        desiredDelta.normalize().multiplyScalar(maxMove)
      )
    } else {
      const posSmooth = THREE.MathUtils.clamp(
        1 - Math.exp(-positionSmoothing * 10 * delta),
        0,
        1
      )
      cameraRef.current.position.lerp(camDesiredWorld, posSmooth)
    }

    const rotSmooth = THREE.MathUtils.clamp(
      1 - Math.exp(-rotationSmoothing * 20 * delta),
      0,
      1
    )
    cameraRef.current.quaternion.slerp(camFinalQuat, rotSmooth)
    cameraRef.current.updateMatrixWorld()

    if (sphereRef.current) {
      sphereRef.current.visible = showDebugMarker
      if (showDebugMarker) sphereRef.current.position.copy(brickWorldPos)
    }

    lastRawRef.current = rawOffset
  })

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        theatreKey='Camera'
        makeDefault
        near={0.1}
        far={5000}
        fov={35}
      />

      {/* Wrapper group that gets scaled by useResponsiveSetup */}
      <group ref={wrapperRef}>
        <e.group
          theatreKey='SpringGroup'
          ref={springGroupRef}
          position={[0, 0, 0]}
        >
          {/* <SpringPath
          pathJson={customPath}
            count={brickCount}
            turns={turns}
            coilRadius={coilRadius}
            height={pathHeight}
            scale={pathScale}
            radialOffset={radialOffset}
            texturePath='/textures/brick-texture.jpg'
            cameraRef={cameraRef}
            hiddenDepth={hiddenDepth}
            activationRange={activationRange}
            riseSpeed={riseSpeed}
            debugShowBricks={true}
            debugForceProgress={true}
            debugFallbackMeshes={true}
            activeIndexRef={bricksActiveRef}
            activeRadius={activeRadius}
            activeFade={activeFade}
            downAmplitude={downAmplitude}
            frontHold={frontHold}
            curvatureEnabled={curvatureEnabled}
            curvatureStrength={curvatureStrength}
            curvatureRange={curvatureRange}
            curvatureFalloff={curvatureFalloff}
            floatEnabled={floatEnabled}
            floatSpeed={floatSpeed}
            rotationIntensity={rotationIntensity}
            floatIntensity={floatIntensity}
            floatingRange={floatingRange}
            riseSmoothing={riseSmoothing}
            wave={{ enabled: false }}
          /> */}


          <SpringPath
  count={brickCount}
  pathJson={customPath}
  cameraRef={cameraRef}
  hiddenDepth={hiddenDepth}
  activationRange={activationRange}
  riseSpeed={riseSpeed}
  riseSmoothing={riseSmoothing}
  radialOffset={radialOffset}
  brick={{ width: 3, height: 2, depth: 8 }}
  scale={pathScale} // NOT used by default here because samples already in world units; only use if you adapt
/>


        </e.group>

        <mesh ref={sphereRef} visible>
          <sphereGeometry args={[SPHERE_RADIUS, 12, 10]} />
          <meshStandardMaterial
            color={'#ff4444'}
            metalness={0.1}
            roughness={0.4}
          />
        </mesh>

        <hemisphereLight
          args={['#cfe7ff', '#6b4f5f', 0.35]} /* sky color, ground color, intensity */
          castShadow={false}
        />

        <directionalLight
          position={[30, 40, 10]} /* tilt it like sun */
          intensity={0.25}
          castShadow={true}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />

        <e.mesh theatreKey='SandSurface' position={[0, 0, -1]}>
          <SandSurface textureUrl={sandUrl} size={3000} />
        </e.mesh>

        <e.mesh theatreKey='CausticsLightProjector' position={[0, 0, -1]}>
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

        <e.group theatreKey='sankho' position={[0, 0, -1]}>
          <ConchShell scale={50} />
        </e.group>

        <e.group theatreKey='L1stone' position={[0, 0, -1]}>
          <Float
            speed={2}
            rotationIntensity={0.1}
            floatIntensity={0.7}
            floatingRange={[-2, 2]}
          >
            <L1stone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='L2stone' position={[0, 0, -1]}>
          <Float
            speed={5}
            rotationIntensity={0.1}
            floatIntensity={0.7}
            floatingRange={[-2, 2]}
          >
            <L2stone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='L3stone' position={[0, 0, -1]}>
          <L3stone />
        </e.group>

        <e.group theatreKey='R1stone' position={[0, 0, -1]}>
          <R1stone />
        </e.group>

        <e.group theatreKey='Pillarstone' position={[0, 0, -1]}>
          <Float
            speed={1.5}
            rotationIntensity={0.1}
            floatIntensity={0.5}
            floatingRange={[-2, 2]}
          >
            <Pillarstone scale={10} />
          </Float>
        </e.group>

        <e.group theatreKey='RockStone' position={[0, 0, -1]}>
          <RockStone scale={30} />
        </e.group>

        <e.group theatreKey='CloudFront' position={[0, 0, 1]}>
          <CloudFloating numPlanes={20} opacity={0.4} />
        </e.group>

        <e.group theatreKey='Fish' position={[0, 0, 1]}>
          <Fish scale={100} />
        </e.group>

        <e.group theatreKey='Seashell' position={[0, 0, 1]}>
          <Seashell scale={20} />
        </e.group>
      </group>
    </>
  )
}
