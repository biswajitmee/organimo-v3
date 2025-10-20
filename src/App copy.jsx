// src/App.jsx
import React, { useRef, useState } from "react";
import ScrollSection from "./ScrollSection";
import GsapOverlay from "./component/GsapOverlay";
// use the new simple loader
import SimpleLoader from "./SimpleLoader";

export default function App() {
  const COUNT = 4;
  const triggersRef = useRef(Array.from({ length: COUNT }).map(() => React.createRef()));
  const [unlocked, setUnlocked] = useState(false);

  return (
    <>
      {!unlocked && (
        <SimpleLoader
          autoPreviewMs={3000} // auto 3s preview after 100%
          onFinish={() => setUnlocked(true)}
        />
      )}

      <ScrollSection triggersRef={triggersRef} />
      {unlocked && <GsapOverlay triggersRef={triggersRef} />}
    </>
  );
}
