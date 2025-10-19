// Fish.jsx
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'

export  function Fish(props) {
  const group = useRef()
  const { nodes, materials, animations, scene } = useGLTF('/models/fish-blender.glb')
  const { actions, mixer } = useAnimations(animations, group)
   
  // --- Autoplay swim animation ---
  useEffect(() => {
    if (!actions) return
    Object.values(actions).forEach((action) => {
      if (!action) return
      action.reset().setLoop(THREE.LoopRepeat, Infinity).play()
    })
    return () => mixer.stopAllAction()
  }, [actions, mixer])

  // --- Disable culling so it never disappears ---
  useEffect(() => {
    group.current?.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false
    })
  }, [scene])

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Sketchfab_model" rotation={[-Math.PI / 2, 0, 0]}>
          <group name="Goldfish_Type3fbx" rotation={[Math.PI / 2, 0, 0]} scale={0.001}>
            <group name="Object_2">
              <group name="RootNode">
                <group
                  name="GoldfishT3_BMesh_Swim_Slow"
                  position={[45.876, 48.408, 10.006]}
                  scale={4.198}
                />
                <group name="goldfishType_3_BAseRig" rotation={[3.094, 0.011, -1.58]} scale={10}>
                  <group name="Object_6">
                    <group name="Object_8" position={[-16.33, 103.822, 96.36]} scale={4.198} />
                    <skinnedMesh
                      name="Object_9"
                      geometry={nodes.Object_9.geometry}
                      material={materials.Goldfish_Typee_3_Mat}
                      skeleton={nodes.Object_9.skeleton}
                    />
                    <primitive object={nodes._rootJoint} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/fish-blender.glb')
