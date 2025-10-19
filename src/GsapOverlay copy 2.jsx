// src/component/GsapOverlay.jsx
import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import SplitText from 'gsap/SplitText' // GSAP Premium plugin

gsap.registerPlugin(SplitText)

export default function GsapOverlay () {
  const sections = useRef([])     // DOM refs for 4 sections
  const splits = useRef([])      // SplitText instances
  const tlRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    // build timeline with fractional placements 0..1
    const tl = gsap.timeline({ paused: true })

    // create SplitText for each section headline
    sections.current.forEach((sec) => {
      if (!sec) return
      const headline = sec.querySelector('.headline') || sec.querySelector('h1, h2')
      if (!headline) return
      const split = new SplitText(headline, { type: 'words' })
      // mark each word for CSS fallback if needed
      split.words.forEach(w => w.classList.add('word'))
      splits.current.push(split)
      // initial state for words: dropped below and invisible
      gsap.set(split.words, { yPercent: 100, autoAlpha: 0 })
    })

    // ensure sections initial alpha: only section 0 visible
    gsap.set(sections.current, { autoAlpha: 0, y: 0 })
    if (sections.current[0]) gsap.set(sections.current[0], { autoAlpha: 1 })

    // helper reveal/hide using words
    function revealWords(idx, opts = {}) {
      const split = splits.current[idx]
      if (!split) return
      return gsap.to(split.words, {
        yPercent: 0,
        autoAlpha: 1,
        duration: opts.duration ?? 0.8,
        stagger: opts.stagger ?? 0.05,
        ease: 'power3.out'
      })
    }
    function hideWords(idx, opts = {}) {
      const split = splits.current[idx]
      if (!split) return
      return gsap.to(split.words, {
        yPercent: -80,
        autoAlpha: 0,
        duration: opts.duration ?? 0.6,
        stagger: opts.stagger ?? 0.03,
        ease: 'power1.in'
      })
    }

    // TIMELINE: fractional times from 0..1
    // 0..0.18: hero visible (we'll reveal it immediately on mount)
    tl.call(() => revealWords(0, { duration: 0.80, stagger: 0.06 }), null, 0.0)
    // fade hero out around 0.18..0.22
    tl.to(sections.current[0], { autoAlpha: 0, y: -20, duration: 0.04, ease: 'power2.in' }, 0.04)

    // section 1 in 0.24..0.5, out ~0.48..0.52
    tl.call(() => revealWords(1, { duration: 0.75, stagger: 0.05 }), null, 0.03)
    tl.fromTo(sections.current[1], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 }, 0.07)
    tl.call(() => hideWords(1, { duration: 0.55, stagger: 0.03 }), null, 0.48)
    tl.to(sections.current[1], { autoAlpha: 0, y: -14, duration: 0.12 }, 0.48)

    // section 2 in 0.56..0.82
    tl.call(() => revealWords(2, { duration: 0.75, stagger: 0.045 }), null, 0.56)
    tl.fromTo(sections.current[2], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 }, 0.56)
    tl.call(() => hideWords(2, { duration: 0.5, stagger: 0.03 }), null, 0.80)
    tl.to(sections.current[2], { autoAlpha: 0, y: -14, duration: 0.12 }, 0.80)

    // section 3 final in 0.88..1.0
    tl.call(() => revealWords(3, { duration: 0.85, stagger: 0.06 }), null, 0.88)
    tl.fromTo(sections.current[3], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 }, 0.88)

    // normalize timeline so progress(0..1) maps to fractional timeline
    try { tl.totalDuration(1) } catch (e) { /* older gsap may not support setter - ok */ }

    tlRef.current = tl

    // Ensure hero is fully revealed on mount (exactly once)
    // This guarantees "ekdom prothome animate hoe hero dekha jabe"
    try {
      revealWords(0, { duration: 0.85, stagger: 0.06 })
      if (sections.current[0]) gsap.set(sections.current[0], { autoAlpha: 1 })
    } catch (e) { /* safe fallback */ }

    // RAF loop: read global offset and set timeline progress
    function loop () {
      const p = (typeof window !== 'undefined' && typeof window._springScrollOffset === 'number')
        ? window._springScrollOffset
        : 0
      const progress = Math.max(0, Math.min(1, p))
      if (tlRef.current) tlRef.current.progress(progress, false)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    // cleanup on unmount
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try { tl.kill() } catch (e) {}
      splits.current.forEach(s => {
        try { s.revert() } catch (e) {}
      })
      splits.current = []
      tlRef.current = null
    }
  }, [])

  // common Tailwind / style for sections
  const baseClass = 'absolute inset-0 h-screen w-full text-white box-border pointer-events-none px-[10vw]'

  return (
    <div className="z-[9999] fixed inset-0 pointer-events-none">
      {/* SECTION 0 - Hero (left aligned, big) */}
      <section
        ref={(el) => (sections.current[0] = el)}
        className={`${baseClass} flex items-end pb-[8vh]`}
      >
        <div className="max-w-[60%]">
          <div className="mb-3 text-sm uppercase tracking-widest">
            <span className="inline-block mr-2">●</span> FROM BODY{' '}
            <span className="bg-white/10 ml-2 px-2 rounded-full text-xs">TO MIND</span>
          </div>

          <h1 className="font-[300] leading-[0.9] headline" style={{ fontSize: 'clamp(40px,8vw,120px)' }}>
            Limitless <br />
            <span className="font-[200]">begins here.</span>
          </h1>

          <p className="opacity-90 mt-5">
            Journey into the <em className="italic">wonderful world</em> of Organimo®
          </p>
        </div>
      </section>

      {/* SECTION 1 - big centered headline with CTA */}
      <section
        ref={(el) => (sections.current[1] = el)}
        className={`${baseClass} flex flex-col items-center justify-center text-center`}
      >
        <div>
          <div className="mb-4 text-xs uppercase tracking-[0.3em]">SEA MOSS & BLADDERWRACK</div>
          {/* updated to match 3rd section's weight */}
          <h2 className="font-[300] leading-[1.05] headline" style={{ fontSize: 'clamp(28px,5vw,72px)' }}>
            The only natural multivitamin <br /> you will <span className="font-[200] italic">ever need.</span>
          </h2>
          <div className="mt-8">
            <button className="bg-white px-8 py-3 rounded-full font-semibold text-black">SHOP NOW</button>
          </div>
          <p className="opacity-90 mx-auto mt-8 max-w-xl text-sm">
            Organimo® contains a blend of two nutrient-rich superfoods: Sea Moss and Bladderwrack.
          </p>
        </div>
      </section>

      {/* SECTION 2 - ingredients centered */}
      <section
        ref={(el) => (sections.current[2] = el)}
        className={`${baseClass} flex flex-col items-center justify-center text-center`}
      >
        <div>
          <div className="mb-4 text-xs uppercase tracking-[0.3em]">100% ETHICAL & RENEWABLE</div>
          {/* updated to match 3rd section's weight */}
          <h2 className="font-[300] leading-[1.05] headline" style={{ fontSize: 'clamp(28px,5vw,72px)' }}>
            All naturally sourced marine <br /> <span className="font-[200] italic">ingredients from Canada.</span>
          </h2>
          <div className="flex justify-center gap-4 mt-6">
            <span className="px-4 py-1 border border-white/60 rounded-full text-xs tracking-wider">HIGHEST QUALITY</span>
            <span className="px-4 py-1 border border-white/60 rounded-full text-xs tracking-wider">INGREDIENTS</span>
          </div>
          <p className="opacity-90 mx-auto mt-8 max-w-xl text-sm">
            We value sourcing our plants from the highest-grade regions that are clean and 100% natural.
          </p>
        </div>
      </section>

      {/* SECTION 3 - final hero */}
      <section
        ref={(el) => (sections.current[3] = el)}
        className={`${baseClass} flex items-end pb-[8vh]`}
      >
        <div className="max-w-[60%]">
          <div className="mb-3 text-xs uppercase tracking-[0.3em]">DISCOVER THE BENEFITS</div>
          <h2 className="font-[300] leading-[0.95] headline" style={{ fontSize: 'clamp(40px,7vw,110px)' }}>
            The real <br /> <span className="font-[200] italic">limitless pill.</span>
          </h2>
          <p className="opacity-90 mt-6 max-w-lg">Taking Organimo® has a number of health benefits — continue on the journey to find out more.</p>
        </div>
      </section>
    </div>
  )
}
