import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function Pillarstone(props) {
  const { nodes, materials } = useGLTF('/models/pillar-stone.glb')
  return (
    <group {...props} dispose={null}>
      <group scale={0.01}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.PillarTop_aiStandardSurface1_0.geometry}
          material={materials.aiStandardSurface1}
          position={[0, -2.5, 0]}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Vine_aiStandardSurface1_0.geometry}
          material={materials.aiStandardSurface1}
          position={[0, -2.5, 0]}
        /> 
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.PillarBottom_aiStandardSurface1_0.geometry}
          material={materials.aiStandardSurface1}
          position={[0, -2.5, 0]}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.PillarMain_aiStandardSurface1_0.geometry}
          material={materials.aiStandardSurface1}
          position={[0, -0.5, 0]}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Leaves_aiStandardSurface1_0.geometry}
          material={materials.aiStandardSurface1}
          position={[0, -2.5, 0]}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Flower_aiStandardSurface1_0.geometry}
          material={materials.aiStandardSurface1}
          position={[0, -2.5, 0]}
        />
      </group>
    </group>
  )
}

useGLTF.preload('/models/pillar-stone.glb')