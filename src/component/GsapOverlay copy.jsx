// src/component/GsapOverlay.jsx  (unchanged except: waits for loader proceed, then triggers section-0)
import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import SplitText from "gsap/SplitText";
gsap.registerPlugin(SplitText);

export default function GsapOverlay() {
  const sectionsConfig = [
    { start: 0.00, end: 0.10, duration: 0.80, stagger: 0.06, hideDuration: 0.25 },
    { start: 0.17, end: 0.50, duration: 0.75, stagger: 0.05, hideDuration: 0.18 },
    { start: 0.56, end: 0.82, duration: 0.75, stagger: 0.045, hideDuration: 0.18 },
    { start: 0.88, end: 1.00, duration: 0.85, stagger: 0.06, hideDuration: 0.18 }
  ];
  const SECTION_COUNT = sectionsConfig.length;

  const sections = useRef([]);
  const splits = useRef([]);
  const tls = useRef([]);
  const active = useRef(new Array(SECTION_COUNT).fill(false));
  const rafRef = useRef(null);
  const overlayStarted = useRef(false);

  useEffect(() => {
    for (let i = 0; i < SECTION_COUNT; i++) {
      const sec = sections.current[i];
      const cfg = sectionsConfig[i];
      if (!sec || !cfg) continue;

      const headline = sec.querySelector(".headline") || sec.querySelector("h1,h2");
      if (!headline) continue;

      const split = new SplitText(headline, { type: "words" });
      split.words.forEach(w => w.classList.add("word"));
      splits.current[i] = split;

      gsap.set(split.words, { yPercent: 100, autoAlpha: 0 });
      gsap.set(sec, { autoAlpha: 0 });

      const tl = gsap.timeline({ paused: true });
      tl.to(split.words, {
        yPercent: 0, autoAlpha: 1, duration: cfg.duration, stagger: cfg.stagger, ease: "power3.out"
      });
      tl.eventCallback("onReverseComplete", () => { try { gsap.set(sec, { autoAlpha: 0 }); } catch {} });
      tls.current[i] = tl;
    }

    function loop() {
      if (!overlayStarted.current || window.__OVERLAY_LOCKED__) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const p = (typeof window !== "undefined" && typeof window._springScrollOffset === "number")
        ? window._springScrollOffset : 0;
      const progress = Math.max(0, Math.min(1, p));

      for (let i = 0; i < SECTION_COUNT; i++) {
        const cfg = sectionsConfig[i];
        const inRange = (progress >= cfg.start && progress <= cfg.end);
        const was = active.current[i];

        if (inRange && !was) {
          active.current[i] = true;
          gsap.set(sections.current[i], { autoAlpha: 1 });
          const sp = splits.current[i];
          if (sp) gsap.set(sp.words, { yPercent: 100, autoAlpha: 0 });
          tls.current[i]?.play(0);
        }
        if (!inRange && was) {
          active.current[i] = false;
          tls.current[i]?.reverse();
          gsap.to(sections.current[i], { autoAlpha: 0, duration: cfg.hideDuration, ease: "power1.in" });
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    // Start overlay & trigger section-0 AFTER loader proceed
    const startAfterLoader = () => {
      overlayStarted.current = true;
      const sec0 = sections.current[0];
      if (sec0 && tls.current[0]) {
        gsap.set(sec0, { autoAlpha: 1 });
        const sp = splits.current[0];
        if (sp) gsap.set(sp.words, { yPercent: 100, autoAlpha: 0 });
        tls.current[0].play(0);
      }
    };
    window.addEventListener("APP_LOADER_DONE", startAfterLoader, { once: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("APP_LOADER_DONE", startAfterLoader);
      tls.current.forEach(t => { try { t.kill(); } catch {} });
      splits.current.forEach(s => { try { s.revert(); } catch {} });
    };
  }, []);

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
            Limitless <br /><span className="font-[200]">begins here.</span>
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
