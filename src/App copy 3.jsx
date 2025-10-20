// src/App.jsx
import React, { useRef } from "react";
import ScrollSection from "./ScrollSection";
import GsapOverlay from "./component/GsapOverlay";
import SimpleLoader from "./SimpleLoader";

export default function App() {
  const COUNT = 4;
  const triggersRef = useRef(Array.from({ length: COUNT }).map(() => React.createRef()));

  return (
    <>
      <SimpleLoader autoProceedMs={1000} />
      <SimpleLoader autoProceedMs={1000} />
      <div id="app-root">
        <ScrollSection triggersRef={triggersRef} />
        <GsapOverlay triggersRef={triggersRef} />
      </div>
    </>
  );
}
