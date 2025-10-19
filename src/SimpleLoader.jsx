// src/SimpleLoader.jsx
import React, { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'

/**
 * SimpleLoader
 * - autoPreviewMs: auto-close delay after reaching 100 (ms)
 * - holdMs: how long progress must remain 100 before we treat it as complete (debounce)
 * - fadeDuration: fade out duration (ms)
 * - onFinish: callback called once when loader finished/unmounted
 *
 * Behaviour:
 * - uses a global latch window.__SIMPLE_LOADER_COMPLETED__ to ensure single-run across remounts
 * - small hold/debounce to avoid flicker causing double-run
 */
export default function SimpleLoader({
  onFinish,
  autoPreviewMs = 3000,
  holdMs = 120,
  fadeDuration = 450,
  showPercent = true
}) {
  const { progress } = useProgress()

  // If completed globally, don't show at all
  const globalDone = typeof window !== 'undefined' && !!window.__SIMPLE_LOADER_COMPLETED__
  const [visible, setVisible] = useState(!globalDone)
  const [showCompleteButton, setShowCompleteButton] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  // refs for guarding single-run behaviour
  const holdTimerRef = useRef(null)
  const autoTimerRef = useRef(null)
  const finishedRef = useRef(globalDone) // local guard (mirrors global)
  const closeTimeoutRef = useRef(null)

  // ensure if global flag already set we immediately call onFinish (but do not render)
  useEffect(() => {
    if (globalDone) {
      // call onFinish in next tick to let app update
      setTimeout(() => {
        try { onFinish?.() } catch (e) {}
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // watch progress; when it reaches 100 we start a small hold timer to avoid flicker
  useEffect(() => {
    if (finishedRef.current) return

    if (progress >= 100) {
      // start hold timer (debounce) — ensure progress stays at 100 briefly
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      holdTimerRef.current = setTimeout(() => {
        // show complete button and start auto timer (only once)
        if (!finishedRef.current) {
          setShowCompleteButton(true)

          // start auto preview timer
          if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
          autoTimerRef.current = setTimeout(() => {
            triggerClose()
          }, autoPreviewMs)
        }
      }, holdMs)
    } else {
      // if progress drops below 100 before hold expires, cancel hold
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
      // do not revert showCompleteButton once shown — we intentionally keep it if it was already set
    }

    return () => {
      // clean per-effect (not strictly necessary)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  // central close logic guarded to run only once
  const triggerClose = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    // mark global so remounts don't re-run
    try { window.__SIMPLE_LOADER_COMPLETED__ = true } catch (e) {}
    // cancel auto timer
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }

    // fade out then hide and call onFinish
    setFadeOut(true)
    closeTimeoutRef.current = setTimeout(() => {
      setVisible(false)
      try { onFinish?.() } catch (e) {}
    }, fadeDuration)
  }

  const handleManualComplete = () => {
    // user clicked COMPLETE button
    triggerClose()
  }

  if (!visible) return null

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#0b0b0b',
        zIndex: 99999,
        pointerEvents: 'auto',
        transition: `opacity ${fadeDuration}ms ease`,
        opacity: fadeOut ? 0 : 1
      }}
    >
      <div style={{
        width: 150,
        height: 150,
        display: 'grid',
        placeItems: 'center',
        position: 'relative'
      }}>
        <svg width="130" height="130" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r="54" stroke="#2b2b2b" strokeWidth="3" fill="none" />
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke="#d4af37"
            strokeWidth="4"
            fill="none"
            strokeDasharray={Math.PI * 2 * 54}
            strokeDashoffset={Math.PI * 2 * 54 * (1 - Math.min(100, Math.max(0, progress)) / 100)}
            style={{ transition: 'stroke-dashoffset 220ms linear' }}
          />
        </svg>

        {showPercent && (
          <div style={{
            position: 'absolute',
            color: '#cbd5e1',
            fontSize: 20,
            fontWeight: 800
          }}>
            {Math.round(Math.min(100, Math.max(0, progress)))}%
          </div>
        )}

        {showCompleteButton && (
          <button
            onClick={handleManualComplete}
            style={{
              position: 'absolute',
              bottom: -48,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '10px 22px',
              borderRadius: 999,
              border: '2px solid #d4af37',
              background: 'transparent',
              color: '#d4af37',
              fontWeight: 800,
              letterSpacing: 1.2,
              cursor: 'pointer',
              fontSize: 13
            }}
            aria-label="Complete and preview"
          >
            COMPLETE
          </button>
        )}
      </div>
    </div>
  )
}
