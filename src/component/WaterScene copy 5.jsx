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
    // ---------------------------
    // WATER
    // ---------------------------
    const waterGeo = new THREE.PlaneGeometry(200000, 200000)
    const water = new Water(waterGeo, {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: new THREE.TextureLoader().load(
        'data:image/jpeg;base64,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',
        tx => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 2) }
      ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: new THREE.Color('#9a8ca9'),
      distortionScale: 0.22,
      fog: true
    })
    water.material.transparent = true
    water.material.depthWrite = false
    water.rotation.x = -Math.PI / 2
    scene.add(water)
    waterRef.current = water

    // ---------------------------
    // SKY PARAMS (defaults from your GUI screenshot)
    // ---------------------------
    const skyParams = {
      enabled: true,
      radius: 8100,
      height: 30000,
      topColor: '#e8e8fd',
      horizonColor: '#f2c8d6'
    }

    // ---------------------------
    // BAND PARAMS (defaults from your GUI screenshot)
    // ---------------------------
    const params = {
      bandEnabled: true,
      bandRadius: 5300,
      bandHeight: 910,
      bandOpacity: 0.92,
      bandTop: '#131219',
      bandBottom: '#23212f',
      bandBottomPct: 0.03,
      bandBlendPct: 0.06,
      bandFadePct: 0.17,

      // overlay for water override
      bandOverlayOpacity: 0.65,
      bandOverlayScale: 1.0,
      bandOverlayYOffset: 0.15,

      // glow ring (kept but disabled default)
      ringEnabled: false,
      ringRadius: 5000,
      ringY: 0.1,
      ringCoreHeight: 80,
      glowColor: '#d96868',
      intensity: 50,
      softness: 0.6,
      ringFadeWidth: 300,
      layers: 4,
      layerSpread: 1.12,
      baseAlpha: 0.55,
      outerAlphaFalloff: 0.12,
    }

    // ---------------------------
    // SKY MESH
    // ---------------------------
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
        scene.remove(skyMeshRef.current)
        skyMeshRef.current.geometry.dispose()
        skyMeshRef.current.material.dispose()
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

    // ---------------------------
    // BAND TEXTURE + BAND BUILDER WITH OVERLAY
    // ---------------------------
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
        scene.remove(bandRef.current)
        bandRef.current.geometry.dispose()
        bandRef.current.material.map?.dispose()
        bandRef.current.material.dispose()
        bandRef.current = null
      }
      if (bandRef._overlay) {
        scene.remove(bandRef._overlay)
        bandRef._overlay.geometry.dispose()
        bandRef._overlay.material.map?.dispose()
        bandRef._overlay.material.dispose()
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

      // overlay plane
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

    // ---------------------------
    // CLEANUP
    // ---------------------------
    return () => {
      if (bandRef.current) { scene.remove(bandRef.current); bandRef.current.geometry.dispose(); bandRef.current.material.dispose() }
      if (bandRef._overlay) { scene.remove(bandRef._overlay); bandRef._overlay.geometry.dispose(); bandRef._overlay.material.dispose() }
      if (skyMeshRef.current) { scene.remove(skyMeshRef.current); skyMeshRef.current.geometry.dispose(); skyMeshRef.current.material.dispose() }
      if (waterRef.current) { scene.remove(waterRef.current); waterRef.current.geometry.dispose(); waterRef.current.material.dispose() }
    }
  }, [scene, gl, camera])

  // ---------------------------
  // PER FRAME UPDATE
  // ---------------------------
  useFrame((_, dt) => {
    const w = waterRef.current
    if (w) {
      const u = w.material.uniforms
      if (u && u.time) u.time.value += dt
    }
  })

  return <Stats />
}
