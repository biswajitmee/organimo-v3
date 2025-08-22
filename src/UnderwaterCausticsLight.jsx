import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useVideoTexture } from '@react-three/drei'

export default function UnderwaterCausticsLight({
  position = [0, -600, 0],   // near/below water plane
  target = [0, -900, 0],     // point at seabed
  angle = 1.0,
  intensity = 14,
  distance = 5000,
  penumbra = 1,
  decay = 0,                 // 0 = no falloff (nice for pools)
  ...props
}) {
  const lightRef = useRef()
  const targetRef = useRef()
  const { scene } = useThree()

  const map = useVideoTexture('/caustics.mp4', {
   crossOrigin: 'anonymous',
    muted: true,
    loop: true,
    start: true,
  })

  useEffect(() => {
    if (!map) return
    map.generateMipmaps = false
    map.minFilter = THREE.LinearFilter
    map.magFilter = THREE.LinearFilter
    map.colorSpace = THREE.SRGBColorSpace
  }, [map])

  useEffect(() => {
    if (!lightRef.current || !targetRef.current) return
    lightRef.current.target = targetRef.current
    if (!targetRef.current.parent) scene.add(targetRef.current)
  }, [scene])

  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        angle={angle}
        penumbra={penumbra}
        distance={distance}
        intensity={intensity}
        decay={decay}
        castShadow
        map={map}        // ← the video gobo
        {...props}
      />
      <object3D ref={targetRef} position={target} />
    </>
  )
}
