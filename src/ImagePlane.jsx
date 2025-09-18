// ImagePlane.jsx
import { useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function ImagePlane({ url, ...props }) {
  const { gl } = useThree()
  const texture = useLoader(THREE.TextureLoader, url)

  // make sure the bitmap is decoded as sRGB
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = gl.capabilities.getMaxAnisotropy?.() || 1
  texture.needsUpdate = true

  return (
    <mesh {...props}>
      <planeGeometry args={[3000, 2000,1,1,1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        toneMapped={false}        // <- prevents ACES/other tone mapping from altering colors
        premultipliedAlpha={false}
        fog={false}
        depthWrite={false}        // optional: helps with transparent edges
      />
    </mesh>
  )
}
