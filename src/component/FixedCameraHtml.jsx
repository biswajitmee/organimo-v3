// src/component/FixedCameraHtml.jsx
import React, { useMemo } from 'react'
import { createPortal } from 'react-dom'

export default function FixedCameraHtml({
  opacity = 1,
  visible = true,
  children,
  zIndex = 50
}) {
  if (!visible) return null
  if (typeof document === 'undefined') return null

  const portal = useMemo(() => {
    return (
      <div
        aria-hidden={!visible}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex,
          display: 'flex',
          alignItems: 'flex-end'
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            opacity,
            transition: 'opacity 280ms linear',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'flex-end'
          }}
        >
          {children}
        </div>
      </div>
    )
  }, [children, opacity, visible, zIndex])

  return createPortal(portal, document.body)
}
