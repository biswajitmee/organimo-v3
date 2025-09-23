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
  const ringsRef = useRef([])
  const skyMeshRef = useRef(null)
  const createdGuiHereRef = useRef(false)

  useEffect(() => {
    // camera + renderer settings
    camera.far = 6000
    camera.updateProjectionMatrix()
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 0.18
    try {
      if (gl.outputColorSpace !== undefined) gl.outputColorSpace = THREE.SRGBColorSpace
      else if (gl.outputEncoding !== undefined) gl.outputEncoding = THREE.sRGBEncoding
    } catch (e) {}
  }, [camera, gl])

  useEffect(() => {
    // ---------------------------
    // WATER (plane)
    // ---------------------------
    const waterGeo = new THREE.PlaneGeometry(200000, 200000)
    const water = new Water(waterGeo, {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: new THREE.TextureLoader().load(
        'https://threejs.org/examples/textures/waternormals.jpg',
        tx => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2,2) }
      ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: new THREE.Color('#9a8ca9'),
      distortionScale: 0.22,
      fog: true
    })

    // Ensure material supports transparency & won't write depth (so alpha blending works)
    water.material.transparent = true
    water.material.depthWrite = false

    // Add to scene
    water.rotation.x = -Math.PI / 2
    water.position.y = 0
    scene.add(water)
    waterRef.current = water

    // Inject fade shader into water's shader using onBeforeCompile
    // We add uniforms: uCamPos, uFadeStart, uFadeEnd, uFadeCurve
    // And multiply the final gl_FragColor.a by the fade factor.
    water.material.onBeforeCompile = (shader) => {
      shader.uniforms.uCamPos = { value: camera.position.clone() }
      shader.uniforms.uFadeStart = { value: 5800.0 }
      shader.uniforms.uFadeEnd = { value: 6000.0 }
      // optional curve exponent (1.0 = linear, >1 sharper)
      shader.uniforms.uFadePow = { value: 1.0 }

      // expose varying for world position
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;`
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;
         uniform vec3 uCamPos;
         uniform float uFadeStart;
         uniform float uFadeEnd;
         uniform float uFadePow;`
      )

      // Insert fade before the dithering step so we update final alpha
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `{
           float dist = distance(uCamPos, vWorldPosition);
           float t = clamp((dist - uFadeStart) / max(0.0001, (uFadeEnd - uFadeStart)), 0.0, 1.0);
           // apply a power curve so you can control softness
           float fade = 1.0 - pow(t, max(0.0001, uFadePow));
           // multiply output alpha (many water shaders already write alpha = 1)
           gl_FragColor.a *= fade;
           // optional discard to avoid drawing tiny fragments
           if (gl_FragColor.a < 0.01) discard;
         }
         #include <dithering_fragment>`
      )

      // keep reference so we can update uniforms later
      water.material.userData.shader = shader
    }

    // ---------------------------
    // SKY
    // ---------------------------
    const skyParams = {
      radius: 5000,
      height: 30000,
      topColor: '#d6d6f5',
      horizonColor: '#f2c8d6'
    }

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

    // ---------------------------
    // HORIZON BAND (lathe) + RINGS
    // ---------------------------
    const params = {
      // band
      bandRadius: 6000,
      bandHeight: 1200,
      bandOpacity: 0.82,
      bandBottom: '#d96868',
      bandPink: '#d96868',
      bandBottomPct: 0.05,
      bandBlendPct: 0.05,
      bandFadePct: 0.20,
      // ring glow
      ringEnabled: true,
      ringRadius: 5000,
      ringY: 0.1,
      ringCoreHeight: 80,
      glowColor: '#d96868',
      intensity: 1.0,
      softness: 0.6,
      ringFadeWidth: 300,
      layers: 4,
      layerSpread: 1.12,
      baseAlpha: 0.55,
      outerAlphaFalloff: 0.12,
      // water fade controls (exposed in GUI)
      fadeStart: 5000,
      fadeEnd: 6000,
      fadeCurve: 1.0
    }

    function makeVerticalEdgeTexture({
      canvasHeight = 2048,
      colorBottom = '#ffffff',
      colorPink = '#EAD0DB',
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
      if (fp > 0) grd.addColorStop(posFadeStart, `rgba(${Math.round(new THREE.Color(colorPink).r*255)},${Math.round(new THREE.Color(colorPink).g*255)},${Math.round(new THREE.Color(colorPink).b*255)},0)`)
      else grd.addColorStop(posFadeStart, colorPink)
      grd.addColorStop(posBlendStart, colorPink)
      grd.addColorStop(posBottomStart, colorPink)
      grd.addColorStop(1.0 - 0.0001, colorBottom)
      grd.addColorStop(1.0, colorBottom)

      g.fillStyle = grd
      g.fillRect(0, 0, 1, canvasHeight)

      if (bp > 0) {
        const bottomHeight = canvasHeight * bp
        const solidY = canvasHeight - bottomHeight
        g.fillStyle = colorBottom
        g.fillRect(0, solidY, 1, bottomHeight)
      }

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
      const pts = [ new THREE.Vector2(params.bandRadius, 0), new THREE.Vector2(params.bandRadius, params.bandHeight) ]
      const latheGeo = new THREE.LatheGeometry(pts, 256)
      const tex = makeVerticalEdgeTexture({
        canvasHeight: 2048,
        colorBottom: params.bandBottom,
        colorPink: params.bandPink,
        bottomPercent: params.bandBottomPct,
        blendPercent: params.bandBlendPct,
        fadePercent: params.bandFadePct
      })
      if (texRef.current && texRef.current.dispose) try { texRef.current.dispose() } catch (e) {}
      texRef.current = tex
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: params.bandOpacity,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.NormalBlending
      })
      const mesh = new THREE.Mesh(latheGeo, mat)
      mesh.position.y = 0.1
      scene.add(mesh)
      bandRef.current = mesh
    }

    // RING SHADERS & BUILD
    const ringVert = `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `
    const ringFrag = `
      uniform float uHeight;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uAlphaMul;
      uniform float uSoftness;
      varying vec3 vPos;

      void main() {
        float t = (vPos.y + uHeight * 0.5) / uHeight;
        float vFall = 1.0 - smoothstep(0.0, 1.0, t);
        float d = length(vPos.xz);
        float radial = 1.0 - smoothstep(uInner, uOuter, d);
        float softnessFactor = mix(1.0, 0.6, uSoftness);
        float glow = uIntensity * vFall * radial * softnessFactor;
        if (glow < 0.001) discard;
        vec3 col = uColor * glow;
        float alpha = clamp(glow * uAlphaMul, 0.0, 0.95);
        gl_FragColor = vec4(col, alpha);
      }
    `
    function buildRings() {
      if (ringsRef.current && ringsRef.current.length) {
        ringsRef.current.forEach(m => {
          try { scene.remove(m) } catch (e) {}
          try { m.geometry.dispose(); m.material.dispose() } catch (err) {}
        })
      }
      ringsRef.current = []

      if (!params.ringEnabled) return

      for (let i = 0; i < Math.max(1, Math.floor(params.layers)); i++) {
        const layerScale = Math.pow(params.layerSpread, i)
        const outerR = params.ringRadius * layerScale
        const innerR = Math.max(0, params.ringRadius - params.ringFadeWidth * (0.6 + i * 0.12))
        const cyl = new THREE.CylinderGeometry(outerR, outerR, params.ringCoreHeight, 128, 1, true)

        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uHeight: { value: params.ringCoreHeight },
            uInner: { value: innerR },
            uOuter: { value: outerR },
            uColor: { value: new THREE.Color(normalizeColor(params.glowColor)) },
            uIntensity: { value: params.intensity * Math.max(0.25, 1.0 - i * 0.18) },
            uAlphaMul: { value: params.baseAlpha * Math.max(params.outerAlphaFalloff, 1.0 - i * 0.18) },
            uSoftness: { value: params.softness }
          },
          vertexShader: ringVert,
          fragmentShader: ringFrag,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          side: THREE.DoubleSide,
          blending: THREE.NormalBlending
        })

        const mesh = new THREE.Mesh(cyl, mat)
        mesh.position.y = params.ringY
        mesh.frustumCulled = false
        mesh.renderOrder = 5000 + i
        scene.add(mesh)
        ringsRef.current.push(mesh)
      }
    }

    // initial builds
    buildBand()
    buildRings()

    // ---------------------------
    // GUI: robust handling so it's not removed by other components
    // ---------------------------
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

    // style GUI root so clickable
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

    // Sky folder
    const skyFolder = gui.addFolder('Sky (shader cylinder)')
    skyFolder.addColor(skyParams, 'topColor').name('Top Color').onChange(v => {
      try { skyMeshRef.current.material.uniforms.uTop.value.set(new THREE.Color(normalizeColor(v))) } catch (e) {}
    })
    skyFolder.addColor(skyParams, 'horizonColor').name('Horizon Color').onChange(v => {
      try { skyMeshRef.current.material.uniforms.uHorizon.value.set(new THREE.Color(normalizeColor(v))) } catch (e) {}
    })
    skyFolder.add(skyParams, 'height', 5000, 60000, 100).name('Height').onChange(v => {
      try { scene.remove(skyMeshRef.current); skyMeshRef.current.geometry.dispose(); skyMeshRef.current.material.dispose(); skyMeshRef.current = null } catch (e) {}
      skyParams.height = v
      buildSky()
    })
    skyFolder.open()

    // Band folder
    const bandFolder = gui.addFolder('Horizon Band (Lathe)')
    bandFolder.add(params, 'bandRadius', 1000, 9000, 100).name('Radius').onChange(() => { buildBand(); buildRings() })
    bandFolder.add(params, 'bandHeight', 200, 4000, 10).name('Height').onChange(buildBand)
    bandFolder.add(params, 'bandOpacity', 0, 1, 0.01).name('Opacity').onChange(v => { if (bandRef.current) bandRef.current.material.opacity = v })
    bandFolder.addColor(params, 'bandBottom').name('Bottom Color').onChange(v => { params.bandBottom = v; buildBand() })
    bandFolder.addColor(params, 'bandPink').name('Pink Color').onChange(v => { params.bandPink = v; buildBand() })
    bandFolder.add(params, 'bandBottomPct', 0.0, 0.2, 0.005).name('Bottom %').onChange(buildBand)
    bandFolder.add(params, 'bandBlendPct', 0.0, 0.2, 0.005).name('Blend %').onChange(buildBand)
    bandFolder.add(params, 'bandFadePct', 0.0, 0.5, 0.01).name('Fade %').onChange(buildBand)
    bandFolder.open()

    // Ring folder
    const ringFolder = gui.addFolder('Glow Ring (no postprocess)')
    ringFolder.add(params, 'ringEnabled').name('enabled').onChange(v => { params.ringEnabled = v; buildRings() })
    ringFolder.add(params, 'ringRadius', 1000, 9000, 50).name('ringRadius').onChange(v => { params.ringRadius = v; buildRings() })
    ringFolder.add(params, 'ringY', -200, 800, 1).name('ringY').onChange(v => { params.ringY = v; ringsRef.current.forEach(m => m.position.y = v) })
    ringFolder.add(params, 'ringCoreHeight', 10, 800, 1).name('coreHeight').onChange(v => { params.ringCoreHeight = v; buildRings() })
    ringFolder.addColor(params, 'glowColor').name('glowColor').onChange(v => {
      params.glowColor = v
      ringsRef.current.forEach((m) => {
        try { m.material.uniforms.uColor.value.set(new THREE.Color(normalizeColor(v))); m.material.needsUpdate = true } catch (e) {}
      })
    })
    ringFolder.add(params, 'intensity', 0.1, 2.0, 0.01).name('intensity').onChange(v => { params.intensity = v; ringsRef.current.forEach((m, i) => { try { m.material.uniforms.uIntensity.value = v * Math.max(0.25, 1.0 - i * 0.18) } catch (e) {} }) })
    ringFolder.add(params, 'softness', 0, 1, 0.01).name('softness').onChange(v => { params.softness = v; ringsRef.current.forEach(m => { try { m.material.uniforms.uSoftness.value = v } catch (e) {} }) })
    ringFolder.add(params, 'ringFadeWidth', 10, 2000, 10).name('fadeWidth').onChange(v => { params.ringFadeWidth = v; buildRings() })
    ringFolder.add(params, 'layers', 1, 6, 1).name('layers').onChange(v => { params.layers = v; buildRings() })
    ringFolder.add(params, 'layerSpread', 1.0, 1.5, 0.01).name('layerSpread').onChange(v => { params.layerSpread = v; buildRings() })
    ringFolder.add(params, 'baseAlpha', 0.0, 1.0, 0.01).name('baseAlpha').onChange(v => { params.baseAlpha = v; ringsRef.current.forEach((m, i) => { try { m.material.uniforms.uAlphaMul.value = v * Math.max(params.outerAlphaFalloff, 1.0 - i * 0.18) } catch (e) {} }) })
    ringFolder.open()

    // Water fade folder (exposes uniforms for interactive tuning)
    const fadeFolder = gui.addFolder('Water Fade')
    fadeFolder.add(params, 'fadeStart', 1000, 5900, 50).name('Fade Start').onChange(v => {
      params.fadeStart = v
      try { if (waterRef.current?.material?.userData?.shader) waterRef.current.material.userData.shader.uniforms.uFadeStart.value = v } catch (e) {}
    })
    fadeFolder.add(params, 'fadeEnd', 2000, 6000, 50).name('Fade End').onChange(v => {
      params.fadeEnd = v
      try { if (waterRef.current?.material?.userData?.shader) waterRef.current.material.userData.shader.uniforms.uFadeEnd.value = v } catch (e) {}
    })
    fadeFolder.add(params, 'fadeCurve', 0.1, 4.0, 0.01).name('Fade Curve').onChange(v => {
      params.fadeCurve = v
      try { if (waterRef.current?.material?.userData?.shader) waterRef.current.material.userData.shader.uniforms.uFadePow.value = v } catch (e) {}
    })
    fadeFolder.open()

    // ---- finished building UI ----

    // cleanup function
    return () => {
      // destroy GUI only if we created it (protects other components)
      try {
        if (createdHere) {
          try { gui.destroy() } catch (e) {}
          if (typeof window !== 'undefined') delete window.__THREE_WATER_GUI
        }
      } catch (e) {}
      // dispose band
      try { if (bandRef.current) { scene.remove(bandRef.current); bandRef.current.geometry.dispose(); bandRef.current.material.map?.dispose(); bandRef.current.material.dispose() } } catch (e) {}
      // dispose rings
      try { ringsRef.current.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose() }) } catch (e) {}
      // dispose sky
      try { if (skyMeshRef.current) { scene.remove(skyMeshRef.current); skyMeshRef.current.geometry.dispose(); skyMeshRef.current.material.dispose() } } catch (e) {}
      // dispose water
      try { if (waterRef.current) { scene.remove(waterRef.current); waterRef.current.geometry.dispose(); waterRef.current.material.dispose() } } catch (e) {}
      // dispose textures
      try { if (texRef.current?.dispose) texRef.current.dispose() } catch (e) {}
    }
  }, [scene, gl, camera])

  // update per-frame: water time and camera uniform for fade
  useFrame((_, dt) => {
    const w = waterRef.current
    if (w) {
      const u = w.material.uniforms
      if (u && u.time) u.time.value += dt * 0.18
      const ns = u.normalSampler?.value
      if (ns && ns.offset) { ns.offset.x += dt * 0.01; ns.offset.y += dt * 0.006 }
      // update injected shader uniform for camera
      try {
        const sh = w.material.userData.shader
        if (sh && sh.uniforms && sh.uniforms.uCamPos) {
          sh.uniforms.uCamPos.value.copy(camera.position)
        }
      } catch (e) {}
    }
  })

  return <Stats />
}
