// UnderwaterSleeveBelow.jsx
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'

function makeVerticalGradientTexture({
  width = 2048,
  height = 2048,
  top = '#8E79BE',     // near surface
  bottom = '#2E264C',  // deeper
} = {}) {
  const c = document.createElement('canvas')
  c.width = width; c.height = height
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, 0, height)
  grd.addColorStop(0, top)
  grd.addColorStop(1, bottom)
  g.fillStyle = grd
  g.fillRect(0, 0, width, height)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
} 

export default function UnderwaterSleeve({
  topY = -0.12,        // just under water surface (y=0)
  depth = 12000,       // how far it extends downward
  radius = 5000,      // side-wall radius
  closeBottom = true,  // add a bottom cap
  topColor = '#4D2E69',
  bottomColor = '#4D2E69',
  onlyWhenUnderwater = true,
  transparent= true,
depthWrite= false,
blending= THREE.NormalBlending,
}) {
  const { camera } = useThree()
  const cylRef = useRef(null)
  const capRef = useRef(null)

  const gradTex = useMemo(
    () => makeVerticalGradientTexture({ top: topColor, bottom: bottomColor }),
    [topColor, bottomColor]
  )

  // geometry placement
  const height = depth
  const centerY = topY - height / 2
  const bottomY = topY - depth

  const cylGeom = useMemo(
    () => new THREE.CylinderGeometry(radius, radius, height, 96, 1, true),
    [radius, height]
  )
  const cylMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: gradTex,
      side: THREE.BackSide,     // we’re inside the cylinder
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
    }),
    [gradTex]
  )

  const capGeom = useMemo(
    () => new THREE.CircleGeometry(radius * 0.998, 128),
    [radius]
  )
  const capMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: bottomColor,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
    }),
    [bottomColor]
  )

  // follow camera on X/Z so you never see the wall edge
  useFrame(() => {
    const cyl = cylRef.current
    if (!cyl) return

    const show = !onlyWhenUnderwater || camera.position.y < 0
    cyl.visible = show
    cyl.position.set(camera.position.x, centerY, camera.position.z)

    if (capRef.current) {
      capRef.current.visible = show
      capRef.current.position.set(camera.position.x, bottomY, camera.position.z)
    }
  })

  return (
    <>
      <mesh ref={cylRef} geometry={cylGeom} material={cylMat} frustumCulled={false} />
      {closeBottom && (
        <mesh
          ref={capRef}
          geometry={capGeom}
          material={capMat}
          rotation-x={-Math.PI / 2}
          frustumCulled={false}
        />
      )}
    </>
  )
}
