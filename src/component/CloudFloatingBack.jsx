// CloudMountainSelfContained.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function rand(min, max) { return Math.random() * (max - min) + min }
function randVec2(baseX, baseY, mag = 0.12) {
  return [baseX + rand(-mag, mag), baseY + rand(-mag, mag)]
} 
      
export default function CloudFloatingBack({
  position = [0, 8, 0], 
  color1 = '#ffffff',
  color2 = '#0c00b3',
  opacity = 0.02,
  speed = 0.9,
  numPlanes = 100,
  xSpread = 500,
  ySpread = 150, 
  zSpread = 100,
  baseScale = 100,
  debug = false,
  // base wind direction — positive x = left->right, y = slight up
  sharedNoise = { dir: [1.0, 0.22] },
  // how much each plane deviates from base wind
  perLayerWindVariance = 0.22
}) {
  // Create per-plane configs (now each has its own dir & localSpeed)
  const layers = useMemo(() => Array.from({ length: numPlanes }).map((_, i) => {
    const t = numPlanes > 1 ? i / (numPlanes - 1) : 0.0
    const x = rand(-1, 1)
    const yBell = 1.0 - x * x
    const peak = Math.sin(Math.PI * (1.0 - t))

    const xSpreadCur = xSpread * (0.7 + 0.3 * yBell) * (1.0 - t * 0.72)
    const zSpreadCur = zSpread * (0.45 + 0.55 * t)

    // individual wind direction for this layer (small randomized deviate)
    const dir = randVec2(sharedNoise.dir[0], sharedNoise.dir[1], perLayerWindVariance)

    return {
      key: i,
      position: [
        x * xSpreadCur,
        ySpread * (0.25 + 0.75 * yBell) * peak + rand(-0.8, 0.8),
        rand(-zSpreadCur, zSpreadCur)
      ],
      scale: [
        baseScale * (1.05 - t * 0.68) * rand(0.86, 1.12) * (0.85 + 0.35 * yBell),
        baseScale * (0.65 + t * 1.05) * rand(0.88, 1.08) * (0.6 + 0.6 * yBell),
        1
      ],
      rotation: [0, 0, rand(-0.08, 0.08)],
      opacity: opacity * (1.0 - t * t) * (0.85 + 0.2 * yBell) * rand(0.92, 1.05),
      speed: speed * rand(0.82, 1.12),
      seed: Math.random() * 1000,
      dir // per-layer wind dir
    }
  }), [numPlanes, xSpread, ySpread, zSpread, baseScale, opacity, speed, sharedNoise.dir, perLayerWindVariance])

  // Refs
  const meshRefs = useRef([])
  const matRefs = useRef([])

  useEffect(() => {
    meshRefs.current = []
    matRefs.current = []
  }, [numPlanes])

  const { camera } = useThree()
  const tmpVec = useRef(new THREE.Vector3())

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // Update uniforms on each material
    for (let i = 0; i < matRefs.current.length; i++) {
      const m = matRefs.current[i]
      if (!m) continue
      if (m.uniforms) {
        if (m.uniforms.uTime) m.uniforms.uTime.value = t
        if (m.uniforms.uSeed) m.uniforms.uSeed.value = layers[i]?.seed ?? 0.0
        if (m.uniforms.uSpeed) m.uniforms.uSpeed.value = layers[i]?.speed ?? 1.0
        // pass the per-layer dir
        if (m.uniforms.uDir) {
          const d = m.uniforms.uDir.value
          if (d && typeof d.set === 'function') {
            d.set(layers[i].dir[0], layers[i].dir[1])
          } else {
            m.uniforms.uDir.value = new THREE.Vector2(layers[i].dir[0], layers[i].dir[1])
          }
        }
      }
    }

    // No renderOrder forcing: let depthTest handle occlusion with other objects
    // (we still may sort for internal metrics if needed)
    if (debug && clock.elapsedTime % 2 < 0.016) {
      // debug: check a few first layer dirs + speeds
      const sample = layers.slice(0, Math.min(6, layers.length)).map((L, idx) =>
        `#${idx} dir(${L.dir[0].toFixed(2)},${L.dir[1].toFixed(2)}) spd=${L.speed.toFixed(2)}`
      ).join(' | ')
      console.log('CloudLayer samples:', sample)
    }

    // (Optional) If you'd still like to occasionally resort internal distance, you can uncomment:
    // const arr = []
    // for (let i = 0; i < meshRefs.current.length; i++) {
    //   const mesh = meshRefs.current[i]
    //   if (!mesh) continue
    //   mesh.getWorldPosition(tmpVec.current)
    //   const d = camera.position.distanceTo(tmpVec.current)
    //   arr.push({ i, mesh, d })
    // }
    // arr.sort((a,b)=>b.d - a.d)
    // for (let r=0; r<arr.length; r++) { if (arr[r].mesh) arr[r].mesh.renderOrder = r } // <-- but this forces top behavior, so left commented
  })

  return (
    <group position={position}>
      {layers.map((cfg, idx) => (
        <mesh
          key={cfg.key}
          ref={el => meshRefs.current[idx] = el}
          position={cfg.position}
          scale={cfg.scale}
          rotation={cfg.rotation}
        >
          <planeGeometry args={[6, 4, 32, 32]} />
          <shaderMaterial
            ref={m => { matRefs.current[idx] = m }}
            blending={THREE.NormalBlending}
            transparent={true}
            // Allow depth testing so other geometry can occlude clouds
            depthWrite={false}
            depthTest={true}
            side={THREE.DoubleSide}
            alphaTest={0.005}
            premultipliedAlpha={false}
            uniforms={{
              uTime: { value: 0.0 },
              uColor1: { value: new THREE.Color(color1) },
              uColor2: { value: new THREE.Color(color2) },
              uOpacity: { value: cfg.opacity },
              uSpeed: { value: cfg.speed },
              uSeed: { value: cfg.seed },
              // start with per-layer dir
              uDir: { value: new THREE.Vector2(cfg.dir[0], cfg.dir[1]) }
            }}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
          />
        </mesh>
      ))}
    </group>
  )
}

// Vertex + Fragment shaders (kept inline)
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uOpacity;
uniform float uSpeed;
uniform float uSeed;
uniform vec2 uDir;

// ---- noise helpers ----
float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453123);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = random(i);
  float b = random(i+vec2(1.0,0.0));
  float c = random(i+vec2(0.0,1.0));
  float d = random(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// ---- Main ----
void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float dist = length(uv);

  // Ensure positive-x main flow by adding tiny epsilon before normalize
  vec2 dirNorm = normalize(uDir + vec2(1e-6, 0.0));

  float time = uTime;
  // MAIN DRIFT: monotonic (never reverses) — moves along dirNorm
  float driftSpeedScalar = 0.595;
  vec2 mainDrift = dirNorm * (time * driftSpeedScalar * uSpeed);

  // PERPENDICULAR WOBBLE for local flutter (doesn't reverse main drift)
  float wobbleFreq = 0.6;
  float wobbleMag = 0.18;
  vec2 perp = vec2(-dirNorm.y, dirNorm.x);
  vec2 perpWobble = perp * (sin(time * wobbleFreq * uSpeed) * wobbleMag);

  vec2 offset = mainDrift + perpWobble;

  float body = fbm(uv * 6.0 + offset + uSeed * 0.058);
  float edge = fbm(uv * 12.0 + offset * 0.2 + uSeed * 0.0013);

  float blob = smoothstep(0.85, 0.2, dist - body * 0.25);
  float feather = smoothstep(0.4, 1.0, dist + edge * 0.35);

  float alpha = blob * (1.0 - feather) * uOpacity;
  alpha = max(alpha, 0.0005);

  float edgeFade = smoothstep(1.95, 0.4, length(uv));
  alpha *= edgeFade;

  vec3 baseCol = mix(uColor1, uColor2, vUv.y + body * 0.15);

  gl_FragColor = vec4(baseCol, alpha);
}
`
