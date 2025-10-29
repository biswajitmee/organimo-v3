// src/App.jsx
import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import ScrollSection from "./ScrollSection";
import GsapOverlay from "./component/GsapOverlay";
import SimpleLoader from "./SimpleLoader";

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const createdByUs = useRef(false);
  const lenisRef = useRef(null);

  useEffect(() => {
    // If already initialized elsewhere (HMR / another module), reuse it.
    if (typeof window !== "undefined" && window._lenis) {
      lenisRef.current = window._lenis;
      createdByUs.current = false;
    } else {
      // create lenis once and mark we created it
      const lenis = new Lenis({
        smooth: true,
        lerp: 0.08,
        wheelMultiplier: 1,
        duration: 1.0,
        orientation: "vertical",
        autoRaf: true // let Lenis run its own RAF
      });
      window._lenis = lenis;
      lenisRef.current = lenis;
      createdByUs.current = true;
    }

    // create a robust sync handler lenis -> Drei ScrollControls scroll-area
    const lenis = lenisRef.current;

    function findScrollArea() {
      // try common selectors used by drei or your custom scroll area
      const selectors = [
        ".ScrollControls-scroll",
        ".ScrollControls__scrollArea",
        ".scrollArea",
        ".scroll-area",
        "#smooth-scroll-area",
        "[data-r3f-scroll]"
      ];
      for (const s of selectors) {
        try {
          const el = document.querySelector(s);
          if (el) return el;
        } catch (e) {}
      }
      // fallback
      return document.scrollingElement || document.documentElement || document.body;
    }

    let scrollArea = findScrollArea();
    // if ScrollControls mounts later, retry a few times
    let tries = 0;
    const MAX_TRIES = 10;
    const TRY_DELAY = 180;
    function ensureScrollArea() {
      const found = findScrollArea();
      if (found && found !== document.documentElement) {
        scrollArea = found;
      } else if (tries < MAX_TRIES) {
        tries++;
        setTimeout(ensureScrollArea, TRY_DELAY);
      } else {
        scrollArea = document.scrollingElement || document.documentElement || document.body;
      }
    }
    ensureScrollArea();

    // lenis -> scrollArea update
    const onLenisScroll = (evt) => {
      try {
        // evt may be a Lenis instance or object; defensively read values
        const scrollVal = (typeof evt === "object" && typeof evt.scroll === "number")
          ? evt.scroll
          : (typeof lenis.animatedScroll === "number" ? lenis.animatedScroll : (window.scrollY || 0));

        const limitVal = (typeof evt === "object" && typeof evt.limit === "number")
          ? evt.limit
          : (typeof lenis.limit === "number" ? lenis.limit : (document.body.scrollHeight - window.innerHeight));

        // apply scrollTop to the scrollArea used by ScrollControls (so useScroll() sees it)
        if (scrollArea && scrollArea !== document.scrollingElement && typeof scrollArea.scrollTop === "number") {
          scrollArea.scrollTop = Math.round(scrollVal);
        } else {
          // fallback to window scroll
          try { window.scrollTo(0, Math.round(scrollVal)); } catch (e) {}
        }

        // publish normalized progress for existing app logic
        const prog = (typeof evt === "object" && typeof evt.progress === "number")
          ? evt.progress
          : (limitVal > 0 ? (scrollVal / Math.max(1, limitVal)) : 0);
        window._springScrollOffset = Math.max(0, Math.min(1, Number(prog || 0)));

        // keep GSAP ScrollTrigger in sync
        try { ScrollTrigger.update(); } catch (e) {}
      } catch (err) {
        // swallow — we don't want to break rendering if something unexpected happens
        console.warn("[lenis->sync] error", err);
      }
    };

    // attach once (avoid duplicate listeners)
    try {
      // remove any previous duplicate listeners we may have added earlier on HMR
      if (lenis && lenis.off && (lenis._appOnLenisScrollAttached)) {
        // if we attached before, try to remove the old handler reference
        try { lenis.off("scroll", lenis._appOnLenisScrollAttached); } catch (e) {}
        lenis._appOnLenisScrollAttached = null;
      }
      if (lenis && lenis.on) {
        lenis.on("scroll", onLenisScroll);
        // store reference so we can remove on cleanup
        lenis._appOnLenisScrollAttached = onLenisScroll;
      }
    } catch (e) {
      console.warn("[lenis] attach failed", e);
    }

    // publish an initial value so Scene pick it up immediately
    setTimeout(() => {
      try {
        const initialScroll = (lenis && typeof lenis.animatedScroll === "number") ? lenis.animatedScroll : (window.scrollY || 0);
        const limitVal = (lenis && typeof lenis.limit === "number") ? lenis.limit : (document.body.scrollHeight - window.innerHeight);
        window._springScrollOffset = limitVal > 0 ? Math.max(0, Math.min(1, initialScroll / limitVal)) : 0;
        // also set scrollArea initial scrollTop
        if (scrollArea && typeof scrollArea.scrollTop === "number") scrollArea.scrollTop = Math.round(initialScroll);
        ScrollTrigger.update();
      } catch (e) {}
    }, 40);

    // export debug helpers
    window._lenisDebug = {
      instance: lenis,
      getProgress: () => (typeof lenis.progress === "function" ? lenis.progress() : (lenis.animatedScroll / Math.max(1, lenis.limit || 1)))
    };

    // cleanup: only destroy/remove handler if we created the instance
    return () => {
      try {
        if (lenis && lenis.off && lenis._appOnLenisScrollAttached) {
          lenis.off("scroll", lenis._appOnLenisScrollAttached);
          lenis._appOnLenisScrollAttached = null;
        }
      } catch (e) {}
      if (createdByUs.current && lenis) {
        try {
          lenis.destroy && lenis.destroy();
        } catch (e) {}
        try { delete window._lenis; } catch (e) {}
      }
      try { delete window._lenisDebug; } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once per App mount

  return (
    <>
      <SimpleLoader autoProceedMs={1000} />

      <div id="app-root">
        <ScrollSection />
        <GsapOverlay />
      </div>
    </>
  );
}
