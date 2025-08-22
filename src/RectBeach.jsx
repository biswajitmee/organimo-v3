import * as THREE from 'three'
import React, { useMemo, useRef, useEffect } from 'react'
import { useThree, useFrame, createPortal } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'

export default function RectBeach({
  rect = { width: 0.9, height: 0.8, radius: 0.03, z: -8 },
  floorY = -300,
  waterY = 0,
  sandUrl,
  waterDetailUrl,
  causticsUrl,
  causticsStrength = 1.2,
  colorTint = new THREE.Color('#432a7a'),
  children
}) {
  const { gl, size, camera } = useThree()
  const rt = useFBO({
    samples: 4,
    stencilBuffer: false,
    depthBuffer: true,
    depthTexture: new THREE.DepthTexture(size.width, size.height)
  })
  const vScene = useMemo(() => new THREE.Scene(), [])
  const quad = useRef()
  const time = useRef(0)

  // Textures -------------------------------------------------
  const sandTex = useMemo(() => {
    if (!sandUrl) return null
    const t = new THREE.TextureLoader().load(sandUrl)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [sandUrl])

  const waterDetailTex = useMemo(() => {
    if (!waterDetailUrl) return null
    const t = new THREE.TextureLoader().load(waterDetailUrl)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [waterDetailUrl])

  const causticsTex = useMemo(() => {
    if (!causticsUrl) return null
    const video = document.createElement('video')
    video.src = causticsUrl
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    const tex = new THREE.VideoTexture(video)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    video.addEventListener('canplay', () => video.play().catch(() => {}))
    return tex
  }, [causticsUrl])

  // SAND SHADER ---------------------------------------------
  const sandMat = useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uFloorY: { value: floorY },
      uWaterY: { value: waterY },
      uSandMap: { value: sandTex || new THREE.Texture() },
      uDetail: { value: waterDetailTex || new THREE.Texture() },
      uHasSand: { value: sandTex ? 1 : 0 },
      uHasDetail: { value: waterDetailTex ? 1 : 0 },
      uTint: { value: new THREE.Color(colorTint) },
      uFogCol: { value: new THREE.Color('#0e0220') },
      uFogNear: { value: 100.0 },
      uFogFar: { value: 1600.0 }
    }
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */`
        precision highp float;

        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying vec2 vUv2;

        uniform float uTime;

        // hash/noise/fbm (same as before)
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(in vec2 p){
          vec2 i=floor(p); vec2 f=fract(p);
          float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
          vec2 u=f*f*(3.0-2.0*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
        }
        float fbm(vec2 p){
          float s=0.0; float a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
          for(int i=0;i<5;i++){ s+=a*noise(p); p=m*p; a*=0.5; }
          return s;
        }

        float dunes(vec2 xz, float t){
          return fbm( xz*0.004 )*8.0 + fbm(xz*0.02)*1.2 + sin((xz.x+xz.y)*0.03 + t*0.5)*0.8;
        }

        void main(){
          vec3 pos = position;
          float h = dunes(pos.xz, uTime);
          pos.y += h;

          // finite difference slope to build a normal (no derivatives in VS)
          float eps = 1.0;
          float hx = dunes(pos.xz + vec2(eps,0.0), uTime) - h;
          float hz = dunes(pos.xz + vec2(0.0,eps), uTime) - h;
          vec3 n = normalize(vec3(-hx, 1.0, -hz));

          vUv2 = uv * 12.0;

          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize( mat3(modelMatrix) * n );

          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;

        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying vec2 vUv2;

        uniform sampler2D uSandMap;
        uniform sampler2D uDetail;
        uniform int uHasSand;
        uniform int uHasDetail;
        uniform vec3 uTint;
        uniform vec3 uFogCol;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform float uWaterY;

        void main(){
          vec3 baseSand = vec3(0.66,0.58,0.45);
          vec3 sandTex = (uHasSand == 1) ? texture2D(uSandMap, vUv2).rgb : baseSand;
          vec3 detail  = (uHasDetail == 1) ? texture2D(uDetail, vUv2*2.0).rgb : vec3(1.0);

          vec3 N = normalize(vWorldNormal);
          vec3 L = normalize(vec3(0.2, 1.0, 0.1));
          float diff = max(dot(N, L), 0.0);

          vec3 col = sandTex * (0.55 + 0.45*diff) * detail;

          float heightFog = clamp((uWaterY - vWorldPos.y)/200.0, 0.0, 1.0);
          vec3 fogged = mix(col, uTint*0.75, heightFog);

          float df = smoothstep(uFogNear, uFogFar, length(vWorldPos));
          vec3 finalCol = mix(fogged, uFogCol, df);

          gl_FragColor = vec4(finalCol, 1.0);
        }
      `
    })
  }, [sandTex, waterDetailTex, colorTint, floorY, waterY])

  // COMPOSITE (caustics + rays + bubbles + particles) -------
  const compositeMat = useMemo(() => new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: {
      tScene: { value: rt.texture },
      tDepth: { value: rt.depthTexture },
      tCaustics: { value: causticsTex || new THREE.Texture() },
      uTime: { value: 0 },
      uInvProj: { value: camera.projectionMatrixInverse.clone() },
      uInvView: { value: camera.matrixWorld.clone() },
      uLightPosNDC: { value: new THREE.Vector2(0.5, 0.05) },
      uCameraNear: { value: camera.near },
      uCameraFar: { value: camera.far },
      uWaterY: { value: waterY },
      uCausticsStrength: { value: causticsStrength },
      uTint: { value: new THREE.Color(colorTint) },
      uRect: { value: new THREE.Vector4(rect.width, rect.height, rect.radius, 0) }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;

      uniform sampler2D tScene;
      uniform sampler2D tDepth;
      uniform sampler2D tCaustics;
      uniform float uTime;
      uniform mat4 uInvProj;
      uniform mat4 uInvView;
      uniform vec2 uLightPosNDC;
      uniform float uCameraNear;
      uniform float uCameraFar;
      uniform float uWaterY;
      uniform float uCausticsStrength;
      uniform vec3  uTint;
      uniform vec4  uRect;

      float roundedBoxSDF(vec2 p, vec2 b, float r){
        vec2 d = abs(p) - b + vec2(r);
        return length(max(d,0.0)) + min(max(d.x,d.y),0.0) - r;
      }

      vec3 worldPosFromDepth(vec2 uv, float depth){
        vec4 clip = vec4(uv*2.0-1.0, depth*2.0-1.0, 1.0);
        vec4 view = uInvProj * clip;
        view /= view.w;
        vec4 wpos = uInvView * view;
        return wpos.xyz;
      }

      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
      float noise(vec2 p){
        vec2 i=floor(p); vec2 f=fract(p);
        float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
      }
      float fbm(vec2 p){
        float s=0.0, a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
        for(int i=0;i<5;i++){ s+=a*noise(p); p=m*p; a*=0.5; }
        return s;
      }

      void main(){
        vec2 uv = vUv;
        vec2 p = uv*2.0-1.0;
        float d = roundedBoxSDF(p, vec2(0.98), uRect.z*2.0);
        if(d>0.0) discard;

        vec3 col = texture2D(tScene, uv).rgb;
        float depth = texture2D(tDepth, uv).x;
        vec3 wpos = worldPosFromDepth(uv, depth);

        // Caustics projected from top
        vec2 cuv = wpos.xz * 0.03 + vec2(0.0, -uTime*0.15);
        vec3 cTex = texture2D(tCaustics, cuv).rgb;
        float waterFade = clamp((uWaterY - wpos.y)/200.0, 0.0, 1.0);
        col += cTex * (uCausticsStrength * waterFade * 0.8);

        // God rays
        vec2 dir = uLightPosNDC - uv;
        float dist = length(dir);
        vec2 stepv = dir / max(64.0, 128.0*dist);
        vec2 suv = uv;
        float sum = 0.0, k = 0.0;
        for(int i=0;i<48;i++){
          suv += stepv;
          float dz = texture2D(tDepth, suv).x - depth;
          float occ = smoothstep(0.002, 0.15, dz);
          sum += (1.0-occ) * (0.98 - float(i)/48.0);
          k += 1.0;
        }
        float rays = max(sum / max(k,1.0), 0.0);
        float bands = 0.35 + 0.65*fbm(uv*vec2(8.0,2.0) + uTime*0.2);
        col += rays * bands * 0.18;

        // Bubbles
        float bubbles = 0.0;
        for(int i=0;i<6;i++){
          vec2 seed = vec2(float(i)*17.0, float(i)*3.0);
          vec2 buv = uv + vec2(fract(sin(seed.x)*437.0), fract(sin(seed.y)*913.0))*0.6 - 0.3;
          buv.y += fract(uTime*0.08 + float(i)*0.17)*-1.2;
          float b = smoothstep(0.06,0.0, length(fract(buv)-0.5));
          bubbles += b;
        }
        col += vec3(1.0) * bubbles * 0.07;

        // Small particles
        float dust = fbm(uv*vec2(120.0,60.0) + uTime*0.6);
        col += vec3(dust)*0.02;

        // water tint + vignette
        col = mix(col, uTint, 0.18);
        float vig = smoothstep(0.95, 0.6, length(p));
        col *= mix(0.9, 1.05, vig);

        gl_FragColor = vec4(col, 1.0);
      }
    `
  }), [rt, causticsTex, rect.width, rect.height, rect.radius, waterY, causticsStrength, colorTint, camera])

  // VIRTUAL SCENE -------------------------------------------
  useEffect(() => {
    vScene.fog = new THREE.FogExp2('#000015', 0.0009)
  }, [vScene])

  // Ground mesh using the sand shader
  useEffect(() => {
    const geo = new THREE.PlaneGeometry(6000, 4000, 300, 200)
    geo.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(geo, sandMat)
    mesh.position.set(0, floorY, -800)
    vScene.add(mesh)
    return () => {
      vScene.remove(mesh)
      geo.dispose()
      sandMat.dispose()
    }
  }, [vScene, sandMat, floorY])

  // Mount children into the virtual scene
  const portal = createPortal(<group>{children}</group>, vScene)

  // RENDER LOOP ---------------------------------------------
  useFrame((_, dt) => {
    time.current += dt
    sandMat.uniforms.uTime.value = time.current

    compositeMat.uniforms.uTime.value = time.current
    compositeMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse)
    compositeMat.uniforms.uInvView.value.copy(camera.matrixWorld)
    compositeMat.uniforms.uCameraNear.value = camera.near
    compositeMat.uniforms.uCameraFar.value = camera.far

    const oldTarget = gl.getRenderTarget()
    gl.setRenderTarget(rt)
    gl.clear(true, true, true)
    gl.render(vScene, camera)
    gl.setRenderTarget(oldTarget)

    if (quad.current) {
      const z = rect.z
      const w = rect.width
      const h = rect.height
      const topLeftNDC = new THREE.Vector3(-w,  h, 0).unproject(camera)
      const bottomRightNDC = new THREE.Vector3( w, -h, 0).unproject(camera)
      const sizeVec = new THREE.Vector3().subVectors(bottomRightNDC, topLeftNDC)
      quad.current.scale.set(Math.abs(sizeVec.x)*0.5, Math.abs(sizeVec.y)*0.5, 1)

      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      quad.current.position.copy(camera.position).add(forward.multiplyScalar(Math.abs(z)))
      quad.current.quaternion.copy(camera.quaternion)
    }
  })

  // DISPLAY QUAD --------------------------------------------
  return (
    <>
      {portal}
      <mesh ref={quad}>
        <planeGeometry args={[2, 2]} />
        <primitive object={compositeMat} attach="material" />
      </mesh>
    </>
  )
}
