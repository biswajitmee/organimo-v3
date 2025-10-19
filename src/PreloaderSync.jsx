import React, { useEffect, useRef, useState } from "react";
import useSceneReadyGate from "./loading/useSceneReadyGate";
import LoaderOverlay from "./LoaderOverlay";

export default function PreloaderSync({ onDone }) {
  const { percent, isFullyReady } = useSceneReadyGate();
  const [showOverlay, setShowOverlay] = useState(true);
  const calledOnce = useRef(false);

  // update inline preloader immediately
  useEffect(() => {
    try { window.__PRELOADER_API__?.update(percent); } catch (e) {}
  }, [percent]);

  // when fully ready, show small COMPLETE then call onDone after fade
  useEffect(() => {
    if (!isFullyReady) return;
    if (calledOnce.current) return;
    calledOnce.current = true;

    // hide inline preloader (visual)
    try { window.__PRELOADER_API__?.done(); } catch (e) {}

    // show internal overlay COMPLETE button via LoaderOverlay component
    // we show briefly then call onDone
    setTimeout(() => {
      try {
        setShowOverlay(false); // hide our overlay (we call onDone)
      } catch (e) {}
    }, 600);

    // call parent onDone to let app proceed
    setTimeout(() => {
      try { onDone && onDone(); } catch (e) {}
    }, 800);

  }, [isFullyReady, onDone]);

  return showOverlay ? <LoaderOverlay progress={percent} canComplete={isFullyReady} onClose={() => { try { window.__PRELOADER_API__?.done(); } catch(e){}; onDone?.(); }} /> : null;
}
