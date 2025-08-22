import {useEffect, useMemo} from "react";
import * as THREE from "three";
import {useFrame, useThree} from "@react-three/fiber";
import {useFBO} from "@react-three/drei";
import {GodRaysFakeSunShader, GodRaysDepthMaskShader, GodRaysCombineShader, GodRaysGenerateShader} from "three/examples/jsm/shaders/GodRaysShader.js";

/**
 * Underwater God Rays (classic shader) for R3F.
 *
 * Place as the LAST child inside <Canvas> so it runs after your scene.
 *
 * Props:
 *  - enabled: boolean (default true)
 *  - sunRef: ref to an Object3D whose worldPosition drives the sun (X/Z via Theatre, etc.)
 *  - lockY: boolean — if true, clamps sun Y to waterY + 0.1 (default true)
 *  - sunDirection: THREE.Vector3 fallback direction (from Water/Sky uniforms)
 *  - waterY: number water plane height (default 0)
 *  - intensity: 0..1 (default 0.4)
 *  - resolutionScale: 0.25..1.0 ray buffer scale (default 0.33)
 *  - bgColor: hex underwater background tint (default 0x001317)
 *  - sunColor: hex beam color (default 0x77d5ff)
 *  - sunDistance: distance used when deriving pos from sunDirection (default 4000)
 *  - depthAttenRange: meters of fade as camera nears surface (default 15)
 *  - tapsPerPass: samples per blur pass (default 8)
 *  - filterLen: overall blur length (default 1.35)
 *  - scissorScale: 0..1 — size of sun scissor rect relative to height (default 0.85)
 */
export default function GodRays({
    enabled = true,
    sunRef,
    lockY = true,
    sunDirection,
    waterY = 0,
    intensity = 0.4,
    resolutionScale = 0.33,
    bgColor = 0x300554,
    sunColor = 0x300554,
    sunDistance = 4000,
    depthAttenRange = 15,
    tapsPerPass = 8,
    filterLen = 0.35,
    scissorScale = 0.85
}) {
    const {gl, size, camera, scene} = useThree();

    // --- Render targets --------------------------------------------------------
    const type = THREE.HalfFloatType;
    const rtColors = useFBO(size.width, size.height, {type, depthBuffer: true});
    const rtDepth = useFBO(size.width, size.height, {type, depthBuffer: true});
    const rtDepthMask = useFBO(size.width, size.height, {type, depthBuffer: false});

    const lowW = Math.max(1, Math.floor(size.width * Math.max(0.33, resolutionScale)));
    const lowH = Math.max(1, Math.floor(size.height * Math.max(0.33, resolutionScale)));
    const rtGod1 = useFBO(lowW, lowH, {type});
    const rtGod2 = useFBO(lowW, lowH, {type});

    // --- Post scene with fullscreen quad --------------------------------------
    const postScene = useMemo(() => new THREE.Scene(), []);
    const postCam = useMemo(() => new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -10000, 10000), []);

    // --- Materials -------------------------------------------------------------
    const depthMat = useMemo(() => {
        const m = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking});
        m.side = THREE.DoubleSide; // water plane occludes from both sides
        m.blending = THREE.NoBlending;
        return m;
    }, []);

    const matDepthMask = useMemo(() => {
        const u = THREE
            .UniformsUtils
            .clone(GodRaysDepthMaskShader.uniforms);
        return new THREE.ShaderMaterial({uniforms: u, vertexShader: GodRaysDepthMaskShader.vertexShader, fragmentShader: GodRaysDepthMaskShader.fragmentShader});
    }, []);

    const matGenerate = useMemo(() => {
        const u = THREE
            .UniformsUtils
            .clone(GodRaysGenerateShader.uniforms);
        return new THREE.ShaderMaterial({uniforms: u, vertexShader: GodRaysGenerateShader.vertexShader, fragmentShader: GodRaysGenerateShader.fragmentShader});
    }, []);

    const matCombine = useMemo(() => {
        const u = THREE
            .UniformsUtils
            .clone(GodRaysCombineShader.uniforms);
        return new THREE.ShaderMaterial({uniforms: u, vertexShader: GodRaysCombineShader.vertexShader, fragmentShader: GodRaysCombineShader.fragmentShader, transparent: true});
    }, []);

    const matFakeSun = useMemo(() => {
        const u = THREE
            .UniformsUtils
            .clone(GodRaysFakeSunShader.uniforms);
        u
            .bgColor
            .value
            .setHex(bgColor);
        u
            .sunColor
            .value
            .setHex(sunColor);
        return new THREE.ShaderMaterial({uniforms: u, vertexShader: GodRaysFakeSunShader.vertexShader, fragmentShader: GodRaysFakeSunShader.fragmentShader});
    }, [bgColor, sunColor]);

    // --- Setup post scene ------------------------------------------------------
    useEffect(() => {
        postCam.position.z = 100;
        postScene.add(postCam);

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matGenerate // overridden per pass
        );
        quad.position.z = -9900;
        postScene.add(quad);

        return () => {
            // Dispose everything we created here
            postScene.remove(postCam);
            postScene.traverse((obj) => {
                if (obj.geometry) 
                    obj.geometry.dispose
                        ?.();
                }
            );
            postScene.clear();
        };
    }, [postCam, postScene, matGenerate]);

    // --- Resize FBOs on viewport change ---------------------------------------
    useEffect(() => {
        rtColors.setSize(size.width, size.height);
        rtDepth.setSize(size.width, size.height);
        rtDepthMask.setSize(size.width, size.height);
        rtGod1.setSize(lowW, lowH);
        rtGod2.setSize(lowW, lowH);
    }, [
        size,
        lowW,
        lowH,
        rtColors,
        rtDepth,
        rtDepthMask,
        rtGod1,
        rtGod2
    ]);

    // --- Helpers ---------------------------------------------------------------
    const clipPos = useMemo(() => new THREE.Vector4(), []);
    const screenPos = useMemo(() => new THREE.Vector3(), []);
    const sunPos = useMemo(() => new THREE.Vector3(), []);

    const getStepSize = (filterLenVal, taps, pass) => filterLenVal * Math.pow(taps, -pass);

    const filterGodRays = (inputTex, renderTarget, stepSize) => {
        postScene.overrideMaterial = matGenerate;
        matGenerate.uniforms.fStepSize.value = stepSize;
        matGenerate.uniforms.tInput.value = inputTex;

        gl.setRenderTarget(renderTarget);
        gl.render(postScene, postCam);
        postScene.overrideMaterial = null;
    };

    // --- Main loop -------------------------------------------------------------
    useFrame(() => {
        if (!enabled) 
            return;
        
        // Derive sun world position: 1) Theatre ref, 2) water/sky direction, 3) default
        if (sunRef
            ?.current) {
            sunRef
                .current
                .getWorldPosition(sunPos);
            if (lockY) 
                sunPos.y = waterY + 0.1;
            }
        else if (sunDirection
            ?.isVector3) {
            sunPos
                .copy(sunDirection)
                .normalize()
                .multiplyScalar(sunDistance);
            if (lockY) 
                sunPos.y = waterY + 0.1;
            }
        else {
            sunPos.set(0, waterY + 2000, -2000);
        }

        // Sun NDC
        clipPos
            .set(sunPos.x, sunPos.y, sunPos.z, 1.0)
            .applyMatrix4(camera.matrixWorldInverse)
            .applyMatrix4(camera.projectionMatrix);
        clipPos.x /= clipPos.w;
        clipPos.y /= clipPos.w;

        screenPos.set((clipPos.x + 1) * 0.5, (clipPos.y + 1) * 0.5, clipPos.z);

        // Share sun screen-space to shaders
        matGenerate
            .uniforms
            .vSunPositionScreenSpace
            .value
            .copy(screenPos);
        matFakeSun
            .uniforms
            .vSunPositionScreenSpace
            .value
            .copy(screenPos);
        matFakeSun.uniforms.fAspect.value = size.width / size.height;

        const isUnderwater = camera.position.y < waterY;

        if (!isUnderwater) {
            // ABOVE WATER: ensure state is clean and just draw the scene normally
            scene.overrideMaterial = null;
            postScene.overrideMaterial = null;
            gl.setScissorTest(false);
            gl.setRenderTarget(null);
            gl.render(scene, camera);
            return;
        }

        // UNDERWATER: compute attenuation vs surface to avoid blowout
        const depthAtten = THREE
            .MathUtils
            .clamp((waterY - camera.position.y) / Math.max(0.001, depthAttenRange), 0.0, 1.0);
        matCombine.uniforms.fGodRayIntensity.value = intensity * 1.2 * depthAtten;

        // 1) Clear underwater bg + draw fake sun (scissored)
        gl.setRenderTarget(rtColors);
        gl.setClearColor(new THREE.Color(bgColor), 1);
        gl.clear(true, true, false);

        const sunsqH = scissorScale * size.height;
        const sunsqW = scissorScale * size.height;
        const sx = screenPos.x * size.width;
        const sy = screenPos.y * size.height;

        gl.setScissor(sx - sunsqW / 2, sy - sunsqH / 2, sunsqW, sunsqH);
        gl.setScissorTest(true);
        postScene.overrideMaterial = matFakeSun;
        gl.setRenderTarget(rtColors);
        gl.render(postScene, postCam);
        gl.setScissorTest(false);
        postScene.overrideMaterial = null;

        // 2) Scene color
        scene.overrideMaterial = null;
        gl.setRenderTarget(rtColors);
        gl.render(scene, camera);

        // 3) Scene depth
        scene.overrideMaterial = depthMat;
        gl.setRenderTarget(rtDepth);
        gl.clear();
        gl.render(scene, camera);
        scene.overrideMaterial = null;

        // 4) Depth mask
        matDepthMask.uniforms.tInput.value = rtDepth.texture;
        postScene.overrideMaterial = matDepthMask;
        gl.setRenderTarget(rtDepthMask);
        gl.render(postScene, postCam);
        postScene.overrideMaterial = null;

        // 5) God-ray ping-pong
        const s1 = getStepSize(filterLen, tapsPerPass, 1.0);
        const s2 = getStepSize(filterLen, tapsPerPass, 2.0);
        const s3 = getStepSize(filterLen, tapsPerPass, 3.0);

        filterGodRays(rtDepthMask.texture, rtGod2, s1);
        filterGodRays(rtGod2.texture, rtGod1, s2);
        filterGodRays(rtGod1.texture, rtGod2, s3);

        // 6) Final composite to screen
        matCombine.uniforms.tColors.value = rtColors.texture;
        matCombine.uniforms.tGodRays.value = rtGod2.texture;

        postScene.overrideMaterial = matCombine;
        gl.setRenderTarget(null);
        gl.render(postScene, postCam);
        postScene.overrideMaterial = null;
    }, 1);

    return null;
}
