// useOptionalTexture.ts
import { useEffect, useState } from 'react'
import * as THREE from 'three'

type Options = {
  repeat?: [number, number]
  anisotropy?: number
  wrapS?: THREE.Wrapping
  wrapT?: THREE.Wrapping
  colorSpace?: THREE.ColorSpace
  encoding?: THREE.TextureEncoding // for older three builds
}

export function useOptionalTexture(
  url?: string,
  {
    repeat = [1, 1],
    anisotropy = 4,
    wrapS = THREE.RepeatWrapping,
    wrapT = THREE.RepeatWrapping,
    colorSpace,
    encoding,
  }: Options = {}
) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!url) { setTex(null); return }

    let canceled = false
    const loader = new THREE.TextureLoader()

    loader.load(
      url,
      (t) => {
        if (canceled) return
        t.wrapS = wrapS
        t.wrapT = wrapT
        t.repeat.set(repeat[0], repeat[1])
        t.anisotropy = anisotropy
        if (colorSpace !== undefined) (t as any).colorSpace = colorSpace
        if (encoding !== undefined)   (t as any).encoding   = encoding
        setTex(t)
      },
      undefined,
      () => setTex(null)
    )

    return () => { canceled = true }
  }, [url, repeat[0], repeat[1], anisotropy, wrapS, wrapT, colorSpace, encoding])

  return tex
}
