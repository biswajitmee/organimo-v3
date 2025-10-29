// // src/App.jsx
// import React, { useRef, useEffect } from "react";
// import ScrollSection from "./ScrollSection";
// import GsapOverlay from "./component/GsapOverlay";
// import SimpleLoader from "./SimpleLoader";
// import Lenis from "lenis";
// // optional: import "lenis/dist/lenis.css";

// export default function App() {
//   const COUNT = 4;
//   const triggersRef = useRef(Array.from({ length: COUNT }).map(() => React.createRef()));

//   useEffect(() => {
//     const lenis = new Lenis({
//       duration: 1.2,
//       easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
//       smooth: true,
//       orientation: "vertical",
//       gestureOrientation: "vertical",
//       smoothTouch: true
//     });

//     window._lenis = lenis;

//     lenis.on("scroll", (e) => {
//       try {
//         const scrollY = e.scroll ?? (lenis.scroll ?? 0);
//         const docHeight = document.documentElement.scrollHeight - window.innerHeight;
//         const offset = docHeight > 0 ? Math.max(0, Math.min(1, scrollY / docHeight)) : 0;
//         window._springScrollOffset = offset;
//         window._springScrollY = scrollY;
//         window._springScrollVelocity = (lenis.velocity ?? 0);
//       } catch (err) {
//         // ignore
//       }
//     });

//     let rafId;
//     function raf(time) {
//       lenis.raf(time);
//       rafId = requestAnimationFrame(raf);
//     }
//     rafId = requestAnimationFrame(raf);

//     document.documentElement.style.scrollBehavior = "auto";

//     return () => {
//       cancelAnimationFrame(rafId);
//       try { lenis.destroy(); } catch (e) {}
//       delete window._lenis;
//     };
//   }, []);

//   return (
//     <>
//       <SimpleLoader autoProceedMs={1000} />

//       <div id="app-root">
//         <ScrollSection triggersRef={triggersRef} />
//         <GsapOverlay triggersRef={triggersRef} />
//       </div>
//     </>
//   );
// }


// src/App.jsx
import React, { useRef, useEffect } from "react";
import ScrollSection from "./ScrollSection";
import GsapOverlay from "./component/GsapOverlay";
import SimpleLoader from "./SimpleLoader";
import Lenis from "lenis";

export default function App() {
  const COUNT = 4;
  const triggersRef = useRef(Array.from({ length: COUNT }).map(() => React.createRef()));

  useEffect(() => {
    // 🧠 always scroll to top on refresh / reload
    if (typeof window !== "undefined") {
      window.history.scrollRestoration = "manual"; // stop browser restoring scroll
      window.scrollTo(0, 0);
    }

    // initialize lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothTouch: true,
    });

    // expose for debugging
    window._lenis = lenis;

    // scroll event hook (keep same as before)
    lenis.on("scroll", (e) => {
      try {
        const scrollY = e.scroll ?? (lenis.scroll ?? 0);
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const offset = docHeight > 0 ? Math.max(0, Math.min(1, scrollY / docHeight)) : 0;
        window._springScrollOffset = offset;
        window._springScrollY = scrollY;
        window._springScrollVelocity = lenis.velocity ?? 0;
      } catch (err) {}
    });

    // 🧩 run Lenis raf loop
    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // 🚀 important: reset scroll position after lenis fully ready
    setTimeout(() => {
      try {
        lenis.scrollTo(0, { immediate: true }); // reset lenis virtual position
        window.scrollTo(0, 0);
        window._springScrollOffset = 0;
      } catch (e) {}
    }, 100);

    return () => {
      cancelAnimationFrame(rafId);
      try {
        lenis.destroy();
      } catch (e) {}
      delete window._lenis;
    };
  }, []);

  return (
    <>
      <SimpleLoader autoProceedMs={1000} />
      <div id="app-root">
        <ScrollSection triggersRef={triggersRef} />
        <GsapOverlay triggersRef={triggersRef} />
      </div>
    </>
  );
}
