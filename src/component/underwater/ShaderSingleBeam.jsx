// ShaderSingleBeam.jsx — vertical ray bundle with transparent end fade (no visible cut)
import * as THREE from 'three'
import React, { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

const vert = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const frag = /* glsl */`
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec3  uColor;
  uniform float uIntensity;

  uniform float uAngle;

  // soft wedge across X (fan-like gate)
  uniform float uUseWedge;
  uniform float uBand;
  uniform float uFeather;

  // vertical beam cluster (thin X, tall Y)
  uniform float uPieceCount;
  uniform float uWidthFracMin;
  uniform float uWidthFracMax;
  uniform float uStripHeight;
  uniform float uLaneJitterY;
  uniform float uOverlapChance;
  uniform float uClusterSpreadX;
  uniform float uDriftAmpMin;
  uniform float uDriftAmpMax;
  uniform float uDriftHzMin;
  uniform float uDriftHzMax;
  uniform float uPieceFeatherX;
  uniform float uPieceFeatherY;
  uniform float uSeed;

  // circular aperture
  uniform vec2  uCircleCenter;
  uniform float uCircleRadius;
  uniform float uCircleFeather;

  // color/alpha across width
  uniform vec3  uColorCenter;
  uniform vec3  uColorEdge;
  uniform float uAlphaXPower;
  uniform float uXColorBias;

  // horizontal color ripple (no vertical animation)
  uniform float uHColorFreq;
  uniform float uHColorSpeed;
  uniform float uHColorAmp;

  // optional micro shimmer
  uniform float uShimmerAmp;
  uniform float uShimmerScale;
  uniform float uShimmerSpeed;

  // NEW: vertical end-fade (prevents visible top/bottom cuts)
  uniform float uEndFeatherTop;    // UV units near +Y edge (top)
  uniform float uEndFeatherBottom; // UV units near -Y edge (bottom)
  uniform float uEndPower;         // shaping exponent for the end fade

  #define MAX_PIECES 32
  const float TAU = 6.28318530718;

  vec2 rot2(vec2 p, float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*p; }
  float hash11(float x){ return fract(sin(x)*43758.5453123); }

  float softRect(vec2 uv, vec2 c, vec2 h, vec2 f){
    vec2 d = abs(uv - c) - h;
    vec2 m = 1.0 - smoothstep(vec2(0.0), f, d);
    return clamp(min(m.x, m.y), 0.0, 1.0);
  }

  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=fract(sin(dot(i, vec2(127.1,311.7)))*43758.5453);
    float b=fract(sin(dot(i+vec2(1.,0.), vec2(127.1,311.7)))*43758.5453);
    float c=fract(sin(dot(i+vec2(0.,1.), vec2(127.1,311.7)))*43758.5453);
    float d=fract(sin(dot(i+vec2(1.,1.), vec2(127.1,311.7)))*43758.5453);
    vec2 u=f*f*(3.-2.*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){ float v=0., a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.02; a*=0.5; } return v; }

  void main(){
    // Centered UV: [-0.5, +0.5] both axes
    vec2 uv0 = vUv - 0.5;
    vec2 uv  = rot2(uv0, uAngle);

    // Circular aperture (soft disk)
    float d = length(uv - uCircleCenter);
    float circleMask = smoothstep(uCircleRadius + uCircleFeather, uCircleRadius, d);

    // Optional wedge gate across X
    float wedge = 1.0;
    if (uUseWedge > 0.5){
      float halfBand = max(1e-4, 0.5 * uBand);
      float A = smoothstep(-halfBand - uFeather, -halfBand, uv.x);
      float B = smoothstep( halfBand + uFeather,  halfBand,  uv.x);
      wedge = A * B;
    }

    // Horizontal center emphasis (alpha across X)
    float span = max(1e-4, (uBand * 0.5) + uFeather);
    float xNorm = clamp(0.5 + (uv.x/(2.0*span)) + (uXColorBias - 0.5), 0.0, 1.0);
    float centerWeight = clamp(1.0 - abs(uv.x)/span, 0.0, 1.0);
    float alphaAcross  = pow(centerWeight, max(0.001, uAlphaXPower));

    // Base color across X
    vec3  colStatic = mix(uColorEdge, uColorCenter, xNorm);

    // Horizontal tint ripple (no vertical motion)
    float hPhase = TAU * (uHColorFreq * uv.x + uHColorSpeed * uTime + (uSeed*0.017));
    float hWave  = 0.5 + 0.5 * cos(hPhase);
    vec3  colWave = mix(uColorEdge, uColorCenter, hWave);
    vec3  colX    = mix(colStatic, colWave, clamp(uHColorAmp, 0.0, 1.0));

    // Build vertical beam cluster
    float Nf = clamp(uPieceCount, 1.0, float(MAX_PIECES));
    float piecesMax = 0.0;   // union mask
    float piecesSum = 0.0;   // density for darkening

    for (int i=0; i<MAX_PIECES; i++){
      if (float(i) >= Nf) break;
      float si = float(i) + uSeed * 19.73;

      // Tight X bundle + tiny wobble
      float cxBase = (hash11(si*2.3)-0.5) * uClusterSpreadX;
      float ax = mix(uDriftAmpMin, uDriftAmpMax, hash11(si*3.7));
      float hz = mix(uDriftHzMin,  uDriftHzMax,  hash11(si*4.9));
      float ph = hash11(si*6.1) * TAU;
      float cx = cxBase + ax * sin(TAU*hz*uTime + ph);

      // Slight Y jitter + occasional overlap nudge
      float ov  = step(hash11(si*7.7), uOverlapChance);
      float cy  = (hash11(si*8.3)-0.5) * 0.02
                + (ov * (hash11(si*9.1)-0.5) * 0.06)
                + (uLaneJitterY * (hash11(si*10.7)-0.5));

      float wFrac = mix(uWidthFracMin, uWidthFracMax, hash11(si*11.9));
      float hx = max(0.0005, 0.5 * wFrac);         // thin in X
      float hy = max(0.0005, uStripHeight);        // tall in Y

      float m = softRect(uv, vec2(cx, cy), vec2(hx, hy),
                         vec2(uPieceFeatherX, uPieceFeatherY));
      piecesMax = max(piecesMax, m);
      piecesSum += m;
    }

    // Optional micro shimmer
    float edgeW   = clamp(piecesMax*(1.0-piecesMax)*4.0, 0.0, 1.0);
    float shimmer = 1.0 + (fbm(uv * uShimmerScale + vec2(0.0, uTime * uShimmerSpeed * 0.16)) - 0.5)
                          * 0.6 * uShimmerAmp * edgeW;

    // Overlap darkening
    float density = clamp(piecesSum * (1.0 / max(1.0, Nf*0.6)), 0.0, 1.0);
    vec3  colDark = mix(colX, colX * 0.6, density);

    // NEW: vertical end-fade mask (smoothly hides top/bottom cuts)
    // uv.y is in [-0.5, +0.5] after centering; edges are at ±0.5
    float maskTop    = smoothstep(0.0, uEndFeatherTop,    0.5 - uv.y);
    float maskBottom = smoothstep(0.0, uEndFeatherBottom, uv.y + 0.5);
    float endMask    = pow(maskTop * maskBottom, max(0.001, uEndPower));

    // Final brightness & color
    float brightness = wedge * piecesMax * circleMask * alphaAcross * shimmer * endMask;
    brightness *= (1.0 - 0.35 * density);

    vec3 col = mix(colDark, uColor, 0.12);
    gl_FragColor = vec4(col * (brightness * uIntensity), brightness);
  }
`;

const SingleBeamMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#7b2aa4'),
    uIntensity: 0.32,

    uAngle: 0.0,

    // wedge across X
    uUseWedge: 1.0,
    uBand: 0.70,
    uFeather: 0.12,

    // cluster / beams
    uPieceCount: 32.0,
    uWidthFracMin: 0.010,
    uWidthFracMax: 0.020,
    uStripHeight: 0.48,
    uLaneJitterY: 0.01,
    uOverlapChance: 0.65,
    uClusterSpreadX: 0.20,
    uDriftAmpMin: 0.004,
    uDriftAmpMax: 0.012,
    uDriftHzMin: 0.25,
    uDriftHzMax: 0.70,
    uPieceFeatherX: 0.010,
    uPieceFeatherY: 0.020,
    uSeed: 0.0,

    // aperture
    uCircleCenter: new THREE.Vector2(0.0, 0.0),
    uCircleRadius: 0.52,
    uCircleFeather: 0.10,

    // color/alpha across X
    uColorCenter: new THREE.Color('#a25be5'),
    uColorEdge:   new THREE.Color('#301046'),
    uAlphaXPower: 1.6,
    uXColorBias:  0.5,

    // horizontal color ripple
    uHColorFreq: 1.20,
    uHColorSpeed: 0.24,
    uHColorAmp: 0.60,

    // shimmer (off by default)
    uShimmerAmp: 0.0,
    uShimmerScale: 6.3,
    uShimmerSpeed: 2*Math.PI*8.0,

    // NEW: end-fade defaults (gentle 12% of half-height)
    uEndFeatherTop: 0.12,
    uEndFeatherBottom: 0.12,
    uEndPower: 1.0,
  },
  vert, frag
)

extend({ SingleBeamMaterial })

export default function ShaderSingleBeam({
  // plane size in world units
  size = [220, 120],
  slices = 15,
  gap = 3,

  // base color & energy
  color = '#7b2aa4',
  intensity = 0.22,

  // time scale (global animation speed)
  timeScale = 0.5,

  // orientation & layout
  angleDeg = 0,
  ringRadius = 0,
  faceCenter = true,

  // cluster props
  pieceCount = 15,
  pieceWidthMin = 24,
  pieceWidthMax = 24,
  stripHeightUV = 0.48,
  laneJitterYUV = 0.01,
  overlapChance = 0.85,
  clusterSpreadXUV = 0.20,
  driftAmpX = [0.004, 0.012],
  driftHz = [0.25, 0.70],
  pieceFeatherXUV = 0.010,
  pieceFeatherYUV = 0.020,

  // aperture
  circleCenterUV = [0, 0],
  circleRadiusUV = 0.52,
  circleFeatherUV = 0.10,

  // color/alpha across width
  colorCenter = '#a25be5',
  colorEdge   = '#301046',
  alphaXPower = 1.0,
  xColorBias  = 0.5,

  // horizontal color ripple
  hColorFreq = 1.20,
  hColorSpeed = 0.24,
  hColorAmp = 0.60,

  // wedge toggle
  useWedge = true,

  // NEW: end-fade props (UV units)
  endFeatherTopUV = 0.12,
  endFeatherBottomUV = 0.52,
  endPower = 1.8,

  // multi-instance decorrelation
  seedOffset = 0,
  renderOrderBase = 5,

  // optional shimmer controls
  shimmerAmp, shimmerHz, shimmerScale,

  ...props
}) {
  const mats = useMemo(() => Array.from({ length: slices }, () => React.createRef()), [slices])

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * timeScale
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i].current
      if (!m) continue

      m.uTime = t
      m.uColor = new THREE.Color(color)
      m.uIntensity = intensity
      m.uAngle = THREE.MathUtils.degToRad(angleDeg)

      // cluster mapping: world width → UV fraction
      m.uSeed = seedOffset + i * 1.2345
      m.uPieceCount = pieceCount
      m.uWidthFracMin = Math.max(0.0005, pieceWidthMin / size[0])
      m.uWidthFracMax = Math.max(0.0006, pieceWidthMax / size[0])
      m.uStripHeight  = stripHeightUV
      m.uLaneJitterY  = laneJitterYUV
      m.uOverlapChance = overlapChance
      m.uClusterSpreadX = clusterSpreadXUV
      m.uDriftAmpMin = driftAmpX[0]
      m.uDriftAmpMax = driftAmpX[1]
      m.uDriftHzMin  = driftHz[0]
      m.uDriftHzMax  = driftHz[1]
      m.uPieceFeatherX = pieceFeatherXUV
      m.uPieceFeatherY = pieceFeatherYUV

      // aperture
      m.uCircleCenter.set(circleCenterUV[0], circleCenterUV[1])
      m.uCircleRadius  = circleRadiusUV
      m.uCircleFeather = circleFeatherUV

      // color/alpha across X
      m.uColorCenter.set(colorCenter)
      m.uColorEdge.set(colorEdge)
      m.uAlphaXPower = alphaXPower
      m.uXColorBias  = xColorBias

      // horizontal color ripple
      m.uHColorFreq  = hColorFreq
      m.uHColorSpeed = hColorSpeed
      m.uHColorAmp   = hColorAmp

      // wedge toggle
      m.uUseWedge = useWedge ? 1.0 : 0.0

      // shimmer (optional)
      if (shimmerAmp   !== undefined) m.uShimmerAmp   = shimmerAmp
      if (shimmerScale !== undefined) m.uShimmerScale = shimmerScale
      if (shimmerHz    !== undefined) m.uShimmerSpeed = 2*Math.PI*shimmerHz

      // NEW: end-fade wiring
      m.uEndFeatherTop = endFeatherTopUV
      m.uEndFeatherBottom = endFeatherBottomUV
      m.uEndPower = endPower
    }
  })

  const ringPositions = React.useMemo(() => {
    if (!ringRadius || ringRadius <= 0) return null
    const arr = []
    for (let i = 0; i < slices; i++) {
      const th = (i / slices) * Math.PI * 2
      arr.push([Math.cos(th) * ringRadius, 0, Math.sin(th) * ringRadius])
    }
    return arr
  }, [ringRadius, slices])
 
  return (
    <group {...props}>
      {Array.from({ length: slices }).map((_, i) => {
        const pos = ringPositions ? ringPositions[i] : [0, 0, -(i - (slices - 1) * 0.5) * gap]
        const rot = ringPositions && faceCenter
          ? [0, Math.atan2(-pos[0], -pos[2]), 0]
          : [0, 0, 0]
        return (
          <mesh key={i} position={pos} rotation={rot} frustumCulled={false} renderOrder={renderOrderBase}>
            <planeGeometry args={[size[0], size[1], 1, 1]} />
            <singleBeamMaterial
              ref={mats[i]}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
             toneMapped={false}
            />
          </mesh>  
        )
      })}
    </group>
  )
}
