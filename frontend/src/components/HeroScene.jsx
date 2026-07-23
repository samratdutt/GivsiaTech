import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, Sparkles, Icosahedron, Torus } from "@react-three/drei";
import * as THREE from "three";
import { useTheme } from "../context/ThemeContext.jsx";

// Dark theme keeps the original lavender/gold palette; light theme swaps to
// ocean blue/neon green with brighter emissive + more ambient fill so the
// glowing nodes stay clearly visible against a white background instead of
// washing out the way dark-tuned emissive materials do on light surfaces.
const PALETTE = {
  dark: {
    lineColor: "#8B6FE8",
    lineOpacity: 0.35,
    nodeA: "#FFD23F",
    nodeB: "#C9B6FF",
    nodeEmissiveA: "#FFD23F",
    nodeEmissiveB: "#8B6FE8",
    nodeEmissiveIntensity: 1.4,
    crystalColor: "#8B6FE8",
    crystalEmissive: "#4d2fb0",
    crystalEmissiveIntensity: 0.4,
    ringColor: "#FFD23F",
    ringEmissiveIntensity: 0.8,
    sparklesColor: "#C9B6FF",
    ambientIntensity: 0.3,
    lightA: "#FFD23F",
    lightB: "#8B6FE8",
    envPreset: "city",
  },
  light: {
    lineColor: "#0077b6",
    lineOpacity: 0.45,
    nodeA: "#00c853",
    nodeB: "#0077b6",
    nodeEmissiveA: "#00c853",
    nodeEmissiveB: "#0077b6",
    nodeEmissiveIntensity: 1.1,
    crystalColor: "#0077b6",
    crystalEmissive: "#004d73",
    crystalEmissiveIntensity: 0.5,
    ringColor: "#00c853",
    ringEmissiveIntensity: 0.9,
    sparklesColor: "#0091d5",
    ambientIntensity: 0.75,
    lightA: "#00c853",
    lightB: "#0077b6",
    envPreset: "apartment",
  },
};

// A lattice of glowing nodes connected by thin lines — represents
// the "network" of automation/web/saas services GivsiaTech builds.
function NodeLattice({ p }) {
  const group = useRef();
  const nodes = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 36; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3.4 + Math.random() * 0.6;
      pts.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        )
      );
    }
    return pts;
  }, []);

  const lines = useMemo(() => {
    const segs = [];
    nodes.forEach((p, i) => {
      const next = nodes[(i + 7) % nodes.length];
      segs.push(p, next);
    });
    return segs;
  }, [nodes]);

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(lines);
    return geo;
  }, [lines]);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.08;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.15;
    }
  });

  return (
    <group ref={group}>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={p.lineColor} transparent opacity={p.lineOpacity} />
      </lineSegments>
      {nodes.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? p.nodeA : p.nodeB}
            emissive={i % 3 === 0 ? p.nodeEmissiveA : p.nodeEmissiveB}
            emissiveIntensity={p.nodeEmissiveIntensity}
          />
        </mesh>
      ))}
    </group>
  );
}

function CoreCrystal({ p }) {
  const mesh = useRef();
  useFrame((state, delta) => {
    mesh.current.rotation.y += delta * 0.25;
    mesh.current.rotation.z += delta * 0.05;
  });
  return (
    <Float speed={1.6} rotationIntensity={0.4} floatIntensity={0.9}>
      <Icosahedron ref={mesh} args={[1.35, 1]}>
        <meshStandardMaterial
          color={p.crystalColor}
          metalness={0.6}
          roughness={0.15}
          emissive={p.crystalEmissive}
          emissiveIntensity={p.crystalEmissiveIntensity}
          flatShading
        />
      </Icosahedron>
    </Float>
  );
}

function OrbitRing({ p }) {
  const ring = useRef();
  useFrame((state, delta) => {
    ring.current.rotation.x += delta * 0.15;
    ring.current.rotation.y += delta * 0.1;
  });
  return (
    <Torus ref={ring} args={[2.3, 0.012, 16, 100]} rotation={[Math.PI / 2.4, 0, 0]}>
      <meshStandardMaterial color={p.ringColor} emissive={p.ringColor} emissiveIntensity={p.ringEmissiveIntensity} />
    </Torus>
  );
}

export default function HeroScene() {
  const { theme } = useTheme();
  const p = PALETTE[theme] || PALETTE.dark;

  return (
    <Canvas
      key={theme}
      camera={{ position: [0, 0, 8.5], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0, animation: "hero-fade-in 0.5s ease" }}
    >
      <ambientLight intensity={p.ambientIntensity} />
      <pointLight position={[6, 6, 6]} intensity={1.4} color={p.lightA} />
      <pointLight position={[-6, -4, -4]} intensity={1.2} color={p.lightB} />
      <CoreCrystal p={p} />
      <OrbitRing p={p} />
      <NodeLattice p={p} />
      <Sparkles count={60} scale={9} size={2} speed={0.3} color={p.sparklesColor} />
      <Environment preset={p.envPreset} />
    </Canvas>
  );
}
