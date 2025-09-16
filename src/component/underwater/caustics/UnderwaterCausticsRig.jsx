// component/underwater/UnderwaterCausticsRig.jsx
import React, { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import CausticsLightProjector from './CausticsLightProjector.jsx'
import PerforatedLightMaskPlane from './PerforatedLightMaskPlane.jsx'

/**
 * Turnkey rig:
 *  - Enables caustic beams only when camera is under `waterLevel` (default 0).
 *  - Places an animated perforated mask plane between light and floor/sand.
 *  - Projects small, tiled caustics on receivers (e.g., SandSurface).
 *
 * Requirements:
 *  - <Canvas shadows />
 *  - Receivers (sand, rocks) have receiveShadow
 *  - public/caustics.mp4 exists (or override videoUrl)
 */
export default function UnderwaterCausticsRig({
  waterLevel = 0,         // camera y must be < waterLevel to enable
  maskY = -250,           // place mask just under surface
  sandY = -600,           // your sand plane (receiver) y
  videoUrl = './caustics.mp4',
  // projector tuning
  projectorPos = [0, -180, 0],
  projectorAngle = 1.0,
  projectorIntensity = 5.5,
  projectorDistance = 2500,
  projectorRepeat = [8, 5], // high tile count => small ripples
  projectorSpeed = [0.05, 0.03],
  projectorShadowSize = 4096,
  projectorBias = -0.0006,
  // mask tuning
  maskSize = [6000, 6000],
  holeScale = 0.0010,
  holeThreshold = 0.47,
  holeFeather = 0.09,
  holeSpeed = 0.06,
  showHelper = true,      // cyan cone helper
}) {
  const { camera } = useThree()
  const [enabled, setEnabled] = useState(false)
  const target = useRef()

  // live toggle based on Theatre-updated camera.y
  useFrame(() => {
    const y = camera.position.y
    const on = y < waterLevel
    if (on !== enabled) setEnabled(on)
  })

  return (
    <>
      {/* The target dummy the projector aims at (usually your sand plane) */}
      <object3D ref={target} position={[0, sandY, 0]} />

      {/* Animated “holey” plane that casts a cutout shadow (the beam gobo) */}
      <PerforatedLightMaskPlane
        visible={enabled}
        position={[0, maskY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={maskSize}
        holeScale={holeScale}
        holeThreshold={holeThreshold}
        feather={holeFeather}
        speed={holeSpeed}
      />

      {/* Caustics projector (video cookie + tiling) */}
      <CausticsLightProjector
        visible={enabled}
        position={projectorPos}
        targetRef={target}
        angle={projectorAngle}
        intensity={projectorIntensity}
        distance={projectorDistance}
        decay={0.0}
        color="#ffffff"
        videoUrl={videoUrl}
        repeat={projectorRepeat}
        speed={projectorSpeed}
        showHelper={showHelper}
        shadowSize={projectorShadowSize}
        bias={projectorBias}
      />
    </>
  )
}
