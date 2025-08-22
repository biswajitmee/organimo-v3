// GodRaysTop.jsx
import * as THREE from 'three'
import React, { useMemo, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'

export default function GodRaysTop({
  lightNDC = [0.5, 0.06],   // top-center in [0..1]
  intensity = 1.0,
  color = '#cfe8ff',
  density = 0.9,
  weight = 1.1,
  decay = 0.965,
  speed = 0.12,
  noiseScale = [12, 3],     // [x,y] bands count
  samples = 64,             // 32–96
  distance = 0.05           // how far in front of the camera (in world units)
}) {
  const { size, camera } = useThree()
  const mesh = useRef()
  const mat = useRef(new THREE.MeshBasicMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 'black',          // base color is ignored by our fragment
    opacity: 0.0
  }))

  // uniforms we’ll inject
  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
    uLight:      { value: new THREE.Vector2(lightNDC[0], lightNDC[1]) },
    uIntensity:  { value: intensity },
    uColor:      { value: new THREE.Color(color) },
    uDensity:    { value: density },
    uWeight:     { value: weight },
    uDecay:      { value: decay },
    uSpeed:      { value: speed },
    uNoiseScale: { value: new THREE.Vector2(noiseScale[0], noiseScale[1]) },
  }), [])

  // inject our fragment shader (keep Three's vertex shader intact)
  useEffect(() => {
    mat.current.onBeforeCompile = (shader) => {
      // add uniforms
      Object.assign(shader.uniforms, uniforms)
      // add code + functions
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `
          #include <common>
          uniform vec2  uResolution;
          uniform vec2  uLight;
          uniform float uIntensity;
          uniform vec3  uColor;
          uniform float uDensity;
          uniform float uWeight;
          uniform float uDecay;
          uniform float uSpeed;
          uniform vec2  uNoiseScale;
          uniform float uTime;

          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
          float noise(vec2 p){
            vec2 i=floor(p), f=fract(p);
            float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
            vec2 u=f*f*(3.0-2.0*f);
            return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
          }
          float fbm(vec2 p){
            float s=0.0, a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
            for(int i=0;i<5;i++){ s+=a*noise(p); p=m*p; a*=0.5; }
            return s;
          }
        `)
        // replace the final color write with our god-rays overlay
        .replace(
          'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
          `
          vec2 uv = gl_FragCoord.xy / uResolution; // screen uv
          vec2 light = uLight;
          vec2 delta = (light - uv);
          float dist = length(delta) + 1e-6;
          vec2 stepv = (delta / dist) * (uDensity / 64.0); // 64 fixed samples for reliability

          vec2 suv = uv;
          float illum = 0.0;
          float dec = 1.0;
          for (int i=0; i<64; i++){
            suv += stepv;
            float bands = fbm(suv * uNoiseScale + vec2(0.0, uTime * uSpeed));
            bands = smoothstep(0.45, 0.95, bands);
            float fall = 1.0 - clamp(length(suv - light), 0.0, 1.0);
            illum += bands * fall * dec * uWeight;
            dec *= uDecay;
          }
          vec2 p = uv*2.0 - 1.0;
          float vign = smoothstep(1.25, 0.25, length(p));
          vec3 rays = uColor * (illum * uIntensity * vign);

          gl_FragColor = vec4(rays, clamp(max(rays.r, max(rays.g, rays.b)), 0.0, 1.0));
          `
        )
      mat.current.userData.shader = shader
    }
    mat.current.needsUpdate = true
  }, [uniforms])

  // keep uniforms current and keep the quad stuck to the camera
  useFrame((_, dt) => {
    // uniforms
    uniforms.uTime.value += dt
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
    uniforms.uLight.value.set(lightNDC[0], lightNDC[1])
    uniforms.uIntensity.value = intensity
    uniforms.uColor.value.set(color)
    uniforms.uDensity.value = density
    uniforms.uWeight.value = weight
    uniforms.uDecay.value = decay
    uniforms.uSpeed.value = speed
    uniforms.uNoiseScale.value.set(noiseScale[0], noiseScale[1])

    // screen-filling plane locked to camera
    if (mesh.current) {
      const cam = camera
      const forward = new THREE.Vector3()
      cam.getWorldDirection(forward)
      const pos = new THREE.Vector3().copy(cam.position).add(forward.multiplyScalar(distance))
      mesh.current.position.copy(pos)
      mesh.current.quaternion.copy(cam.quaternion)

      // scale to cover viewport at this distance
      const tl = new THREE.Vector3(-1,  1, 0).unproject(cam)
      const br = new THREE.Vector3( 1, -1, 0).unproject(cam)
      const sizeVec = new THREE.Vector3().subVectors(br, tl)
      mesh.current.scale.set(Math.abs(sizeVec.x)*0.5, Math.abs(sizeVec.y)*0.5, 1)
    }
  })

  return (
    <mesh ref={mesh} renderOrder={9999}>
      <planeGeometry args={[2, 2]} />
      <primitive object={mat.current} attach="material" />
    </mesh>
  )
}
