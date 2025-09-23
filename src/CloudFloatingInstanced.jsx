// CloudFloatingInstanced.jsx
import React, { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

function rand(min, max) { return Math.random() * (max - min) + min; }
function randVec2(baseX, baseY, mag = 0.12) {
  return [baseX + rand(-mag, mag), baseY + rand(-mag, mag)];
}

export default function CloudFloatingInstanced({
  position = [0, 8, 0],
  color1 = "#d6c2d9",
  color2 = "#0c00b3",
  opacity = 0.20,
  speed = 0.9,
  numPlanes = 100,
  xSpread = 700,
  ySpread = 70,
  zSpread = 150,
  baseScale = 100,
  debug = false,
  sharedNoise = { dir: [-1.0, 0.22] },
  perLayerWindVariance = 0.22
}) {
  const instRef = useRef();
  const geomRef = useRef();
  const depthRTRef = useRef(null);

  const { gl, scene, camera, size } = useThree();

  // 1) build per-instance metadata
  const layers = useMemo(() => Array.from({ length: numPlanes }).map((_, i) => {
    const t = numPlanes > 1 ? i / (numPlanes - 1) : 0.0;
    const x = rand(-1, 1);
    const yBell = 1.0 - x * x;
    const peak = Math.sin(Math.PI * (1.0 - t));

    const xSpreadCur = xSpread * (0.7 + 0.3 * yBell) * (1.0 - t * 0.72);
    const zSpreadCur = zSpread * (0.45 + 0.55 * t);

    const dir = randVec2(sharedNoise.dir[0], sharedNoise.dir[1], perLayerWindVariance);

    return {
      key: i,
      pos: new THREE.Vector3(
        x * xSpreadCur,
        ySpread * (0.25 + 0.75 * yBell) * peak + rand(-0.8, 0.8),
        rand(-zSpreadCur, zSpreadCur)
      ),
      scale: new THREE.Vector3(
        baseScale * (1.05 - t * 0.68) * rand(0.86, 1.12) * (0.85 + 0.35 * yBell),
        baseScale * (0.65 + t * 1.05) * rand(0.88, 1.08) * (0.6 + 0.6 * yBell),
        1
      ),
      rotZ: rand(-0.08, 0.08),
      instOpacity: opacity * (1.0 - t * t) * (0.85 + 0.2 * yBell) * rand(0.92, 1.05),
      speed: speed * rand(0.82, 1.12),
      seed: Math.random() * 1000,
      dir,
      isHard: (Math.random() < 0.05 ? 1.0 : 0.0) // ~5% random hard-edge planes
    };
  }), [numPlanes, xSpread, ySpread, zSpread, baseScale, opacity, speed, sharedNoise.dir, perLayerWindVariance]);

  // 2) create depth render target once (with depthTexture)
  useEffect(() => {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.width), Math.max(1, size.height), {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
    });
    const depthTexture = new THREE.DepthTexture();
    depthTexture.type = THREE.UnsignedShortType;
    depthTexture.format = THREE.DepthFormat;
    rt.depthTexture = depthTexture;
    depthRTRef.current = { rt, depthTexture };

    return () => {
      if (rt) rt.dispose();
      if (depthTexture && depthTexture.dispose) depthTexture.dispose();
    };
  }, [size.width, size.height]);

  // 3) build shared instanced geometry (plane) once
  const planeGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(6, 4, 8, 8);
    geomRef.current = g;
    return g;
  }, []);

  // 4) shader strings
  const vertexShader = `
    precision highp float;

attribute float aSeed;
attribute float aSpeed;
attribute vec2 aDir;
attribute float aIsHard;
attribute float aInstOpacity;

varying vec2 vUv;
varying float vSeed;
varying float vSpeed;
varying vec2 vDir;
varying float vIsHard;
varying float vInstOpacity;
varying vec4 vViewPos; // view-space position

void main(){
  vUv = uv;
  vSeed = aSeed;
  vSpeed = aSpeed;
  vDir = aDir;
  vIsHard = aIsHard;
  vInstOpacity = aInstOpacity;

  // instanceMatrix * position => local->world for this instance
  vec4 worldPos = instanceMatrix * vec4(position, 1.0);

  // modelViewMatrix * worldPos => view-space
  vViewPos = modelViewMatrix * worldPos;

  // standard projection
  gl_Position = projectionMatrix * vViewPos;
}

  `;

  const fragmentShader = `
   precision highp float;

varying vec2 vUv;
varying float vSeed;
varying float vSpeed;
varying vec2 vDir;
varying float vIsHard;
varying float vInstOpacity;
varying vec4 vWorldPos;

uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uOpacity;

uniform sampler2D uDepthTex;
uniform vec2 uResolution;
uniform float cameraNear;
uniform float cameraFar;

// hash + noise
float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123 + vSeed*0.0001); }

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0,0.0));
  float c = hash12(i + vec2(0.0,1.0));
  float d = hash12(i + vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

float fbm3(vec2 p){
  float v = 0.0;
  float a = 0.6;
  v += a * noise(p); p *= 2.0; a *= 0.5;
  v += a * noise(p); p *= 2.0; a *= 0.5;
  v += a * noise(p);
  return v;
}

float linearizeDepth(float z) {
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - (2.0*z-1.0)*(cameraFar - cameraNear));
}

void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float dist = length(uv);

  vec2 jitter = (vec2(hash12(vUv + 0.12), hash12(vUv + 0.44)) - 0.5) * 0.12;
  vec2 dirN = normalize(vDir + vec2(1e-6, 0.0));
  vec2 drift = dirN * (uTime * 0.02 * vSpeed);

  float body = fbm3((uv + jitter) * 4.0 + drift);
  float edge = fbm3((uv + jitter*0.6) * 10.0 + drift*0.4);
  float fine = fbm3((uv + jitter*0.9) * 8.0 + drift*0.9);

  float blob_lo = mix(0.9, 0.7, vIsHard);
  float blob_hi = mix(0.22, 0.25, vIsHard);
  float fe_lo   = mix(0.42, 0.55, vIsHard);
  float fe_hi   = mix(1.02, 0.95, vIsHard);

  float blob = smoothstep(blob_lo, blob_hi, dist - body * 0.22);
  float feather = smoothstep(fe_lo, fe_hi, dist + edge * 0.28);

  float alphaRaw = clamp(blob * (1.0 - feather) * uOpacity * vInstOpacity, 0.0, 1.0);
  if(alphaRaw < 0.005) discard;

  // depth compare using gl_FragCoord
  vec2 screenUV = gl_FragCoord.xy / uResolution;
  float sceneLin = linearizeDepth(texture2D(uDepthTex, screenUV).r);
  float fragLin  = linearizeDepth(gl_FragCoord.z);

  float dDepth = sceneLin - fragLin;
  float softRange = 0.1;
  float depthFade = clamp(dDepth / softRange, 0.0, 1.0);
  if(dDepth < -0.001) discard;

  float alpha = alphaRaw * depthFade;
  if(alpha < 0.003) discard;

  float gradMix = clamp(vUv.y + body * 0.12 + fine * 0.02, 0.0, 1.0);
  vec3 col = mix(uColor1, uColor2, gradMix);
  float rim = pow(clamp(1.0 - dist + edge * 0.2, 0.0, 1.0), 1.8);
  col += 0.03 * rim;

  gl_FragColor = vec4(col, alpha);
}

  ` 

  // 5) material (shared)
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0.0 },
        uColor1: { value: new THREE.Color(color1) },
        uColor2: { value: new THREE.Color(color2) },
        uOpacity: { value: opacity },
        uDepthTex: { value: null },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far }
      }
    });
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertexShader, fragmentShader]);

  // 6) prepare instanced attributes & matrix (after geom + instRef exist)
  useEffect(() => {
    if (!geomRef.current) return;
    // ensure instRef exists later in next tick
    setTimeout(() => {
      if (!instRef.current) return;
      const instCount = layers.length;

      const seeds = new Float32Array(instCount);
      const speeds = new Float32Array(instCount);
      const dirs = new Float32Array(instCount * 2);
      const isHards = new Float32Array(instCount);
      const instOpac = new Float32Array(instCount);

      for (let i = 0; i < instCount; i++) {
        seeds[i] = layers[i].seed;
        speeds[i] = layers[i].speed;
        dirs[i * 2 + 0] = layers[i].dir[0];
        dirs[i * 2 + 1] = layers[i].dir[1];
        isHards[i] = layers[i].isHard;
        instOpac[i] = layers[i].instOpacity;
      }

      geomRef.current.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
      geomRef.current.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
      geomRef.current.setAttribute("aDir", new THREE.InstancedBufferAttribute(dirs, 2));
      geomRef.current.setAttribute("aIsHard", new THREE.InstancedBufferAttribute(isHards, 1));
      geomRef.current.setAttribute("aInstOpacity", new THREE.InstancedBufferAttribute(instOpac, 1));

      const dummy = new THREE.Object3D();
      for (let i = 0; i < instCount; i++) {
        const L = layers[i];
        dummy.position.copy(L.pos);
        dummy.scale.copy(L.scale);
        dummy.rotation.set(0, 0, L.rotZ);
        dummy.updateMatrix();
        instRef.current.setMatrixAt(i, dummy.matrix);
      }
      instRef.current.instanceMatrix.needsUpdate = true;
      // set instanced mesh on layer 1
      instRef.current.layers.set(1);

      // ensure camera will also render layer 1 in the main pass
      camera.layers.enable(1);

      // if depthRT already created, set uniform once
      if (depthRTRef.current && instRef.current.material) {
        instRef.current.material.uniforms.uDepthTex.value = depthRTRef.current.depthTexture;
      }
    }, 0);
  }, [layers]);

  // 7) update uniforms each frame + depth pass
  useFrame(({ clock }) => {
    if (instRef.current && instRef.current.material) {
      instRef.current.material.uniforms.uTime.value = clock.getElapsedTime();
      instRef.current.material.uniforms.uResolution.value.set(size.width, size.height);
      instRef.current.material.uniforms.cameraNear.value = camera.near;
      instRef.current.material.uniforms.cameraFar.value = camera.far;
    }

    const dr = depthRTRef.current;
    if (!dr) return;

    // render scene into depthRT but exclude clouds:
    const prevRT = gl.getRenderTarget();
    const prevAuto = gl.autoClear;
    const prevMask = camera.layers.mask;

    // render only layer 0 (non-cloud objects)
    camera.layers.set(0);
    gl.autoClear = true;
    gl.setRenderTarget(dr.rt);
    gl.clear();
    gl.render(scene, camera);

    // restore
    gl.setRenderTarget(prevRT);
    gl.autoClear = prevAuto;
    camera.layers.mask = prevMask;

    // bind depth texture to material
    if (instRef.current && instRef.current.material) {
      instRef.current.material.uniforms.uDepthTex.value = dr.depthTexture;
    }
  }, 0);

  // 8) update color/opacity when props change
  useEffect(() => {
    if (!instRef.current || !instRef.current.material) return;
    const m = instRef.current.material;
    if (m.uniforms.uColor1) m.uniforms.uColor1.value.set(color1);
    if (m.uniforms.uColor2) m.uniforms.uColor2.value.set(color2);
    if (m.uniforms.uOpacity) m.uniforms.uOpacity.value = opacity;
  }, [color1, color2, opacity]);

  return (
    <group position={position}>
      <instancedMesh ref={instRef} args={[planeGeometry, material, numPlanes]} />
    </group>
  );
}
 