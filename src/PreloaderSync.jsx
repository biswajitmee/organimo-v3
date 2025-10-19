// small component: listens to drei.useProgress and updates inline preloader.
// When combined reaches 100, calls onDone after finishing animation.
import React, { useEffect, useRef } from 'react'
import { useProgress } from '@react-three/drei'

export default function PreloaderSync({ onDone }) {
  const { progress } = useProgress()
  const initial = 38
  const remaining = 100 - initial
  const lastRef = useRef(-1)
  useEffect(() => {
    // wait until inline initial finished OR forced
    if (!window.__PRELOADER_INITIAL_DONE__ && !window.__PRELOADER_FORCED_COMPLETE__) {
      return
    }
    const real = Math.max(0, Math.min(100, progress || 0))
    const combined = initial + Math.round((real / 100) * remaining)
    if (combined === lastRef.current) return
    lastRef.current = combined
    if (window.__PRELOADER_API__ && window.__PRELOADER_API__.updatePercent) {
      window.__PRELOADER_API__.updatePercent(combined)
    }
    if (combined >= 100) {
      setTimeout(() => {
        if (window.__PRELOADER_API__ && window.__PRELOADER_API__.finishNow) {
          window.__PRELOADER_API__.finishNow(480)
        }
        try { onDone && onDone() } catch(e){}
      }, 420)
    }
  }, [progress, onDone])
  return null
}
