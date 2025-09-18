// src/components/CameraHijackRobustDebug.jsx
import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
  Robust hijack with explicit handback-to-theatre-pose:
  - startPos: where hijack triggers (match your theatreState.json start pose)
  - handbackPos / handbackEuler: final pose where hijack should hand back to theatre
  - At exit, we blend hijackCam -> handbackPose, then:
      1) set window.__THEATRE_CAMERA_OVERRIDE = false
      2) find the theatre camera object by name="TheatreCamera" and set its transform to handback
  - This avoids timeline/time-based snaps.
*/

export default function CameraHijackRobustDebug({
  startPos = [125, 111, -213],
  startEuler = [0, 0, 0],
  endEuler = [-3.141, 0.323, 3.141],
  // NEW props for handback pose (theatreState.json pose you'd like to restore to)
  handbackPos = [125, 111, -215],        // <--- notice z = -215 per your request
  handbackEuler = [-3.141, 0.323, 3.141],
  enterBlend = 0.12,
  rotateDuration = 1.2,
  exitBlend = 0.12,
  tolerance = 0.25,
  autoTriggerOnce = false,
  autoStartForDebug = false
}) {
  const hijackCamRef = useRef(null);
  const playingRef = useRef(false);
  const triggeredRef = useRef(false);
  const stageRef = useRef("idle"); // idle | enter | rotate | exit
  const stageStartRef = useRef(0);

  const startQuat = useRef(new THREE.Quaternion());
  const endQuat = useRef(new THREE.Quaternion());
  const startPosV = useRef(new THREE.Vector3(...startPos));
  const handbackPosV = useRef(new THREE.Vector3(...handbackPos));
  const handbackQuat = useRef(new THREE.Quaternion());

  useEffect(() => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 20000);
    cam.name = "HijackCamDebug";
    cam.updateProjectionMatrix();
    hijackCamRef.current = cam;

    const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(...startEuler, "XYZ"));
    const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(...endEuler, "XYZ"));
    if (qa.dot(qb) < 0) qb.multiplyScalar(-1);
    startQuat.current = qa;
    endQuat.current = qb;

    // handback quaternion (the place we want theatre camera to be on handover)
    const qh = new THREE.Quaternion().setFromEuler(new THREE.Euler(...handbackEuler, "XYZ"));
    handbackQuat.current = qh;

    startPosV.current = new THREE.Vector3(...startPos);
    handbackPosV.current = new THREE.Vector3(...handbackPos);

    console.log("[HijackDebug] created hijack camera", cam);
    return () => { hijackCamRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enterStage(now = performance.now() / 1000) {
    stageRef.current = "enter";
    stageStartRef.current = now;
    playingRef.current = true;
    console.log("[HijackDebug] ENTER stage start");
  }
  function rotateStage(now = performance.now() / 1000) {
    stageRef.current = "rotate";
    stageStartRef.current = now;
    const cam = hijackCamRef.current;
    if (cam) {
      cam.position.copy(startPosV.current);
      cam.quaternion.copy(startQuat.current);
      cam.updateMatrixWorld();
    }
    console.log("[HijackDebug] ROTATE stage start");
  }
  function exitStage(now = performance.now() / 1000) {
    stageRef.current = "exit";
    stageStartRef.current = now;
    console.log("[HijackDebug] EXIT stage start");
  }

  useEffect(() => {
    window.__HijackDebug = {
      start: () => { triggeredRef.current = true; enterStage(); },
      stop: () => { if (playingRef.current) exitStage(); },
      isPlaying: () => playingRef.current,
      isTriggered: () => triggeredRef.current,
      hijackCam: () => hijackCamRef.current,
      status: () => ({ playing: playingRef.current, triggered: triggeredRef.current, stage: stageRef.current })
    };
    if (autoStartForDebug) {
      console.log("[HijackDebug] autoStartForDebug -> forcing start");
      window.__HijackDebug.start();
    }
    return () => { delete window.__HijackDebug; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper: snap theatre camera object (name="TheatreCamera") to a pose
  function snapTheatreCameraToPose(posV, quat) {
    try {
      // find object in scene
      // 'state' not available here; we can get global via THREE.Scene? safer: find the DOM canvas renderer camera object
      // But r3f exposes scene on state in useFrame; here we'll set a global on window for the Theatre camera in Scene:
      // => We'll require: in your Scene, add `ref` to the PerspectiveCamera and assign window.__THEATRE_CAMERA_REF = ref.current`
      // So here, if window.__THEATRE_CAMERA_REF exists, use it.
      const tcam = window.__THEATRE_CAMERA_REF;
      if (tcam && tcam.isCamera) {
        tcam.position.copy(posV);
        tcam.quaternion.copy(quat);
        tcam.updateMatrixWorld();
        console.log("[HijackDebug] snapped TheatreCamera to handback pose");
      } else {
        console.warn("[HijackDebug] Theatre camera ref not found on window.__THEATRE_CAMERA_REF — cannot snap.");
      }
    } catch (e) {
      console.warn("[HijackDebug] snap failed", e);
    }
  }

  useFrame((state) => {
    const activeRendererCam = state.camera; // current renderer camera (may be theatre cam or hijack cam)
    const hijackCam = hijackCamRef.current;
    if (!hijackCam) return;

    // while hijack active, force renderer to use hijackCam
    if (playingRef.current) {
      state.camera = hijackCam;
    }

    const now = performance.now() / 1000;

    // STATE MACHINE
    if (stageRef.current === "idle") {
      if (autoTriggerOnce && triggeredRef.current) return;
      const dist = activeRendererCam.position.distanceTo(startPosV.current);
      if (dist <= tolerance) {
        triggeredRef.current = true;
        enterStage(now);
      }
      return;
    }

    if (stageRef.current === "enter") {
      const t = Math.min(1, (now - stageStartRef.current) / Math.max(0.00001, enterBlend));
      hijackCam.position.lerpVectors(activeRendererCam.position, startPosV.current, t);
      hijackCam.quaternion.copy(activeRendererCam.quaternion).slerp(startQuat.current, t);
      hijackCam.updateMatrixWorld();
      if (t >= 1) rotateStage(now);
      return;
    }

    if (stageRef.current === "rotate") {
      const t = Math.min(1, (now - stageStartRef.current) / Math.max(0.00001, rotateDuration));
      const q = startQuat.current.clone().slerp(endQuat.current, t);
      hijackCam.position.copy(startPosV.current);
      hijackCam.quaternion.copy(q);
      hijackCam.updateMatrixWorld();
      if (t >= 1) exitStage(now);
      return;
    }

    if (stageRef.current === "exit") {
      const t = Math.min(1, (now - stageStartRef.current) / Math.max(0.00001, exitBlend));
      // Blend hijackCam -> handback pose (not the live renderer camera)
      hijackCam.position.lerpVectors(startPosV.current, handbackPosV.current, t);
      hijackCam.quaternion.copy(endQuat.current).slerp(handbackQuat.current, t);
      hijackCam.updateMatrixWorld();
      if (t >= 1) {
        // final: release override and snap theatre camera to handback pose
        playingRef.current = false;
        stageRef.current = "idle";
        // release renderer override so theatre can resume (rendering will use theatre camera next frame)
        window.__THEATRE_CAMERA_OVERRIDE = false;
        // now set real theatre camera transform to handback (so no jump)
        snapTheatreCameraToPose(handbackPosV.current, handbackQuat.current);
        console.log("[HijackDebug] finished; returned to theatre at handback pose");
      }
      return;
    }
  });

  return null;
}
