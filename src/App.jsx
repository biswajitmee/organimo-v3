// // src/App.jsx
// import React, { useRef } from "react";
// import ScrollSection from "./ScrollSection";
// import GsapOverlay from "./GsapOverlay";

// export default function App() {
//   // create N refs for N sections
//   const COUNT = 4;
//   const triggersRef = useRef(Array.from({ length: COUNT }).map(() => React.createRef()));

//   return (
//     <div>
//       {/* pass refs to the scroll content that renders real sections */}
//       <ScrollSection triggersRef={triggersRef} />

//       {/* pass same refs to overlay so it can hook ScrollTrigger to them */}
//       <GsapOverlay triggersRef={triggersRef} />
//     </div>
//   );
// }




 // src/App.jsx
import React, { useRef, useState } from "react";
import ScrollSection from "./ScrollSection";
import GsapOverlay from "./GsapOverlay";
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
