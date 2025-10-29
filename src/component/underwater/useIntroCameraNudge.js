// hooks/useIntroCameraNudge.js
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useThree } from "@react-three/fiber"
import { useProgress } from "@react-three/drei"
import * as THREE from "three"
import gsap from "gsap"

/**
 * (Legacy) Auto intro on assets loaded (progress==100).
 * Kept for backward compatibility.
 */
export function useIntroCameraNudge({
  enabled = true,
  snap = 0.6,
  yaw = 6,
  pitch = -2,
  roll = 0,
  inDur = 0.9,
  hold = 0.35,
  outDur = 1.0,
  easeIn = "power2.out",
  easeOut = "power3.out",
  onStart,
  onPeak,
  onComplete
} = {}) {
  const { camera } = useThree()
  const { progress } = useProgress()
  const playedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (progress < 100 || playedRef.current) return
    playedRef.current = true
    const cam = camera
    const startPos = cam.position.clone()
    const startQuat = cam.quaternion.clone()

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize()
    const targetPos = startPos.clone().add(forward.multiplyScalar(snap))

    const deltaQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(pitch),
        THREE.MathUtils.degToRad(yaw),
        THREE.MathUtils.degToRad(roll),
        "YXZ"
      )
    )
    const targetQuat = startQuat.clone().multiply(deltaQuat)

    const state = { t: 0 }
    onStart?.()
    const tl = gsap.timeline()
    tl.to(state, {
      t: 1, duration: inDur, ease: easeIn,
      onUpdate: () => {
        cam.position.lerpVectors(startPos, targetPos, state.t)
        THREE.Quaternion.slerp(startQuat, targetQuat, cam.quaternion, state.t)
        cam.updateMatrixWorld()
      },
      onComplete: () => onPeak?.()
    })
    tl.to({}, { duration: hold })
    tl.to(state, {
      t: 0, duration: outDur, ease: easeOut,
      onUpdate: () => {
        cam.position.lerpVectors(targetPos, startPos, 1 - state.t)
        THREE.Quaternion.slerp(targetQuat, startQuat, cam.quaternion, 1 - state.t)
        cam.updateMatrixWorld()
      },
      onComplete: () => onComplete?.()
    })
    return () => tl.kill()
  }, [progress, enabled])
}

/**
 * Manual intro nudge — play exactly when you call `play()`.
 * Meant for "app preview" trigger.
 */
export function useIntroCameraNudgeManual({
  cameraRef,
  snap = 0.7,
  yaw = 5,
  pitch = -1.5,
  roll = 0,
  inDur = 0.85,
  hold = 0.25,
  outDur = 0.9,
  easeIn = "power2.out",
  easeOut = "power3.out",
  onStart,
  onPeak,
  onComplete
} = {}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const tlRef = useRef(null)

  const play = useCallback(() => {
    const cam = cameraRef?.current
    if (!cam || isPlaying) return
    if (tlRef.current) { tlRef.current.kill(); tlRef.current = null }

    const startPos = cam.position.clone()
    const startQuat = cam.quaternion.clone()

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(startQuat).normalize()
    const targetPos = startPos.clone().add(forward.multiplyScalar(snap))

    const deltaQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(pitch),
        THREE.MathUtils.degToRad(yaw),
        THREE.MathUtils.degToRad(roll),
        "YXZ"
      )
    )
    const targetQuat = startQuat.clone().multiply(deltaQuat)

    const state = { t: 0 }
    setIsPlaying(true)
    onStart?.()

    const tl = gsap.timeline({
      onComplete: () => {
        setIsPlaying(false)
        onComplete?.()
      }
    })
    tl.to(state, {
      t: 1, duration: inDur, ease: easeIn,
      onUpdate: () => {
        cam.position.lerpVectors(startPos, targetPos, state.t)
        THREE.Quaternion.slerp(startQuat, targetQuat, cam.quaternion, state.t)
        cam.updateMatrixWorld()
      },
      onComplete: () => onPeak?.()
    })
    tl.to({}, { duration: hold })
    tl.to(state, {
      t: 0, duration: outDur, ease: easeOut,
      onUpdate: () => {
        cam.position.lerpVectors(targetPos, startPos, 1 - state.t)
        THREE.Quaternion.slerp(targetQuat, startQuat, cam.quaternion, 1 - state.t)
        cam.updateMatrixWorld()
      }
    })

    tlRef.current = tl
  }, [cameraRef, isPlaying, snap, yaw, pitch, roll, inDur, hold, outDur, easeIn, easeOut, onStart, onPeak, onComplete])

  useEffect(() => {
    return () => { if (tlRef.current) tlRef.current.kill() }
  }, [])

  return { play, isPlaying }
}
