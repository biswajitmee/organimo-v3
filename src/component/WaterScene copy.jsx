import * as THREE from 'three'
import { useRef, useEffect, useMemo } from 'react'
import { useFrame, extend, useThree } from '@react-three/fiber'
import { Stats, Sky } from '@react-three/drei'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'

import UnderwaterController from './underwater/UnderwaterController'

extend({ Water })

export default function WaterScene() {
  const waterRef = useRef()
  const skyRef = useRef()
  const meshRef = useRef()
  const { scene } = useThree()

  const sun = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    // Water
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000, 512, 512)
    const water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load(
        'https://threejs.org/examples/textures/waternormals.jpg',
        (tx) => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping }
      ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: false
    })

    water.material.side = THREE.DoubleSide
water.material.uniforms.alpha.value = 1.0

  water.material.transparent = false      // avoid accidental blending
  water.material.depthWrite = true
  water.material.depthTest = true


    water.rotation.x = -Math.PI / 2
    scene.add(water)
    waterRef.current = water

    // GUI
    const gui = new GUI()
    const params = {
      elevation: 0.25,      // can go below 1 now
      azimuth: 180,
      distortionScale: 3.7,
      size: 1
    }

    const updateSun = () => {
      // spherical: elevation [deg] above horizon
      const phi = THREE.MathUtils.degToRad(90 - params.elevation)
      const theta = THREE.MathUtils.degToRad(params.azimuth)
      sun.setFromSphericalCoords(1, phi, theta)

      // update sky + water
      if (skyRef.current) {
        skyRef.current.material.uniforms.sunPosition.value.copy(sun)
      }
      if (waterRef.current) {
        waterRef.current.material.uniforms.sunDirection.value.copy(sun).normalize()
      }
    }

    gui.add(params, 'elevation', 0, 90).step(0.01).decimals(2).onChange(updateSun)
    gui.add(params, 'azimuth', -180, 180).step(0.1).decimals(1).onChange(updateSun)
    gui.add(params, 'distortionScale', 0, 8).step(0.01).decimals(2)
      .onChange(v => { water.material.uniforms.distortionScale.value = v })
    gui.add(params, 'size', 0.1, 10).step(0.01).decimals(2)
      .onChange(v => { water.material.uniforms.size.value = v })

    updateSun()

    return () => {
      gui.destroy()
      scene.remove(water)
      water.geometry.dispose()
      water.material.dispose()
    }
  }, [scene, sun])

  useFrame((_, dt) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(performance.now() * 0.001) * 20 + 5
    }
    if (waterRef.current) {
      waterRef.current.material.uniforms.time.value += dt
    }
  })

  
  return (
    <>
      {/* Pass sunPosition via prop so Sky updates when uniforms change */}
      <Sky ref={skyRef} scale={10000} sunPosition={sun} />
      <mesh ref={meshRef}>
        <meshStandardMaterial roughness={0} />
      </mesh>
      <Stats />

 


    </>
  )
}
