import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function R1stone(props) {
  const { nodes, materials } = useGLTF('/models/r-1-stone.glb')
  return (
    <group {...props} dispose={null}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.defaultMaterial.geometry}
          material={materials.Small_rock_2_low}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>
    </group>
  )
}

useGLTF.preload('/models/r-1-stone.glb') 
