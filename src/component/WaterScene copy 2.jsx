// WaterScene.jsx — Water + Sky + LatheGeometry circular band
import * as THREE from 'three'
import React, { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'

/* safe uniform setter */
function setU(w, key, v) {
  const u = w?.material?.uniforms?.[key]
  if (!u) return
  if (u.value?.set && (typeof v === 'string' || typeof v === 'number')) u.value.set(v)
  else u.value = v
}

/* make vertical gradient texture following the stop percentages
   bottomPercent = hard white region (0..1)
   blendPercent = white->pink transition region (0..1)
   fadePercent = pink->transparent region (0..1)
   any remaining above sum(bottom+blend+fade) is transparent
*/
function makeVerticalEdgeTexture({
  canvasHeight = 2048,
  colorBottom = '#ffffff', // hard bottom color (white default)
  colorPink = '#EAD0DB',   // mid/pink color
  bottomPercent = 0.05,
  blendPercent = 0.05,
  fadePercent = 0.20
} = {}) {
  const c = document.createElement('canvas')
  c.width = 1
  c.height = canvasHeight
  const g = c.getContext('2d')

  // clamp and compute cumulative stops
  const bp = Math.max(0, Math.min(1, bottomPercent))
  const blp = Math.max(0, Math.min(1, blendPercent))
  const fp = Math.max(0, Math.min(1, fadePercent))
  const startBottom = 0.0
  const endBottom = bp
  const endBlend = bp + blp
  const endFade = bp + blp + fp
  // create gradient top->bottom (0 at top of canvas)
  const grd = g.createLinearGradient(0, 0, 0, canvasHeight)
  // note: canvas Y increases downward. We want bottom at low Y to be solid; but easier to map stops as fractions from top:
  // We'll treat 0.0 as top, 1.0 as bottom — so compute positions accordingly.
  // bottom region is the lowest portion: positions near 1.0
  const topPos = 0.0
  const posBottomStart = 1.0 - endBottom
  const posBlendStart = 1.0 - endBlend
  const posFadeStart = 1.0 - endFade
  // Assign stops:
  // Top region (above fade start) -> transparent
  grd.addColorStop(topPos, 'rgba(255,255,255,0)')
  // At fade start --> start pink (transparent -> pink)
  // We'll make the gradient: transparent above posFadeStart, then at posBlendStart we are pink, at posBottomStart we still pink/white mix etc
  if (fp > 0) {
    // at posFadeStart: fully transparent
    grd.addColorStop(Math.max(0, posFadeStart), 'rgba(234,208,219,0)')
    // move toward pink at posBlendStart/endBlend mapping
  } else {
    // no fade segment, continue
    grd.addColorStop(Math.max(0, posFadeStart), colorPink)
  }
  // at posBlendStart: pink solid (start of pink band)
  grd.addColorStop(Math.max(0, posBlendStart), colorPink)
  // at posBottomStart: we still have pink (or blended)
  grd.addColorStop(Math.max(0, posBottomStart), colorPink)
  // finally bottom region: hard bottom color
  grd.addColorStop(1.0 - 0.0001, colorBottom) // just before end
  grd.addColorStop(1.0, colorBottom)

  g.fillStyle = grd
  g.fillRect(0, 0, 1, canvasHeight)

  // To give a bit more controlled hard->soft transitions, we can overlay a second gradient to nudge the white at very bottom
  if (bp > 0) {
    const bottomHeight = canvasHeight * bp
    // overlay a rectangle at bottom with composite 'source-over' to ensure solid bottom
    g.globalCompositeOperation = 'source-over'
    const solidY = canvasHeight - bottomHeight
    g.fillStyle = colorBottom
    g.fillRect(0, solidY, 1, bottomHeight)
    g.globalCompositeOperation = 'source-over'
  }

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(256, 1) // repeat around circumference (many repeats to avoid stretching)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/* --------- main component ---------- */
export default function WaterScene() {
  const { scene, gl, camera } = useThree()
  const waterRef = useRef(null)
  const skyRef = useRef(null)
  const bandRef = useRef(null)
  const texRef = useRef(null)

  useEffect(() => {
    camera.far = 6000
    camera.updateProjectionMatrix()
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 0.18
    gl.outputColorSpace = THREE.SRGBColorSpace
  }, [camera, gl])

  useEffect(() => {
    /* --- Sky --- */
    const sky = new Sky()
    sky.scale.setScalar(45000)
    scene.add(sky)
    skyRef.current = sky
    const skyU = sky.material.uniforms
    skyU.turbidity.value = 6
    skyU.rayleigh.value = 2.0
    skyU.mieCoefficient.value = 0.005
    skyU.mieDirectionalG.value = 0.7

    /* --- Water --- */
    const waterGeo = new THREE.PlaneGeometry(200000, 200000)
    const water = new Water(waterGeo, {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: new THREE.TextureLoader().load(
        'https://threejs.org/examples/textures/waternormals.jpg',
        (tx) => {
          tx.wrapS = tx.wrapT = THREE.RepeatWrapping
          tx.repeat.set(2, 2)
        }
      ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x9a8ca9,
      distortionScale: 0.22,
      fog: true,
    })
    water.rotation.x = -Math.PI / 2
    scene.add(water)
    waterRef.current = water

    /* --- Default band parameters --- */
    const bandParams = {
      radius: 6000,
      height: 1200,
      opacity: 0.82,
      colorBottom: '#ffffff',  // hard bottom
      colorPink: '#EAD0DB',    // mid pink
      bottomPercent: 0.05,     // 5% hard white
      blendPercent: 0.05,      // 5% white->pink
      fadePercent: 0.20        // 20% pink->transparent
    }

    /* build Lathe band */
    function buildBand() {
      // dispose old
      if (bandRef.current) {
        try {
          bandRef.current.geometry.dispose()
          bandRef.current.material.map?.dispose()
          bandRef.current.material.dispose()
          scene.remove(bandRef.current)
        } catch (e) {}
      }

      const pts = [ new THREE.Vector2(bandParams.radius, 0), new THREE.Vector2(bandParams.radius, bandParams.height) ]
      const latheGeo = new THREE.LatheGeometry(pts, 256)
      const tex = makeVerticalEdgeTexture({
        canvasHeight: 2048,
        colorBottom: bandParams.colorBottom,
        colorPink: bandParams.colorPink,
        bottomPercent: bandParams.bottomPercent,
        blendPercent: bandParams.blendPercent,
        fadePercent: bandParams.fadePercent
      })
      texRef.current = tex

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: bandParams.opacity,
        side: THREE.BackSide, // inside draw
        depthWrite: false,
        toneMapped: false,
        blending: THREE.NormalBlending
      })
      const mesh = new THREE.Mesh(latheGeo, mat)
      mesh.position.y = 0.10
      mesh.userData = { params: bandParams }
      scene.add(mesh)
      bandRef.current = mesh
    }

    buildBand()

    /* --- GUI --- */
    const gui = new GUI({ width: 340 })
    const bandFolder = gui.addFolder('Horizon Band (Lathe)')
    bandFolder.add(bandParams, 'radius', 1000, 9000, 100).name('Radius').onChange(() => buildBand())
    bandFolder.add(bandParams, 'height', 200, 4000, 10).name('Height').onChange(() => buildBand())
    bandFolder.add(bandParams, 'opacity', 0, 1, 0.01).name('Opacity').onChange(v => { if (bandRef.current) bandRef.current.material.opacity = v })
    bandFolder.addColor(bandParams, 'colorBottom').name('Bottom Color (hard)').onChange(() => buildBand())
    bandFolder.addColor(bandParams, 'colorPink').name('Pink Color (mid)').onChange(() => buildBand())
    bandFolder.add(bandParams, 'bottomPercent', 0.0, 0.2, 0.005).name('Bottom % (hard)').onChange(() => buildBand())
    bandFolder.add(bandParams, 'blendPercent', 0.0, 0.2, 0.005).name('Blend % (white→pink)').onChange(() => buildBand())
    bandFolder.add(bandParams, 'fadePercent', 0.0, 0.5, 0.01).name('Fade % (pink→transparent)').onChange(() => buildBand())

    // Sky GUI (kept minimal)
    const skyFolder = gui.addFolder('Sky')
    const skyParams = { turbidity: 6, rayleigh: 2, elevation: 2, azimuth: 180 }
    skyFolder.add(skyParams, 'turbidity', 0, 20).onChange(v => skyU.turbidity.value = v)
    skyFolder.add(skyParams, 'rayleigh', 0, 10).onChange(v => skyU.rayleigh.value = v)
    skyFolder.add(skyParams, 'elevation', 0, 90).onChange(val => {
      const phi = THREE.MathUtils.degToRad(90 - val)
      const theta = THREE.MathUtils.degToRad(skyParams.azimuth)
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
      skyU.sunPosition.value.copy(sun)
      if (water.material.uniforms.sunDirection) water.material.uniforms.sunDirection.value.copy(sun).normalize()
    })
    skyFolder.add(skyParams, 'azimuth', -180, 180).onChange(val => {
      const phi = THREE.MathUtils.degToRad(90 - skyParams.elevation)
      const theta = THREE.MathUtils.degToRad(val)
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
      skyU.sunPosition.value.copy(sun)
      if (water.material.uniforms.sunDirection) water.material.uniforms.sunDirection.value.copy(sun).normalize()
    })

    return () => {
      gui.destroy()
      // cleanup
      try { if (bandRef.current) { bandRef.current.geometry.dispose(); bandRef.current.material.map?.dispose(); bandRef.current.material.dispose(); scene.remove(bandRef.current) } } catch {}
      try { if (texRef.current) texRef.current.dispose() } catch {}
      try { scene.remove(water); water.geometry.dispose(); water.material.dispose() } catch {}
      try { scene.remove(sky); sky.geometry.dispose(); sky.material.dispose() } catch {}
    }
  }, [scene, gl, camera])

  useFrame((_, dt) => {
    const w = waterRef.current
    if (w) {
      const u = w.material.uniforms
      if (u.time) u.time.value += dt * 0.2
      const tex = u.normalSampler?.value
      if (tex && tex.offset) { tex.offset.x += dt * 0.01; tex.offset.y += dt * 0.006 }
    }
  })

  return <Stats />
}
