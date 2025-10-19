

///////////////////////////////////

import React, { useRef } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

export function HeroRock(props) {
  const { nodes, materials } = useGLTF('/models/hero-rock.glb')
const rockTex = useTexture('../textures/rock-texture.jpg')
  // Configure texture (repeat, wrap, etc.)
  rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping
  rockTex.repeat.set(2, 2)
  // Create a standard material with the texture
  const rockMaterial = new THREE.MeshStandardMaterial({
    map: rockTex,
    roughness: 0.9,
    metalness: 0.90,  })
  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.mountain.geometry}
          material={rockMaterial}
      />
    </group>
  )
}

useGLTF.preload('/models/hero-rock.glb')