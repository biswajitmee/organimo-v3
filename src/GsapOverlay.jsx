// src/GsapOverlay.jsx
import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import SplitText from "gsap/SplitText"; // GSAP Premium plugin হলে ভালো; না থাকলে swap utility লাগবে
gsap.registerPlugin(SplitText);

/*
  IMPORTANT:
  - এই কোড ধরে নিচ্ছে window._springScrollOffset আপডেট হচ্ছে (value between 0..1).
    তোমার ScrollSection এর ScrollOffsetBridge এটা আপডেট করে থাকলে ভাল মতো কাজ করবে.
  - প্রতিটি সেকশনের timing এখানে আলাদাভাবে কনফিগ করা যাবে (start/end/duration/stagger/hideDuration).
*/

export default function GsapOverlay() {
  // ========== SECTION CONFIGURATION ==========
  // প্রতিটি সেকশনের জন্য এখানে start/end (0..1) নির্ধারণ করো।
  // start = progress-এ কোথায় এই সেকশন "active" শুরু হবে
  // end   = progress-এ কোথায় এই সেকশন "active" শেষ হবে
  // duration, stagger = word reveal animation প্যারামস
  // hideDuration = overlay hide করার fade সময় (seconds)
  //
  // উদাহরণ: প্রথম সেকশন start:0 end:0.18 => progress 0..0.18 এ সেকশন 0 হবে active
  //
  // *** মনে রাখবে: start < end এবং সবগুলো 0..1 রেঞ্জে থাকতে হবে ***
  const sectionsConfig = [
    { start: 0.00, end: 0.10, duration: 0.80, stagger: 0.06, hideDuration: 0.25 },
    { start: 0.14, end: 0.50, duration: 0.75, stagger: 0.05, hideDuration: 0.18 },
    { start: 0.56, end: 0.82, duration: 0.75, stagger: 0.045, hideDuration: 0.18 },
    { start: 0.88, end: 1.00, duration: 0.85, stagger: 0.06, hideDuration: 0.18 }
  ];

  const SECTION_COUNT = sectionsConfig.length;

  // DOM refs - overlay sections
  const sections = useRef([]);   // DOM nodes for overlay sections
  const splits = useRef([]);     // SplitText instances
  const tls = useRef([]);        // per-section timelines
  const active = useRef(new Array(SECTION_COUNT).fill(false)); // which sections currently "active"
  const rafRef = useRef(null);

  useEffect(() => {
    // --- create splits + timelines per section using config values ---
    for (let i = 0; i < SECTION_COUNT; i++) {
      const sec = sections.current[i];
      const cfg = sectionsConfig[i];

      if (!sec || !cfg) {
        splits.current[i] = null;
        tls.current[i] = null;
        continue;
      }

      // find headline inside the section (needs .headline or h1/h2)
      const headline = sec.querySelector(".headline") || sec.querySelector("h1,h2");
      if (!headline) {
        splits.current[i] = null;
        tls.current[i] = null;
        continue;
      }

      // Split into words
      const split = new SplitText(headline, { type: "words" });
      split.words.forEach(w => w.classList.add("word"));
      splits.current[i] = split;

      // initial state: words hidden below
      gsap.set(split.words, { yPercent: 100, autoAlpha: 0 });

      // timeline: reveal words (paused)
      const tl = gsap.timeline({ paused: true });
      tl.to(split.words, {
        yPercent: 0,
        autoAlpha: 1,
        duration: cfg.duration,
        stagger: cfg.stagger,
        ease: "power3.out"
      });

      // when timeline reversed fully, hide the overlay section (autoAlpha = 0)
      // note: onReverseComplete fires once the timeline finished reversing.
      tl.eventCallback("onReverseComplete", () => {
        try { gsap.set(sec, { autoAlpha: 0 }); } catch (e) {}
      });

      tls.current[i] = tl;
    }

    // initial visibility: only show any section you want initially (we'll show none except maybe first)
    gsap.set(sections.current, { autoAlpha: 0 });
    // Optionally show the first immediately (uncomment if desired)
    // if (sections.current[0]) gsap.set(sections.current[0], { autoAlpha: 1 });

    // --- RAF loop: read window._springScrollOffset and update section states ---
    function loop() {
      const p = (typeof window !== "undefined" && typeof window._springScrollOffset === "number")
        ? window._springScrollOffset
        : 0;
      const progress = Math.max(0, Math.min(1, p));

      // For each section, check if progress is inside its [start, end]
      for (let i = 0; i < SECTION_COUNT; i++) {
        const cfg = sectionsConfig[i];
        const inRange = (progress >= cfg.start && progress <= cfg.end);
        const wasActive = active.current[i];

        // Entering the range (forward or backward): if not active, activate -> play timeline
        if (inRange && !wasActive) {
          active.current[i] = true;
          // show overlay immediately
          try { gsap.set(sections.current[i], { autoAlpha: 1 }); } catch (e) {}
          // reset words initial state (in case)
          const sp = splits.current[i];
          if (sp) gsap.set(sp.words, { yPercent: 100, autoAlpha: 0 });
          // play timeline from start (ensures full reveal even if scrubbing)
          try { tls.current[i]?.play(0); } catch (e) {}
        }

        // Leaving the range: if it was active and progress moved outside, reverse timeline
        if (!inRange && wasActive) {
          active.current[i] = false;
          try {
            // reverse timeline so reveal hides (reverse will trigger onReverseComplete that hides the section)
            tls.current[i]?.reverse();
            // as fallback also ensure we fade out overlay if reverse isn't set or quick
            gsap.to(sections.current[i], { autoAlpha: 0, duration: cfg.hideDuration, ease: "power1.in" });
          } catch (e) {}
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    // cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      tls.current.forEach(t => { try { t.kill(); } catch (e) {} });
      splits.current.forEach(s => { try { s.revert(); } catch (e) {} });
      splits.current = [];
      tls.current = [];
      active.current = new Array(SECTION_COUNT).fill(false);
    };
  }, []);

  // base overlay class: no opaque background so underlying ScrollSection remains visible
  const baseClass = "absolute inset-0 h-screen w-full text-white pointer-events-none px-[10vw]";

  return (
    <div className="z-40 fixed inset-0 pointer-events-none">
      {/* SECTION 0 */}
      <section ref={el => (sections.current[0] = el)} className={`${baseClass} flex items-end pb-[8vh]`}>
        <div className="max-w-[60%]">
          <div className="mb-3 text-sm uppercase tracking-widest">
            <span className="inline-block mr-2">●</span> FROM BODY{" "}
            <span className="bg-white/10 ml-2 px-2 rounded-full text-xs">TO MIND</span>
          </div>

          <h1 className="font-[300] leading-[0.9] headline" style={{ fontSize: "clamp(40px,8vw,120px)" }}>
            Limitless <br />
            <span className="font-[200]">begins here.</span>
          </h1>

          <p className="opacity-90 mt-5">Journey into the <em className="italic">wonderful world</em> of Organimo®</p>
        </div>
      </section>

      {/* SECTION 1 */}
      <section ref={el => (sections.current[1] = el)} className={`${baseClass} flex flex-col items-center justify-center text-center`}>
        <div>
          <div className="mb-4 text-xs uppercase tracking-[0.3em]">SEA MOSS & BLADDERWRACK</div>
          <h2 className="font-[300] leading-[1.05] headline" style={{ fontSize: "clamp(28px,5vw,72px)" }}>
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

      {/* SECTION 2 */}
      <section ref={el => (sections.current[2] = el)} className={`${baseClass} flex flex-col items-center justify-center text-center`}>
        <div>
          <div className="mb-4 text-xs uppercase tracking-[0.3em]">100% ETHICAL & RENEWABLE</div>
          <h2 className="font-[300] leading-[1.05] headline" style={{ fontSize: "clamp(28px,5vw,72px)" }}>
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

      {/* SECTION 3 */}
      <section ref={el => (sections.current[3] = el)} className={`${baseClass} flex items-end pb-[8vh]`}>
        <div className="max-w-[60%]">
          <div className="mb-3 text-xs uppercase tracking-[0.3em]">DISCOVER THE BENEFITS</div>
          <h2 className="font-[300] leading-[0.95] headline" style={{ fontSize: "clamp(40px,7vw,110px)" }}>
            The real <br /> <span className="font-[200] italic">limitless pill.</span>
          </h2>
          <p className="opacity-90 mt-6 max-w-lg">Taking Organimo® has a number of health benefits — continue on the journey to find out more.</p>
        </div>
      </section>
    </div>
  );
}
