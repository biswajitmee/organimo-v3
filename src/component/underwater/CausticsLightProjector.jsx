import * as THREE from 'three'
import React, { useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useVideoTexture } from '@react-three/drei'

/**
 * CausticsLightProjector (fits full plane + small cells)
 *
 * New optional props:
 * - fitRect?: [width, height]  // world-space rect to fully cover at target plane
 * - worldCell?: number         // desired caustic cell size in world units (approx)
 *
 * Everything else stays the same / backward compatible.
 */
export default function CausticsLightProjector({
  src,
  height = 500,
  target = [0, 0, 0],

  // If angleDeg is given, we use it directly.
  // Otherwise we compute from radius+height or from fitRect.
  angleDeg,
  radius = 10000,

  // Pattern controls (tile can still be forced; otherwise auto from worldCell)
  tile = 1,
  worldCell,                // <-- NEW (approximate cell size in world units)

  cookieSize = 2048,
  intensity = 48,
  distance = 45000,
  playbackRate = 4,

  // NEW: full-coverage helper (plane width/height at target)
  fitRect,                  // e.g. [5000, 5000]
}) {
  const light = useRef()
  const targetRef = useRef()
  const { gl } = useThree()

  // ---------- Base video texture ----------
  const videoTex = useVideoTexture(src, {
    crossOrigin: 'anonymous',
    muted: true,
    loop: true,
    autoplay: true,
    start: true,
  })

  useEffect(() => {
    if (!videoTex) return
    // Cookies act more like masks; linear often avoids extra companding,
    // but sRGB also looks fine. Keep sRGB to match your pipeline.
    videoTex.colorSpace = THREE.SRGBColorSpace
    if (videoTex.image) videoTex.image.playbackRate = playbackRate
  }, [videoTex, playbackRate])

  // ---------- High-quality canvas cookie ----------
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    const s = THREE.MathUtils.clamp(cookieSize | 0, 256, 4096)
    c.width = s
    c.height = s
    return c
  }, [cookieSize])

  const cookieTex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.anisotropy = gl.capabilities.getMaxAnisotropy?.() ?? 1
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping // cookie, not UV tiling
    return t
  }, [canvas, gl])

  // ---------- Compute coverage & tile automatically ----------
  // Half-diagonal radius needed to cover fitRect (if provided)
  const fittedRadius = useMemo(() => {
    if (!fitRect) return radius
    const [w, h] = fitRect
    // footprint radius needed to reach the farthest corner from the center
    return 0.5 * Math.hypot(w, h)
  }, [fitRect, radius])

  // Final angle: angleDeg > fitRect > radius
  const angle = useMemo(() => {
    if (angleDeg !== undefined) {
      return THREE.MathUtils.degToRad(Math.min(angleDeg, 89))
    }
    const useRadius = fittedRadius
    const a = Math.atan(Math.max(1, useRadius) / Math.max(1, height))
    return Math.min(a, Math.PI / 2 - 0.05)
  }, [angleDeg, fittedRadius, height])

  // Auto tile from desired world cell size (approx)
  // Footprint diameter at target plane is ~ 2 * fittedRadius.
  const computedTile = useMemo(() => {
    if (!worldCell || worldCell <= 0) return tile
    const footprint = 2 * fittedRadius
    // How many tiles across to roughly get worldCell size:
    const n = Math.max(1, Math.round(footprint / worldCell))
    // Clamp to something sane to keep CPU OK when redrawing the cookie
    return Math.min(n, 16)
  }, [worldCell, fittedRadius, tile])

  // ---------- Draw video → cookie every frame (with tiling) ----------
  useFrame(() => {
    const vid = videoTex?.image
    if (!vid || vid.readyState < 2) return

    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    const N = Math.max(1, Math.floor(computedTile))
    const cw = canvas.width / N
    const ch = canvas.height / N

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        ctx.drawImage(
          vid,
          0, 0, vid.videoWidth || 1, vid.videoHeight || 1,
          i * cw, j * ch, cw, ch
        )
      }
    }
    cookieTex.needsUpdate = true
  })

  // ---------- Aim at target (no manual scene.add/remove) ----------
  useEffect(() => {
    if (!light.current || !targetRef.current) return
    light.current.target = targetRef.current
    targetRef.current.position.set(target[0], target[1], target[2])
    targetRef.current.updateMatrixWorld()
  }, [target])

  return (
    <>
      <spotLight
        ref={light}
        position={[target[0], height, target[2]]}
        map={cookieTex}
        intensity={intensity}
        distance={distance}
        angle={angle}
        penumbra={1}
        decay={0}
        color="white"
        castShadow={false}
      />
      <object3D ref={targetRef} />
    </>
  )
}
