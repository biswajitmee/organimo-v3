// RectDeri3D.jsx
import React, { useRef, useMemo } from "react"
import * as THREE from "three"
import { Text, useTexture } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"

export default function TextBoxUnderWater({
  title = "Skin Health",
  bullets = [
    "Anti-aging, collagen production, reduces acne, hydrates skin and decreases excessive sebum oil in the skin.",
    "Helps with severe skin conditions like eczema and psoriasis.",
  ],
  bubbleSrc = "/textures/bubble.png",
  position = [0, 1.2, 0],
  scale = 1,
}) {
  const group = useRef()
  const bubbleTex = useTexture(bubbleSrc)

  // subtle float animation
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    group.current.position.y = position[1] + Math.sin(t * 1.2) * 0.1
    group.current.rotation.y = Math.sin(t * 0.3) * 0.15
  })

  const boxGeom = useMemo(() => new THREE.PlaneGeometry(2.8 * scale, 1.6 * scale, 32, 32), [scale])

  return (
    <group ref={group} position={position}>
      {/* translucent glowing card */}
      <mesh geometry={boxGeom}>
        <meshPhysicalMaterial
          transparent
          opacity={0.15}
          roughness={0.3}
          metalness={0.1}
          color="#cbe9ff"
          transmission={0.8}
          ior={1.2}
          thickness={0.2}
        />
      </mesh>

      {/* faint border */}
      <lineSegments position={[0, 0, 0.002]}>
        <edgesGeometry args={[boxGeom]} />
        <lineBasicMaterial color="#b8e0ff" transparent opacity={0.4} />
      </lineSegments>

      {/* bubble above */}
      <mesh position={[0, 1.1 * scale, 0]}>
        <sphereGeometry args={[0.25 * scale, 32, 32]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.3}
          transmission={1}
          roughness={0.1}
          thickness={0.3}
          ior={1.1}
          map={bubbleTex}
          emissive="#aaddff"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Title */}
      <Text
        fontSize={0.14 * scale}
        color="#ffffff"
        anchorY="middle"
        position={[0, 0.45 * scale, 0.02]}
        font="/fonts/Inter-Bold.ttf"
      >
        {title}
      </Text>

      {/* Bullets */}
      {bullets.map((b, i) => (
        <group key={i} position={[0, 0.15 * scale - i * 0.35 * scale, 0.02]}>
          {/* numbered circle */}
          <mesh position={[-1.1 * scale, 0, 0]}>
            <circleGeometry args={[0.1 * scale, 32]} />
            <meshBasicMaterial color="rgba(255,255,255,0.15)" />
          </mesh>
          <Text
            fontSize={0.09 * scale}
            color="#ffffff"
            position={[-1.1 * scale, 0, 0.01]}
            anchorX="center"
            anchorY="middle"
            font="/fonts/Inter-SemiBold.ttf"
          >
            {String(i + 1).padStart(2, "0")}
          </Text>

          {/* bullet text */}
          <Text
            maxWidth={2 * scale}
            fontSize={0.09 * scale}
            color="#e7f6ff"
            anchorX="left"
            anchorY="middle"
            position={[-0.9 * scale, 0, 0]}
            lineHeight={1.3}
            font="/fonts/Inter-SemiBold.ttf"
          >
            {b}
          </Text>
        </group>
      ))}
    </group>
  )
}
