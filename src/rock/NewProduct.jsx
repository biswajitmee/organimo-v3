
import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function Newproduct(props) {
  const { nodes, materials } = useGLTF('/Newproduct.glb')
  return (
    <group {...props} dispose={null}>
      <group scale={0.01}>
        <group rotation={[-Math.PI / 2, 0, 0]} scale={100}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Circle002_Material002_0.geometry}
            material={materials['Material.002']}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Circle002_Material001_0.geometry}
            material={materials['Material.001']}
          />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/Newproduct.glb')
