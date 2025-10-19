import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";

export default function ScrollOffsetBridge() {
  const scroll = useScroll();
  useFrame(() => {
    if (scroll) {
      // clamp 0..1
      const v = Math.max(0, Math.min(1, scroll.offset || 0));
      window._springScrollOffset = v;
    }
  });
  return null;
}
