// src/SimpleLoader.jsx
import React, { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'

export default function SimpleLoader({
  onFinish,
  autoPreviewMs = 3000, // auto preview delay after reaching 100
  showPercent = true,
  fadeDuration = 450
}) {
  const { progress } = useProgress()
  const [visible, setVisible] = useState(true)
  const [showComplete, setShowComplete] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const autoTimerRef = useRef(null)
  const finishCalledRef = useRef(false)
  const closeTimeoutRef = useRef(null)

  // When progress reaches 100, show COMPLETE button and start auto timer
  useEffect(() => {
    if (progress >= 100 && !showComplete) {
      setShowComplete(true)

      // start auto preview timer (only if not already fired)
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
      autoTimerRef.current = setTimeout(() => {
        handleClose()
      }, autoPreviewMs)
    }
    // If progress drops below 100 (rare) don't revert showComplete
    return () => {
      // no-op
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  const handleClose = () => {
    if (finishCalledRef.current) return
    finishCalledRef.current = true

    // cancel auto timer
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }

    // start fade
    setFadeOut(true)
    // after fadeDuration call onFinish and unmount loader
    closeTimeoutRef.current = setTimeout(() => {
      setVisible(false)
      try {
        onFinish?.()
      } catch (e) {}
    }, fadeDuration)
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

        {/* COMPLETE button appears when progress >= 100 */}
        {showComplete && (
          <button
            onClick={handleClose}
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
