// WaterScene.jsx — silky Organimo-like waves + color (sky disabled)
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

// soft, thin horizon glow (end-wall blend)
function makeHorizonBandTexture({
  width = 4096,
  height = 1024,
  color = '#ffffff',
  band = 0.52,
  feather = 0.35,
  strength = 0.35,
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
  const fwd = useMemo(() => new THREE.Vector3(), [])

  /* camera & renderer */
  useEffect(() => {
    camera.far = 50000
    camera.updateProjectionMatrix()
  }, [camera])

  // background will be this clear color (no sky)
  const EXPOSURE = 0.18
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = EXPOSURE
    gl.setClearColor('#EAD0DB', 1) // pastel backdrop instead of sky
    gl.physicallyCorrectLights = true
  }, [gl])
  useFrame(() => {
    if (gl.toneMappingExposure !== EXPOSURE) gl.toneMappingExposure = EXPOSURE
  })

  /* fog (soft pastel) */
  const FOG_COLOR = '#75607b'
  const FOG_DENS = 0.00049
  useEffect(() => {
    scene.fog = new THREE.FogExp2(new THREE.Color(FOG_COLOR), FOG_DENS)
  }, [scene])
  useFrame(() => {
    const fog = scene.fog
    if (!fog || !fog.isFogExp2) {
      scene.fog = new THREE.FogExp2(new THREE.Color(FOG_COLOR), FOG_DENS)
    } else {
      fog.color.set(FOG_COLOR)
      fog.density = FOG_DENS
    }
  })

  /* water setup (Organimo-like waves & color) */
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
      sunColor: 0x000000,               // sun OFF
      waterColor: new THREE.Color('#6E7EA1'),
      distortionScale: 0.28,
      fog: true,
    })

//     function disableWaterSun(water) {
//   const u = water?.material?.uniforms
//   if (!u) return
//   if (u.sunColor) u.sunColor.value.set(0, 0, 0)     // <-- kills sun light
//   if (u.reflectivity) u.reflectivity.value = 0.0     // (some builds expose this)
//   if (u.sunDirection) u.sunDirection.value.set(0, 1, 0) // any dir; color=black already disables
// }
// disableWaterSun(water)


    water.rotation.x = -Math.PI / 2
    water.frustumCulled = false
    water.material.side = THREE.DoubleSide
    water.material.transparent = false
    water.material.depthWrite = true
    water.material.depthTest = true

    setU(water, 'size', 0.85)
    setU(water, 'alpha', 1.0)
    if (water.material.uniforms.reflectivity) water.material.uniforms.reflectivity.value = 0.0 // flatter without sky

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

  /* animate waves & keep plane centered under camera (infinite look) */
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

  /* soft horizon band (still active with no sky) */
  useFrame(({ gl, camera: cam }) => {
    const band = bandRef.current
    if (!band) return

    band.visible = (gl.getRenderTarget() === null) && (camera.position.y >= 0)

    cam.getWorldDirection(fwd).normalize()
    const targetY = 2
    const dy = Math.abs(fwd.y) < 1e-4 ? (fwd.y < 0 ? -1e-4 : 1e-4) : fwd.y
    let t = (targetY - cam.position.y) / dy
    t = THREE.MathUtils.clamp(t, 2000, 20000)

    band.position.copy(cam.position).addScaledVector(fwd, t)
    band.quaternion.copy(cam.quaternion)

    const fovY = THREE.MathUtils.degToRad(cam.fov)
    const height = 2 * Math.tan(fovY / 2) * t
    const width = height * cam.aspect
    const thickness = 220
    band.scale.set(width * 1.05, thickness, 1)
  })

  return (
    <>
      {/* (sky dome removed) */}

      {/* horizon glow */}
      <mesh ref={bandRef} renderOrder={999} frustumCulled={false}>
        {/* <planeGeometry args={[1, 1]} /> */}
        {/* <meshBasicMaterial
          map={bandTex}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthTest={false}     // overlay cleanly without sky
          depthWrite={false}
          toneMapped={false}
        /> */}
      </mesh>

      <Stats />
    </>
  )
}
