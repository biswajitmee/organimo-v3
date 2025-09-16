// component/underwater/CausticsLightProjector.jsx
import * as THREE from 'three'
import React, { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useVideoTexture, useHelper } from '@react-three/drei'

export default function CausticsLightProjector({
  visible = true,
  position = [0, -298, 0],
  targetRef,                 // <-- pass a ref from the rig
  angle = 1.1,
  intensity = 6.0,
  distance = 1200,
  decay = 0.0,
  color = '#ffffff',
  videoUrl = '.../caustics.mp4',
  repeat = [6.0, 4.0],
  speed = [0.06, 0.04],
  showHelper = true,
  shadowSize = 2048,
  bias = -0.0005,
}) {
  const lightRef = useRef()

  useHelper(showHelper && visible ? lightRef : null, THREE.SpotLightHelper, 'cyan')

  const cookie = useVideoTexture(videoUrl, {
    start: true, loop: true, muted: true, crossOrigin: 'anonymous'
  })

  useEffect(() => {
    if (!cookie) return
    cookie.wrapS = cookie.wrapT = THREE.RepeatWrapping
    cookie.repeat.set(repeat[0], repeat[1])
    cookie.minFilter = THREE.LinearFilter
    cookie.magFilter = THREE.LinearFilter
    if ('colorSpace' in cookie) cookie.colorSpace = THREE.SRGBColorSpace
    cookie.needsUpdate = true
  }, [cookie, repeat])

  useFrame((_, dt) => {
    if (!cookie) return
    cookie.offset.x += speed[0] * dt
    cookie.offset.y += speed[1] * dt
  })

  useEffect(() => {
    const l = lightRef.current
    const t = targetRef?.current
    if (!l || !t) return
    l.target = t
    l.target.updateMatrixWorld()
    if (!('map' in l)) console.warn('[CausticsLightProjector] SpotLight.map not supported in this three build.')
  }, [targetRef])

  return (
    <spotLight
      ref={lightRef}
      visible={visible}
      position={position}
      color={color}
      intensity={intensity}
      angle={angle}
      distance={distance}
      decay={decay}
      penumbra={1}
      castShadow
      shadow-mapSize-width={shadowSize}
      shadow-mapSize-height={shadowSize}
      shadow-bias={bias}
      map={cookie}
    />
  )
}
