
import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function StoneHeight(props) {
  const { nodes, materials } = useGLTF('/stoneHeight.glb')
  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cube.geometry}
        material={nodes.Cube.material}
      />
    </group>
  )
}

useGLTF.preload('/stoneHeight.glb')
