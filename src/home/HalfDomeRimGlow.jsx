// HalfDomeRimGlow.jsx — inside-facing hemisphere with pink rim glow → blue gradient + raying effect
import * as THREE from 'three'
import React, { useMemo, useLayoutEffect } from 'react'

export default function HalfDomeRimGlow({
  radius = 6000,

  // Colors (sRGB hex are ok; converted to linear)
  edgeColor = '#ff9ad3',      // pink glow at cut edge (equator)
  midBlue   = '#b7c8e6',      // light grayish-blue near edge
  deepBlue  = '#5c5591',      // deep blue toward zenith

  // Gradient shaping
  gradientPower = 1.25,       // >1 = deeper top blue; <1 = flatter
  exposure = 1.0,             // overall brightness

  // Rim glow shaping
  rimWidth   = 0.18,          // 0..1 distance from edge (y=0) over which glow extends
  rimFeather = 0.22,          // softness of rim falloff
  rimStrength = 1.4,          // intensity multiplier for pink glow

  // Rays emanating from the cut edge
  raysCount = 28.0,           // number of spokes around the dome
  raysSpeed = 0.25,           // animation speed
  raysStrength = 0.55,        // how strong the rays brighten the rim glow
  raysSharpness = 2.0,        // higher = thinner/brighter streaks
  noiseAmount = 0.25,         // breaks up perfect stripes

  renderOrder = -50,          // draw behind everything
  ...props
}) {
  const uniforms = useMemo(() => ({
    uTop:  { value: new THREE.Color(deepBlue).convertSRGBToLinear() },
    uMid:  { value: new THREE.Color(midBlue).convertSRGBToLinear() },
    uEdge: { value: new THREE.Color(edgeColor).convertSRGBToLinear() },

    uGradPow: { value: gradientPower },
    uExpo:    { value: exposure },

    uRimW:    { value: rimWidth },
    uRimF:    { value: rimFeather },
    uRimStr:  { value: rimStrength },

    uRaysCount:    { value: raysCount },
    uRaysSpeed:    { value: raysSpeed },
    uRaysStrength: { value: raysStrength },
    uRaysSharp:    { value: raysSharpness },
    uNoiseAmt:     { value: noiseAmount },

    uTime: { value: 0 },
  }), [])

  // keep uniforms synced when props change
  useLayoutEffect(() => { uniforms.uTop.value.set(deepBlue).convertSRGBToLinear() }, [deepBlue])
  useLayoutEffect(() => { uniforms.uMid.value.set(midBlue).convertSRGBToLinear() }, [midBlue])
  useLayoutEffect(() => { uniforms.uEdge.value.set(edgeColor).convertSRGBToLinear() }, [edgeColor])

  useLayoutEffect(() => { uniforms.uGradPow.value = gradientPower }, [gradientPower])
  useLayoutEffect(() => { uniforms.uExpo.value = exposure }, [exposure])

  useLayoutEffect(() => { uniforms.uRimW.value = rimWidth }, [rimWidth])
  useLayoutEffect(() => { uniforms.uRimF.value = rimFeather }, [rimFeather])
  useLayoutEffect(() => { uniforms.uRimStr.value = rimStrength }, [rimStrength])

  useLayoutEffect(() => { uniforms.uRaysCount.value = raysCount }, [raysCount])
  useLayoutEffect(() => { uniforms.uRaysSpeed.value = raysSpeed }, [raysSpeed])
  useLayoutEffect(() => { uniforms.uRaysStrength.value = raysStrength }, [raysStrength])
  useLayoutEffect(() => { uniforms.uRaysSharp.value = raysSharpness }, [raysSharpness])
  useLayoutEffect(() => { uniforms.uNoiseAmt.value = noiseAmount }, [noiseAmount])

  const vert = /* glsl */`
    varying vec3 vWorld;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `

  const frag = /* glsl */`
    precision highp float;

    varying vec3 vWorld;

    uniform vec3 uTop, uMid, uEdge;
    uniform float uGradPow, uExpo;

    uniform float uRimW, uRimF, uRimStr;

    uniform float uRaysCount, uRaysSpeed, uRaysStrength, uRaysSharp, uNoiseAmt;
    uniform float uTime;

    // tiny hash/noise for ray breakup
    float hash21(vec2 p){
      p = fract(p*vec2(123.34, 345.45));
      p += dot(p, p+34.345);
      return fract(p.x*p.y);
    }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      float a = hash21(i);
      float b = hash21(i+vec2(1,0));
      float c = hash21(i+vec2(0,1));
      float d = hash21(i+vec2(1,1));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
    }

    void main(){
      // surface direction (inside hemisphere). y in [0..1] for upper half.
      vec3 n = normalize(vWorld);
      float y = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);

      // --------- Base gradient: edge(light gray-blue) -> deep top blue ----------
      float t = pow(y, uGradPow);            // shape
      vec3 baseCol = mix(uMid, uTop, t);     // at y=0: uMid, at y=1: uTop

      // --------- Rim pink glow near the cut (equator y≈0) ----------
      // distance from rim: 0 at rim, 1 upward
      float dRim = clamp(y / max(uRimW, 1e-4), 0.0, 1.0);
      // feathered inverse falloff (strong at edge, fades inwards)
      float rim = 1.0 - smoothstep(0.0, uRimF, dRim);
      // soften more with 1 - y so it hugs the border
      rim *= (1.0 - y);

      // --------- Rays along azimuth, emanating from rim ----------
      // azimuth around vertical axis
      float phi = atan(n.z, n.x);           // [-pi, pi]
      // normalized [0..1]
      float uvA = (phi / 6.2831853) + 0.5;
      // longitudinal “stripes”
      float spokes = sin(uvA * uRaysCount * 6.2831853 + uTime * uRaysSpeed*2.1);
      spokes = pow(abs(spokes), uRaysSharp);      // thinner/brighter
      // fade rays as we go up
      float rayFalloff = 1.0 - smoothstep(0.0, 1.0, y);
      // break uniformity with noise along the ring
      float nse = noise(vec2(uvA*40.0, 1.7 + uTime*0.07));
      float rayMask = mix(spokes, spokes*0.6, uNoiseAmt * nse);
      float rays = rayMask * rayFalloff;

      // combine rim + rays
      float rimGlow = rim * (1.0 + rays * uRaysStrength);

      // color add from edgeColor, scaled
      vec3 glowCol = uEdge * (rimGlow * uRimStr);

      vec3 finalCol = baseCol + glowCol;

      gl_FragColor = vec4(finalCol * uExpo, 1.0);
    }
  `

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      side: THREE.BackSide,   // inside the dome
      depthWrite: false,
      depthTest: false,
      toneMapped: true,
      // Optional: uncomment if you want extra pop at the rim
      // blending: THREE.CustomBlending,
      // blendEquation: THREE.AddEquation,
      // blendSrc: THREE.SrcAlphaFactor,
      // blendDst: THREE.OneMinusSrcAlphaFactor,
      transparent: false,
    })
    // animate uTime without needing useFrame outside
    const clock = new THREE.Clock()
    const tick = () => {
      uniforms.uTime.value = clock.getElapsedTime()
      requestAnimationFrame(tick)
    }
    tick()
    return m
  }, [])

  return (
    <mesh renderOrder={renderOrder} material={material} {...props} scale={[radius, radius, radius]}>
      {/* upper hemisphere: thetaStart=0 (north pole), thetaLength=PI/2 */}
      <sphereGeometry args={[1, 96, 96, 0, Math.PI*2, 0, Math.PI/2]} />
    </mesh>
  )
}
