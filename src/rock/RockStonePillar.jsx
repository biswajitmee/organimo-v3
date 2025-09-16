// RockStonePillar.jsx
import * as THREE from 'three'
import React, { useMemo, useRef } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'

/* ---------- GLSL helpers ---------- */
const NOISE = /* glsl */`
  vec3 hash3(vec3 p){
    p = vec3(
      dot(p, vec3(127.1,311.7, 74.7)),
      dot(p, vec3(269.5,183.3,246.1)),
      dot(p, vec3(113.5,271.9,124.6))
    );
    return -1. + 2.*fract(sin(p)*43758.5453123);
  }
  float vnoise(vec3 p){
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f*f*(3. - 2.*f);

    float n000 = dot(hash3(i+vec3(0,0,0)), f-vec3(0,0,0));
    float n100 = dot(hash3(i+vec3(1,0,0)), f-vec3(1,0,0));
    float n010 = dot(hash3(i+vec3(0,1,0)), f-vec3(0,1,0));
    float n110 = dot(hash3(i+vec3(1,1,0)), f-vec3(1,1,0));
    float n001 = dot(hash3(i+vec3(0,0,1)), f-vec3(0,0,1));
    float n101 = dot(hash3(i+vec3(1,0,1)), f-vec3(1,0,1));
    float n011 = dot(hash3(i+vec3(0,1,1)), f-vec3(0,1,1));
    float n111 = dot(hash3(i+vec3(1,1,1)), f-vec3(1,1,1));

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);
    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);
    return mix(nxy0, nxy1, u.z);
  }
  float fbm(vec3 p){
    float a=0.5,f=0.0;
    for(int i=0;i<5;i++){ f += a*vnoise(p); p*=2.0; a*=0.55; }
    return f;
  }
  float ridge(vec3 p){
    float r=0.,amp=0.8;
    for(int i=0;i<5;i++){
      float n = abs(vnoise(p));
      r += (1.0-n)*amp; p*=2.0; amp*=0.55;
    }
    return r;
  }
`;

/* ---------- Vertex ---------- */
const vert = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uNoiseScale;
  uniform float uDisplace;
  uniform float uRidgeMix;
  uniform float uLumpiness;

  uniform float uStretchY;     // elongate along Y (silhouette)
  uniform float uTaper;        // 0..1 taper near ends
  uniform float uStriation;    // vertical band strength
  uniform float uStriationFreq;

  uniform vec3  uCarvePos1;
  uniform float uCarveR1;
  uniform float uCarveDepth1;

  uniform vec3  uCarvePos2;
  uniform float uCarveR2;
  uniform float uCarveDepth2;

  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying float vMask;
  varying float vY;

  ${NOISE}

  float smin(float a, float b, float k){
    float h = clamp(0.5 + 0.5*(b-a)/k, 0., 1.);
    return mix(b, a, h) - k*h*(1.0-h);
  }

  void main(){
    // pre-stretch the geometry on Y
    vec3 pos = position;
    pos.y *= uStretchY;

    vec3 nrm = normalize(normal);

    // sample domain WITHOUT geometric stretch (keeps detail un-stretched)
    vec3 domainP = normalize(position) * uNoiseScale;

    float low = fbm(normalize(position)*0.8 + uTime*0.03) * uLumpiness;
    float f = fbm(domainP);
    float r = ridge(domainP*1.25);
    float h = mix(f, r, uRidgeMix);

    // vertical striations
    float bands = sin(position.y * uStriationFreq) * 0.5 + 0.5;
    h += uStriation * (bands - 0.5);

    // taper near ends
    float yN = clamp(abs(pos.y)/(uStretchY*1.0), 0.0, 1.0);
    float taper = 1.0 - uTaper * smoothstep(0.75, 1.0, yN);

    // base displacement
    float disp = (h*0.8 + low*0.2) * uDisplace;
    vec3 displaced = pos + nrm * (disp * taper);

    // soft cavities
    float d1 = length(displaced - uCarvePos1) - uCarveR1;
    float d2 = length(displaced - uCarvePos2) - uCarveR2;
    float d  = smin(d1, d2, 0.5);
    float carve = smoothstep(0.0, 0.6, -d); // inside→1
    displaced -= nrm * (carve * (uCarveDepth1 + uCarveDepth2) * 0.5);

    vec3 worldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
    vec3 worldNormal = normalize(mat3(modelMatrix) * nrm);

    vWorldPos = worldPos;
    vNormalW  = worldNormal;
    vMask     = h;
    vY        = displaced.y;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

/* ---------- Fragment (fixed 'varying' typo) ---------- */
const frag = /* glsl */`
  precision highp float;

  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uAO;
  uniform vec3  uLightDir;
  uniform float uSpecPower;
  uniform float uSpecInt;

  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying float vMask;
  varying float vY;

  void main(){
    vec3 N = normalize(vNormalW);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), uSpecPower) * uSpecInt;

    float veins = smoothstep(0.35, 0.9, vMask);
    vec3 albedo = mix(uColorA, uColorB, veins);

    float vDark = smoothstep(0.0, 1.0, clamp((vY+0.6)/1.6, 0.0, 1.0));
    albedo *= mix(0.9, 1.05, vDark);

    float ao = mix(1.0, 1.0 - uAO, smoothstep(0.2, 0.8, vMask));
    vec3 color = albedo * (0.15 + 0.85*diff) * ao + spec;

    color = pow(color, vec3(1.0/2.2));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const RockPillarMat = shaderMaterial(
  {
    uTime: 0,
    uNoiseScale: 2.0,
    uDisplace: 0.75,
    uRidgeMix: 0.7,
    uLumpiness: 0.25,

    uStretchY: 10.0,
    uTaper: 0.35,
    uStriation: 0.16,
    uStriationFreq: 7.0,

    uCarvePos1: new THREE.Vector3(0.08, 0.85, 0.02),
    uCarveR1: 0.28,
    uCarveDepth1: 0.38,

    uCarvePos2: new THREE.Vector3(-0.12, 0.25, -0.04),
    uCarveR2: 0.22,
    uCarveDepth2: 0.30,

    uColorA: new THREE.Color('#2b2534'),
    uColorB: new THREE.Color('#8e8391'),
    uAO: 0.45,

    uLightDir: new THREE.Vector3(-0.25, 0.85, 0.35).normalize(),
    uSpecPower: 80.0,
    uSpecInt: 0.05,
  },
  vert,
  frag
)
extend({ RockPillarMat })

export default function RockStonePillar({
  radius = 1.0,
  detail = 7,
  rotationSpeed = 0.06,
  materialProps = {},
  ...props
}) {
  const meshRef = useRef()
  const matRef = useRef()
  const geo = useMemo(() => new THREE.IcosahedronGeometry(radius, detail), [radius, detail])

  useFrame((_, dt) => {
    if (matRef.current) matRef.current.uTime += dt
    if (meshRef.current) {
      meshRef.current.rotation.y += rotationSpeed * dt
      meshRef.current.rotation.x += rotationSpeed * 0.12 * dt
    }
  })

  return (
    <mesh ref={meshRef} geometry={geo} {...props} castShadow receiveShadow>
      {/* @ts-ignore */}
      <rockPillarMat ref={matRef} attach="material" {...materialProps} />
    </mesh>
  )
}
