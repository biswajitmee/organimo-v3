// PathFish.jsx
import React, { useMemo, useRef, useImperativeHandle, forwardRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Line, PerspectiveCamera } from '@react-three/drei'
import { Fish } from './fish'
/**
 * Props:
 * - points: Array<[x,y,z]> control points for the path
 * - speed: units per second along the curve length
 * - loop: boolean (default true)
 * - closed: boolean curve closed (default false)
 * - tension: Catmull-Rom tension (0..1), default 0.5
 * - bank: how much to roll into turns (0..1), default 0.35
 * - showPath: draw the path line if true
 * - fishScale: scale of the fish (uniform)
 * - fishOffset: optional offset vec3 to nudge fish relative to path (e.g., [0,0.2,0])
 * - fixCamera: if true, places a fixed camera at `camPos` looking at `camLookAt`
 * - camPos: camera position
 * - camLookAt: camera target
 *
 * Exposed methods (via ref):
 * - start()
 * - stop()
 * - setProgress(p: 0..1)
 * - setSpeed(v: number)
 */
export const PathFish = forwardRef(function PathFish(
  {
    points = [
      [0, 0, 0],
      [2, 0.5, -3],
      [6, 1.2, -5],
      [10, 0.2, -2],
      [7, -0.4, 2],
      [3, 0.1, 3],
    ],
    speed = 2.0,
    loop = true,
    closed = false,
    tension = 0.5,
    bank = 0.35,
    showPath = true,
    fishScale = 1,
    fishOffset = [0, 0, 0],
    fixCamera = true,
    camPos = [0, 2.5, 8],
    camLookAt = [0, 0.5, 0],
    // pass-through props for Fish if needed
    ...fishProps
  },
  ref
) {
  const curve = useMemo(() => {
    const pts = points.map((p) => new THREE.Vector3(...p))
    const c = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', tension)
    return c
  }, [points, closed, tension])

  // Precompute length to convert speed (units/sec) → progress (/sec)
  const totalLength = useMemo(() => curve.getLength(), [curve])
  const linePoints = useMemo(() => curve.getSpacedPoints(200), [curve])

  // Motion state
  const progress = useRef(0)          // 0..1 along the curve
  const running = useRef(true)
  const speedRef = useRef(speed)      // units/sec along world length

  // Refs
  const fishGroup = useRef()
  const tempPos = useMemo(() => new THREE.Vector3(), [])
  const tempTangent = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])
  const m = useMemo(() => new THREE.Matrix4(), [])

  // Camera fix at start (optional)
  useEffect(() => {
    if (!fixCamera) return
    // drei's <PerspectiveCamera makeDefault> below handles it visually
  }, [fixCamera])

  // Imperative API
  useImperativeHandle(ref, () => ({
    start() { running.current = true },
    stop() { running.current = false },
    setProgress(p) { progress.current = THREE.MathUtils.clamp(p, 0, 1) },
    setSpeed(v) { speedRef.current = Math.max(0, v) }
  }), [])

  useFrame((_, dt) => {
    if (running.current) {
      const dp = (speedRef.current / Math.max(1e-6, totalLength)) * dt // convert world u/sec → progress/sec
      progress.current += dp
      if (loop) {
        progress.current = (progress.current % 1 + 1) % 1
      } else {
        progress.current = THREE.MathUtils.clamp(progress.current, 0, 1)
      }
    }

    const t = progress.current
    // Position
    curve.getPointAt(t, tempPos)
    tempPos.add(new THREE.Vector3(...fishOffset))
    // Tangent (direction of travel)
    curve.getTangentAt(t, tempTangent).normalize()

    // Build a frame where Z faces forward, Y is up
    // Look direction = tangent; build a quaternion from look-at matrix
    const target = tempPos.clone().add(tempTangent)
    m.lookAt(tempPos, target, up)
    quat.setFromRotationMatrix(m)

    // Banking: roll around forward axis proportional to curvature
    // Approximate curvature by comparing current tangent to a slightly advanced tangent
    const aheadT = (t + 0.01) % 1
    const aheadTan = curve.getTangentAt(aheadT).normalize()
    const turnAmt = tempTangent.angleTo(aheadTan) // 0..pi
    const roll = -THREE.MathUtils.clamp(turnAmt * 2.0 * bank, -Math.PI / 4, Math.PI / 4)

    // Apply roll in fish local forward axis
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(tempTangent, roll)
    quat.multiply(rollQuat)

    // Write transforms
    if (fishGroup.current) {
      fishGroup.current.position.copy(tempPos)
      fishGroup.current.quaternion.copy(quat)
    }
  })

  return (
    <>
      {fixCamera && (
        <PerspectiveCamera makeDefault position={camPos} fov={50} near={0.1} far={1000} />
      )}
      {/* Aim the fixed camera toward camLookAt on mount */}
      {fixCamera && (
        <LookAt target={camLookAt} />
      )}

      {/* Debug path line */}
      {showPath && (
        <Line
          points={linePoints}
          lineWidth={2}
          transparent
          opacity={0.65}
        />
      )}

      {/* The fish following the path */}
      <group ref={fishGroup} scale={fishScale}>
        <Fish {...fishProps} />
      </group>
    </>
  )
})

/** Helper to aim the default camera at a point once (for fixed start) */
function LookAt({ target = [0, 0, 0] }) {
  const t = useMemo(() => new THREE.Vector3(...target), [target])
  useFrame(({ camera }) => {
    camera.lookAt(t)
  }, 1) // priority after camera update
  return null
}
