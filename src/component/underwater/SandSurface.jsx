// SandSurface.jsx
import * as THREE from 'three'
import React, { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'

export default function SandSurface({ textureUrl, size = 20000 }) {
  // Load the sand texture
  const sandTex = useLoader(THREE.TextureLoader, textureUrl)

  // Configure wrapping/repeat
  useMemo(() => {
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping
    sandTex.repeat.set(size / 200, size / 200) // adjust tiling as needed
    sandTex.anisotropy = 8
    sandTex.colorSpace = THREE.SRGBColorSpace
  }, [sandTex, size])

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[size, size, 1, 1]} />
      <meshStandardMaterial
        map={sandTex}
        roughness={1}
        metalness={0}
      />
    </mesh>
  )
}
