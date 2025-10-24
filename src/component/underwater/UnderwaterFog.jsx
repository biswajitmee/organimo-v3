// UnderwaterFog.jsx
import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

export default function UnderwaterFog({
  waterY = 0,
  // surface (what you already use in WaterScene)
  surfaceColor = '#4D2E69',
  surfaceDensity = 0.00032,
  // underwater target
  underColor = '#4D2E69',      // purple-blue
  underDensity = 0.0014,        // stronger fog under water
  // how soft the transition is around the surface
  blendMeters = 6               // meters over which to blend
}) {
  const { scene, camera } = useThree()

  // one fog object reused for both states (important for Water RTT)
  const fog = useMemo(
    () => new THREE.FogExp2(new THREE.Color(surfaceColor), surfaceDensity),
    []
  )
 
  // install once, restore on unmount
  useEffect(() => {
    const prev = scene.fog
    scene.fog = fog
    return () => { scene.fog = prev }
  }, [scene, fog])

  useFrame(() => {
    // depth below surface (<=0 above water, >0 underwater)
    const depth = waterY - camera.position.y

    // 0..1 blend with a soft band across the surface
    // t=0 above water, t=1 deep under water
    const t = THREE.MathUtils.clamp((depth + blendMeters * 0.5) / blendMeters, 0, 1)

    // lerp density & color
    fog.density = THREE.MathUtils.lerp(surfaceDensity, underDensity, t)

    // small extra boost as you go deeper (feels more volumetric)
    const deep = THREE.MathUtils.clamp(depth / 40, 0, 1)
    fog.density *= 1.0 + deep * 0.6

    fog.color.set(surfaceColor).lerp(new THREE.Color(underColor), t)
  })

  return null
}
