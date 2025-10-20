// src/App.jsx
import React, { useRef } from "react";
import ScrollSection from "./ScrollSection";
import GsapOverlay from "./component/GsapOverlay";

export default function App() {
  // create N refs for N sections
  const COUNT = 4;
  const triggersRef = useRef(Array.from({ length: COUNT }).map(() => React.createRef()));

  return (
    <div>
      {/* pass refs to the scroll content that renders real sections */}
      <ScrollSection triggersRef={triggersRef} />

      {/* pass same refs to overlay so it can hook ScrollTrigger to them */}
      <GsapOverlay triggersRef={triggersRef} />
    </div>
  );
}
