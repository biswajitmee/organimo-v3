// WaterScene.jsx
import * as THREE from 'three'
import React, { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'

// postprocessing (three.js examples - old style)
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

function normalizeColor(hex) {
  if (!hex) return '#ffffff'
  const s = String(hex)
  return s[0] === '#' ? s : '#' + s
}

function setUniform(obj, key, val) {
  if (!obj || !obj.material || !obj.material.uniforms) return
  const u = obj.material.uniforms[key]
  if (!u) return
  if (u.value?.set && (typeof val === 'number' || typeof val === 'string')) u.value.set(val)
  else u.value = val
}

export default function WaterScene() {
  const { scene, gl, camera, size } = useThree()
  const waterRef = useRef(null)
  const bandRef = useRef(null)
  const glowRef = useRef(null)
  const composerRef = useRef(null)
  const bloomPassRef = useRef(null)
  const guiRef = useRef(null)

  useEffect(() => {
    // renderer/camera basics
    camera.far = 6000
    camera.updateProjectionMatrix()
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 0.18
    gl.outputColorSpace = THREE.SRGBColorSpace

    // --- Sky
    const sky = new Sky()
    sky.scale.setScalar(45000)
    scene.add(sky)
    const skyU = sky.material.uniforms
    skyU.turbidity.value = 6
    skyU.rayleigh.value = 2
    skyU.mieCoefficient.value = 0.005
    skyU.mieDirectionalG.value = 0.7

    // --- Water
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
    water.rotation.x = -Math.PI / 2
    water.position.y = 0
    scene.add(water)
    waterRef.current = water

    // --- params (GUI defaults)
    const params = {
      enabled: true,
      radius: 5500,
      bandHeight: 260,
      bandYOffset: 0.1,
      bandY: 0.1,
      overlayOpacity: 0.85,
      overlayOnTop: false,
      // colors/stops
      skyColor: '#C7B1D0',
      pinkColor: '#EAD0DB',
      bottomWhite: '#FFFFFF',
      // glow
      glowColor: '#ffb6d3',
      glowIntensity: 1.6,
      glowSoftness: 0.6,   // 0..1 (higher = softer radial)
      glowScale: 1.03,
      // bloom
      bloomStrength: 0.9,
      bloomRadius: 0.6,
      bloomThreshold: 0.15,
      radialSegments: 256
    }

    // safe dispose helper
    function safeDisposeMesh(mesh) {
      if (!mesh) return
      try { if (mesh.parent) scene.remove(mesh) } catch(e) {}
      try { mesh.geometry?.dispose() } catch(e) {}
      try {
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose && m.dispose())
          else {
            mesh.material.map?.dispose && mesh.material.map.dispose()
            mesh.material.dispose && mesh.material.dispose()
          }
        }
      } catch(e) {}
    }

    // build band + glow
    function buildBand() {
      safeDisposeMesh(bandRef.current)
      safeDisposeMesh(glowRef.current)
      bandRef.current = null
      glowRef.current = null

      const r = params.radius
      const h = params.bandHeight
      const segs = Math.max(24, Math.floor(params.radialSegments))

      // Gradient band (subtle visible band)
      const bandGeo = new THREE.CylinderGeometry(r, r, h, segs, 1, true)
      const bandMat = new THREE.ShaderMaterial({
         uniforms: {
    uHeight: { value: h * 1.05 },
    uRadius: { value: r * params.glowScale },
    uGlowColor: { value: new THREE.Color(normalizeColor(params.glowColor)) },
    uBaseColor: { value: new THREE.Color('#8aa9ff') }, // soft blue base
    uIntensity: { value: params.glowIntensity },
    uSoftness: { value: params.glowSoftness }
  },
        vertexShader: `
          varying float vY;
          void main() {
            vY = position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uHeight;
          uniform vec3 uColorTop;
          uniform vec3 uColorBottom;
          uniform float uOpacity;
          varying float vY;
          void main() {
            float t = (vY + uHeight * 0.5) / uHeight;
            float blend = smoothstep(0.0, 0.95, t);
            vec3 col = mix(uColorBottom, uColorTop, blend);
            float alpha = mix(uOpacity, 0.0, clamp((t - 0.35) * 2.0, 0.0, 1.0));
            if (alpha < 0.0005) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: true
      })
      const band = new THREE.Mesh(bandGeo, bandMat)
      band.position.y = params.bandY + params.bandYOffset
      band.renderOrder = params.overlayOnTop ? 9999 : 2000
      // make sure it's on default layer so Water reflection camera sees it
      band.layers.set(0)
      scene.add(band)
      bandRef.current = band

      // Glow mesh (additive, bottom-driven, feathered)
      const glowGeo = new THREE.CylinderGeometry(r * params.glowScale, r * params.glowScale, h * 1.05, Math.max(32, Math.floor(segs/2)), 1, true)
      const glowMat = new THREE.ShaderMaterial({
        uniforms: {
          uHeight: { value: h * 1.05 },
          uRadius: { value: r * params.glowScale },
          uGlowColor: { value: new THREE.Color(normalizeColor(params.glowColor)) },
          uIntensity: { value: params.glowIntensity },
          uSoftness: { value: params.glowSoftness }
        },
        vertexShader: `
          varying vec3 vPos;
          varying float vY;
          void main() {
            vPos = position;
            vY = position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }
        `,
        fragmentShader: `
          uniform float uHeight;
          uniform float uRadius;
          uniform vec3 uGlowColor;
          uniform float uIntensity;
          uniform float uSoftness;
          varying vec3 vPos;
          varying float vY;

          // smooth power curve for nicer falloffs
          float powSmooth(float x, float p) {
            return pow(clamp(x, 0.0, 1.0), p);
          }

          void main() {
            // vertical coordinate normalized 0..1 (bottom..top)
            float t = (vY + uHeight * 0.5) / uHeight;
            // bottom strongest, smooth falloff upward (use slight power)
            float vFall = powSmooth(1.0 - t, 1.2);

            // radial falloff: distance from ideal ring radius
            float distXZ = length(vPos.xz);
            float radialDelta = abs(distXZ - uRadius);

            // radial softness range (in world units). smaller fraction => thinner ring.
            float radialRange = max(0.5, uRadius * (0.008 + (1.0 - uSoftness) * 0.05));

            float radialFall = 1.0 - smoothstep(0.0, radialRange, radialDelta);

            // combine vertical and radial
            float intensity = uIntensity * vFall * radialFall;

            // clamp/shape for nicer bloom pickup
            float a = clamp(intensity, 0.0, 1.0);

            if (a < 0.0008) discard;

            // boost rgb for bloom (bloom uses luminance threshold)
            vec3 col = uGlowColor * (0.9 + intensity * 1.6);

            gl_FragColor = vec4(col, a);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: true // include in water reflection pass & tone-mapping
      })
      const glow = new THREE.Mesh(glowGeo, glowMat)
      glow.position.y = band.position.y
      glow.renderOrder = 1999
      glow.layers.set(0)
      scene.add(glow)
      glowRef.current = glow
    }

    // initial create
    buildBand()

    // --- composer (postprocess)
    const composer = new EffectComposer(gl)
    composerRef.current = composer
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), params.bloomStrength, params.bloomRadius, params.bloomThreshold)
    composer.addPass(bloomPass)
    bloomPassRef.current = bloomPass

    // --- GUI
    const gui = new GUI({ width: 360 })
    guiRef.current = gui

    const bandFolder = gui.addFolder('Band (bottom-only)')
    bandFolder.add(params, 'enabled').name('Enable Band').onChange(v => {
      if (bandRef.current) bandRef.current.visible = v
      if (glowRef.current) glowRef.current.visible = v
    })
    bandFolder.add(params, 'radius', 1000, 9000, 100).onChange(val => { params.radius = val; buildBand() })
    bandFolder.add(params, 'bandHeight', 20, 4000, 10).name('height').onChange(val => { params.bandHeight = val; buildBand() })
    bandFolder.add(params, 'bandYOffset', -500, 500, 1).name('yOffset').onChange(v => {
      if (bandRef.current) bandRef.current.position.y = params.bandY + v
      if (glowRef.current) glowRef.current.position.y = params.bandY + v
    })
    bandFolder.add(params, 'bandY', -2000, 5000, 1).name('Band Y-pos').onChange(v => {
      if (bandRef.current) bandRef.current.position.y = v + params.bandYOffset
      if (glowRef.current) glowRef.current.position.y = v + params.bandYOffset
    })
    bandFolder.add(params, 'overlayOpacity', 0, 1, 0.01).onChange(v => {
      if (bandRef.current) setUniform(bandRef.current, 'uOpacity', v)
    })
    bandFolder.add(params, 'overlayOnTop').name('Overlay On Top').onChange(v => {
      if (bandRef.current) bandRef.current.renderOrder = v ? 9999 : 2000
    })

    const colorFolder = gui.addFolder('Band Colors & Glow')
    colorFolder.addColor(params, 'skyColor').name('Sky color').onChange(v => {
      params.skyColor = v
      if (bandRef.current) setUniform(bandRef.current, 'uColorTop', new THREE.Color(normalizeColor(v)))
    })
    colorFolder.addColor(params, 'pinkColor').name('Pink color').onChange(v => {
      params.pinkColor = v
      if (bandRef.current) setUniform(bandRef.current, 'uColorBottom', new THREE.Color(normalizeColor(v)))
    })
    colorFolder.addColor(params, 'glowColor').name('Glow color').onChange(v => {
      params.glowColor = v
      if (glowRef.current) setUniform(glowRef.current, 'uGlowColor', new THREE.Color(normalizeColor(v)))
    })

    const glowFolder = gui.addFolder('Glow (soft)')
    glowFolder.add(params, 'glowIntensity', 0, 4, 0.01).name('intensity').onChange(v => {
      params.glowIntensity = v
      if (glowRef.current) setUniform(glowRef.current, 'uIntensity', v)
    })
    glowFolder.add(params, 'glowSoftness', 0.0, 1.0, 0.01).name('softness').onChange(v => {
      params.glowSoftness = v
      if (glowRef.current) setUniform(glowRef.current, 'uSoftness', v)
    })
    glowFolder.add(params, 'glowScale', 1.0, 1.5, 0.01).name('glow scale').onChange(v => {
      params.glowScale = v
      buildBand()
    })
    glowFolder.add(params, 'radialSegments', 24, 512, 1).name('radial segments').onChange(v => {
      params.radialSegments = v
      buildBand()
    })

    const bloomFolder = gui.addFolder('Bloom (postprocess)')
    bloomFolder.add(params, 'bloomStrength', 0, 3, 0.01).name('strength').onChange(v => {
      params.bloomStrength = v
      if (bloomPassRef.current) bloomPassRef.current.strength = v
    })
    bloomFolder.add(params, 'bloomRadius', 0, 2, 0.01).name('radius').onChange(v => {
      params.bloomRadius = v
      if (bloomPassRef.current) bloomPassRef.current.radius = v
    })
    bloomFolder.add(params, 'bloomThreshold', 0, 1, 0.01).name('threshold').onChange(v => {
      params.bloomThreshold = v
      if (bloomPassRef.current) bloomPassRef.current.threshold = v
    })

    const waterFolder = gui.addFolder('Water')
    const wU = water.material.uniforms
    const wParams = { waterColor: '#9a8ca9', reflectivity: 0.02, distortionScale: 0.22, size: 0.85 }
    waterFolder.addColor(wParams, 'waterColor').name('water color').onChange(v => {
      if (wU && wU.waterColor) wU.waterColor.value.copy(new THREE.Color(normalizeColor(v)))
    })
    waterFolder.add(wParams, 'reflectivity', 0, 0.5, 0.001).onChange(v => { if (wU.reflectivity) wU.reflectivity.value = v })
    waterFolder.add(wParams, 'distortionScale', 0, 1, 0.01).onChange(v => { if (wU.distortionScale) wU.material.uniforms.distortionScale.value = v })
    waterFolder.add(wParams, 'size', 0.1, 2.0, 0.01).onChange(v => { if (wU.size) wU.size.value = v })

    const skyFolder = gui.addFolder('Sky / Sun')
    const skyParams = { turbidity: 6, rayleigh: 2, elevation: 12, azimuth: 180 }
    skyFolder.add(skyParams, 'turbidity', 0, 20).onChange(v => sky.material.uniforms.turbidity.value = v)
    skyFolder.add(skyParams, 'rayleigh', 0, 10).onChange(v => sky.material.uniforms.rayleigh.value = v)
    skyFolder.add(skyParams, 'elevation', 0, 90).onChange(val => {
      const phi = THREE.MathUtils.degToRad(90 - val)
      const theta = THREE.MathUtils.degToRad(skyParams.azimuth)
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
      sky.material.uniforms.sunPosition.value.copy(sun)
      if (water.material.uniforms.sunDirection) water.material.uniforms.sunDirection.value.copy(sun).normalize()
    })
    skyFolder.add(skyParams, 'azimuth', -180, 180).onChange(val => {
      const phi = THREE.MathUtils.degToRad(90 - skyParams.elevation)
      const theta = THREE.MathUtils.degToRad(val)
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
      sky.material.uniforms.sunPosition.value.copy(sun)
      if (water.material.uniforms.sunDirection) water.material.uniforms.sunDirection.value.copy(sun).normalize()
    })

    // open groups
    bandFolder.open()
    colorFolder.open()
    glowFolder.open()
    bloomFolder.open()
    waterFolder.open()
    skyFolder.open()

    // handle resize for composer once
    function onResize() {
      const dpr = window.devicePixelRatio || 1
      composerRef.current.setSize(window.innerWidth * dpr, window.innerHeight * dpr)
      bloomPassRef.current && bloomPassRef.current.setSize && bloomPassRef.current.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // cleanup
    return () => {
      try { gui.destroy() } catch (e) {}
      try { window.removeEventListener('resize', onResize) } catch (e) {}
      try { safeDisposeMesh(bandRef.current) } catch (e) {}
      try { safeDisposeMesh(glowRef.current) } catch (e) {}
      try { composerRef.current?.dispose() } catch (e) {}
      try { scene.remove(water); water.geometry.dispose(); water.material.dispose() } catch (e) {}
      try { scene.remove(sky); sky.geometry?.dispose(); sky.material?.dispose() } catch (e) {}
    }
  }, [scene, gl, camera, size])

  // animate: water time, keep band centered, and composer render
  useFrame((state, dt) => {
    const w = waterRef.current
    if (w) {
      const u = w.material.uniforms
      if (u.time) u.time.value += dt * 0.18
      const ns = u.normalSampler?.value
      if (ns && ns.offset) {
        ns.offset.x += dt * 0.01
        ns.offset.y += dt * 0.006
      }
    }

    // center band/glow around camera xz so horizon stays in view
    const band = bandRef.current
    const glow = glowRef.current
    if (band) {
      band.position.x = camera.position.x
      band.position.z = camera.position.z
    }
    if (glow) {
      glow.position.x = camera.position.x
      glow.position.z = camera.position.z
    }

    // postprocess composer render (run after default render)
    const composer = composerRef.current
    if (composer) {
      // keep composer size in sync with dpr
      const dpr = state.viewport.dpr || window.devicePixelRatio || 1
      composer.setSize(window.innerWidth * dpr, window.innerHeight * dpr)
      composer.render(dt)
    }
  }, 1)

  return <Stats />
}
