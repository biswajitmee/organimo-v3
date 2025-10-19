import React, { useEffect, useRef, useState } from "react";

export default function LoaderOverlay({ progress = 0, canComplete = false, onClose }) {
  const [showComplete, setShowComplete] = useState(false);
  const [fade, setFade] = useState(false);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!canComplete) return;
    setShowComplete(true);
    const auto = setTimeout(() => {
      if (closedRef.current) return;
      closedRef.current = true;
      setFade(true);
      setTimeout(() => onClose?.(), 450);
    }, 600);
    return () => clearTimeout(auto);
  }, [canComplete, onClose]);

  const handleClose = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    setFade(true);
    setTimeout(() => onClose?.(), 450);
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#111",
      display: "grid",
      placeItems: "center",
      zIndex: 999999,
      opacity: fade ? 0 : 1,
      transition: "opacity .45s ease",
      willChange: "opacity"
    }}>
      {!showComplete ? (
        <div style={{ width: 140, height: 140, position: "relative", display: "grid", placeItems: "center" }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r="54" stroke="#2b2b2b" strokeWidth="2" fill="none" />
            <circle cx="60" cy="60" r="54" stroke="#d4af37" strokeWidth="2" fill="none"
              strokeDasharray={Math.PI * 2 * 54}
              strokeDashoffset={Math.PI * 2 * 54 * (1 - progress / 100)}
              style={{ transition: "stroke-dashoffset .18s linear" }}
            />
          </svg>
          <div style={{ position:"absolute", color:"#cbd5e1", fontWeight:700 }}>{`${progress}%`}</div>
        </div>
      ) : (
        <button onClick={handleClose} style={{ padding:"10px 22px", borderRadius:40, border:"2px solid #d4af37", background:"transparent", color:"#d4af37", cursor:"pointer", fontWeight:700 }}>COMPLETE</button>
      )}
    </div>
  );
}
