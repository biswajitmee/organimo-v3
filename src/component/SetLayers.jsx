// SetLayers.jsx
import { useEffect, useRef } from 'react'

export default function SetLayers({ layer = 2, only = false, children }) {
  const group = useRef()
  useEffect(() => {
    if (!group.current) return
    group.current.traverse((o) => {
      if (!o.layers) return
      if (only) {
        o.layers.mask = 0
        o.layers.enable(layer)
      } else {
        o.layers.enable(layer)
      }
    })
  }, [layer, only])
  return <group ref={group}>{children}</group>
}
