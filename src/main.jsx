// import React, { Suspense } from "react";
// import ReactDOM from "react-dom/client";
// import App from "./App";
// import "./App.css";
 
 
// ReactDOM.createRoot(document.getElementById("root")).render( 
//     <Suspense fallback={null}>
//       <App />
     
//     </Suspense> 
// );


import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// সবসময় কালো ব্যাকগ্রাউন্ড রাখো (safe fallback)
document.documentElement.style.background = "#000";
document.body.style.background = "#000";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
