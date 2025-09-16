// StarField.jsx — lightweight twinkling stars (GPU points)
import * as THREE from 'three'
import React, { useMemo } from 'react'

export default function StarField({
  count = 2000,
  innerRadius = 4200,
  outerRadius = 5200,
  size = 6.0,            // screen-space size (pixels); will attenuate with distance
  sizeAttenuation = true,
  brightness = 1.4,      // global brightness
  twinkle = 0.35,        // strength of twinkle modulation (0..1)
  minSpeed = 0.2,        // twinkle speed range
  maxSpeed = 0.6,
  renderOrder = -40,
  ...props
}) {
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const speed = new Float32Array(count)
    const mag   = new Float32Array(count)

    // distribute on a spherical shell (uniform-ish)
    for (let i = 0; i < count; i++) {
      // random direction
      const u = Math.random() * 2 - 1   // cos(theta)
      const phi = Math.random() * Math.PI * 2
      const r = THREE.MathUtils.lerp(innerRadius, outerRadius, Math.random())
      const s = Math.sqrt(1 - u*u)
      const x = s * Math.cos(phi) * r
      const y = u * r
      const z = s * Math.sin(phi) * r
      positions[i*3+0] = x
      positions[i*3+1] = y
      positions[i*3+2] = z

      phase[i] = Math.random() * Math.PI * 2
      speed[i] = THREE.MathUtils.lerp(minSpeed, maxSpeed, Math.random())
      mag[i]   = 0.6 + Math.random() * 0.4 // per-star brightness variance
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phase, 1))
    geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speed, 1))
    geo.setAttribute('aMag',     new THREE.BufferAttribute(mag, 1))

    const uniforms = {
      uTime: { value: 0 },
      uSize: { value: size },
      uBrightness: { value: brightness },
      uTwinkle: { value: twinkle },
      uSizeAtten: { value: sizeAttenuation ? 1.0 : 0.0 },
    }

    const vert = /* glsl */`
      precision highp float;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aMag;
      uniform float uTime;
      uniform float uSize;
      uniform float uSizeAtten;
      varying float vAlpha;

      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;

        // pixel size (if attenuating, scale w/ distance)
        float sz = uSize;
        if(uSizeAtten > 0.5){
          // classic size attenuation (inverse by w)
          sz = uSize * (300.0 / -mv.z); // 300 is a fudge factor; tune for your FOV
        }
        gl_PointSize = max(1.0, sz);

        // twinkle alpha in vertex (phase per-star)
        float tw = 0.5 + 0.5 * sin(aPhase + uTime * aSpeed * 2.8);
        vAlpha = mix(1.0, tw, 0.85); // slight base flicker
        vAlpha *= aMag;
      }
    `

    const frag = /* glsl */`
      precision highp float;
      uniform float uBrightness;
      uniform float uTwinkle;
      varying float vAlpha;

      void main(){
        // circular sprite
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float d = dot(uv, uv);
        if(d > 1.0) discard;

        // soft falloff toward edges
        float circle = smoothstep(1.0, 0.0, d);
        float alpha = vAlpha * circle;

        // white star (can tint by multiplying vec3 color if desired)
        vec3 col = vec3(1.0) * uBrightness;

        gl_FragColor = vec4(col, alpha);
      }
    `

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false, // stars stay crisp/bright
    })

    return { geometry: geo, material: mat }
  }, [count, innerRadius, outerRadius, size, sizeAttenuation, brightness, twinkle, minSpeed, maxSpeed])

  // animate time
  useMemo(() => {
    const clock = new THREE.Clock()
    const update = () => {
      material.uniforms.uTime.value = clock.getElapsedTime()
      requestAnimationFrame(update)
    }
    update()
  }, [material])

  return (
    <points geometry={geometry} material={material} renderOrder={renderOrder} {...props} />
  )
}
