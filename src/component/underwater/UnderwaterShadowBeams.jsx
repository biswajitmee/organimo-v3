import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useVideoTexture, useTexture } from "@react-three/drei";

/**
 * UnderwaterShadowBeams (seam-free)
 *
 * - Shadow mask plane just below water: patterned shadows on receivers.
 * - Seam-free volumetric slab: only the TOP INSIDE face of a box is rendered,
 *   so no side/bottom faces → no vertical seam and no horizon blowout.
 *
 * Props:
 *  waterY, planeSize, src, threshold, repeat, scroll,
 *  castShadows, debugMask,
 *  volumeBeams, volumeSize, volumeHeight, volumeColor, volumeOpacity, volumeIntensity,
 *  lightColor, lightIntensity, lightPos, lightTarget, shadowMapSize
 */
export default function UnderwaterShadowBeams({
  waterY = 0,
  planeSize = 10000,
  src = "/caustics.mp4",
  threshold = 0.45,
  repeat = [2, 2],
  scroll = [0.02, 0.015],
  castShadows = true,
  debugMask = false,

  volumeBeams = true,
  volumeSize = [10000, 10000],
  volumeHeight = 800,
  volumeColor = "#bfeaff",
  volumeOpacity = 0.18,    // a little lower by default
  volumeIntensity = 1.0,

  lightColor = "#ffffff",
  lightIntensity = 2.5,    // slightly lower; reduce risk of blowout
  lightPos = [100, 1200, -200],
  lightTarget = [0, -500, 0],
  shadowMapSize = 2048,
}) {
  const planeRef = useRef();
  const lightRef = useRef();
  const targetRef = useRef();

  // --- Mask texture (video or static) ----------------------------------------
  const isVideo = typeof src === "string" && /\.(mp4|webm)$/i.test(src);
  const videoTex = isVideo
    ? useVideoTexture(src, { crossOrigin: "anonymous", muted: true, loop: true, start: true })
    : null;
  const staticTex = !isVideo && typeof src === "string" ? useTexture(src) : null;
  const maskTex = videoTex || staticTex;

  useEffect(() => {
    if (!maskTex) return;
    maskTex.wrapS = maskTex.wrapT = THREE.RepeatWrapping;
    maskTex.generateMipmaps = false;
    maskTex.minFilter = THREE.LinearFilter;
    maskTex.magFilter = THREE.LinearFilter;
    if (!isVideo) maskTex.repeat.set(repeat[0], repeat[1]);
  }, [maskTex, isVideo, repeat]);

  // --- SHADOW MASK PLANE -----------------------------------------------------
  const colorMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: maskTex || undefined,
      colorWrite: debugMask,  // show mask if debugging; otherwise invisible in color pass
      transparent: true,
      opacity: debugMask ? 0.6 : 1.0,
      alphaTest: threshold,
    });
    m.side = THREE.DoubleSide;
    m.depthWrite = false;
    m.depthTest = true;
    return m;
  }, [maskTex, threshold, debugMask]);

  const depthMat = useMemo(() => {
    const m = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaMap: maskTex || undefined,
      alphaTest: threshold,
    });
    m.side = THREE.DoubleSide;
    m.transparent = true;
    return m;
  }, [maskTex, threshold]);

  useEffect(() => {
    if (!planeRef.current) return;
    planeRef.current.customDepthMaterial = depthMat;
    planeRef.current.customDistanceMaterial = depthMat;
  }, [depthMat]);

  useFrame((_, dt) => {
    if (!maskTex || isVideo) return;
    maskTex.offset.x = (maskTex.offset.x + scroll[0] * dt) % 1;
    maskTex.offset.y = (maskTex.offset.y + scroll[1] * dt) % 1;
  });

  // --- Light / shadow camera -------------------------------------------------
  useEffect(() => {
    if (!lightRef.current || !targetRef.current) return;
    const dl = lightRef.current;
    dl.target = targetRef.current;
    dl.castShadow = true;
    dl.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    const cam = dl.shadow.camera;
    const half = planeSize * 0.5;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 10;
    cam.far = 5000;
    dl.shadow.bias = -0.0002;
    dl.shadow.normalBias = 0.02;
    cam.updateProjectionMatrix();
  }, [planeSize, shadowMapSize]);

  // --- SEAM-FREE VOLUME (TOP FACE ONLY) -------------------------------------
  const volumeRef = useRef();
  const volMat = useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uUseTex: { value: maskTex ? 1.0 : 0.0 },
      uTex: { value: maskTex || null },
      uRepeat: { value: new THREE.Vector2(repeat[0], repeat[1]) },
      uScroll: { value: new THREE.Vector2(scroll[0], scroll[1]) },
      uColor: { value: new THREE.Color(volumeColor) },
      uOpacity: { value: volumeOpacity },
      uIntensity: { value: volumeIntensity },
      uHeight: { value: volumeHeight },
      uSurfaceY: { value: waterY },
    };

    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,           // render INSIDE faces only (we're inside the slab)
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: `
        varying vec3 vWorld;
        varying vec3 vWNormal;
        void main() {
          vec4 w = modelMatrix * vec4(position,1.0);
          vWorld = w.xyz;
          // world normal
          vWNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uUseTex;
        uniform sampler2D uTex;
        uniform vec2 uRepeat;
        uniform vec2 uScroll;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uIntensity;
        uniform float uHeight;
        uniform float uSurfaceY;
        varying vec3 vWorld;
        varying vec3 vWNormal;

        float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

        void main() {
          // Keep only the TOP inside face (normal pointing DOWN in world)
          if (vWNormal.y > -0.5) discard;

          // Project world XZ to UV
          vec2 uv = (vWorld.xz * 0.001) * uRepeat + uScroll * uTime;

          float m;
          if (uUseTex > 0.5) {
            m = texture2D(uTex, uv).r;
          } else {
            // Fallback procedural
            float a = n2(uv*8.0 + uTime*0.1);
            float b = n2(uv*13.0 - uTime*0.07);
            m = 0.5 + 0.5 * sin((uv.x*20.0 + a*5.0) + uTime*0.8);
            m = mix(m, b, 0.35);
          }

          // Sharpen to create filaments
          float beam = smoothstep(0.65, 0.95, m);

          // Depth falloff with stronger fade very near the surface to avoid a bright band
          float topDepth = clamp((uSurfaceY - vWorld.y) / max(1.0, uHeight), 0.0, 1.0);
          float topFade = smoothstep(0.10, 0.35, topDepth); // 0 at surface → 1 a bit deeper
          float depthFade = (1.0 - clamp((vWorld.y - (uSurfaceY - uHeight)) / uHeight, 0.0, 1.0)); // fade near bottom
          float alpha = beam * uOpacity * topFade * depthFade;

          if (alpha <= 0.001) discard;

          vec3 col = uColor * (beam * uIntensity);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    return mat;
  }, [maskTex, repeat, scroll, volumeColor, volumeOpacity, volumeIntensity, volumeHeight, waterY]);

  useFrame((_, dt) => {
    if (volMat) volMat.uniforms.uTime.value += dt;
  });

  return (
    <>
      {/* Sun / directional light */}
      <directionalLight
        ref={lightRef}
        color={lightColor}
        intensity={lightIntensity}
        position={lightPos}
        castShadow
      />
      <object3D ref={targetRef} position={lightTarget} />

      {/* Shadow-only mask plane (just below the water surface) */}
      {castShadows && (
        <mesh
          ref={planeRef}
          position={[0, waterY - 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow={false}
          renderOrder={1}
        >
          <planeGeometry args={[planeSize, planeSize, 1, 1]} />
          <primitive object={colorMat} attach="material" />
        </mesh>
      )}

      {/* Seam-free additive volume slab (only top inside face) */}
      {volumeBeams && (
        <mesh
          ref={volumeRef}
          // Centered so the top face sits exactly at waterY
          position={[0, waterY - volumeHeight * 0.5, 0]}
          renderOrder={2}
        >
          <boxGeometry args={[volumeSize[0], volumeHeight, volumeSize[1], 1, 1, 1]} />
          <primitive object={volMat} attach="material" />
        </mesh>
      )}
    </>
  );
}
