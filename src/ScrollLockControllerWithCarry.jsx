// ScrollLockControllerWithCarry.jsx
import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScroll } from '@react-three/drei'
import { useControls } from 'leva'
import * as THREE from 'three'

export default function ScrollLockControllerWithCarry({ children }) {
  const scroll = useScroll()

  // Leva controls (tweak করে ideal behaviour পাবে)
  const cfg = useControls('ScrollLockWithCarry', {
    checkpoints: { value: '0,0.25,0.5,0.75,1' }, // normalized 0..1
    velocityThreshold: { value: 3.0, min: 0.1, max: 30, step: 0.1 }, // fast-scroll detect
    lockMode: { options: ['nearest', 'next', 'index'], value: 'nearest' },
    lockIndex: { value: 1, min: 0, max: 10, step: 1 },
    // carry-over / momentum settings
    carryFactor: { value: 0.25, min: 0, max: 1, step: 0.01 }, // fraction of last delta to keep
    maxCarry: { value: 0.08, min: 0, max: 0.5, step: 0.001 }, // max normalized offset to carry (0..1)
    // easing towards target (higher -> faster)
    easeLerp: { value: 0.18, min: 0.01, max: 1, step: 0.01 },
    requireManualUnlock: { value: true },
    unlockCooldownMs: { value: 120, min: 0, max: 2000, step: 10 },
    tolerance: { value: 0.0005, min: 0, max: 0.05, step: 0.0001 }
  })

  // parse checkpoint string
  const parseCheckpoints = (s) =>
    s.split(',').map(x => parseFloat(x.trim())).filter(n => !Number.isNaN(n)).map(n => Math.max(0, Math.min(1, n))).sort((a,b) => a-b)

  const cpsRef = useRef(parseCheckpoints(cfg.checkpoints))
  useEffect(() => { cpsRef.current = parseCheckpoints(cfg.checkpoints) }, [cfg.checkpoints])

  const lastOffsetRef = useRef(scroll.offset)
  const lastTimeRef = useRef(performance.now())

  const lockedRef = useRef(false)
  const lockedTargetRef = useRef(0)      // final target we will ease towards
  const lockedVisualRef = useRef(0)      // current eased visual value
  const lastDeltaRef = useRef(0)         // last frame delta (signed)

  const lastUnlockAttemptRef = useRef(0)

  // pick checkpoint
  const chooseCheckpoint = (mode, current) => {
    const cps = cpsRef.current
    if (!cps.length) return current
    if (mode === 'nearest') {
      let nearest = cps[0], dist = Math.abs(current - nearest)
      for (let c of cps) { const d = Math.abs(current - c); if (d < dist) { dist = d; nearest = c } }
      return nearest
    } else if (mode === 'next') {
      for (let c of cps) if (c > current + cfg.tolerance) return c
      return cps[cps.length - 1]
    } else if (mode === 'index') {
      const idx = Math.max(0, Math.min(cfg.lockIndex, cps.length - 1))
      return cps[idx]
    }
    return current
  }

  const lockAtWithCarry = (checkpoint, signedDelta) => {
    // signedDelta = lastOffset - prevOffset (direction & magnitude)
    // compute carry = carryFactor * signedDelta clamped by maxCarry
    const rawCarry = cfg.carryFactor * signedDelta
    const carry = Math.max(-cfg.maxCarry, Math.min(cfg.maxCarry, rawCarry))
    // target = checkpoint + carry (but keep within [0,1] and within neighbour checkpoint range)
    let target = checkpoint + carry
    target = Math.max(0, Math.min(1, target))

    // prevent jumping too far beyond nearest surrounding checkpoints:
    const cps = cpsRef.current
    // find nearest index to checkpoint
    let idx = cps.findIndex(c => Math.abs(c - checkpoint) < 1e-6)
    if (idx === -1) {
      // find where checkpoint would be inserted
      idx = cps.findIndex(c => c > checkpoint)
      if (idx === -1) idx = cps.length // inserted at end
    }
    // allowed min/max: between previous and next checkpoint
    const prevCP = cps[Math.max(0, idx-1)] ?? 0
    const nextCP = cps[Math.min(cps.length-1, idx)] ?? 1
    // clamp target to [prevCP, nextCP] with small epsilon
    target = Math.max(prevCP - 0.0001, Math.min(nextCP + 0.0001, target))

    lockedRef.current = true
    lockedTargetRef.current = target
    lockedVisualRef.current = scroll.offset // start easing from current offset
    lastUnlockAttemptRef.current = performance.now()

    // push DOM scrollTop to approximate visual lock (best-effort)
    try {
      const el = scroll.el
      if (el) el.scrollTop = target * (el.scrollHeight - el.clientHeight)
    } catch (e) {}
  }

  const unlock = () => {
    lockedRef.current = false
  }

  // listen for wheel/touch to manually unlock (if configured)
  useEffect(() => {
    const onWheel = (e) => {
      if (!lockedRef.current) return
      const now = performance.now()
      if (cfg.requireManualUnlock) {
        if (now - lastUnlockAttemptRef.current > cfg.unlockCooldownMs) {
          if (Math.abs(e.deltaY) > 2) unlock()
        }
        lastUnlockAttemptRef.current = now
      }
    }
    const onTouchStart = () => {
      if (!lockedRef.current) return
      const now = performance.now()
      if (cfg.requireManualUnlock) {
        if (now - lastUnlockAttemptRef.current > cfg.unlockCooldownMs) unlock()
        lastUnlockAttemptRef.current = now
      }
    }

    const target = scroll.el || window
    target.addEventListener('wheel', onWheel, { passive: true })
    target.addEventListener('touchstart', onTouchStart, { passive: true })
    return () => {
      target.removeEventListener('wheel', onWheel)
      target.removeEventListener('touchstart', onTouchStart)
    }
  }, [cfg.requireManualUnlock, cfg.unlockCooldownMs, scroll.el])

  useFrame(() => {
    const now = performance.now()
    const dt = Math.max(1e-6, (now - lastTimeRef.current) / 1000)
    const current = scroll.offset
    const delta = current - lastOffsetRef.current
    const velocity = Math.abs(delta / dt)
    lastDeltaRef.current = delta

    // detect fast scroll -> decide lock
    if (!lockedRef.current && velocity >= cfg.velocityThreshold) {
      const checkpoint = chooseCheckpoint(cfg.lockMode, current)
      lockAtWithCarry(checkpoint, delta)
    }

    // if locked -> ease visual value toward lockedTargetRef
    if (lockedRef.current) {
      // lockedVisual lerp -> lockedTarget
      lockedVisualRef.current = THREE.MathUtils.lerp(lockedVisualRef.current, lockedTargetRef.current, cfg.easeLerp)
      // map visual to DOM scroll for consistency
      try {
        const el = scroll.el
        if (el) el.scrollTop = lockedVisualRef.current * (el.scrollHeight - el.clientHeight)
      } catch (e) {}

      // if visual nearly reached target AND user not trying to push further, keep it locked
      if (Math.abs(lockedVisualRef.current - lockedTargetRef.current) < cfg.tolerance) {
        // keep exact equal to avoid jitter
        lockedVisualRef.current = lockedTargetRef.current
        try {
          const el = scroll.el
          if (el) el.scrollTop = lockedTargetRef.current * (el.scrollHeight - el.clientHeight)
        } catch (e) {}
      }
    }

    // update lasts
    lastOffsetRef.current = scroll.offset
    lastTimeRef.current = now
  })

  return <>{children}</>
}
