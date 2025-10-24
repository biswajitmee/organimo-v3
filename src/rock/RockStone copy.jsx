// src/RockStone.jsx
import React, { useRef, useLayoutEffect, useMemo, useEffect } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader' // ensure three has examples available

export default function RockStone(props) {
  const pivotRef = useRef()
  const modelRef = useRef()

  const { nodes } = useGLTF('/models/Rock-Product.glb')

  // --- load common maps (png/jpg) with useTexture ---
  const colorMap = useTexture('../textures/1/rock_boulder_dry_diff_4k.jpg') // color map (sRGB)
  const normalMap = useTexture('../textures/1/rock_boulder_dry_disp_4k.png') // normal/displacement (PNG)

  // --- load EXR maps (roughness/ao) with EXRLoader ---
  // If your EXR files are not necessary, convert them to PNG/JPG and use useTexture instead.
  // useLoader(EXRLoader, url) returns a DataTexture/Texture compatible with Three.
  let roughnessMap = null
  let aoMap = null
  try {
    roughnessMap = useLoader(EXRLoader, '../textures/1/rock_boulder_dry_rough_4k.exr')
  } catch (err) {
    // fallback: leave null or load a png fallback
    console.warn('Could not load EXR roughness; falling back to null or png. Error:', err)
  }
  try {
    aoMap = useLoader(EXRLoader, '../textures/1/rock_boulder_dry_nor_gl_4k.exr')
  } catch (err) {
    console.warn('Could not load EXR ao/normal; falling back to null. Error:', err)
  }

  // --- configure encodings/wrap/repeat properly ---
  useEffect(() => {
    if (colorMap) {
      colorMap.encoding = THREE.sRGBEncoding
      colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping
      colorMap.repeat.set(2, 2)
    }
    if (normalMap) {
      normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping
      normalMap.repeat.set(2, 2)
      // normal maps should use LinearEncoding
      normalMap.encoding = THREE.LinearEncoding
    }
    if (roughnessMap) {
      roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping
      roughnessMap.repeat.set(2, 2)
      roughnessMap.encoding = THREE.LinearEncoding
    }
    if (aoMap) {
      aoMap.wrapS = aoMap.wrapT = THREE.RepeatWrapping
      aoMap.repeat.set(2, 2)
      aoMap.encoding = THREE.LinearEncoding
    }
  }, [colorMap, normalMap, roughnessMap, aoMap])

  // --- create material using maps individually (not passing one big object) ---
  const rockMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: colorMap || null,
      normalMap: normalMap || null,
      roughnessMap: roughnessMap || null,
      aoMap: aoMap || null,
      displacementMap: normalMap || null, // if you have a dedicated displacement map, use that instead
      displacementScale: 0.15,
      roughness: 0.6,
      metalness: 0.1, // rocks usually low metalness
    })
  }, [colorMap, normalMap, roughnessMap, aoMap])

  // Center pivot logic (as before)
  useLayoutEffect(() => {
    if (!modelRef.current || !pivotRef.current) return
    pivotRef.current.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(modelRef.current)
    const worldCenter = new THREE.Vector3()
    box.getCenter(worldCenter)
    const centerInPivot = worldCenter.clone()
    pivotRef.current.worldToLocal(centerInPivot)
    modelRef.current.position.sub(centerInPivot)
  }, [])

  return (
    <group ref={pivotRef} {...props} dispose={null}>
      <group ref={modelRef}>
        <group position={[-1.587, 1.178, 5.861]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2.geometry}
            material={rockMaterial}
            position={[0.089, -0.456, -0.055]}
            rotation={[0, 0, 0.19]}
            scale={0.575}
          />
        </group>

        <group position={[-4.831, -4.163, 5.551]} rotation={[-Math.PI / 2, 0, 0]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2012.geometry}
            material={rockMaterial}
            position={[0.241, 0.35, 0.499]}
            rotation={[1.135, -0.142, 0.065]}
          />
        </group>

        <group position={[-1.513, 0.356, 5.604]} rotation={[-1.8, 0.682, 0.331]} scale={0.689}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2001.geometry}
            material={rockMaterial}
            position={[-0.836, 0.394, -0.521]}
            scale={0.778}
          />
        </group>

        <group position={[-2.199, -0.506, 5.932]} rotation={[-1.8, 0.682, 0.331]} scale={0.653}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2002.geometry}
            material={rockMaterial}
            position={[-0.663, 1.997, 1.224]}
            rotation={[0, -1.204, 0]}
            scale={0.778}
          />
        </group>

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube002.geometry}
          material={rockMaterial}
          position={[-0.402, 1.475, 4.11]}
          rotation={[0, 0.14, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <group position={[-1.707, -0.574, 4.151]} rotation={[-Math.PI / 2, 0, 0]} scale={0.793}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2003.geometry}
            material={rockMaterial}
            scale={0.575}
          />
        </group>

        <group position={[0.459, -0.424, 4.407]} rotation={[-Math.PI / 2, 0, -0.581]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2004.geometry}
            material={rockMaterial}
            position={[1.448, -1.226, 1.309]}
            rotation={[0, 0, 2.584]}
            scale={[0.386, 0.339, 0.575]}
          />
        </group>

        <group
          position={[-0.173, -0.216, 4.548]}
          rotation={[-2.767, 0, 0.187]}
          scale={[0.555, 0.918, 0.929]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2005.geometry}
            material={rockMaterial}
            position={[0.62, -1.032, 1.483]}
            rotation={[0, 0, 2.584]}
            scale={[0.386, 0.339, 0.575]}
          />
        </group>

        <group
          position={[0.347, 1.462, 4.703]}
          rotation={[-2.819, 0.096, 0.31]}
          scale={[0.376, 0.622, 0.63]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2006.geometry}
            material={rockMaterial}
            position={[0.62, -1.032, 1.483]}
            rotation={[0, 0, 2.584]}
            scale={[0.386, 0.339, 0.575]}
          />
        </group>

        <group position={[0.228, -1.233, 2.353]} rotation={[-Math.PI / 2, 0, 0]} scale={0.793}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2007.geometry}
            material={rockMaterial}
            position={[-0.542, -0.5, 0.349]}
            rotation={[-0.523, -0.199, 2.801]}
            scale={[0.635, 0.413, 0.642]}
          />
        </group>

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube003.geometry}
          material={rockMaterial}
          position={[-1.237, 0.421, 2.902]}
          rotation={[0, 0.593, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube001.geometry}
          material={rockMaterial}
          position={[-0.497, 1.111, 3.622]}
          rotation={[0, Math.PI / 9, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube004.geometry}
          material={rockMaterial}
          position={[-0.837, 0.741, 3.232]}
          rotation={[0, 0.593, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube005.geometry}
          material={rockMaterial}
          position={[-2.107, -0.499, 1.952]}
          rotation={[0, 0.593, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube007.geometry}
          material={rockMaterial}
          position={[-1.487, 0.121, 2.622]}
          rotation={[0, 0.593, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube006.geometry}
          material={rockMaterial}
          position={[-1.767, -0.119, 2.282]}
          rotation={[0, 0.593, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube008.geometry}
          material={rockMaterial}
          position={[-2.517, -0.779, 1.612]}
          rotation={[0, 0.81, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube009.geometry}
          material={rockMaterial}
          position={[-2.947, -1.122, 1.504]}
          rotation={[0, 1.16, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube010.geometry}
          material={rockMaterial}
          position={[-3.457, -1.478, 1.6]}
          rotation={[0, 1.535, 0]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube011.geometry}
          material={rockMaterial}
          position={[-3.893, -1.816, 1.965]}
          rotation={[-Math.PI, 1.379, -Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube012.geometry}
          material={rockMaterial}
          position={[-4.393, -2.136, 2.225]}
          rotation={[-Math.PI, 1.11, -Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube013.geometry}
          material={rockMaterial}
          position={[-4.754, -2.448, 2.589]}
          rotation={[-Math.PI, 0.731, -Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube014.geometry}
          material={rockMaterial}
          position={[-4.958, -2.8, 3.079]}
          rotation={[-Math.PI, 0.527, -Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube015.geometry}
          material={rockMaterial}
          position={[-5.031, -3.167, 3.566]}
          rotation={[-Math.PI, 0.31, -Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube016.geometry}
          material={rockMaterial}
          position={[-5.063, -3.471, 4.119]}
          rotation={[-Math.PI, 0.189, -Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube017.geometry}
          material={rockMaterial}
          position={[-5.024, -3.792, 4.547]}
          rotation={[Math.PI, -0.076, Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube018.geometry}
          material={rockMaterial}
          position={[-4.889, -4.077, 5.08]}
          rotation={[Math.PI, -0.28, Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube019.geometry}
          material={rockMaterial}
          position={[-4.552, -4.498, 5.516]}
          rotation={[Math.PI, -0.451, Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube020.geometry}
          material={rockMaterial}
          position={[-4.149, -4.797, 5.962]}
          rotation={[Math.PI, -0.692, Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Cube021.geometry}
          material={rockMaterial}
          position={[-3.681, -5.097, 6.298]}
          rotation={[Math.PI, -0.95, Math.PI]}
          scale={[0.695, 0.167, 0.299]}
        />

        <group position={[-2.176, -3.362, 3.21]} rotation={[-2.277, -0.116, 1.683]} scale={0.653}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2008.geometry}
            material={rockMaterial}
            position={[0.107, 1.631, 1.883]}
            rotation={[0, -1.204, 0]}
            scale={0.654}
          />
        </group>

        <group position={[-2.229, -2.887, 6.595]} rotation={[-1.8, 0.682, 0.331]} scale={0.653}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2009.geometry}
            material={rockMaterial}
            position={[0.001, 2.128, 2.085]}
            rotation={[0, -1.204, 0]}
            scale={0.778}
          />
        </group>

        <group
          position={[-2.579, -0.983, 5.089]}
          rotation={[2.356, 0.429, 2.387]}
          scale={[0.321, 0.592, 0.32]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2010.geometry}
            material={rockMaterial}
            position={[0.342, 2.176, 2.094]}
            rotation={[-0.04, -0.389, 0.49]}
            scale={0.778}
          />
        </group>

        <group
          position={[-3.556, -1.246, 6.078]}
          rotation={[2.356, 0.429, 2.387]}
          scale={[0.321, 0.592, 0.32]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2011.geometry}
            material={rockMaterial}
            position={[-3.125, 2.516, 6.035]}
            rotation={[-2.383, -0.288, -2.093]}
            scale={0.778}
          />
        </group>

        <group position={[-4.589, -4.922, 5.937]} rotation={[-Math.PI / 2, 0, 0]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2013.geometry}
            material={rockMaterial}
            position={[0.476, 0.362, 0.528]}
            rotation={[1.266, -0.198, 0.103]}
            scale={1.713}
          />
        </group>

        <group position={[-2.143, -2.504, 1.19]} rotation={[-1.109, -0.317, -0.084]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2014.geometry}
            material={rockMaterial}
            position={[0.235, 0.406, 0.438]}
            rotation={[1.135, -0.142, 0.065]}
          />
        </group>

        <group position={[-2.283, -2.331, 1.548]} rotation={[-2.104, 0.777, 0.48]} scale={0.397}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2015.geometry}
            material={rockMaterial}
            position={[-0.663, 1.997, 1.224]}
            rotation={[0, -1.204, 0]}
            scale={0.778}
          />
        </group>

        <group
          position={[-4.051, -3.118, 1.792]}
          rotation={[-2.452, 0.918, 0.826]}
          scale={[0.397, 0.562, 0.45]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2016.geometry}
            material={rockMaterial}
            position={[-0.663, 1.997, 1.224]}
            rotation={[0, -1.204, 0]}
            scale={0.778}
          />
        </group>

        <group position={[-4.831, -4.163, 5.551]} rotation={[-Math.PI / 2, 0, 0]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2018.geometry}
            material={rockMaterial}
            position={[-0.12, 1.058, 0.334]}
            rotation={[0.595, -0.285, 0.163]}
            scale={[1.244, 1.109, 1.118]}
          />
        </group>

        <group
          position={[-4.831, -3.853, 1.54]}
          rotation={[-2.738, -0.18, 1.481]}
          scale={[0.397, 0.562, 0.45]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2017.geometry}
            material={rockMaterial}
            position={[-0.665, 1.151, 1.767]}
            rotation={[-2.522, -1.371, -2.59]}
            scale={0.778}
          />
        </group>

        <group
          position={[-4.87, -4.411, 2.881]}
          rotation={[2.102, -0.708, 1.034]}
          scale={[0.397, 0.562, 0.45]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2019.geometry}
            material={rockMaterial}
            position={[-1.689, 0.998, 1.412]}
            rotation={[-2.522, -1.371, -2.59]}
            scale={0.615}
          />
        </group>

        <group position={[-6.176, -3.7, 5.842]} rotation={[-2.598, -0.343, 0.2]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2020.geometry}
            material={rockMaterial}
            position={[0.241, 0.35, 0.499]}
            rotation={[1.135, -0.142, 0.065]}
          />
        </group>

        <group position={[-5.591, -4.195, 6.356]} rotation={[-2.598, -0.343, 0.2]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2021.geometry}
            material={rockMaterial}
            position={[0.202, 0.322, 0.365]}
            rotation={[1.221, -0.026, 0.998]}
          />
        </group>

        <group
          position={[-1.644, -5.392, 5.862]}
          rotation={[2.338, -0.736, 1.001]}
          scale={[0.397, 0.562, 0.45]}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2022.geometry}
            material={rockMaterial}
            position={[-2.823, -0.222, 2.638]}
            rotation={[-2.017, -0.65, -2.431]}
            scale={0.513}
          />
        </group>

        <group position={[-3.364, -4.255, 7.195]} rotation={[-1.917, -1.173, 1.257]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2023.geometry}
            material={rockMaterial}
            position={[0.436, 0.369, 0.704]}
            rotation={[1.312, -1.222, 0.109]}
          />
        </group>

        <group position={[-3.912, -2.897, 7.463]} rotation={[2.46, 0.225, 1.595]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2024.geometry}
            material={rockMaterial}
            position={[0.324, 0.461, 0.705]}
            rotation={[1.312, -1.222, 0.109]}
          />
        </group>

        <group position={[-3.934, -4.095, 6.371]} rotation={[1.723, 0.225, 1.595]} scale={1.141}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2025.geometry}
            material={rockMaterial}
            position={[0.324, 0.461, 0.705]}
            rotation={[1.312, -1.222, 0.109]}
            scale={1.281}
          />
        </group>

        <group position={[-4.413, -3.104, 5.081]} rotation={[-1.263, -0.087, -0.077]} scale={3.761}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2026.geometry}
            material={rockMaterial}
            position={[0.241, 0.349, 0.497]}
            rotation={[1.135, -0.142, 0.065]}
          />
        </group>

        <group position={[0.974, -0.241, 5.264]} rotation={[-Math.PI / 2, 0, 2.004]}>
          <mesh castShadow receiveShadow geometry={nodes.Object_2027.geometry} material={rockMaterial} scale={0.575} />
        </group>

        <group position={[0.919, -0.058, 3.246]} rotation={[-Math.PI / 2, 0, 2.732]} scale={0.696}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2028.geometry}
            material={rockMaterial}
            position={[-0.206, -0.123, -0.303]}
            scale={0.575}
          />
        </group>

        <group position={[-1.297, 3.453, 6.813]} rotation={[-2.421, 0.473, -0.093]} scale={3.179}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.Object_2029.geometry}
            material={rockMaterial}
            position={[0.168, 0.679, 0.122]}
            rotation={[0.999, -0.018, 0.875]}
            scale={[1.949, 1.652, 1.324]}
          />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/Rock-Product.glb')
