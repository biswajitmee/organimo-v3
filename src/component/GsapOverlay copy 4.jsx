// src/GsapOverlay.jsx
import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import SplitText from "gsap/SplitText"; // যদি premium না থাকে, তুমি split utility swap করে নিতে পারো
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger, SplitText);

/*
  Usage:
    <GsapOverlay triggersRef={triggersRef} />
  - triggersRef: useRef([...]) passed from App -> ScrollSection which fills DOM nodes for sections.
*/

export default function GsapOverlay({ triggersRef = null }) {
  // config per-section (start/end relative to scroll offset 0..1)
  const sectionsConfig = [
    { start: 0.00, end: 0.10, duration: 0.80, stagger: 0.06, hideDuration: 0.25 },
    { start: 0.14, end: 0.50, duration: 0.75, stagger: 0.05, hideDuration: 0.18 },
    { start: 0.56, end: 0.82, duration: 0.75, stagger: 0.045, hideDuration: 0.18 },
    { start: 0.88, end: 1.00, duration: 0.85, stagger: 0.06, hideDuration: 0.18 }
  ];

  const SECTION_COUNT = sectionsConfig.length;
  const sections = useRef(Array(SECTION_COUNT).fill(null));
  const splits = useRef([]);
  const tls = useRef([]);
  const active = useRef(new Array(SECTION_COUNT).fill(false));
  const rafRef = useRef(null);

  // Helper: get global progress from window._springScrollOffset (set by your ScrollOffsetBridge)
  function getGlobalProgress() {
    const p = (typeof window !== "undefined" && typeof window._springScrollOffset === "number")
      ? window._springScrollOffset
      : 0;
    return Math.max(0, Math.min(1, p));
  }

  useEffect(() => {
    // wait until:
    // 1) preloader finished (unlocked) -> either App mounts this component only after unlocked,
    //    but double-check the inline flag.
    // 2) camera ready + first frame rendered (so canvas visual is stable)
    // We'll poll for both; then initialize.
    let mounted = true;
    let initInterval = null;

    function checkReadyAndInit() {
      const preDone = !!window.__PRELOADER_INITIAL_DONE__ || !!window.__PRELOADER_FORCED_COMPLETE__;
      const cameraReady = !!window.__R3F_CAMERA_READY__ || !!window.__R3F_FIRST_FRAME__;
      // If App already mounted this component only after unlocked, preDone likely true.
      if (preDone && cameraReady) {
        clearInterval(initInterval);
        initInterval = null;
        if (!mounted) return;
        try { init(); } catch (e) { console.warn('GSAP overlay init fail', e); }
      }
    }
    initInterval = setInterval(checkReadyAndInit, 80);
    checkReadyAndInit();

    function init() {
      // find section nodes: prefer triggersRef, else query [data-gsap-section]
      let nodes = [];
      if (triggersRef && triggersRef.current && triggersRef.current.length) {
        nodes = Array.from(triggersRef.current).filter(Boolean);
      }
      if (!nodes.length) {
        nodes = Array.from(document.querySelectorAll('[data-gsap-section]'));
      }
      // if still none, fallback to earlier app sections (select first 4)
      if (!nodes.length) {
        nodes = Array.from(document.querySelectorAll('section')).slice(0, SECTION_COUNT);
      }

      // map into our sections.current (ensure length)
      for (let i = 0; i < SECTION_COUNT; i++) {
        sections.current[i] = nodes[i] || null;
      }

      // build SplitText + timelines per section
      for (let i = 0; i < SECTION_COUNT; i++) {
        const sec = sections.current[i];
        const cfg = sectionsConfig[i];
        if (!sec || !cfg) {
          splits.current[i] = null;
          tls.current[i] = null;
          continue;
        }

        // ensure visible but transparent initially
        gsap.set(sec, { autoAlpha: 0 });

        const headline = sec.querySelector(".headline") || sec.querySelector("h1,h2");
        if (!headline) {
          splits.current[i] = null;
          tls.current[i] = null;
          continue;
        }

        const split = new SplitText(headline, { type: "words" });
        split.words.forEach(w => w.classList.add("word"));
        splits.current[i] = split;
        gsap.set(split.words, { yPercent: 100, autoAlpha: 0 });

        const tl = gsap.timeline({ paused: true });
        tl.to(split.words, {
          yPercent: 0,
          autoAlpha: 1,
          duration: cfg.duration,
          stagger: cfg.stagger,
          ease: "power3.out"
        });
        tl.eventCallback("onReverseComplete", () => {
          try { gsap.set(sec, { autoAlpha: 0 }); } catch (e) {}
        });
        tls.current[i] = tl;
      }

      // RAF loop: drive per-section enter/exit from global progress (this keeps it frame-synchronous with three scroll)
      function loop() {
        const progress = getGlobalProgress();
        for (let i = 0; i < SECTION_COUNT; i++) {
          const cfg = sectionsConfig[i];
          const sec = sections.current[i];
          if (!cfg || !sec) continue;
          const inRange = (progress >= cfg.start && progress <= cfg.end);
          const wasActive = active.current[i];

          if (inRange && !wasActive) {
            active.current[i] = true;
            gsap.set(sec, { autoAlpha: 1 });
            const sp = splits.current[i];
            if (sp) gsap.set(sp.words, { yPercent: 100, autoAlpha: 0 });
            try { tls.current[i]?.play(0); } catch (e) {}
          }

          if (!inRange && wasActive) {
            active.current[i] = false;
            try {
              tls.current[i]?.reverse();
              gsap.to(sec, { autoAlpha: 0, duration: cfg.hideDuration, ease: "power1.in" });
            } catch (e) {}
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      mounted = false;
      if (initInterval) clearInterval(initInterval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // cleanup GSAP splits/timelines
      tls.current.forEach(t => { try { t.kill(); } catch (e) {} });
      splits.current.forEach(s => { try { s.revert(); } catch (e) {} });
      tls.current = [];
      splits.current = [];
      active.current = new Array(SECTION_COUNT).fill(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggersRef]);

  return null; // overlay DOM already provided by ScrollSection; this only runs animations
}
