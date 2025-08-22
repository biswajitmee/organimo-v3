import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

/**
 * Props:
 * - size: plane size (width=height), default 1500 (keep < camera.far)
 * - segments: grid resolution (original demo used 256)
 * - heightScale: multiply height field (original used *10)
 * - position: group position
 */
export default function TerrainRaycastPart({
  size = 5000,
  segments = 100,
  heightScale = 0.1,
  position = [0, -80, 0]
}) {
  const meshRef = useRef()
  const helperRef = useRef()
  const { scene } = useThree()

  const { geometry, texture } = useMemo(() => {
    const width = segments
    const height = segments
    const sizeWH = width * height

    // --- height field
    const data = new Uint8Array(sizeWH)
    const perlin = new ImprovedNoise()
    const z = Math.random() * 10
    let quality = 1
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < sizeWH; i++) {
        const x = i % width
        const y = Math.floor(i / width)
        data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 0.75)
      }
      quality *= 5
    }

    // --- geometry
    const g = new THREE.PlaneGeometry(size, size, width - 1, height - 1)
    g.rotateX(-Math.PI / 2)
    const verts = g.attributes.position.array
    for (let i = 0, j = 0, l = verts.length; i < l; i++, j += 3) {
      verts[j + 1] = data[i] * heightScale
    }
    g.computeVertexNormals()

    // --- baked texture (same look as original)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    let ctx = canvas.getContext('2d')
    ctx.fillStyle = '#4D2E69'
    ctx.fillRect(0, 0, width, height)

    const img = ctx.getImageData(0, 0, width, height)
    const pix = img.data
    const v3 = new THREE.Vector3()
    const sun = new THREE.Vector3(1, 1, 1).normalize()

    for (let i = 0, j = 0, l = pix.length; i < l; i += 4, j++) {
      v3.x = (data[j - 2] ?? 0) - (data[j + 2] ?? 0)
      v3.y = 2
      v3.z = (data[j - width * 2] ?? 0) - (data[j + width * 2] ?? 0)
      v3.normalize()
      const shade = v3.dot(sun)
      const t = 0.5 + data[j] * 0.007
      pix[i]     = (96 + shade * 128) * t
      pix[i + 1] = (32 + shade * 96)  * t
      pix[i + 2] = (shade * 96)       * t
      pix[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    const canvasScaled = document.createElement('canvas')
    canvasScaled.width = width * 4
    canvasScaled.height = height * 4
    ctx = canvasScaled.getContext('2d')
    ctx.scale(4, 4)
    ctx.drawImage(canvas, 0, 0)

    const img2 = ctx.getImageData(0, 0, canvasScaled.width, canvasScaled.height)
    const pix2 = img2.data
    for (let i = 0, l = pix2.length; i < l; i += 4) {
      const n = (Math.random() * 5) | 0
      pix2[i] += n; pix2[i + 1] += n; pix2[i + 2] += n
    }
    ctx.putImageData(img2, 0, 0)

    const tex = new THREE.CanvasTexture(canvasScaled)
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.colorSpace = THREE.SRGBColorSpace

    return { geometry: g, texture: tex }
  }, [segments, size, heightScale])

  const helperGeom = useMemo(() => {
    const g = new THREE.ConeGeometry(20, 100, 3)
    g.translate(0, 50, 0)
    g.rotateX(Math.PI / 2)
    return g
  }, [])

  // pointer move -> align helper to surface normal at hit
  const onPointerMove = (e) => {
    if (!e.face || !meshRef.current || !helperRef.current) return
    const worldNormal = e.face.normal
      .clone()
      .transformDirection(meshRef.current.matrixWorld)
      .normalize()
    const look = e.point.clone().add(worldNormal)
    helperRef.current.position.copy(e.point)
    helperRef.current.lookAt(look)
  }

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerMove={onPointerMove}
        frustumCulled={false} // keeps it from popping if your camera.far is tight
      >
        <meshStandardMaterial map={texture} roughness={1} metalness={0} />
      </mesh>

      <mesh ref={helperRef} geometry={helperGeom}>
        <meshNormalMaterial />
      </mesh>
    </group>
  )
}
