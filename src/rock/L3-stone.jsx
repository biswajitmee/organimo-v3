import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function L3stone(props) {
  const { nodes, materials } = useGLTF('/models/l3-stone.glb')
  return (
    <group {...props} dispose={null}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.defaultMaterial.geometry}
          material={materials.defaultMat}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>
    </group>
  )
} 

useGLTF.preload('/models/l3-stone.glb')