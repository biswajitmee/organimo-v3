// src/component/GsapOverlay.jsx
import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export default function GsapOverlay () {
  const tlRef = useRef(null)
  const rafRef = useRef(null)
  const s0 = useRef(null)
  const s1 = useRef(null)
  const s2 = useRef(null)
  const s3 = useRef(null)

  useEffect(() => {
    const tl = gsap.timeline({ paused: true })

    // initial state: hide all, show first
    gsap.set([s0.current, s1.current, s2.current, s3.current], { autoAlpha: 0, y: 0 })
    gsap.set(s0.current, { autoAlpha: 1, y: 0 })

    // fractional windows (0..1) — adjust these if you change pages/virtual scroll
    // feel free to tweak these numbers to extend/shorten pin durations
    tl.to(s0.current, { autoAlpha: 0, y: -40, duration: 0.08 }, 0.18)   // section0 fade out
    tl.fromTo(s1.current, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.20) // sec1 in
    tl.to(s1.current, { autoAlpha: 0, y: -30, duration: 0.12 }, 0.50)  // sec1 out
    tl.fromTo(s2.current, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.55) // sec2 in
    tl.to(s2.current, { autoAlpha: 0, y: -30, duration: 0.12 }, 0.78)  // sec2 out
    tl.fromTo(s3.current, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.82) // sec3 in

    // normalize timeline so these numbers are treated as 0..1 progress fractions
    try {
      tl.totalDuration(1)
    } catch (e) {
      // older GSAP fallback: we'll leave as-is (but modern GSAP supports totalDuration)
      console.warn('totalDuration not settable on this GSAP version', e)
    }

    tlRef.current = tl

    // RAF sync with window._springScrollOffset
    function loop () {
      const p = (typeof window !== 'undefined' && typeof window._springScrollOffset === 'number') ? window._springScrollOffset : 0
      const progress = Math.max(0, Math.min(1, p))
      if (tlRef.current) tlRef.current.progress(progress, false)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try { tl.kill() } catch (e) {}
      tlRef.current = null
    }
  }, [])

  // overlay container: fixed and pointer-events none (so it won't block scroll)
  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    pointerEvents: 'none', // very important
  }

  const sectionCommon = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100vh',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '8vh 10vw',
    boxSizing: 'border-box',
    color: 'white',
    pointerEvents: 'none', // also for children
  }

  return (
    <div style={overlayStyle}>
      <div ref={s0} style={{ ...sectionCommon }}>
        <div style={{ maxWidth: '60%' }}>
          <div className="mb-3 text-sm uppercase tracking-widest">● FROM BODY <span className="bg-white/10 ml-2 px-2 rounded-full text-xs">TO MIND</span></div>
          <h1 style={{ fontSize: 'clamp(40px,6vw,120px)', lineHeight: 0.9, fontWeight: 300 }}>Limitless <br /><span style={{ fontWeight: 200 }}>begins here.</span></h1>
          <p style={{ marginTop: 20, opacity: 0.9 }}>Journey into the <em>wonderful world</em> of Organimo®</p>
          <div style={{ marginTop: 36, fontWeight: 600 }}>SCROLL TO BEGIN ↓</div>
        </div>
      </div>

      <div ref={s1} style={{ ...sectionCommon, alignItems: 'center', opacity: 0 }}>
        <div style={{ maxWidth: '60%' }}>
          <h2 style={{ fontSize: 'clamp(28px,5vw,72px)', fontWeight: 700 }}>Second Section</h2>
          <p style={{ marginTop: 12 }}>This is the second message — tailored content here.</p>
        </div>
      </div>

      <div ref={s2} style={{ ...sectionCommon, alignItems: 'center', opacity: 0 }}>
        <div style={{ maxWidth: '60%' }}>
          <h2 style={{ fontSize: 'clamp(22px,4vw,48px)', fontWeight: 600 }}>Third Quick Highlight</h2>
          <p style={{ marginTop: 8 }}>Short note here.</p>
        </div>
      </div>

      <div ref={s3} style={{ ...sectionCommon, alignItems: 'center', opacity: 0 }}>
        <div style={{ maxWidth: '60%' }}>
          <h2 style={{ fontSize: 'clamp(22px,4vw,48px)', fontWeight: 600 }}>Fourth Section</h2>
          <p style={{ marginTop: 8 }}>Closing message.</p>
        </div>
      </div>
    </div>
  )
}
