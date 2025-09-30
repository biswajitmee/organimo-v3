// WaterScene.jsx
import * as THREE from 'three'
import React, { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'

function normalizeColor(hex) {
  if (!hex) return '#ffffff'
  const s = String(hex)
  return s[0] === '#' ? s : '#' + s
}

export default function WaterScene() {
  const { scene, gl, camera } = useThree()
  const waterRef = useRef(null)
  const bandRef = useRef(null)
  const texRef = useRef(null)
  const skyMeshRef = useRef(null)
  const ringRef = useRef(null)
  const guiRef = useRef(null)
  const createdGuiHereRef = useRef(false)

  useEffect(() => {
    camera.far = 10000
    camera.updateProjectionMatrix()
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 0.18
    try {
      if (gl.outputColorSpace !== undefined) gl.outputColorSpace = THREE.SRGBColorSpace
      else if (gl.outputEncoding !== undefined) gl.outputEncoding = THREE.sRGBEncoding
    } catch (e) {}
  }, [camera, gl])

  useEffect(() => {
    // ------------------------------------------------
    // create water (same as you had)
    // ------------------------------------------------
    const waterGeo = new THREE.PlaneGeometry(200000, 200000)
    const water = new Water(waterGeo, {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: new THREE.TextureLoader().load(
        // short data url used previously
        'https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcSrOm95mNPnfnlrjDw0hRwSP0dNjFrxoZVN4EXdoO3ECRkiqaM2',
        tx => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 2) }
      ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: new THREE.Color('#0e0e50'),
      distortionScale: 0.22,
      fog: true
    })
    water.material.transparent = true
    water.material.depthWrite = false
    water.rotation.x = -Math.PI / 2
    scene.add(water)
    waterRef.current = water

    // ------------------------------------------------
    // sky + band + ring defaults (same as previous)
    // ------------------------------------------------
    const skyParams = {
      enabled: true,
      radius: 8100,
      height: 30000,
      topColor: '#e8e8fd',
      horizonColor: '#f2c8d6'
    }

    const params = {
      bandEnabled: true,
      bandRadius: 5300,
      bandHeight: 910,
      bandOpacity: 0.92,
      bandTop: '#ffffff',
      bandBottom: '#d96868',
      bandBottomPct: 0.03,
      bandBlendPct: 0.06,
      bandFadePct: 0.17,
      bandOverlayOpacity: 0.65,
      bandOverlayScale: 1.0,
      bandOverlayYOffset: 0.15,

      // ring
      ringEnabled: true,
      ringInner: 2380,
      ringOuter: 6760,
      ringY: 373,
      ringColor: '#ff6688',
      ringIntensity: 1.0
    }

    // ------------------------------------------------
    // helper: buildSky, buildBand, buildRing (same as before)
    // ------------------------------------------------
    const skyVert = `
      varying vec3 vPos;
      void main(){
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `
    const skyFrag = `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform float uHeight;
      varying vec3 vPos;
      void main() {
        float t = (vPos.y + (uHeight * 0.5)) / uHeight;
        float f = smoothstep(0.0, 1.0, t);
        vec3 col = mix(uHorizon, uTop, f);
        gl_FragColor = vec4(col, 1.0);
      }
    `
    function buildSky() {
      if (skyMeshRef.current) {
        try { scene.remove(skyMeshRef.current) } catch (e) {}
        try { skyMeshRef.current.geometry.dispose(); skyMeshRef.current.material.dispose() } catch (e) {}
        skyMeshRef.current = null
      }
      if (!skyParams.enabled) return
      const cyl = new THREE.CylinderGeometry(skyParams.radius, skyParams.radius, skyParams.height, 32, 1, true)
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color(normalizeColor(skyParams.topColor)) },
          uHorizon: { value: new THREE.Color(normalizeColor(skyParams.horizonColor)) },
          uHeight: { value: skyParams.height }
        },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false
      })
      const mesh = new THREE.Mesh(cyl, mat)
      mesh.position.y = 0
      scene.add(mesh)
      skyMeshRef.current = mesh
    }
    buildSky()

    function makeVerticalEdgeTexture({
      canvasHeight = 2048,
      colorTop = '#ffffff',
      colorBottom = '#EAD0DB',
      bottomPercent = 0.05,
      blendPercent = 0.05,
      fadePercent = 0.20
    } = {}) {
      const c = document.createElement('canvas')
      c.width = 1
      c.height = canvasHeight
      const g = c.getContext('2d')

      const bp = Math.max(0, Math.min(1, bottomPercent))
      const blp = Math.max(0, Math.min(1, blendPercent))
      const fp = Math.max(0, Math.min(1, fadePercent))
      const endBottom = bp
      const endBlend = bp + blp
      const endFade = bp + blp + fp

      const posFadeStart = Math.max(0, 1 - endFade)
      const posBlendStart = Math.max(0, 1 - endBlend)
      const posBottomStart = Math.max(0, 1 - endBottom)

      const grd = g.createLinearGradient(0, 0, 0, canvasHeight)
      grd.addColorStop(0.0, 'rgba(255,255,255,0)')
      grd.addColorStop(posFadeStart, colorTop)
      grd.addColorStop(posBlendStart, colorTop)
      grd.addColorStop(posBottomStart, colorBottom)
      grd.addColorStop(1.0, colorBottom)

      g.fillStyle = grd
      g.fillRect(0, 0, 1, canvasHeight)

      const tex = new THREE.CanvasTexture(c)
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(256, 1)
      try { tex.colorSpace = THREE.SRGBColorSpace } catch (e) { tex.encoding = THREE.sRGBEncoding }
      tex.needsUpdate = true
      return tex
    }

    function buildBand() {
      if (bandRef.current) {
        try { scene.remove(bandRef.current) } catch (e) {}
        try { bandRef.current.geometry.dispose(); bandRef.current.material.map?.dispose(); bandRef.current.material.dispose() } catch (e) {}
        bandRef.current = null
      }
      if (bandRef._overlay) {
        try { scene.remove(bandRef._overlay) } catch (e) {}
        try { bandRef._overlay.geometry.dispose(); bandRef._overlay.material.map?.dispose(); bandRef._overlay.material.dispose() } catch (e) {}
        bandRef._overlay = null
      }
      if (!params.bandEnabled) return

      const pts = [ new THREE.Vector2(params.bandRadius, 0), new THREE.Vector2(params.bandRadius, params.bandHeight) ]
      const latheGeo = new THREE.LatheGeometry(pts, 256)
      const tex = makeVerticalEdgeTexture({
        canvasHeight: 2048,
        colorTop: params.bandTop,
        colorBottom: params.bandBottom,
        bottomPercent: params.bandBottomPct,
        blendPercent: params.bandBlendPct,
        fadePercent: params.bandFadePct
      })
      texRef.current = tex

      const latheMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: params.bandOpacity,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        blending: THREE.NormalBlending
      })
      const latheMesh = new THREE.Mesh(latheGeo, latheMat)
      latheMesh.position.y = 0.1
      latheMesh.renderOrder = 8000
      scene.add(latheMesh)
      bandRef.current = latheMesh

      const overlaySize = Math.max(20000, params.bandRadius * 4)
      const overlayGeo = new THREE.PlaneGeometry(overlaySize, overlaySize, 1, 1)
      const overlayMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: params.bandOverlayOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        blending: THREE.NormalBlending
      })
      const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat)
      overlayMesh.rotation.x = -Math.PI / 2
      overlayMesh.position.y = params.bandOverlayYOffset
      overlayMesh.renderOrder = 9000
      overlayMesh.frustumCulled = false
      scene.add(overlayMesh)
      bandRef._overlay = overlayMesh
    }
    buildBand()

    function buildRing() {
      if (ringRef.current) {
        try { scene.remove(ringRef.current) } catch (e) {}
        try { ringRef.current.geometry.dispose(); ringRef.current.material.dispose() } catch (e) {}
        ringRef.current = null
      }
      if (!params.ringEnabled) return
      const inner = Math.max(0.001, params.ringInner)
      const outer = Math.max(inner + 1.0, params.ringOuter)
      const ringGeo = new THREE.RingGeometry(inner, outer, 256)
      ringGeo.rotateX(-Math.PI / 2)
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(normalizeColor(params.ringColor)),
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
        opacity: Math.min(1.0, Math.max(0.0, params.ringIntensity))
      })
      const ring = new THREE.Mesh(ringGeo, mat)
      ring.position.y = params.ringY
      ring.renderOrder = 10000
      ring.frustumCulled = false
      scene.add(ring)
      ringRef.current = ring
    }
    buildRing()

    // ------------------------------------------------
    // GUI — SAFE binding (use local waveParams for distortion)
    // ------------------------------------------------
    let gui, createdHere = false
    if (typeof window !== 'undefined' && window.__THREE_WATER_GUI) {
      gui = window.__THREE_WATER_GUI
      createdHere = false
    } else {
      gui = new GUI({ width: 340 })
      createdHere = true
      if (typeof window !== 'undefined') window.__THREE_WATER_GUI = gui
    }
    createdGuiHereRef.current = createdHere
    guiRef.current = gui

    setTimeout(() => {
      try {
        const root = document.querySelector('.lil-gui') || gui.domElement
        if (root && root.style) {
          root.style.position = 'fixed'
          root.style.top = '18px'
          root.style.right = '18px'
          root.style.zIndex = '999999'
          root.style.pointerEvents = 'auto'
          root.style.maxHeight = '96vh'
          root.style.overflow = 'auto'
        }
      } catch (e) {}
    }, 20)

    // top toggles
    const toggles = {
      Sky: skyParams.enabled,
      Band: params.bandEnabled,
      Ring: params.ringEnabled
    }
    const toggleFolder = gui.addFolder('Enable / Disable')
    toggleFolder.add(toggles, 'Sky').name('Sky Enabled').onChange(v => {
      skyParams.enabled = v
      buildSky()
    })
    toggleFolder.add(toggles, 'Band').name('Horizon Band').onChange(v => {
      params.bandEnabled = v
      buildBand()
    })
    toggleFolder.add(toggles, 'Ring').name('Glow Ring').onChange(v => {
      params.ringEnabled = v
      buildRing()
    })
    toggleFolder.open()

    // sky folder
    const skyFolder = gui.addFolder('Sky (shader cylinder)')
    skyFolder.add(skyParams, 'radius', 2000, 30000, 100).name('Radius').onChange(v => { skyParams.radius = v; buildSky() })
    skyFolder.add(skyParams, 'height', 5000, 60000, 100).name('Height').onChange(v => { skyParams.height = v; buildSky() })
    skyFolder.addColor(skyParams, 'topColor').name('Top Color').onChange(v => {
      try { skyMeshRef.current.material.uniforms.uTop.value.set(new THREE.Color(normalizeColor(v))) } catch (e) {}
    })
    skyFolder.addColor(skyParams, 'horizonColor').name('Horizon Color').onChange(v => {
      try { skyMeshRef.current.material.uniforms.uHorizon.value.set(new THREE.Color(normalizeColor(v))) } catch (e) {}
    })
    skyFolder.open()

    // band folder
    const bandFolder = gui.addFolder('Horizon Band (Lathe)')
    bandFolder.add(params, 'bandRadius', 1000, 9000, 100).name('Radius').onChange(() => { buildBand(); buildRing() })
    bandFolder.add(params, 'bandHeight', 200, 4000, 10).name('Height').onChange(buildBand)
    bandFolder.add(params, 'bandOpacity', 0, 1, 0.01).name('Opacity').onChange(v => { if (bandRef.current) bandRef.current.material.opacity = v })
    bandFolder.addColor(params, 'bandTop').name('Top Color').onChange(v => { params.bandTop = v; buildBand() })
    bandFolder.addColor(params, 'bandBottom').name('Bottom Color').onChange(v => { params.bandBottom = v; buildBand() })
    bandFolder.add(params, 'bandBottomPct', 0.0, 0.2, 0.005).name('Bottom %').onChange(buildBand)
    bandFolder.add(params, 'bandBlendPct', 0.0, 0.2, 0.005).name('Blend %').onChange(buildBand)
    bandFolder.add(params, 'bandFadePct', 0.0, 0.5, 0.01).name('Fade %').onChange(buildBand)
    bandFolder.add(params, 'bandOverlayOpacity', 0.0, 1.0, 0.01).name('Overlay Opacity').onChange(v => { if (bandRef._overlay) bandRef._overlay.material.opacity = v })
    bandFolder.add(params, 'bandOverlayYOffset', -2, 2, 0.01).name('Overlay Y Off').onChange(v => { if (bandRef._overlay) bandRef._overlay.position.y = v })
    bandFolder.add(params, 'bandOverlayScale', 0.1, 4, 0.01).name('Overlay Scale').onChange(v => {
      if (bandRef._overlay) {
        const s = Math.max(0.001, v)
        bandRef._overlay.scale.set(s, s, 1)
      }
    })
    bandFolder.open()

    // ring folder
    const ringFolder = gui.addFolder('Glow Ring (basic)')
    ringFolder.add(params, 'ringEnabled').name('Enabled').onChange(v => { params.ringEnabled = v; buildRing() })
    ringFolder.add(params, 'ringInner', 10, 9000, 1).name('innerRadius').onChange(v => { params.ringInner = v; buildRing() })
    ringFolder.add(params, 'ringOuter', 10, 9000, 1).name('outerRadius').onChange(v => { params.ringOuter = v; buildRing() })
    ringFolder.add(params, 'ringY', -200, 2000, 1).name('ringY').onChange(v => { params.ringY = v; if (ringRef.current) ringRef.current.position.y = v })
    ringFolder.addColor(params, 'ringColor').name('glowColor').onChange(v => {
      params.ringColor = v
      try { if (ringRef.current) ringRef.current.material.color.set(new THREE.Color(normalizeColor(v))) } catch (e) {}
    })
    ringFolder.add(params, 'ringIntensity', 0, 2, 0.01).name('intensity').onChange(v => { if (ringRef.current) ringRef.current.material.opacity = v })
    ringFolder.open()

    // ------------------------------------------------
    // IMPORTANT: safe waveParams for water controls (avoid binding GUI to possibly-missing shader props)
    // ------------------------------------------------
    const waveParams = {
      distortionScale: 0.22,
      normalSpeedX: 0.01,
      normalSpeedY: 0.006
    }

    // set initial from material if present
    try {
      const mat = waterRef.current?.material
      if (mat && typeof mat.distortionScale === 'number') waveParams.distortionScale = mat.distortionScale
    } catch (e) {}

    const waterFolder = gui.addFolder('Water (safe controls)')
    // bind to waveParams (guaranteed to exist), then apply to material in onChange
    waterFolder.add(waveParams, 'distortionScale', 0.0, 3.0, 0.01).name('Distortion').onChange(v => {
      waveParams.distortionScale = v
      try { if (waterRef.current && typeof waterRef.current.material !== 'undefined') waterRef.current.material.distortionScale = v } catch (e) {}
    })
    waterFolder.open()

    // ensure initial shader uniform sync
    setTimeout(() => {
      try {
        const sh = waterRef.current?.material?.userData?.shader
        if (sh && sh.uniforms) {
          if (sh.uniforms.uCamPos) sh.uniforms.uCamPos.value.copy(camera.position)
        }
      } catch (e) {}
    }, 50)

    // cleanup
    return () => {
      try {
        if (createdHere) {
          try { gui.destroy() } catch (e) {}
          if (typeof window !== 'undefined') delete window.__THREE_WATER_GUI
        }
      } catch (e) {}
      try { if (bandRef.current) { scene.remove(bandRef.current); bandRef.current.geometry.dispose(); bandRef.current.material.map?.dispose(); bandRef.current.material.dispose() } } catch (e) {}
      try { if (bandRef._overlay) { scene.remove(bandRef._overlay); bandRef._overlay.geometry.dispose(); bandRef._overlay.material.map?.dispose(); bandRef._overlay.material.dispose() } } catch (e) {}
      try { if (skyMeshRef.current) { scene.remove(skyMeshRef.current); skyMeshRef.current.geometry.dispose(); skyMeshRef.current.material.dispose() } } catch (e) {}
      try { if (waterRef.current) { scene.remove(waterRef.current); waterRef.current.geometry.dispose(); waterRef.current.material.dispose() } } catch (e) {}
      try { if (ringRef.current) { scene.remove(ringRef.current); ringRef.current.geometry.dispose(); ringRef.current.material.dispose() } } catch (e) {}
    }
  }, [scene, gl, camera])

  // per-frame updates
  useFrame((_, dt) => {
    const w = waterRef.current
    if (w) {
      const u = w.material.uniforms
      if (u && u.time) u.time.value += dt
    }
  })

  return <Stats />
}
