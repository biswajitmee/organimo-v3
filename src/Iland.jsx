import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function Iland(props) {
  const { nodes, materials } = useGLTF('/iland.glb')
  return (
    <group {...props} dispose={null}>
      <group position={[17.117, 218.356, 23.591]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <group position={[33.745, 38.713, -60.289]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Fortress_Fortress_0.geometry}
            material={materials.Fortress}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Fortress_Fortress_0_1.geometry}
            material={materials.Fortress}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Fortress_Fortress_0_2.geometry}
            material={materials.Fortress}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Fortress_Environment_0.geometry}
            material={materials.Environment}
          />
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Fortress_Sand_0.geometry}
            material={materials.Sand}
          />
        </group>
      </group>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Sea_Sea_0.geometry}
        material={materials.material}
        position={[-1.388, 326.224, 14.92]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Sky_Sky_0.geometry}
        material={materials.material_4}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  )
}

useGLTF.preload('/iland.glb')