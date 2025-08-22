// GodRaysClassic.jsx
import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import {
  GodRaysFakeSunShader,
  GodRaysDepthMaskShader,
  GodRaysCombineShader,
  GodRaysGenerateShader,
} from "three/examples/jsm/shaders/GodRaysShader.js";

export default function GodRaysClassic({
  // live-tweakable props
  intensity = 0.9,
  bgColor = 0x000511,
  sunColor = 0xffee00,
  sunBrightness = 1.0,
  sunDiscScale = 0.6,
  filterLen = 1.2,
  taps = 6.0,
  sunPosition = new THREE.Vector3(0, 1000, -1000),
  sunNDC = null,               // [x,y] in [0..1]; overrides world position if provided
  resolutionMultiplier = 1 / 2,
  enableDemoGeometry = true,
}) {
  const { gl: renderer, scene, camera, size } = useThree();

  // --------------------------
  // Keep all user props in refs so changes are reflected inside useFrame
  // --------------------------
  const p = useRef({});
  useEffect(() => {
    p.current = {
      intensity,
      sunBrightness,
      sunDiscScale,
      filterLen,
      taps,
      sunNDC,
      sunPosition,
    };
  }, [intensity, sunBrightness, sunDiscScale, filterLen, taps, sunNDC, sunPosition]);

  // --------------------------
  // Demo occluders (optional)
  // --------------------------
  const sphereRef = useRef();
  useEffect(() => {
    if (!enableDemoGeometry) return;
    const group = new THREE.Group();
    scene.add(group);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 8, 120, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    trunk.position.set(0, -90, -150);
    group.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.DodecahedronGeometry(60, 0),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    foliage.position.set(0, -30, -150);
    group.add(foliage);

    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 4, 50 + i * 5, 8),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      b.position.set((i - 1.5) * 28, -60 + i * 8, -150);
      b.rotation.z = (i - 1.5) * 0.5;
      group.add(b);
    }

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(20, 20, 10),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    sphereRef.current = sphere;
    scene.add(sphere);

    return () => {
      scene.remove(group);
      scene.remove(sphere);
    };
  }, [enableDemoGeometry, scene]);

  // --------------------------
  // Post chain (materials + RTs)
  // --------------------------
  const pp = useMemo(() => {
    const s = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -10000, 10000);
    cam.position.z = 100;
    s.add(cam);

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    quad.position.z = -9900;
    s.add(quad);

    const UMask = THREE.UniformsUtils.clone(GodRaysDepthMaskShader.uniforms);
    const MMask = new THREE.ShaderMaterial({
      uniforms: UMask,
      vertexShader: GodRaysDepthMaskShader.vertexShader,
      fragmentShader: GodRaysDepthMaskShader.fragmentShader,
    });

    const UGen = THREE.UniformsUtils.clone(GodRaysGenerateShader.uniforms);
    const MGen = new THREE.ShaderMaterial({
      uniforms: UGen,
      vertexShader: GodRaysGenerateShader.vertexShader,
      fragmentShader: GodRaysGenerateShader.fragmentShader,
    });

    const UComb = THREE.UniformsUtils.clone(GodRaysCombineShader.uniforms);
    const MComb = new THREE.ShaderMaterial({
      uniforms: UComb,
       vertexShader: GodRaysCombineShader.vertexShader,
       fragmentShader: GodRaysCombineShader.fragmentShader,
  
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,   // <<< do a clean overwrite of the fullscreen quad
    });

    const UFake = THREE.UniformsUtils.clone(GodRaysFakeSunShader.uniforms);
    const MFake = new THREE.ShaderMaterial({
      uniforms: UFake,
      vertexShader: GodRaysFakeSunShader.vertexShader,
      fragmentShader: GodRaysFakeSunShader.fragmentShader,
      depthTest: false,    // draw sun regardless of scene depth
      depthWrite: false,
      blending: THREE.NoBlending,  
    });

    UFake.bgColor.value.setHex(bgColor);
    UFake.sunColor.value.setHex(sunColor);

    UComb.fGodRayIntensity.value = intensity;

    const type =
      renderer.capabilities.isWebGL2 || renderer.extensions.get("OES_texture_half_float")
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType;

    const rtC = new THREE.WebGLRenderTarget(1, 1, { type });
    const rtD = new THREE.WebGLRenderTarget(1, 1, { type });
    const rtDM = new THREE.WebGLRenderTarget(1, 1, { type });
    const rtG1 = new THREE.WebGLRenderTarget(1, 1, { type });
    const rtG2 = new THREE.WebGLRenderTarget(1, 1, { type });

    return {
      scene: s,
      camera: cam,
      quad,
      MMask,
      MGen,
      MComb,
      MFake,
      UMask,
      UGen,
      UComb,
      UFake,
     materialDepth: (() => {
         const m = new THREE.MeshDepthMaterial();
         m.depthPacking = THREE.BasicDepthPacking;  // <<< force the format the shader expects
         m.blending = THREE.NoBlending;             // avoid accidental blending in RT
         return m;
       })(),
      rtC,
      rtD,
      rtDM,
      rtG1,
      rtG2,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgColor, sunColor, renderer]);

  // RT sizes react to resolutionMultiplier changes
  useEffect(() => {
    const w = size.width;
    const h = size.height;
    pp.rtC.setSize(w, h);
    pp.rtD.setSize(w, h);
    pp.rtDM.setSize(w, h);

    const aw = Math.max(1, Math.floor(w * resolutionMultiplier));
    const ah = Math.max(1, Math.floor(h * resolutionMultiplier));
    pp.rtG1.setSize(aw, ah);
    pp.rtG2.setSize(aw, ah);
  }, [pp, size, resolutionMultiplier]);

  // helpers
  const clip = useMemo(() => new THREE.Vector4(), []);
  const sunSS = useMemo(() => new THREE.Vector3(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const step = (len, tpp, pass) => len * Math.pow(tpp, -pass);

  useFrame(({ clock }) => {
    // Animate demo occluder so beams are visible
    if (sphereRef.current) {
      const t = clock.getElapsedTime() / 4;
      const R = 200;
      sphereRef.current.position.set(R * Math.cos(t), 0, R * Math.sin(t) - 100);
    }

    const {
      intensity: I,
      sunBrightness: SB,
      sunDiscScale: SDS,
      filterLen: FL,
      taps: TAPS,
      sunNDC: SND,
      sunPosition: SP,
    } = p.current;

    // Sun screen-space position
    if (SND && Array.isArray(SND)) {
      sunSS.set(SND[0], SND[1], 0.0);
    } else {
      clip.set(SP.x, SP.y, SP.z, 1.0);
      clip.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
      clip.x /= clip.w;
      clip.y /= clip.w;
      sunSS.set((clip.x + 1) / 2, (clip.y + 1) / 2, clip.z);
    }

    // Update uniforms that can change live
    pp.UGen.vSunPositionScreenSpace.value.copy(sunSS);
    pp.UFake.vSunPositionScreenSpace.value.copy(sunSS);
    pp.UFake.fAspect.value = size.width / size.height;

    // live intensity
    pp.UComb.fGodRayIntensity.value = I;

    // live sun brightness (scale sun color every frame)
    tmpColor.setHex(sunColor).multiplyScalar(SB);
    pp.UFake.sunColor.value.copy(tmpColor);

    // ——— Rendering pipeline ———
    const oldAuto = renderer.autoClear;
    const prevClr = renderer.getClearColor(new THREE.Color());
    const prevA = renderer.getClearAlpha();
    renderer.autoClear = false;

    // 1) sky + fake sun -> colors RT
    renderer.setRenderTarget(pp.rtC);
    renderer.setClearColor(new THREE.Color(bgColor), 1);
    renderer.clear(true, true, false);

    const sunsqH = SDS * size.height; // sunDiscScale in [0..1+]
    const sunsqW = SDS * size.height;
    const sx = sunSS.x * size.width;
    const sy = sunSS.y * size.height;

    renderer.setScissor(sx - sunsqW / 2, sy - sunsqH / 2, sunsqW, sunsqH);
    renderer.setScissorTest(true);
    pp.scene.overrideMaterial = pp.MFake;
    renderer.render(pp.scene, pp.camera);
    renderer.setScissorTest(false);
    pp.scene.overrideMaterial = pp.MFake;
     renderer.render(pp.scene, pp.camera);
     renderer.setScissorTest(false);
     pp.scene.overrideMaterial = null;


   

    // 2) scene colors
    scene.overrideMaterial = null;
    renderer.setRenderTarget(pp.rtC);
    renderer.render(scene, camera);

    // 3) scene depth
    scene.overrideMaterial = pp.materialDepth;
    renderer.setRenderTarget(pp.rtD);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;

    // 4) depth mask
    pp.UMask.tInput.value = pp.rtD.texture;
    pp.scene.overrideMaterial = pp.MMask;
    renderer.setRenderTarget(pp.rtDM);
    renderer.render(pp.scene, pp.camera);
    pp.scene.overrideMaterial = null;

    // 5) god-rays (3 passes, ping-pong) — uses live filterLen/taps
    const doPass = (inputTex, outRT, stepSize) => {
      pp.scene.overrideMaterial = pp.MGen;
      pp.UGen.fStepSize.value = stepSize;
      pp.UGen.tInput.value = inputTex;
      renderer.setRenderTarget(outRT);
      renderer.render(pp.scene, pp.camera);
      pp.scene.overrideMaterial = null;
    };
    doPass(pp.rtDM.texture, pp.rtG2, step(FL, TAPS, 1.0));
    doPass(pp.rtG2.texture, pp.rtG1, step(FL, TAPS, 2.0));
    doPass(pp.rtG1.texture, pp.rtG2, step(FL, TAPS, 3.0));

    // 6) final combine to screen
    pp.UComb.tColors.value = pp.rtC.texture;
    pp.UComb.tGodRays.value = pp.rtG2.texture;

    renderer.setRenderTarget(null);
    renderer.clearDepth(); // ignore scene depth
    pp.scene.overrideMaterial = pp.MComb;
    renderer.render(pp.scene, pp.camera);
    pp.scene.overrideMaterial = null;

    renderer.setClearColor(prevClr, prevA);
    renderer.autoClear = oldAuto;
  }, 1);

  return null;
}
