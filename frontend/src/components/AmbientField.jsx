import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "../context/ThemeContext.jsx";

function DriftingPoints({ color, opacity, size }) {
  const points = useRef();

  const positions = useMemo(() => {
    const arr = new Float32Array(220 * 3);
    for (let i = 0; i < 220; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 14 - 4;
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (points.current) {
      points.current.rotation.y += delta * 0.015;
      points.current.rotation.x += delta * 0.005;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={220} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={opacity} sizeAttenuation />
    </points>
  );
}

// Faint lavender dots read fine on the dark background but nearly vanish on
// white, so light theme uses a darker, more saturated ocean blue at higher
// opacity/size to stay visible against a light surface.
const FIELD = {
  dark: { color: "#8B6FE8", opacity: 0.5, size: 0.035 },
  light: { color: "#0077b6", opacity: 0.4, size: 0.04 },
};

// Mounted once at the App level. Sits fixed behind every section so the
// whole site (not just the hero) feels like it's inside the same 3D space.
export default function AmbientField() {
  const { theme } = useTheme();
  const f = FIELD[theme] || FIELD.dark;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: false }}>
        <DriftingPoints color={f.color} opacity={f.opacity} size={f.size} />
      </Canvas>
    </div>
  );
}
