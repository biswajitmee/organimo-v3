// src/ScrollSection.jsx
import React, { useRef, useEffect } from "react"
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import { ScrollControls, Scroll, useScroll } from "@react-three/drei"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/* ---------------- HeroOverlay (intro text only) ---------------- */
function HeroOverlay() {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".hero_text",
        { y: 30, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.8, ease: "power2.out" }
      )
    }, ref)
    return () => ctx.revert()
  }, [])
  return (
    <section
      ref={ref}
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "flex-end",
        padding: "48px",
        boxSizing: "border-box"
      }}
    >
      <div>
        <h1 className="hero_text" style={{ fontSize: 48 }}>
          Limitless begins here
        </h1>
      </div>
    </section>
  )
}

/* ---------------- ScrollContentSection (includes Section #1 pinning) ---------------- */
function ScrollContentSection() {
  const sectionRefs = useRef([])

  useEffect(() => {
    // clear old triggers if hot reload
    ScrollTrigger.getAll().forEach((t) => t.kill())

    // pin the FIRST content section (#1)
    if (sectionRefs.current[0]) {
      ScrollTrigger.create({
        trigger: sectionRefs.current[0],
        start: "top top",
        end: "+=200", // <-- pin for 200px
        pin: true,
        pinSpacing: false, // keeps layout compact after unpin
        markers: false
      })
    }
  }, [])

  return (
    <div style={{ width: "100%" }}>
      <HeroOverlay />

      {/* Section #1 pinned 200px */}
      <section
        ref={(el) => (sectionRefs.current[0] = el)}
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#101010"
        }}
      >
        <h2 style={{ fontSize: 36 }}>Section #1 (pinned 200px)</h2>
      </section>

      {/* Other sections */}
      {Array.from({ length: 7 }).map((_, i) => (
        <section
          key={i + 1}
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid rgba(255,255,255,0.1)"
          }}
        >
          <h2 style={{ fontSize: 36 }}>Section #{i + 2}</h2>
        </section>
      ))}
    </div>
  )
}

/* ---------------- Simple 3D Scene ---------------- */
function Scene() {
  const scroll = useScroll()
  const cubeRef = useRef()
  useFrame((state, delta) => {
    if (!scroll) return
    const off = scroll.offset
    if (cubeRef.current) {
      cubeRef.current.rotation.y += delta * 0.6
      cubeRef.current.position.y = Math.sin(off * Math.PI * 2) * 2
    }
    state.camera.position.lerp(
      new THREE.Vector3(0, 1 + off * 2, 8 - off * 4),
      0.07
    )
    state.camera.lookAt(0, 0, 0)
  })
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.7} />
      <mesh ref={cubeRef} position={[0, 0, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color={"#7cb0ff"} />
      </mesh>
    </>
  )
}

/* ---------------- Main Export ---------------- */
export default function ScrollSection() {
  const PAGES = 8
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Canvas
        style={{
          width: "100vw",
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0
        }}
        camera={{ position: [0, 2, 8], fov: 50 }}
      >
        <ScrollControls pages={PAGES} damping={0.3} distance={1}>
          <Scene />
          <Scroll html style={{ width: "100%", zIndex: 10 }}>
            <ScrollContentSection />
          </Scroll>
        </ScrollControls>
      </Canvas>
    </div>
  )
}
