// src/component/CameraWorldHtmlManager.jsx
import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import {  useThree } from '@react-three/fiber'

/**
 * CameraWorldHtmlManager
 *
 * Props:
 *  - sheet: optional theatre sheet (to read timeline seconds)
 *  - windows: optional array of 4 {start, end} seconds
 *  - blocks: optional array of 4 React nodes (Tailwind HTML)
 *  - positions: optional array of 4 world positions [x,y,z] where blocks sit
 *  - lerp: smoothing factor for opacity (0..1)
 *
 * Usage: put inside your Scene (Canvas) children. Ensure your Scene exposes
 * window._springScrollOffset (or pass sheet).
 */
export default function CameraHtmlManager({
  sheet = null,
  windows = null,
  blocks = null,
  positions = null,
  lerp = 0.12
}) {
  const { camera } = useThree()

  // Default time windows (seconds) — change as needed
  const defaultWindows = [
    { start: 0, end: 7 },   // first on 0..7s
    { start: 12, end: 24 }, // second on 12..24s
    { start: 25, end: 30 }, // third on 25..30s
    { start: 35, end: 60 }  // fourth on 35..60s
  ]

  // Default positions in world space if you don't pass any.
  // Place them somewhere in front of the path/camera. Adjust to taste.
  const defaultPositions = [
    [0, 1.6, -4],
    [0, 1.6, -12],
    [0, 1.6, -20],
    [0, 1.6, -30]
  ]

  // Default HTML blocks you can customize (Tailwind classes ok)
  const defaultBlocks = [
    <div className="flex flex-col justify-center items-start px-[6vw] w-full h-full text-white pointer-events-none select-none">
      <div className="opacity-90 mb-3 font-medium text-sm uppercase tracking-widest">
        <span className="inline-block mr-2">●</span>
        FROM BODY
        <span className="bg-white/10 mx-2 px-2 rounded-full font-semibold text-xs">TO MIND</span>
      </div>
      <h1 className="max-w-[60%] font-light text-[clamp(40px,6vw,120px)] leading-[0.9]">
        Limitless <br />
        <span className="font-extralight">begins here.</span>
      </h1>
      <p className="opacity-90 mt-8 max-w-[50%] font-light text-lg">
        Journey into the <em className="italic">wonderful world</em> of Organimo®
      </p>
    </div>,
    <div className="flex flex-col justify-center items-start px-[6vw] w-full h-full text-white pointer-events-none select-none">
      <h2 className="max-w-[60%] font-semibold text-[clamp(28px,4.8vw,64px)]">Second Section</h2>
      <p className="mt-4 max-w-[50%]">This is the second message — tailored content here.</p>
    </div>,
    <div className="flex flex-col justify-center items-start px-[6vw] w-full h-full text-white pointer-events-none select-none">
      <h2 className="font-medium text-[clamp(22px,3.6vw,40px)]">Third Quick Highlight</h2>
      <p className="mt-3">4–5s quick note.</p>
    </div>,
    <div className="flex flex-col justify-center items-start px-[6vw] w-full h-full text-white pointer-events-none select-none">
      <h2 className="text-[clamp(22px,3.6vw,40px)]">Fourth Section</h2>
      <p className="mt-4 max-w-[50%]">Closing / longer message.</p>
    </div>
  ]

  const timeWindows = Array.isArray(windows) && windows.length === 4 ? windows : defaultWindows
  const htmlBlocks = Array.isArray(blocks) && blocks.length === 4 ? blocks : defaultBlocks
  const posArray = Array.isArray(positions) && positions.length === 4 ? positions : defaultPositions

  // opacity refs for smooth lerp
  const opRef = useRef([0, 0, 0, 0])
  const [visibleFlags, setVisibleFlags] = useState([false, false, false, false])
  const raf = useRef(null)

  // Read seconds from theatre sheet if available
  function getSeqSeconds() {
    try {
      if (!sheet || !sheet.sequence) return null
      const rawPos = Number(sheet.sequence.position || 0)
      let fps = 60
      const ptr = sheet.sequence && sheet.sequence.pointer
      if (ptr) {
        if (typeof ptr.fps === 'number' && ptr.fps > 0) fps = ptr.fps
        else if (typeof ptr.frameRate === 'number' && ptr.frameRate > 0) fps = ptr.frameRate
      }
      return rawPos > 100 ? rawPos / fps : rawPos
    } catch (e) {
      return null
    }
  }

  // decide which index should be active (0..3 or -1)
  function computeActiveIndex() {
    const s = getSeqSeconds()
    if (s !== null) {
      for (let i = 0; i < timeWindows.length; i++) {
        const w = timeWindows[i]
        if (s >= w.start && s < w.end) return i
      }
      return -1
    }
    // fallback: virtual scroll offset (exposed from Scene)
    try {
      const off = typeof window !== 'undefined' ? window._springScrollOffset : null
      if (typeof off === 'number') {
        const total = Math.max(1, timeWindows[timeWindows.length - 1].end)
        const approx = off * total
        for (let i = 0; i < timeWindows.length; i++) {
          const w = timeWindows[i]
          if (approx >= w.start && approx < w.end) return i
        }
        return -1
      }
      // final fallback: map page scrollY
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 1
      const limit = vh * 2
      const y = typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0
      if (y <= limit) return 0
      const total2 = Math.max(1, timeWindows[timeWindows.length - 1].end)
      const approx2 = Math.min(total2, (y / (limit + 1)) * total2)
      for (let i = 0; i < timeWindows.length; i++) {
        const w = timeWindows[i]
        if (approx2 >= w.start && approx2 < w.end) return i
      }
      return -1
    } catch (e) {
      return -1
    }
  }

  useEffect(() => {
    let mounted = true
    const THRESH = 0.02

    function tick() {
      if (!mounted) return
      const active = computeActiveIndex()
      for (let i = 0; i < 4; i++) {
        const cur = opRef.current[i] || 0
        const desired = i === active ? 1 : 0
        opRef.current[i] = Number(THREE.MathUtils.lerp(cur, desired, lerp).toFixed(3))
      }
      const newFlags = opRef.current.map(v => v > THRESH)
      let changed = false
      for (let i = 0; i < 4; i++) if (newFlags[i] !== visibleFlags[i]) { changed = true; break }
      if (changed) setVisibleFlags(newFlags.slice())
      raf.current = requestAnimationFrame(tick)
    }

    raf.current = requestAnimationFrame(tick)
    return () => {
      mounted = false
      if (raf.current) cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, lerp])

  // small nudge listeners (optional)
  useEffect(() => {
    const nudge = () => {}
    window.addEventListener('scroll', nudge, { passive: true })
    window.addEventListener('touchmove', nudge, { passive: true })
    return () => {
      window.removeEventListener('scroll', nudge)
      window.removeEventListener('touchmove', nudge)
    }
  }, [])

  // Render 4 Html components in world anchored at positions, but rotated every frame to face camera (billboard)
  return (
    <>
      {posArray.map((p, i) => {
        const opacity = opRef.current[i] || 0
        const visible = visibleFlags[i]
        // if not visible we keep rendering but display:none to avoid layout thrash; can also unmount entirely if you prefer
        return (
          <group key={`world-html-${i}`} position={new THREE.Vector3(...p)}>
            <BillboardHtml opacity={opacity} visible={visible}>
              {htmlBlocks[i]}
            </BillboardHtml>
          </group>
        )
      })}
    </>
  )
}

/* ------------------------------------------------------------------
   BillboardHtml
   - wraps <Html transform> and makes the THREE group face camera every frame
   - controls the inner wrapper's opacity (fade)
   ------------------------------------------------------------------ */
function BillboardHtml({ children, opacity = 0, visible = false }) {
  const ref = useRef()
  const { camera } = useThree()
  // update group quaternion each frame to face camera
  useEffect(() => {
    let mounted = true
    const id = requestAnimationFrame(function tick() {
      if (!mounted) return
      if (ref.current && camera) {
        // copy camera rotation — keeps the HTML facing the camera
        ref.current.quaternion.copy(camera.quaternion)
      }
      requestAnimationFrame(tick)
    })
    return () => { mounted = false; cancelAnimationFrame(id) }
  }, [camera])

  // use inline style to control opacity; pointerEvents none by default
  return (
    <group ref={ref}>
      <Html
        transform
        occlude={false}
        center
        style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
      >
        <div
          aria-hidden={!visible}
          style={{
            width: 'auto',
            maxWidth: '70vw',
            pointerEvents: 'none',
            opacity,
            transition: 'opacity 180ms linear',
            transform: 'translate3d(-50%,-50%,0)',
            position: 'relative',
            left: '50%',
            top: '50%'
          }}
        >
          {children}
        </div>
      </Html>
    </group>
  )
}
