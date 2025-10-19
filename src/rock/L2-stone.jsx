import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function L2stone(props) {
  const { nodes, materials } = useGLTF('/models/l2-stone.glb')
  return (
    <group {...props} dispose={null}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.defaultMaterial.geometry}
            material={materials.Rock_lod0}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        </group>
      </group>
    </group>
  )
}
 
useGLTF.preload('/models/l2-stone.glb')  
