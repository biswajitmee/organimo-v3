// WaterScene.jsx
import * as THREE from 'three';
import { useRef, useEffect, useMemo } from 'react';
import { useFrame, extend, useThree } from '@react-three/fiber';
import { Stats, Sky } from '@react-three/drei';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

extend({ Water });

/** Soft vertical gradient used for the horizon glow band */
function makeSoftHorizonTexture({
  width = 2048,
  height = 512,
  color = '#ffd7ef', // tint
  mid = 0.52,        // band center (0..1)
  band = 0.06,       // bright band thickness
  feather = 0.28,    // falloff above/below band
  strength = 0.6,    // overall opacity baked into texture
} = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');

  const y0 = (mid - feather) * height;
  const y1 = (mid - band * 0.5) * height;
  const y2 = (mid + band * 0.5) * height;
  const y3 = (mid + feather) * height;

  const grad = g.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0.00, 'rgba(255,255,255,0)');
  grad.addColorStop(Math.max(0, y0 / height), 'rgba(255,255,255,0)');
  grad.addColorStop(Math.max(0, y1 / height), `rgba(255,255,255,${0.18 * strength})`);
  grad.addColorStop(Math.max(0, y2 / height), `rgba(255,255,255,${1.00 * strength})`);
  grad.addColorStop(Math.min(1, y3 / height), `rgba(255,255,255,${0.18 * strength})`);
  grad.addColorStop(1.00, 'rgba(255,255,255,0)');

  g.fillStyle = grad;
  g.fillRect(0, 0, width, height);

  // tint pass
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.globalAlpha = 1;
  g.fillRect(0, 0, width, height);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}

export default function WaterScene() {
  const topRef = useRef();
  const botRef = useRef();
  const skyRef = useRef();
  const bobRef = useRef();
  const volNormalsRef = useRef();

  // horizon glow refs
  const horizonRef = useRef();
  const glowMatRef = useRef();
  const glowCfg = useRef({ distance: 0.90, height: 0.6, opacity: 0.9 });

  const { scene, gl, camera } = useThree();
  const sun = useMemo(() => new THREE.Vector3(), []);

  // LAYERS
  const L_DEFAULT = 0;
  const L_CAUSTICS = 1;
  const L_WATER = 2;

  useEffect(() => {
    camera.layers.enable(L_DEFAULT);
    camera.layers.enable(L_CAUSTICS);
    camera.layers.enable(L_WATER);
  }, [camera]);

  useEffect(() => {
    const SIZE = 10000;
    const THICKNESS = 80;
    const EPS = 0.25;
    const SEP = 1.0; // separation between top/bottom water planes

    const group = new THREE.Group();
    scene.add(group);

    // ---- Atmosphere: fog that matches sky horizon hue ----
    const fog = new THREE.FogExp2(new THREE.Color('#e9bfd2'), 0.00030); // tweak density to taste
    scene.fog = fog;

    // ---- Water volume (sides/bottom) for thickness look ----
    const volGeom = new THREE.BoxGeometry(SIZE, THICKNESS, SIZE, 2, 1, 2);
    const volNormals = new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      (tx) => {
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.minFilter = THREE.LinearMipMapLinearFilter;
        tx.magFilter = THREE.LinearFilter;
        tx.repeat.set(6, 2);
      }
    );
    volNormalsRef.current = volNormals;

    const volMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b3d57,
      roughness: 0.95,
      metalness: 0.0,
      normalMap: volNormals,
      normalScale: new THREE.Vector2(0.8, 0.8),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const volume = new THREE.Mesh(volGeom, volMat);
    volume.position.y = -(THICKNESS * 0.5) - EPS;
    volume.renderOrder = -1;
    volume.layers.set(L_WATER);
    group.add(volume);

    // ---- Shared water normals (for Water shader) ----
    const waterNormals = new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      (tx) => {
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.minFilter = THREE.LinearMipMapLinearFilter;
        tx.magFilter = THREE.LinearFilter;
        const maxAniso = gl.capabilities.getMaxAnisotropy?.() ?? 1;
        tx.anisotropy = Math.min(8, maxAniso);
      }
    );

    // IMPORTANT: fog: true so Water respects scene fog
    const params = {
      textureWidth: 256,
      textureHeight: 256,
      waterNormals,
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x6D3FB3,
      distortionScale: 4.5,
      fog: true,
    };

    const plane = new THREE.PlaneGeometry(SIZE, SIZE, 512, 512);

    // ---- Top Water (seen from above) ----
    const top = new Water(plane, params);
    top.rotation.x = -Math.PI / 2;
    top.position.y = +SEP * 0.5;
    top.material.side = THREE.FrontSide;
    top.material.depthWrite = true;
    top.material.depthTest = true;
    top.material.polygonOffset = true;
    top.material.polygonOffsetFactor = -4;
    top.material.polygonOffsetUnits = -4;
    if (top.material.uniforms.size) top.material.uniforms.size.value = 0.8;
    if (top.material.uniforms.reflectivity) top.material.uniforms.reflectivity.value = 0.03; // softer specular
    if (top.material.uniforms.alpha) top.material.uniforms.alpha.value = 1.0;
    top.renderOrder = 2;
    top.layers.set(L_WATER);
    group.add(top);
    topRef.current = top;

    // ---- Bottom Water (underside, seen from below) ----
    const bot = new Water(plane.clone(), params);
    bot.rotation.x = Math.PI / 2;
    bot.position.y = -SEP * 0.5;
    bot.material.side = THREE.FrontSide;
    bot.material.depthWrite = false;
    bot.material.depthTest = false;
    bot.material.polygonOffset = false;
    if (bot.material.uniforms.size) bot.material.uniforms.size.value = 0.8;
    if (bot.material.uniforms.reflectivity) bot.material.uniforms.reflectivity.value = 0.0; // no mirror
    if (bot.material.uniforms.alpha) bot.material.uniforms.alpha.value = 1.0;
    bot.renderOrder = 1;
    bot.layers.set(L_WATER);
    group.add(bot);
    botRef.current = bot;

    // ---- Soft Horizon Glow (non-additive alpha blend) ----
    const glowTex = makeSoftHorizonTexture({
      color: '#ffd7ef', // match sky tint
      mid: 0.52,
      band: 0.06,
      feather: 0.28,
      strength: 0.6,
    });

    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false,
      depthTest: false,
      premultipliedAlpha: false,
      toneMapped: false,
      opacity: glowCfg.current.opacity,
    });
    glowMatRef.current = glowMat;

    const glowGeo = new THREE.PlaneGeometry(80000, 9000);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.renderOrder = 1000;
    glow.layers.set(L_WATER);
    group.add(glow);
    horizonRef.current = glow;

    // ---- GUI ----
    const gui = new GUI({ title: 'Controls' });
    const sunParams = { elevation: 0.25, azimuth: 180 };
    const fogUI = { density: fog.density, color: `#${fog.color.getHexString()}` };
    const waterUI = { distortionScale: params.distortionScale, size: 0.8 };
    const glowUI = { distance: glowCfg.current.distance, height: glowCfg.current.height, opacity: glowCfg.current.opacity };

    const updateSun = () => {
      const phi = THREE.MathUtils.degToRad(90 - sunParams.elevation);
      const theta = THREE.MathUtils.degToRad(sunParams.azimuth);
      sun.setFromSphericalCoords(1, phi, theta);
      if (skyRef.current) skyRef.current.material.uniforms.sunPosition.value.copy(sun);
      [topRef.current, botRef.current].forEach(w => {
        if (w) w.material.uniforms.sunDirection.value.copy(sun).normalize();
      });
    };

    gui.add(sunParams, 'elevation', 0, 90, 0.01).onChange(updateSun);
    gui.add(sunParams, 'azimuth', -180, 180, 0.1).onChange(updateSun);

    gui.addColor(fogUI, 'color').onChange((v) => fog.color.set(v));
    gui.add(fogUI, 'density', 0.0001, 0.001, 0.00001).onChange((v) => (fog.density = v));

    gui.add(waterUI, 'distortionScale', 0, 8, 0.01).onChange((v) => {
      [topRef.current, botRef.current].forEach(w => {
        if (w?.material.uniforms.distortionScale) w.material.uniforms.distortionScale.value = v;
      });
    });
    gui.add(waterUI, 'size', 0.1, 10, 0.01).onChange((v) => {
      [topRef.current, botRef.current].forEach(w => {
        if (w?.material.uniforms.size) w.material.uniforms.size.value = v;
      });
    });

    gui.add(glowUI, 'distance', 0.75, 0.97, 0.01).onChange((v) => (glowCfg.current.distance = v));
    gui.add(glowUI, 'height', -1.0, 2.0, 0.01).onChange((v) => (glowCfg.current.height = v));
    gui.add(glowUI, 'opacity', 0.2, 1.5, 0.01).onChange((v) => {
      glowCfg.current.opacity = v;
      if (glowMatRef.current) glowMatRef.current.opacity = v;
    });

    updateSun();

    return () => {
      gui.destroy();
      scene.remove(group);
      scene.fog = null;

      // dispose
      top.geometry.dispose(); top.material.dispose();
      bot.geometry.dispose(); bot.material.dispose();
      volGeom.dispose(); volMat.dispose(); volNormals.dispose();

      glowGeo.dispose();
      glowMat.dispose();
      glowTex.dispose();
    };
  }, [scene, sun, gl]);

  // Animate + keep the horizon band glued to the far horizon
  useFrame((_, dt) => {
    if (bobRef.current) {
      bobRef.current.position.y = Math.sin(performance.now() * 0.001) * 20 + 5;
    }
    if (topRef.current) topRef.current.material.uniforms.time.value += dt;
    if (botRef.current) botRef.current.material.uniforms.time.value += dt;

    if (volNormalsRef.current) {
      volNormalsRef.current.offset.x += dt * 0.03;
      volNormalsRef.current.offset.y += dt * 0.015;
    }

    const glow = horizonRef.current;
    if (glow) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir).normalize();
      const dist = camera.far * glowCfg.current.distance; // how far the glow sits
      glow.position.copy(camera.position).add(dir.multiplyScalar(dist));
      glow.position.y = glowCfg.current.height;           // small lift above water hides seam
      glow.lookAt(camera.position);
    }
  });

  return (
    <>
      <Sky
        ref={skyRef}
        scale={10000}
        sunPosition={sun}
        turbidity={7}
        rayleigh={2.2}
        mieCoefficient={0.004}
        mieDirectionalG={0.9}
      />
      <mesh ref={bobRef}>
        <meshStandardMaterial roughness={0} />
      </mesh>
      <Stats />
    </>
  );
}
