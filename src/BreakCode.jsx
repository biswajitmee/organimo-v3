import {
  editable as e,
} from "@theatre/r3f";

import React, { useRef } from "react";
import { useGLTF } from "@react-three/drei";

function BreakCode(props) {
  const { nodes, materials } = useGLTF("/final-close-code.glb");
  return (
    <group {...props} dispose={null}>
      <group position={[5.745, 1.193, -0.299]}>
      <e.mesh theatreKey="mesh1"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell007.geometry}
          material={materials["Material.005"]}
        />
         
      </group>
      <group position={[7.863, 19.238, -0.524]}>
      <e.mesh theatreKey="mesh3"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell001_1.geometry}
          material={materials["Material.005"]}
        />
       <e.mesh theatreKey="mesh4"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell001_2.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[7.426, 15.749, -0.297]}>
      <e.mesh theatreKey="mesh5"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell002_1.geometry}
          material={materials["Material.005"]}
        />
         <e.mesh theatreKey="mesh6"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell002_2.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[6.549, 6.024, -0.237]}>
      <e.mesh theatreKey="mesh7"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell003_1.geometry}
          material={materials["Material.005"]}
        />
         <e.mesh theatreKey="mesh8"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell003_2.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[6.862, 9.981, -0.071]}>
      <e.mesh theatreKey="mesh9"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell004_1.geometry}
          material={materials["Material.005"]}
        />
         <e.mesh theatreKey="mesh10"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell004_2.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[4.932, -1.422, -0.593]}>
      <e.mesh theatreKey="mesh11"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell006.geometry}
          material={materials["Material.005"]}
        />
        <e.mesh theatreKey="mesh12"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell006_1.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[4.964, -1.217, 0.065]}>
      <e.mesh theatreKey="mesh13"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell007.geometry}
          material={materials["Material.005"]}
        />
         <e.mesh theatreKey="mesh14"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell007_1.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[5.28, -1.26, 0.049]}>
      <e.mesh theatreKey="mesh15"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell001_1.geometry}
          material={materials["Material.005"]}
        />
         <e.mesh theatreKey="mesh16"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell001_2.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[4.852, -1.213, 0.036]}>
      <e.mesh theatreKey="mesh17"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell002_1.geometry}
          material={materials["Material.005"]}
        />
         <e.mesh theatreKey="mesh18"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell002_2.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[4.822, -1.36, -0.26]}>
      <e.mesh theatreKey="mesh19"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell003.geometry}
          material={materials["Material.005"]}
        />
         <e.mesh theatreKey="mesh20"
          castShadow
          receiveShadow
          geometry={nodes.Cube005_cell006_cell003_1.geometry}
          material={materials["Material.005"]}
        />
      </group>
      <group position={[13.327, 14.33, 0.039]}>
      <e.mesh theatreKey="mesh21"
          castShadow
          receiveShadow
          geometry={nodes.Cube003_cell003.geometry}
          material={materials["Material.006"]}
        />
         <e.mesh theatreKey="mesh22"
          castShadow
          receiveShadow
          geometry={nodes.Cube003_cell003_1.geometry}
          material={materials["Material.006"]}
        />
      </group>
      <group position={[11.853, 15.706, 0.019]}>
      <e.mesh theatreKey="mesh23"
          castShadow
          receiveShadow
          geometry={nodes.Cube003_cell004.geometry}
          material={materials["Material.006"]}
        />
        <e.mesh theatreKey="mesh24"
          castShadow
          receiveShadow
          geometry={nodes.Cube003_cell004_1.geometry}
          material={materials["Material.006"]}
        />
      </group>
      <group position={[16.525, 11.607, -0.018]}>
      <e.mesh theatreKey="mesh25"
          castShadow
          receiveShadow
          geometry={nodes.Cube003_cell001_1.geometry}
          material={materials["Material.006"]}
        />
        <e.mesh theatreKey="mesh26"
          castShadow
          receiveShadow
          geometry={nodes.Cube003_cell001_2.geometry}
          material={materials["Material.006"]}
        />
      </group>
      <group position={[13.732, 5.843, -0.122]}>
      <e.mesh theatreKey="mesh27"
          castShadow
          receiveShadow
          geometry={nodes.Cube004_cell003.geometry}
          material={materials["Material.004"]}
        />
        <e.mesh theatreKey="mesh28"
          castShadow
          receiveShadow
          geometry={nodes.Cube004_cell003_1.geometry}
          material={materials["Material.004"]}
        />
      </group>
      <group position={[16.355, 8.74, 0.029]}>
      <e.mesh theatreKey="mesh29"
          castShadow
          receiveShadow
          geometry={nodes.Cube004_cell004.geometry}
          material={materials["Material.004"]}
        />
        <e.mesh theatreKey="mesh30"
          castShadow
          receiveShadow
          geometry={nodes.Cube004_cell004_1.geometry}
          material={materials["Material.004"]}
        />
      </group>
      <group position={[17.601, 8.5, 0.026]}>
      <e.mesh theatreKey="mesh31"
          castShadow
          receiveShadow
          geometry={nodes.Cube004_cell001_1.geometry}
          material={materials["Material.004"]}
        />
          <e.mesh theatreKey="mesh32"
          castShadow
          receiveShadow
          geometry={nodes.Cube004_cell001_2.geometry}
          material={materials["Material.004"]}
        />
      </group>
      <group position={[-3.028, 9.345, -0.117]}>
      <e.mesh theatreKey="mesh33"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell002_1.geometry}
          material={materials["Material.002"]}
        />
          <e.mesh theatreKey="mesh34"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell002_2.geometry}
          material={materials["Material.002"]}
        />
      </group>
      <group position={[0.396, 6.396, -0.012]}>
      <e.mesh theatreKey="mesh35"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell003_1.geometry}
          material={materials["Material.002"]}
        />
          <e.mesh theatreKey="mesh36"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell003_2.geometry}
          material={materials["Material.002"]}
        />
      </group>
      <group position={[-1.194, 7.933, -0.03]}>
      <e.mesh theatreKey="mesh37"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell005.geometry}
          material={materials["Material.002"]}
        />
          <e.mesh theatreKey="mesh38"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell005_1.geometry}
          material={materials["Material.002"]}
        />
      </group>
      <group position={[2.228, 4.604, -0.004]}>
      <e.mesh theatreKey="mesh39"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell006.geometry}
          material={materials["Material.002"]}
        />
          <e.mesh theatreKey="mesh40"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell006_1.geometry}
          material={materials["Material.002"]}
        />
      </group>
      <group position={[-3.253, 9.551, -0.055]}>
      <e.mesh theatreKey="mesh41"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell001_1.geometry}
          material={materials["Material.002"]}
        />
        <e.mesh theatreKey="mesh42"
          castShadow
          receiveShadow
          geometry={nodes.Cube001_cell001_2.geometry}
          material={materials["Material.002"]}
        />
      </group>
      <group position={[1.16, 14.166, -0.26]}>
      <e.mesh theatreKey="mesh43"
          castShadow
          receiveShadow
          geometry={nodes.Cube_cell003.geometry}
          material={materials["Material.001"]}
        />
        <e.mesh theatreKey="mesh44"
          castShadow
          receiveShadow
          geometry={nodes.Cube_cell003_1.geometry}
          material={materials["Material.001"]}
        />
      </group>
      <group position={[2.38, 15.209, 0.03]}>
      <e.mesh theatreKey="mesh45"
          castShadow
          receiveShadow
          geometry={nodes.Cube_cell004.geometry}
          material={materials["Material.001"]}
        />
       <e.mesh theatreKey="mesh46"
          castShadow
          receiveShadow
          geometry={nodes.Cube_cell004_1.geometry}
          material={materials["Material.001"]}
        />
      </group>
      <group position={[-0.83, 12.244, -0.067]}>
      <e.mesh theatreKey="mesh47"
          castShadow
          receiveShadow
          geometry={nodes.Cube_cell001_1.geometry}
          material={materials["Material.001"]}
        />
        <e.mesh theatreKey="mesh48"
          castShadow
          receiveShadow
          geometry={nodes.Cube_cell001_2.geometry}
          material={materials["Material.001"]}
        />
      </group>
    </group>
  );
}

useGLTF.preload("/final-close-code.glb");
export default BreakCode;
