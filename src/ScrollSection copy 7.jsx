// ScrollSection.jsx
import * as THREE from 'three'
import React, { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, useScroll, Scroll, PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei'

import { getProject, val } from '@theatre/core'
import theatreeBBState from './theatreState.json'
import { editable as e, SheetProvider } from '@theatre/r3f'
import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'

// init theatre studio
studio.initialize()
studio.extend(extension)

// local imports (keep your actual paths)
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
import { Seashell } from './upperWater/seashell.jsx'
import HalfDomeRimGlow from './home/HalfDomeRimGlow.jsx'
import ImagePlane from './ImagePlane.jsx'

import SpringPath from './SpringPath.jsx'
import SteppingStone from './component/SteppingStone.jsx'

/* =========================
   Top-level Canvas wrapper
   ========================= */
export default function ScrollSection () {
  const project = getProject('myProject', { state: theatreeBBState })
  const sheet = project.sheet('Scene')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const pages = isMobile ? 9 : 8.5

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Canvas
        shadows
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <React.Suspense fallback={null}>
          <WaterScene />
          <UnderwaterFog
            waterY={0}
            surfaceColor='#E8C5D2'
            surfaceDensity={0.00042}
            underColor='#7E66A4'
            underDensity={0.0014}
            blendMeters={9}
          />
        </React.Suspense>

        <ScrollControls pages={pages} distance={3} damping={0.02}>
          <SheetProvider sheet={sheet}>
            <Scene project={project} />
          </SheetProvider>
          <Scroll html style={{ position: 'absolute', width: '100vw' }} />
        </ScrollControls>
      </Canvas>
    </div>
  )
}

/* =========================
   Scene: camera follows spring path and orients correctly
   - radial-based offset (stable outward direction)
   - tangent-based facing (orbit effect)
   ========================= */
function Scene ({ project }) {
  const cameraRef = useRef()
  const springGroupRef = useRef()
  const scroll = useScroll()
  const { scene } = useThree()

  // ensure theatre timeline plays (so Studio timeline reacts)
  useEffect(() => {
    try { project?.play?.() } catch (e) {}
  }, [project])

  const sheet = useMemo(() => {
    try { return project.sheet('Scene') } catch (e) { return null }
  }, [project])

  /* ==== tuneable spring params (change as you like) ==== */
  const springParams = useMemo(() => ({
    turns: 0.9,
    coilRadius: 50,
    tubeRadius: 1,
    height: 10,
    scale: 50,
    color: '#2ea3ff'
  }), [])

  /* Helix curve class (local coordinates) */
  class HelixCurve extends THREE.Curve {
    constructor ({ turns = 1, radius = 1, height = 1 } = {}) {
      super()
      this.turns = turns
      this.radius = radius
      this.height = height
    }
    getPoint (t, target = new THREE.Vector3()) {
      const angle = t * this.turns * Math.PI * 2
      const x = Math.cos(angle) * this.radius
      const z = Math.sin(angle) * this.radius
      const y = (t - 0.5) * this.height
      return target.set(x, y, z)
    }
  }

  /* camera curve (world units) */
  const camCurve = useMemo(() => new HelixCurve({
    turns: springParams.turns,
    radius: springParams.coilRadius * springParams.scale,
    height: springParams.height * springParams.scale
  }), [springParams])

  /* read group world transform */
  function readSpringWorld () {
    if (!springGroupRef.current) return { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scl: new THREE.Vector3(1,1,1) }
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    springGroupRef.current.getWorldPosition(pos)
    springGroupRef.current.getWorldQuaternion(quat)
    springGroupRef.current.getWorldScale(scl)
    return { pos, quat, scl }
  }

  /* initial camera at start */
  const currentT = useRef(0)
  useEffect(() => {
    if (!cameraRef.current || !camCurve) return
    const gp = readSpringWorld()
    const start = camCurve.getPoint(0).clone().add(gp.pos)
    cameraRef.current.position.copy(start)
    cameraRef.current.quaternion.identity()
    cameraRef.current.updateMatrixWorld()
    currentT.current = 0
  }, [camCurve])

  /* smoothing & tuning */
  const parameterLerp = 0.45   // how fast t follows scroll (0..1)
  const posLerp = 0.45
  const quatSlerp = 0.45
  const offsetOutward = 0.8 * springParams.scale // positive = outside coil, negative = inside
  const lookAhead = 0.02

  /* main loop */
  useFrame(() => {
    if (!cameraRef.current || !scroll) return

    // sync theatre timeline from scroll (keeps Studio timeline in sync)
    if (sheet) {
      try {
        let sequenceLength = 1
        const valLen = Number(val?.(sheet.sequence.pointer.length) || 0)
        if (valLen && !Number.isNaN(valLen)) sequenceLength = valLen
        else if (sheet.sequence.length) sequenceLength = Number(sheet.sequence.length)
        else if (sheet.sequence.duration) sequenceLength = Number(sheet.sequence.duration)
        const timelineSpeed = 1.6
        sheet.sequence.position = scroll.offset * sequenceLength * timelineSpeed
      } catch (e) {}
    }

    // sample param from scroll
    const gp = readSpringWorld()
    const s = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    const nextT = THREE.MathUtils.lerp(currentT.current, s, parameterLerp)
    currentT.current = nextT

    // get local point + tangent, convert to world by adding group position
    const localPoint = camCurve.getPointAt(nextT).clone()
    const tangent = camCurve.getTangentAt(nextT).clone().normalize()
    const worldPoint = localPoint.clone().add(gp.pos)

    // compute radial (stable outward direction): vector from spring center (gp.pos) to curve point
    const radial = localPoint.clone().normalize() // since localPoint measured from center (0,0,...) radial = localPoint.normalized()
    // if group is rotated or translated, using gp.pos in world is enough because we added gp.pos already
    // build world radial direction (accounting for group's world rotation/scale if needed)
    // (we assume the curve was centered at group's origin; if not, use worldPoint - gp.pos)
    let radialWorld = worldPoint.clone().sub(gp.pos).normalize()
    if (!isFinite(radialWorld.x) || radialWorld.lengthSq() < 1e-6) {
      // fallback: perpendicular to tangent
      radialWorld = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), tangent).normalize()
    }

    // camera target position = worldPoint + radialWorld * offsetOutward
    const cameraTargetPos = worldPoint.clone().addScaledVector(radialWorld, offsetOutward)

    // smooth position
    cameraRef.current.position.lerp(cameraTargetPos, posLerp)

    // orientation: face slightly ahead along tangent (look-at = currentPosition + tangent)
    const aheadParam = Math.min(1, nextT + lookAhead)
    const aheadLocal = camCurve.getPointAt(aheadParam).clone().add(gp.pos)
    const lookTarget = aheadLocal
    const m = new THREE.Matrix4().lookAt(cameraRef.current.position, lookTarget, new THREE.Vector3(0,1,0))
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m)
    cameraRef.current.quaternion.slerp(targetQuat, quatSlerp)

    cameraRef.current.updateMatrixWorld()
  })

  /* RENDER */
  return (
    <>
      <DreiPerspectiveCamera ref={cameraRef} 
      makeDefault near={0.5} 
      far={50000} fov={35}   />

      {/* visible spring mesh wrapped in theatre-editable group */}
      <e.group theatreKey='Spring' ref={springGroupRef} position={[0, 0, 0]}>
        <SpringPath
          turns={springParams.turns}
          coilRadius={springParams.coilRadius}
          tubeRadius={springParams.tubeRadius}
          height={springParams.height}
          scale={springParams.scale}
          color={springParams.color}
          position={[0,0,0]}
          rotation={[0,10,0]}
        />
      </e.group>

      {/* rest of scene (unchanged) */}
      <e.group theatreKey='Newproduct'><Newproduct scale={26} /></e.group>
      <e.group theatreKey='HeroRock'><HeroRock scale={80} /></e.group>
      <e.group theatreKey='CloudFloating'><CloudFloating numPlanes={30} opacity={1} /></e.group>
      <e.group theatreKey='Fish'><Fish scale={100} /></e.group>
      <e.group theatreKey='Seashell'><Seashell scale={10} /></e.group>

      <ambientLight intensity={0.55} />
      <directionalLight intensity={0.6} />

      <e.mesh theatreKey='SandSurface'><SandSurface textureUrl={sandUrl} size={3000} /></e.mesh>
      <e.mesh theatreKey='CausticsLightProjector'><CausticsLightProjector src={videoUrl} target={[0,0,0]} fitRect={[9000,9000]} /></e.mesh>

      <ShaderSingleBeam position={[30,-310,-380]} rotation={[THREE.MathUtils.degToRad(-6),0,2.5]} seedOffset={100}/>
      <UnderwaterSleeve topY={-0.12} depth={12000} radius={5000} closeBottom/>
      <HalfDomeRimGlow radius={3500}/>
      <ImagePlane url='./sky.png' position={[0,0,-5]} />

<e.group theatreKey='SteppingStone' position={[0, 0, 1]}>
<SteppingStone position={[0, 0.09, 0]} count={28} radius={5} />
      </e.group>


    </>
  )
}
