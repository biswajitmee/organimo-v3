import { useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Gltf, ScrollControls, useScroll, Scroll } from "@react-three/drei";
import { getProject, val } from "@theatre/core";
import theatreeBBState from "./theatreState.json";
  
import {
  editable as e,
  SheetProvider,
  PerspectiveCamera,
  useCurrentSheet,
} from "@theatre/r3f";

// import studio from "@theatre/studio";
// import extension from "@theatre/r3f/dist/extension";
// studio.initialize();
// studio.extend(extension);
 
import BreakCode from "./BreakCode";
 
 import { Cloude } from "./Cloude";
import { Iland } from "./Iland";
import { Space } from "./Space";
import { StoneHeight } from "./StoneHeight";
import { Cocacola } from "./Cocacola";
import { StoneArch } from "./StoneArch";

export default function ScrollSection() {
  const sheet = getProject("myProject", { state: theatreeBBState }).sheet("Scene");
  const [mouse, setMouse] = useState([0, 0]);
  const handleMouseMove = (event) => {
    setMouse([event.clientX, event.clientY]);
  };



  const isMobile = window.innerWidth <= 768; // Adjust the width breakpoint as needed
  const pages = isMobile ? 9 : 8.5;



  return (
    <div
      style={{ height: "100vh", overflow: "hidden" }}
      onMouseMove={handleMouseMove}
    >
      <Canvas
        style={{ width: "100vw", height: "100vh" }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ScrollControls pages={pages} distance={3} damping={0.5}>
          <SheetProvider sheet={sheet}>
            <Scene />
          </SheetProvider>

          <Scroll html style={{ position: "absolute", width: "100vw" }}>
           
      
 
          </Scroll>
        </ScrollControls>
     
      </Canvas>
    </div>
  );
}

function Scene() {
  const sheet = useCurrentSheet();
  const scroll = useScroll();


  useFrame(() => {

    const sequenceLength = val(sheet.sequence.pointer.length);

    sheet.sequence.position = scroll.offset * sequenceLength;
  });
  const bgColor = "#000000";

  return (
    <>
      <color attach="background" args={[bgColor]} />

      <e.mesh theatreKey="Cloude" position={[0, 0, -1]}>     
      <Cloude />
      </e.mesh>
<fog attach="fog" args={["#000000", 10, 300]} />
<e.pointLight theatreKey="LightBlue" position={[0, 0, 1]} />
      <e.pointLight theatreKey="LightPurple" position={[0, 0, -2]} />
      <e.pointLight theatreKey="LightWhite" position={[-1, 0, -1]} />
<e.mesh theatreKey="fog" position={[0, 0, -1]}>
     <Space/>
        </e.mesh>
      <e.mesh theatreKey="Space" position={[0, 0, -1]}>
     <Space/>
        </e.mesh>


        <e.mesh theatreKey="cocacola" position={[0, 0, -1]}>
  <Cocacola/>
        </e.mesh>
        <e.mesh theatreKey="Stone Arch" position={[0, 0, -1]}>
  <StoneArch/>
        </e.mesh>

        <e.mesh theatreKey="stone Height" position={[0, 0, -1]}>
 <StoneHeight/>
        </e.mesh>


      <PerspectiveCamera
        position={[0, 0, 0]}
        theatreKey="Camera"
        makeDefault
        near={5}
        far={500}
        fov={15}
      />
      <ambientLight intensity={0.5} />


    </>
  );
}
