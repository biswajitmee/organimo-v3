import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function Product(props) {
  const { nodes, materials } = useGLTF('/Product.glb')
  return (
    <group {...props} dispose={null}>
      <group rotation={[-Math.PI / 2, 0, 0]} scale={0.677}>
        <group rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <group rotation={[-Math.PI / 2, 0, 0]} scale={100}>
            <mesh
              castShadow
              receiveShadow
              geometry={nodes.cream_cream_Material_0.geometry}
              material={materials.cream_Material}
              position={[0.001, -0.01, 1.087]}
              rotation={[-0.005, -0.002, -1.095]}
              scale={1.792}
            />
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/Product.glb')