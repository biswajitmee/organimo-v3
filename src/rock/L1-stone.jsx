import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function L1stone(props) {
  const { nodes, materials } = useGLTF('/models/l1-stone.glb')
  return (
    <group {...props} dispose={null}>
      <group scale={0.01}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.lowpolyLOD1100_lambert1_0.geometry}
          material={materials.lambert1}
          position={[0, 119.551, 0]}
          scale={59.989}
        />
      </group>
    </group>
  )
}

useGLTF.preload('/models/l1-stone.glb')     