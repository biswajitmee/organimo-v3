// src/component/underwater/TextBoxUnderWater.jsx
import React, { useRef, useMemo, useEffect } from "react"
import * as THREE from "three"
import { Text, useScroll } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useControls, button } from "leva"
import gsap from "gsap"

// helpers
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export default function TextBoxUnderWater({
  bullets = [
    "Anti-aging, collagen production, reduces acne, hydrates skin and decreases excessive sebum oil in the skin.",
    "Helps with severe skin conditions like eczema and psoriasis."
  ],
  scale = 1,
  position = [0, 1.2, 0],

  // scroll-sync props
  scrollTimelineLength = 120, // total scroll timeline in seconds
  startAt = 30,               // when (seconds) this component's animation begins
  duration = 4,               // seconds duration mapped to full reveal
  manualPlay = false,         // if true, scroll sync disabled; use Play button

  // visuals
  borderColor = "#ffffff",
  borderInitialOpacity = 0.0,
  borderTargetOpacity = 1.0
}) {
  const group = useRef()
  const borderRef = useRef()
  const borderMat = useRef()
  const textMats = useRef([])
  const t = useRef(0)

  const { totalDuration, Play } = useControls("TextBox Animation", {
    totalDuration: { value: duration, min: 0.05, max: 10, step: 0.01 },
    Play: button(() => startBorderGrowManual())
  })

  const scroll = useScroll()

  // rectangle dims (center-origin)
  const W = 3.0 * scale
  const H = 2.0 * scale
  const R = 0.18 * scale

  // geometry: rounded rect polyline centered
  const borderGeometry = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-W / 2 + R, -H / 2)
    s.lineTo(W / 2 - R, -H / 2)
    s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R)
    s.lineTo(W / 2, H / 2 - R)
    s.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2)
    s.lineTo(-W / 2 + R, H / 2)
    s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R)
    s.lineTo(-W / 2, -H / 2 + R)
    s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2)
    const pts = s.getPoints(256)
    const arr = []
    for (let i = 0; i < pts.length; i++) arr.push(new THREE.Vector3(pts[i].x, pts[i].y, 0.01))
    arr.push(new THREE.Vector3(pts[0].x, pts[0].y, 0.01))
    return new THREE.BufferGeometry().setFromPoints(arr)
  }, [W, H, R])

  if (!textMats.current) textMats.current = []

  useEffect(() => {
    if (!group.current) return
    group.current.traverse((o) => {
      if (o.isMesh || o.isLine || o.isPoints) {
        o.renderOrder = 999
        o.frustumCulled = false
      }
    })
    if (borderRef.current) borderRef.current.scale.set(1, 0.0001, 1)
    textMats.current.forEach((m) => { if (m) m.opacity = 0 })
  }, [])

  // manual play via GSAP (fallback)
  function startBorderGrowManual() {
    if (!borderRef.current || !borderMat.current) return
    gsap.killTweensOf("*")
    const total = Math.max(0.02, totalDuration)
    const growDur = total * 0.9
    const textDur = Math.max(0.1, total * 0.6)
    borderRef.current.scale.set(1, 0.0001, 1)
    borderMat.current.opacity = borderInitialOpacity
    textMats.current.forEach((m) => { if (m) { m.opacity = 0; m.transparent = true } })

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } })
    tl.to(borderMat.current, { opacity: borderTargetOpacity, duration: Math.min(0.25, growDur * 0.4) }, 0)
    tl.to(borderRef.current.scale, { y: 1.0, duration: growDur, ease: "power3.out" }, 0)
    textMats.current.forEach((m, i) => {
      if (!m) return
      const startAt = Math.min(growDur * 0.1 + i * 0.06, growDur * 0.6)
      tl.to(m, { opacity: 1.0, duration: textDur }, startAt)
    })
  }

  // --- layout: special positioning when bullets.length === 2 ---
  // desired: first circle near top inside border, second circle centered (middle), texts sit just below their circles.
  const computePositions = () => {
    const positions = []
    const topOffsetFraction = 0.22 // fraction of H from top edge inward for the first circle
    const textOffsetFraction = 0.12 // vertical gap from circle center to top of the text block

    if (bullets.length === 1) {
      positions.push(0) // center
      return positions
    }

    if (bullets.length === 2) {
      const yFirst = H * 0.5 - topOffsetFraction * H // near top inside border
      const ySecond = 0 // center
      positions.push(yFirst, ySecond)
      return positions
    }

    // default: distribute evenly centered
    const spacing = 0.55 * scale
    for (let i = 0; i < bullets.length; i++) {
      const y = (bullets.length - 1) * 0.5 * spacing - i * spacing
      positions.push(y)
    }
    return positions
  }

  const circlePositions = useMemo(() => computePositions(), [bullets, W, H, scale])

  // scroll-sync frame
  useFrame(() => {
    t.current += 1 / 60
    if (manualPlay) return

    const offset = (scroll && typeof scroll.offset === "number") ? scroll.offset : (scroll.current || 0)
    const globalSec = clamp(offset, 0, 1) * Math.max(0.0001, scrollTimelineLength)
    const raw = (globalSec - startAt) / Math.max(0.0001, duration)
    const prog = clamp(raw, 0, 1)
    const eased = easeOutCubic(prog)

    if (borderRef.current) {
      borderRef.current.scale.y = Math.max(0.0001, eased)
      borderRef.current.scale.x = 1 + 0.02 * Math.sin(eased * Math.PI)
    }
    if (borderMat.current) {
      borderMat.current.opacity = THREE.MathUtils.lerp(borderMat.current.opacity || 0, borderTargetOpacity * eased, 0.55)
    }

    // text fade: start slightly after border begins
    const textStartOffset = 0.08
    textMats.current.forEach((m, i) => {
      if (!m) return
      // for stagger when more than 2, compute small per-index offset
      const stagger = i * 0.06
      const tProg = clamp((prog - textStartOffset - stagger) / Math.max(0.0001, 1 - textStartOffset - stagger), 0, 1)
      const tEased = easeOutCubic(tProg)
      m.opacity = tEased
    })
  })

  // render
  return (
    <group ref={group} position={position}>
      {/* border line */}
      <line ref={borderRef} geometry={borderGeometry}>
        <lineBasicMaterial
          ref={borderMat}
          color={borderColor}
          transparent
          opacity={borderInitialOpacity}
          linewidth={1}
          depthTest={false}
          depthWrite={false}
        />
      </line>

      {/* For layout: place texts/circles in relation to computed circlePositions */}
      <group position={[0, 0, 0.03]}>
        {bullets.map((b, i) => {
          // compute circle center Y
          const circleY = circlePositions[i] ?? 0
          // place text slightly below circle center
          // choose a fixed visual offset relative to H
          const textOffset = H * 0.12
          const textY = circleY - textOffset

          return (
            <group key={i} position={[0, 0, 0]}>
              {/* circle positioned at circleY */}
              <group position={[0, circleY, 0]}>
                <mesh renderOrder={999} frustumCulled={false}>
                  <circleGeometry args={[0.12 * scale, 32]} />
                  <meshBasicMaterial
                    depthTest={false}
                    depthWrite={false}
                    transparent
                    opacity={0.22}
                    color="#ffffff"
                    toneMapped={false}
                  />
                </mesh>

                {/* number inside circle */}
                <Text
                  fontSize={0.048 * scale}
                  anchorX="center"
                  anchorY="middle"
                  position={[0, 0, 0.01]}
                  font="/fonts/Inter-SemiBold.ttf"
                >
                  {String(i + 1).padStart(2, "0")}
                  <meshBasicMaterial
                    ref={(m) => (textMats.current[i * 2] = m)}
                    color="#ffffff"
                    transparent
                    opacity={0}
                    depthTest={false}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </Text>
              </group>

              {/* Bullet text placed at textY (below the circle) */}
              <group position={[0, textY, 0]}>
                <Text
                  fontSize={0.095 * scale}
                  anchorX="center"
                  anchorY="middle"
                  position={[0, 0, 0]}
                  maxWidth={2.4 * scale}
                  lineHeight={1}
                  font="/fonts/Inter-Bold.ttf"
                >
                  {b}
                  <meshBasicMaterial
                    ref={(m) => (textMats.current[i * 2 + 1] = m)}
                    color="#ffffff"
                    transparent
                    opacity={0}
                    depthTest={false}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </Text>
              </group>
            </group>
          )
        })}
      </group>
    </group>
  )
}
