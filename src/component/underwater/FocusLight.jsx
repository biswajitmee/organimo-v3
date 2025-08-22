

import { SpotLight, useDepthBuffer } from "@react-three/drei"

function FocusLight() {
  const depthBuffer = useDepthBuffer()
  return <SpotLight  
  
  distance={50}
  angle={15}
  attenuation={5000}
  anglePower={1}
  depthBuffer={depthBuffer} />
}
export default FocusLight