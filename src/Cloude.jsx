import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function Cloude(props) {
  const { nodes, materials } = useGLTF('/fluffy_cloud.glb')
  return (
    <group {...props} dispose={null}>
      <group position={[0, 0.003, 1]} rotation={[-Math.PI, 0, 0]}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_2.geometry}
          material={materials.material1}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_3.geometry}
          material={materials.material2}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_4.geometry}
          material={materials.material3}
        />
      </group>
    </group>
  )
}

useGLTF.preload('/fluffy_cloud.glb')
