import * as THREE from 'three'
 
import CausticsLightProjector from './CausticsLightProjector'

export default function DebugUnderwaterTest() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, -260, 5]} intensity={0.8} />

      <mesh position={[-1.5, -320, 0]} castShadow receiveShadow>
        <sphereGeometry args={[6, 64, 64]} />
        <meshStandardMaterial color="#7aa8ff" roughness={0.8} metalness={0} />
      </mesh>

      <mesh position={[10, -330, -8]} rotation={[0.2, 0.6, 0]}>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial color="#ffd27a" roughness={0.9} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -340, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#2a2a2a" roughness={1} />
      </mesh>

      <CausticsLightProjector
        position={[0, -298, 0]}
        target={[0, -360, 0]}
        angle={1.45}
        intensity={7}
        distance={1000}
        decay={0}
        videoUrl="/caustics.mp4"
        repeat={[2, 1.5]}
        speed={[0.03, 0.02]}
        showHelper
      />

     
    </>
  )
}
