import React from "react"
import { useGLTF, Float } from "@react-three/drei"

export function ConchShell(props) {
  const { nodes, materials } = useGLTF("/models/conch-shell.glb")

  return (
    <Float
      speed={1}                // how fast it floats/rotates
      rotationIntensity={0.1}  // how much rotation wiggles
      floatIntensity={0.7}     // how much it floats up/down
      floatingRange={[-2, 2]} // y-range in world units
    >
      <group {...props} dispose={null}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Object_2.geometry}
          material={materials.model_Material_u1_v1}
          rotation={[-Math.PI / 2, 1, 0]}
          scale={0.005}
        />
      </group>
    </Float>
  )
}

useGLTF.preload("/models/conch-shell.glb")
