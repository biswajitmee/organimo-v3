import * as THREE from 'three'
import React, { useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useVideoTexture } from '@react-three/drei'

export default function CausticsLightProjector({
  src,
  height = 1500,
  target = [0, 0, 0],
  // If angleDeg given, we use it directly; otherwise we compute from radius+height
  angleDeg,
  radius = 2000,
  // Pattern controls
  tile = 1,              // 1 = no tiling, 2/3 = finer cells
  cookieSize = 2048,     // 1024/2048/4096 (POT -> enables mipmaps)
  intensity = 18,
  distance = 15000,
  playbackRate = 1
}) {
  const light = useRef()
  const targetRef = useRef()
  const { scene, gl } = useThree()

  // Base video texture
  const videoTex = useVideoTexture(src, {
    crossOrigin: 'anonymous',
    muted: true,
    loop: true,
    autoplay: true,
    start: true
  })

  useEffect(() => {
    if (!videoTex) return
    videoTex.colorSpace = THREE.SRGBColorSpace
    if (videoTex.image) videoTex.image.playbackRate = playbackRate
    // We won't use videoTex directly as the cookie (no mipmaps).
  }, [videoTex, playbackRate])

  // High-quality canvas texture (POT + mipmaps + anisotropy)
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    const s = THREE.MathUtils.clamp(cookieSize, 256, 4096) | 0
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
    return t
  }, [canvas, gl])

  // Draw the video into the canvas every frame (with optional tiling)
  useFrame(() => {
    const vid = videoTex?.image
    if (!vid || vid.readyState < 2) return

    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    const N = Math.max(1, Math.floor(tile))
    const cw = canvas.width / N
    const ch = canvas.height / N

    // Optional: high-quality sampling while downscaling
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

  // Cone angle
  const angle = useMemo(() => {
    if (angleDeg !== undefined) return THREE.MathUtils.degToRad(Math.min(angleDeg, 89))
    const a = Math.atan(Math.max(1, radius) / Math.max(1, height))
    return Math.min(a, Math.PI / 2 - 0.05)
  }, [angleDeg, radius, height])

  // Aim at target
  useEffect(() => {
    if (!light.current || !targetRef.current) return
    scene.add(targetRef.current)
    light.current.target = targetRef.current
    targetRef.current.position.set(target[0], target[1], target[2])
    targetRef.current.updateMatrixWorld()
    return () => void scene.remove(targetRef.current)
  }, [scene, target])

  return (
    <>
      <spotLight
        ref={light}
        position={[target[0], height, target[2]]}
        map={cookieTex}           // use HQ, mipmapped cookie
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
