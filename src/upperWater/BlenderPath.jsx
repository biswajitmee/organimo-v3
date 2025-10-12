// src/BlenderPath.jsx
import * as THREE from 'three'
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useScroll, Html } from '@react-three/drei'
import { useControls } from 'leva'

/* smoothing helper (Chaikin) */
function chaikinSmooth(points, iterations = 2) {
  if (!points || points.length < 3) return (points || []).map(p => p.clone())
  let pts = points.map(p => p.clone())
  for (let it = 0; it < iterations; it++) {
    const out = []
    out.push(pts[0].clone())
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1]
      const q = p0.clone().multiplyScalar(0.75).add(p1.clone().multiplyScalar(0.25))
      const r = p0.clone().multiplyScalar(0.25).add(p1.clone().multiplyScalar(0.75))
      out.push(q, r)
    }
    out.push(pts[pts.length - 1].clone())
    pts = out
  }
  return pts
}

/* compute Frenet frames by resampling points via CatmullRom and computing frames */
function computeFrenetForSamples(points, samplesCount = 800, closed = false) {
  if (!points || points.length < 2) return { samples: [], tangents: [], normals: [], binormals: [] }
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.clone()), closed, 'catmullrom', 0.5)
  const samples = curve.getPoints(samplesCount - 1)
  const fr = curve.computeFrenetFrames(samplesCount - 1, closed)
  return { samples: samples.map(p => p.clone()), tangents: fr.tangents.map(v => v.clone()), normals: fr.normals.map(v => v.clone()), binormals: fr.binormals.map(v => v.clone()) }
}

/* clamp quaternion delta per frame by max deg/sec */
function clampQuatDelta(prevQuat, targetQuat, maxDegPerSec, delta) {
  if (!prevQuat) return targetQuat.clone()
  const maxRad = THREE.MathUtils.degToRad(Math.max(1, maxDegPerSec)) * Math.max(1e-6, delta)
  const angle = prevQuat.angleTo(targetQuat)
  if (angle <= maxRad) return targetQuat.clone()
  const t = maxRad / angle
  const out = new THREE.Quaternion()
  out.slerpQuaternions(prevQuat, targetQuat, t)
  return out
}

export default function BlenderPath({ points: propsPoints = [], cameraProps = {} } = {}) {
  // GUI defaults, but parent cameraProps will override when passed
  const {
    pathScale: gui_pathScale,
    camOffsetX, camOffsetY, camOffsetZ,
    camRotXdeg, camRotYdeg, camRotZdeg,
    camSmoothness, scrollResponsiveness,
    clampPitchDeg, invertScroll,
    debugPathColor, maxAngularDegPerSec
  } = useControls('Blender Path / Camera', {
    pathScale: { value: cameraProps.pathScale ?? 5.0, min: 0.1, max: 50, step: 0.1 },

    camOffsetX: { value: cameraProps.camOffsetX ?? 4.5, min: -200, max: 200, step: 0.1 },
    camOffsetY: { value: cameraProps.camOffsetY ?? 34.5, min: -200, max: 400, step: 0.1 },
    camOffsetZ: { value: cameraProps.camOffsetZ ?? -37.4, min: -400, max: 400, step: 0.1 },

    camRotXdeg: { value: cameraProps.camRotXdeg ?? 0.0, min: -90, max: 90, step: 0.1 },
    camRotYdeg: { value: cameraProps.camRotYdeg ?? 0.0, min: -180, max: 180, step: 0.1 },
    camRotZdeg: { value: cameraProps.camRotZdeg ?? 0.0, min: -180, max: 180, step: 0.1 },

    camSmoothness: { value: cameraProps.camSmoothness ?? 0.08, min: 0.001, max: 1.0, step: 0.001 },
    scrollResponsiveness: { value: cameraProps.scrollResponsiveness ?? 0.45, min: 0.01, max: 2.0, step: 0.01 },
    clampPitchDeg: { value: cameraProps.clampPitchDeg ?? 45, min: 0, max: 89, step: 1 },

    invertScroll: { value: cameraProps.invertScroll ?? true },

    debugPathColor: { value: cameraProps.debugPathColor ?? '#ff3b30' },

    maxAngularDegPerSec: { value: cameraProps.maxAngularDegPerSec ?? 45, min: 1, max: 180, step: 1 }
  })

  const scroll = useScroll()
  const cameraRef = useRef()
  const markerRef = useRef()
  const pathLineRef = useRef()
  const smoothedIndexRef = useRef(0)
  const loadedRef = useRef({ samples: [], tangents: [], normals: [], binormals: [] })
  const prevTangentRef = useRef(null)

  // load/resample pipeline (if propsPoints provided use them; else expect parent loaded points)
  useEffect(() => {
    let mounted = true
    (async () => {
      try {
        let raw = []
        if (propsPoints && propsPoints.length) raw = propsPoints.map(p => p.clone())
        // else keep raw empty — parent should pass points; if empty we'll do nothing
        if (!mounted) return

        if (!raw.length) {
          loadedRef.current = { samples: [], tangents: [], normals: [], binormals: [] }
          return
        }

        // Chaikin smooth then Frenet resample
        const smooth = chaikinSmooth(raw, 2)
        const SAMPLES = Math.max(500, Math.min(1800, Math.floor((smooth.length || 10) * 6)))
        const fr = computeFrenetForSamples(smooth, SAMPLES, false)
        loadedRef.current = fr

        // update debug path line geometry
        if (pathLineRef.current) {
          const geom = new THREE.BufferGeometry().setFromPoints(fr.samples)
          pathLineRef.current.geometry?.dispose?.()
          pathLineRef.current.geometry = geom
        }
      } catch (e) {
        console.warn('BlenderPath: load error', e)
        loadedRef.current = { samples: [], tangents: [], normals: [], binormals: [] }
      }
    })()
    return () => { mounted = false }
  }, [propsPoints])

  // when samples ready, place camera on first sample
  useEffect(() => {
    const fr = loadedRef.current
    if (!fr || !fr.samples || !fr.samples.length) return
    if (!cameraRef.current) return
    const first = fr.samples[0].clone().multiplyScalar(gui_pathScale)
    cameraRef.current.position.copy(first)
    const dir = fr.tangents && fr.tangents[0] ? fr.tangents[0].clone() : new THREE.Vector3(0, 0, -1)
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize()
    const up = new THREE.Vector3().crossVectors(dir, side).normalize()
    const basis = new THREE.Matrix4().makeBasis(side, up, dir)
    cameraRef.current.quaternion.setFromRotationMatrix(basis)
    cameraRef.current.updateMatrixWorld(true)
    smoothedIndexRef.current = 0
    prevTangentRef.current = dir.clone()
  }, [loadedRef.current?.samples?.length, gui_pathScale])

  const clampPitchRad = THREE.MathUtils.degToRad(Math.max(0, Math.min(89, clampPitchDeg)))

  useFrame((state, delta) => {
    const fr = loadedRef.current
    if (!fr || !fr.samples || fr.samples.length < 2 || !cameraRef.current) return

    // read scroll offset & invert if desired
    let rawOffset = THREE.MathUtils.clamp(scroll.offset, 0, 1)
    if (invertScroll) rawOffset = 1 - rawOffset

    const count = Math.max(2, fr.samples.length)
    const targetIndexF = rawOffset * (count - 1)

    // smooth index interpolation
    const cur = smoothedIndexRef.current || 0
    const diff = targetIndexF - cur
    const baseLerp = 1 - Math.exp(-Math.max(0.0001, scrollResponsiveness) * 60 * delta)
    const combinedLerp = THREE.MathUtils.clamp(baseLerp * (1 - Math.min(0.95, camSmoothness)), 0.0001, 0.99)
    const nextIndex = cur + diff * combinedLerp
    smoothedIndexRef.current = nextIndex

    const idx = Math.floor(nextIndex)
    const nextI = Math.min(idx + 1, count - 1)
    const t = nextIndex - idx

    const p0 = fr.samples[idx].clone().multiplyScalar(gui_pathScale)
    const p1 = fr.samples[nextI].clone().multiplyScalar(gui_pathScale)
    const posOnPath = p0.clone().lerp(p1, t)

    // tangent smoothing to remove jerk on control points
    let tangent = (fr.tangents && fr.tangents[idx]) ? fr.tangents[idx].clone() : p1.clone().sub(p0).normalize()
    if (!isFinite(tangent.x) || tangent.lengthSq() < 1e-8) tangent = new THREE.Vector3(0, 0, -1)
    const prevTan = prevTangentRef.current || tangent.clone()
    tangent = prevTan.clone().lerp(tangent, 0.06).normalize()
    prevTangentRef.current = tangent.clone()

    // basis (side, correctedUp, tangent)
    const worldUp = new THREE.Vector3(0, 1, 0)
    let side = new THREE.Vector3().crossVectors(worldUp, tangent).normalize()
    if (!isFinite(side.x) || side.lengthSq() < 1e-8) side = new THREE.Vector3(1, 0, 0)
    const correctedUp = new THREE.Vector3().crossVectors(tangent, side).normalize()

    // world position desired: posOnPath + local offsets transformed by path-local basis
    const basis = new THREE.Matrix4().makeBasis(side, correctedUp, tangent)
    const localOffset = new THREE.Vector3(camOffsetX, camOffsetY, camOffsetZ)
    const worldOffset = localOffset.applyMatrix4(basis)
    const desiredPos = posOnPath.clone().add(worldOffset)

    // smooth position
    const posLerpT = THREE.MathUtils.clamp(1 - Math.exp(-60 * camSmoothness * delta), 0, 1)
    cameraRef.current.position.lerp(desiredPos, posLerpT)

    // compute target rotation: face forward along tangent; apply GUI euler offsets (camera-local)
    const camBasis = new THREE.Matrix4().makeBasis(side, correctedUp, tangent)
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(camBasis)

    const extraEuler = new THREE.Euler(
      THREE.MathUtils.degToRad(camRotXdeg),
      THREE.MathUtils.degToRad(camRotYdeg),
      THREE.MathUtils.degToRad(camRotZdeg),
      'YXZ'
    )
    const extraQuat = new THREE.Quaternion().setFromEuler(extraEuler)
    const targetQuat = baseQuat.clone().premultiply(extraQuat)

    // clamp pitch
    const eulerTmp = new THREE.Euler().setFromQuaternion(targetQuat, 'YXZ')
    eulerTmp.x = THREE.MathUtils.clamp(eulerTmp.x, -clampPitchRad, clampPitchRad)
    const finalQuat = new THREE.Quaternion().setFromEuler(eulerTmp)

    // clamp angular velocity to avoid sudden spins
    const clampedQuat = clampQuatDelta(cameraRef.current.quaternion, finalQuat, maxAngularDegPerSec, delta)

    // smooth rotation
    const rotSlerpT = THREE.MathUtils.clamp(1 - Math.exp(-120 * camSmoothness * delta), 0, 1)
    cameraRef.current.quaternion.slerp(clampedQuat, rotSlerpT)
    cameraRef.current.updateMatrixWorld(true)

    // debug marker
    if (markerRef.current) {
      markerRef.current.position.copy(posOnPath)
      markerRef.current.visible = true
    }
  })

  return (
    <>
      {/* use r3f primitive camera (non-theatre) */}
      <perspectiveCamera ref={cameraRef} makeDefault near={0.1} far={5000} fov={35} />

      <mesh ref={markerRef}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color={debugPathColor} />
      </mesh>

      <group>
        <line ref={pathLineRef}>
          <lineBasicMaterial color={debugPathColor} linewidth={2} />
        </line>
      </group>

      <Html center style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(0,0,0,0.55)', padding: 6, borderRadius: 6, color: 'white', fontSize: 12 }}>
          Blender Path: {loadedRef.current?.samples?.length ?? '...'} pts
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>
            invertScroll: {String(invertScroll)} • camSmoothness: {Number(camSmoothness).toFixed(3)}
          </div>
        </div>
      </Html>
    </>
  )
}
