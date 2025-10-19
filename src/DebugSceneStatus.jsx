import React from "react";

export default function DebugSceneStatus({
  percent,
  isFullyReady,
  extra = {},
  onForceUnlock,
}) {
  const s = {
    position: "fixed",
    right: 12,
    top: 12,
    zIndex: 99999,
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    padding: "10px 12px",
    fontFamily: "monospace",
    fontSize: 12,
    borderRadius: 8,
    lineHeight: "1.4",
    minWidth: 220,
  };

  return (
    <div style={s}>
      <div><strong>Loader percent:</strong> {percent}%</div>
      <div><strong>isFullyReady:</strong> {String(isFullyReady)}</div>
      <hr style={{ opacity: 0.15 }} />
      {Object.keys(extra).map((k) => (
        <div key={k}><strong>{k}:</strong> {String(extra[k])}</div>
      ))}
      <hr style={{ opacity: 0.15 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          onClick={() => {
            try { onForceUnlock?.(); } catch (e) {}
          }}
          style={{ padding: "6px 8px", cursor: "pointer", borderRadius: 6, border: "1px solid #666", background: "#111", color: "#fff" }}
        >
          Force Unlock
        </button>
      </div>
      <div style={{ marginTop: 8, opacity: 0.8, fontSize: 11 }}>
        Open Console to see detailed logs from useSceneReadyGate.
      </div>
    </div>
  );
}
