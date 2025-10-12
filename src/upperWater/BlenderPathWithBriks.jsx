// src/BlenderPathWithBriks.jsx
import React, { useMemo } from 'react'
import { useControls } from 'leva'
import BlenderPath from './BlenderPath'
import Briks from './Briks'

export default function BlenderPathWithBriks({ points = [], cameraProps = {}, bricksProps = {} } = {}) {
  // quick local UI to override debug color if you want
  const gui = useControls('Blender Path Quick', {
    debugPathColor: { value: cameraProps.debugPathColor ?? '#ff3b30' }
  })

  const mergedCameraProps = useMemo(() => ({
    ...cameraProps,
    debugPathColor: cameraProps.debugPathColor ?? gui.debugPathColor
  }), [cameraProps, gui])

  const mergedBricksProps = useMemo(() => ({
    ...bricksProps,
    pathScale: bricksProps.pathScale ?? mergedCameraProps.pathScale ?? 5
  }), [bricksProps, mergedCameraProps])

  return (
    <group>
      <BlenderPath points={points} cameraProps={mergedCameraProps} />
      <Briks
        points={points}
        pathScale={mergedBricksProps.pathScale}
        brickSpacing={mergedBricksProps.brickSpacing ?? 10}
        brickScale={mergedBricksProps.brickScale ?? 1}
        pathColor={mergedBricksProps.pathColor ?? mergedCameraProps.debugPathColor}
      />
    </group>
  )
}
