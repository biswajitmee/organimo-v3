
// src/component/Brick.jsx
import React, { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

/**
 * Brick (r3f component)
 *
 * Props:
 *  - texture: string (public path to image, e.g. "/texture/brick-texture.jpg")
 *  - width, height, depth: numbers (box size)
 *  - widthSegments, heightSegments, depthSegments: integers (subdivisions)
 *  - topRepeat: [rx, ry] repeat for top face
 *  - sideRepeat: [rx, ry] repeat for side faces
 *  - roughness, metalness, bumpScale (appearance)
 *  - position, rotation (three-array)
 *
 * Usage:
 *  <Brick texture="/texture/brick-texture.jpg" width={15.7} height={2.55} depth={7.9}
 *         widthSegments={4} heightSegments={5} depthSegments={6}
 *         topRepeat={[2,1]} sideRepeat={[1,1]} />
 */

export default function Briks({
  texture = "/textures/brick-texture.jpg",
  width = 15.747,
  height = 2.552,
  depth = 7.888,
  widthSegments = 4,
  heightSegments = 5,
  depthSegments = 6,
  topRepeat = [2, 1],
  sideRepeat = [1, 1],
  roughness = 0.9,
  metalness = 0.02,
  bumpScale = 0.03,
  bumpTexture = null, // optional: pass "/texture/brick-bump.jpg"
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  receiveShadow = true,
  castShadow = true,
}) {
  // load main color texture (from public/)
  const colorMap = useLoader(THREE.TextureLoader, texture);

  // make sure encoding + wrapping set for correct colors and tiling
  colorMap.encoding = THREE.sRGBEncoding;
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;

  // create per-face texture clones so we can set different repeat for top vs sides
  const sideMap = useMemo(() => {
    const t = colorMap.clone();
    t.repeat.set(sideRepeat[0], sideRepeat[1]);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [colorMap, sideRepeat]);

  const topMap = useMemo(() => {
    const t = colorMap.clone();
    t.repeat.set(topRepeat[0], topRepeat[1]);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [colorMap, topRepeat]);

  // optional bump/roughness map (if provided) or null
  const bumpMap = useMemo(() => {
    if (!bumpTexture) return null;
    const b = new THREE.TextureLoader().load(bumpTexture);
    b.wrapS = b.wrapT = THREE.RepeatWrapping;
    b.repeat.set(sideRepeat[0], sideRepeat[1]);
    b.needsUpdate = true;
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpTexture]);

  // Build 6 materials: order -> +X, -X, +Y(top), -Y(bottom), +Z, -Z
  const materials = useMemo(() => {
    const sideMat = new THREE.MeshStandardMaterial({
      map: sideMap,
      roughness,
      metalness,
      bumpMap: bumpMap,
      bumpScale,
      color: new THREE.Color(1.0, 1.0, 1.0),
      side: THREE.FrontSide,
    });

    const topMat = new THREE.MeshStandardMaterial({
      map: topMap,
      roughness: Math.max(0.0, roughness - 0.08),
      metalness: Math.max(0.0, metalness - 0.01),
      bumpMap: bumpMap,
      bumpScale: bumpScale * 0.5,
      color: new THREE.Color(1.0, 1.0, 1.0),
      side: THREE.FrontSide,
    });

    const bottomMat = new THREE.MeshStandardMaterial({
      map: sideMap,
      roughness: Math.min(1.0, roughness + 0.05),
      metalness: metalness,
      bumpMap: bumpMap,
      bumpScale: bumpScale * 1.2,
      color: new THREE.Color(0.9, 0.9, 0.92),
      side: THREE.FrontSide,
    });

    // return array matching Three's face order
    return [
      sideMat, // +X
      sideMat.clone(), // -X
      topMat, // +Y (top)
      bottomMat, // -Y (bottom)
      sideMat.clone(), // +Z
      sideMat.clone(), // -Z
    ];
  }, [sideMap, topMap, bumpMap, roughness, metalness, bumpScale]);

  // geometry with segments like your screenshot
  const geometry = useMemo(
    () => new THREE.BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments),
    [width, height, depth, widthSegments, heightSegments, depthSegments]
  );

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {/* attach each material to the mesh so faces map correctly */}
      {materials.map((m, i) => (
        <primitive key={i} object={m} attach={`material-${i}`} />
      ))}
    </mesh>
  );
}
