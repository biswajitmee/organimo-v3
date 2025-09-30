// WaterScene.jsx — silky Organimo-like waves + horizon band fixed at y=0.10
import * as THREE from 'three'
import { useRef, useEffect, useMemo } from 'react'
import { useFrame, extend, useThree } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'

extend({ Water })

/* ---------------- helpers ---------------- */
function setU(w, key, v) {
  const u = w?.material?.uniforms?.[key]
  if (!u) return
  if (u.value?.set && (typeof v === 'string' || typeof v === 'number')) u.value.set(v)
  else u.value = v
}

// horizon glow gradient texture
function makeHorizonBandTexture({
  width = 4096,
  height = 1024,
  color = '#EAD0DB',
  band = 0.52,
  feather = 0.35,
  strength = 0.45,
} = {}) {
  const c = document.createElement('canvas')
  c.width = width; c.height = height
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, 0, height)
  grd.addColorStop(Math.max(0, band - feather), 'rgba(255,255,255,0)')
  grd.addColorStop(band, `rgba(255,255,255,${strength})`)
  grd.addColorStop(Math.min(1, band + feather), 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, width, height)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color
  g.fillRect(0, 0, width, height)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ---------------- component ---------------- */
export default function WaterScene() {
  const waterRef = useRef()
  const bandRef = useRef()

  const { scene, gl, camera } = useThree()

  const bandTex = useMemo(() => makeHorizonBandTexture(), [])

  /* camera & renderer */
  useEffect(() => {
    camera.far = 6000
    camera.updateProjectionMatrix()
  }, [camera])

  const EXPOSURE = 0.18
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = EXPOSURE
    gl.setClearColor('#EAD0DB', 1) // pastel backdrop
    gl.physicallyCorrectLights = true
  }, [gl])

  /* fog */
  const FOG_COLOR = '#EAD0DB'
  const FOG_DENS = 0.00028
  useEffect(() => {
    scene.fog = new THREE.FogExp2(new THREE.Color(FOG_COLOR), FOG_DENS)
  }, [scene])

  /* water */
  useEffect(() => {
    const waterGeometry = new THREE.PlaneGeometry(200000, 200000, 1, 1)
    const normals = new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      (tx) => {
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping
        tx.repeat.set(1.9, 1.15)
        tx.rotation = Math.PI * 0.06
      }
    )

    const water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(),
      sunColor: 0x000000,
      waterColor: new THREE.Color('#9A8CA9'),
      distortionScale: 0.28,
      fog: true,
    })

    water.rotation.x = -Math.PI / 2
    water.frustumCulled = false
    water.material.side = THREE.DoubleSide
    water.material.transparent = false
    water.material.depthWrite = true
    water.material.depthTest = true

    setU(water, 'size', 0.85)
    setU(water, 'alpha', 1.0)
    if (water.material.uniforms.reflectivity) water.material.uniforms.reflectivity.value = 0.0

    scene.add(water)
    waterRef.current = water

    // GUI
    const gui = new GUI()
    const params = { distortionScale: 0.28, size: 0.85, waterColor: '#75607b' }
    gui.add(params, 'distortionScale', 0, 1).step(0.01).onChange(v => setU(water, 'distortionScale', v))
    gui.add(params, 'size', 0.4, 1.4).step(0.01).onChange(v => setU(water, 'size', v))
    gui.addColor(params, 'waterColor').onChange(v => setU(water, 'waterColor', new THREE.Color(v)))

    return () => { gui.destroy(); scene.remove(water); water.geometry.dispose(); water.material.dispose() }
  }, [scene])

  /* animate waves */
  useFrame((_, dt) => {
    const w = waterRef.current
    if (!w) return
    const u = w.material.uniforms
    if (u?.time) u.time.value = (u.time.value + dt * 0.22) % 1000.0
    const tex = u?.normalSampler?.value
    if (tex) {
      tex.offset.x += dt * 0.010
      tex.offset.y += dt * 0.006
    }
    w.position.x = camera.position.x
    w.position.z = camera.position.z
  })

  /* horizon band — fixed at y=0.10, radius ~6000 */
  useFrame(() => {
    const band = bandRef.current
    if (!band) return

    band.position.set(camera.position.x, 0.10, camera.position.z)

    band.rotation.set(-Math.PI / 2, 0, 0) // flat horizontal

    const RADIUS = 6000 // or try 5500
    const THICKNESS = 220
    band.scale.set(RADIUS * 2, THICKNESS, 1)
  })

  return (
    <>
      {/* horizon glow */}
      <mesh ref={bandRef} renderOrder={999} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={bandTex}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <Stats />
    </>
  )
}
