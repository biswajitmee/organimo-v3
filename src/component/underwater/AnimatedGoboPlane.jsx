import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * AnimatedGoboPlane
 * - A long rectangle plane that blocks light except through animated holes.
 * - Invisible in color pass (colorWrite=false), but casts shadow with alpha mask.
 * - Holes are drawn into a CanvasTexture (fast & easy to animate).
 *
 * Props:
 *  y:                 plane height (default 0 just at water surface)
 *  size:              [widthX, depthZ] of the rectangle (default [12000, 2500])
 *  threshold:         alphaTest threshold (default 0.45) — lower lets more light pass
 *  repeat:            UV tiling of the mask over the rectangle (default [2,1])
 *  scroll:            UV scroll speed (default [0.02, 0]) to drift the pattern
 *  bigCount/smallCount: number of large/small holes
 *  bigRadius/smallRadius: [min,max] in mask UV pixels (maps to hole size)
 *  bigSpeed/smallSpeed:   animation speed multipliers
 *
 *  addSun:            create a DirectionalLight here (default true)
 *  sunColor:          "#fff"
 *  sunIntensity:      3.0
 *  sunPos:            [x,y,z] (default [0, 1200, 500])
 *  sunTarget:         [x,y,z] (default [0, -500, 0])
 *  shadowMapSize:     2048 or 4096
 */
export default function AnimatedGoboPlane({
  y = 0,
  size = [12000, 2500],
  threshold = 0.45,
  repeat = [2, 1],
  scroll = [0.02, 0.0],

  bigCount = 20,
  smallCount = 60,
  bigRadius = [40, 120],
  smallRadius = [10, 35],
  bigSpeed = 0.35,
  smallSpeed = 0.6,

  addSun = true,
  sunColor = "#ffffff",
  sunIntensity = 3.0,
  sunPos = [0, 1200, 500],
  sunTarget = [0, -500, 0],
  shadowMapSize = 2048,
}) {
  const planeRef = useRef();
  const lightRef = useRef();
  const targetRef = useRef();

  // ------- CanvasTexture mask (animated circles) -------
  const texRes = 1024; // power of two is best for perf
  const { canvas, ctx, texture, circles } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = texRes;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });

    // Build animated circles (big + small)
    const mkCircles = (count, rMin, rMax, spd) =>
      Array.from({ length: count }).map(() => ({
        x: Math.random() * texRes,
        y: Math.random() * texRes,
        r0: THREE.MathUtils.randFloat(rMin, rMax),
        a: Math.random() * Math.PI * 2,      // angle for orbital motion
        w: THREE.MathUtils.randFloat(0.4, 1.2) * spd, // angular speed
        pulse: THREE.MathUtils.randFloat(0.25, 0.6),  // radius pulse amount
        phase: Math.random() * Math.PI * 2,
        dir: Math.random() < 0.5 ? -1 : 1,
      }));

    const circles = [
      ...mkCircles(bigCount, bigRadius[0], bigRadius[1], bigSpeed),
      ...mkCircles(smallCount, smallRadius[0], smallRadius[1], smallSpeed),
    ];

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.repeat.set(repeat[0], repeat[1]);

    return { canvas, ctx, texture, circles };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // create once

  // update repeat if prop changes
  useEffect(() => {
    texture.repeat.set(repeat[0], repeat[1]);
  }, [repeat, texture]);

  // ------- Materials: invisible color + depth alpha casting -------
  const colorMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: texture,
      colorWrite: false,     // invisible in color pass
      transparent: true,
      alphaTest: threshold,
    });
    m.side = THREE.DoubleSide;
    m.depthWrite = false;
    m.depthTest = true;
    return m;
  }, [texture, threshold]);

  const depthMat = useMemo(() => {
    const m = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaMap: texture,
      alphaTest: threshold,
    });
    m.side = THREE.DoubleSide;
    m.transparent = true;
    return m;
  }, [texture, threshold]);

  // Assign custom depth materials so shadows respect the holes
  useEffect(() => {
    if (!planeRef.current) return;
    planeRef.current.customDepthMaterial = depthMat;
    planeRef.current.customDistanceMaterial = depthMat;
  }, [depthMat]);

  // ------- Animate the mask on the CPU and upload to GPU -------
  const tRef = useRef(0);
  useFrame((_, dt) => {
    tRef.current += dt;

    // animate hole positions + radii
    ctx.clearRect(0, 0, texRes, texRes);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, texRes, texRes);

    // draw many circles additively (white holes on black blocker)
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ffffff";

    for (let c of circles) {
      // orbit a little
      c.a += c.w * dt * c.dir;
      c.x = (c.x + Math.cos(c.a) * 20 * dt * 60) % texRes;
      c.y = (c.y + Math.sin(c.a) * 20 * dt * 60) % texRes;
      if (c.x < 0) c.x += texRes;
      if (c.y < 0) c.y += texRes;

      // pulse radius
      const r = c.r0 * (1.0 + c.pulse * Math.sin(tRef.current * 0.8 + c.phase));

      // draw circle
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }

    // soft blur by drawing a second pass slightly scaled (cheap hack)
    ctx.globalAlpha = 0.25;
    ctx.drawImage(canvas, -2, -2, texRes + 4, texRes + 4);
    ctx.globalAlpha = 1.0;

    texture.offset.x = (texture.offset.x + scroll[0] * dt) % 1;
    texture.offset.y = (texture.offset.y + scroll[1] * dt) % 1;

    texture.needsUpdate = true;
  });

  // ------- Sun / directional light (optional) -------
  useEffect(() => {
    if (!addSun || !lightRef.current || !targetRef.current) return;
    const dl = lightRef.current;
    dl.target = targetRef.current;
    dl.castShadow = true;
    dl.shadow.mapSize.set(shadowMapSize, shadowMapSize);

    // cover the long rectangle fully
    const cam = dl.shadow.camera;
    const halfX = size[0] * 0.55;
    const halfZ = size[1] * 0.55;
    cam.left = -halfX;
    cam.right = halfX;
    cam.top = halfZ;
    cam.bottom = -halfZ;
    cam.near = 10;
    cam.far = 5000;
    dl.shadow.bias = -0.00025;
    dl.shadow.normalBias = 0.03;
    cam.updateProjectionMatrix();
  }, [addSun, size, shadowMapSize]);

  return (
    <>
      {/* Optional sun that shines through the gobo */}
      {addSun && (
        <>
          <directionalLight
            ref={lightRef}
            color={sunColor}
            intensity={sunIntensity}
            position={sunPos}
            castShadow
          />
          <object3D ref={targetRef} position={sunTarget} />
        </>
      )}

      {/* Long rectangle “gobo” plane with animated holes */}
      <mesh
        ref={planeRef}
        position={[0, y - 0.05, 0]}          // just below surface so camera is under it
        rotation={[-Math.PI / 2, 0, 0]}       // lay flat
        castShadow                             // this is the blocker
        receiveShadow={false}
      >
        <planeGeometry args={[size[0], size[1], 1, 1]} />
        <primitive object={colorMat} attach="material" />
      </mesh>
    </>
  );
}
