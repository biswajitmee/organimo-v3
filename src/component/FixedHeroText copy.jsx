import React, { useRef, useEffect, useState } from 'react'
import { Html } from '@react-three/drei'

export default function FixedHeroText({
  sheet,
  durationSec = 7, // total visible duration in Theatre timeline
  fadeMs = 1000, // fade duration
}) {
  const [opacity, setOpacity] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!sheet || !sheet.sequence) return
    let rafId

    function getSeqSeconds() {
      try {
        const rawPos = Number(sheet.sequence.position || 0)
        let fps = 60
        const ptr = sheet.sequence && sheet.sequence.pointer
        if (ptr) {
          if (typeof ptr.fps === 'number') fps = ptr.fps
          else if (typeof ptr.frameRate === 'number') fps = ptr.frameRate
        }
        return rawPos > 100 ? rawPos / fps : rawPos
      } catch (e) {
        return 0
      }
    }

    function updateOpacity() {
      const t = getSeqSeconds()
      const fadeDur = fadeMs / 1000
      let o = 0
      if (t < fadeDur) o = t / fadeDur // fade-in
      else if (t < durationSec - fadeDur) o = 1 // hold
      else if (t < durationSec) o = 1 - (t - (durationSec - fadeDur)) / fadeDur // fade-out
      else o = 0
      setOpacity(o)
      setVisible(o > 0.01)
      rafId = requestAnimationFrame(updateOpacity)
    }

    rafId = requestAnimationFrame(updateOpacity)
    return () => cancelAnimationFrame(rafId)
  }, [sheet, durationSec, fadeMs])

  if (!visible) return null

  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 20, opacity }}>
      <div className="flex flex-col justify-end items-start px-[10vw] pb-[8vw] w-full h-full text-white transition-opacity duration-300 pointer-events-none select-none">
        {/* Tagline */}
        <div className="opacity-90 mb-3 font-medium text-sm uppercase tracking-widest">
          <span className="inline-block mr-2">●</span>
          FROM BODY
          <span className="bg-white/10 mx-2 px-2 rounded-full font-semibold text-xs">
            TO MIND
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="max-w-[60%] font-light text-[clamp(40px,8vw,160px)] leading-[0.9]">
          Limitless <br />
          <span className="font-extralight">begins here.</span>
        </h1>

        {/* Subtext */}
        <p className="opacity-90 mt-8 max-w-[50%] font-light text-lg">
          Journey into the <em className="italic">wonderful world</em> of Organimo®
        </p>

        {/* Scroll hint */}
        <div className="opacity-80 mt-10 font-semibold text-sm tracking-wider">
          SCROLL TO BEGIN <span className="inline-block ml-2">↓</span>
        </div>
      </div>
    </Html>
  )
}
