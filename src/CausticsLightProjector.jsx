// CausticsLightProjector.jsx
import * as THREE from 'three'
import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useVideoTexture, useHelper } from '@react-three/drei'

export default function CausticsLightProjector({
  position  = [0, -298, 0],
  target    = [0, -340, 0],
  angle     = 1.35,           // radians — widen to cover everything
  intensity = 6.0,            // start strong so you can see it
  distance  = 1200,
  decay     = 0.0,
  color     = '#ffffff',
  videoUrl  = '/caustics.mp4',
  repeat    = [1.5, 1.2],
  speed     = [0.03, 0.02],
  showHelper = true,          // visualize the cone while tuning
}) {
  const lightRef  = useRef()
  const targetRef = useRef()

  // helper to visualize where the cone actually is
  useHelper(showHelper ? lightRef : null, THREE.SpotLightHelper, 'cyan')

  const cookie = useVideoTexture(videoUrl, {
    start: true, loop: true, muted: true, crossOrigin: 'anonymous'
  })

  // configure texture
  useEffect(() => {
    if (!cookie) return
    cookie.wrapS = cookie.wrapT = THREE.RepeatWrapping
    cookie.repeat.set(repeat[0], repeat[1])
    cookie.minFilter = THREE.LinearFilter
    cookie.magFilter = THREE.LinearFilter
    if ('colorSpace' in cookie) cookie.colorSpace = THREE.LinearSRGBColorSpace
  }, [cookie, repeat])

  // scroll the caustics
  useFrame((_, dt) => {
    if (!cookie) return
    cookie.offset.x += speed[0] * dt
    cookie.offset.y += speed[1] * dt
  })

  // make the light actually aim at the target object
  useEffect(() => {
    const l = lightRef.current
    const t = targetRef.current
    if (!l || !t) return
    l.target = t
    l.target.updateMatrixWorld()
    // warn if your three build lacks `map` support on SpotLight
    if (!('map' in l)) {
      console.warn('[CausticsLightProjector] This three.js version does not support SpotLight.map (need r152+).')
    }
  }, [])

  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        color={color}
        intensity={intensity}
        angle={angle}
        distance={distance}
        decay={decay}
        penumbra={1}
        castShadow={false}
        map={cookie}               // <-- the cookie
      />
      {/* target must be in the scene graph */}
      <object3D ref={targetRef} position={target} />
    </>
  )
}
