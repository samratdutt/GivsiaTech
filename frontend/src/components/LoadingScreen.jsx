import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, Sparkles } from "@react-three/drei";
import gsap from "gsap";
import { useTheme } from "../context/ThemeContext.jsx";

// Dark theme: lavender wireframe around a pulsing yellow core, same accent
// pair as HeroScene. Light theme swaps to a prussian-blue wireframe around
// a black core with a subtle blue glow — reads as dark shapes on the
// light background instead of washing out.
const PALETTE = {
  dark: {
    shellColor: "#c3aeff",
    shellOpacity: 0.55,
    coreColor: "#ffd94d",
    coreEmissive: "#ffd94d",
    coreEmissiveIntensity: 1.6,
    ambientIntensity: 0.4,
    lightA: "#ffd94d",
    lightB: "#8b6fe8",
    sparklesColor: "#c3aeff",
    accentGradient: "linear-gradient(100deg, #ffd94d 0%, #c3aeff 100%)",
  },
  light: {
    shellColor: "#003153",
    shellOpacity: 0.6,
    coreColor: "#000000",
    coreEmissive: "#003153",
    coreEmissiveIntensity: 1.3,
    ambientIntensity: 0.7,
    lightA: "#003153",
    lightB: "#0a1f33",
    sparklesColor: "#003153",
    accentGradient: "linear-gradient(100deg, #003153 0%, #000000 100%)",
  },
};

// Low-poly wireframe crystal around a pulsing glowing core — standing in
// for a brand mark while the real 3D hero and site data load behind it.
function LoaderCore({ p }) {
  const shell = useRef();
  const core = useRef();

  useFrame((state, delta) => {
    if (shell.current) {
      shell.current.rotation.y += delta * 0.6;
      shell.current.rotation.x += delta * 0.25;
    }
    if (core.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.12;
      core.current.scale.set(s, s, s);
    }
  });

  return (
    <group>
      <Icosahedron ref={shell} args={[1.8, 0]}>
        <meshBasicMaterial color={p.shellColor} wireframe transparent opacity={p.shellOpacity} />
      </Icosahedron>
      <mesh ref={core}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial
          color={p.coreColor}
          emissive={p.coreEmissive}
          emissiveIntensity={p.coreEmissiveIntensity}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

// Shown on every hard page load/refresh (mounted once at the App root, not
// per-route) — fades itself out once the progress tween completes, then
// tells App to unmount it via onDone.
export default function LoadingScreen({ onDone }) {
  const { theme } = useTheme();
  const p = PALETTE[theme] || PALETTE.dark;
  const [progress, setProgress] = useState(0);
  const overlayRef = useRef(null);

  useEffect(() => {
    const counter = { value: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(overlayRef.current, {
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          onComplete: onDone,
        });
      },
    });
    tl.to(counter, {
      value: 100,
      duration: 1.6,
      ease: "power1.inOut",
      onUpdate: () => setProgress(Math.round(counter.value)),
    });
    return () => tl.kill();
  }, [onDone]);

  return (
    <div ref={overlayRef} style={overlayStyle}>
      <div style={{ width: 220, height: 220 }}>
        <Canvas key={theme} camera={{ position: [0, 0, 5], fov: 45 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={p.ambientIntensity} />
          <pointLight position={[4, 4, 4]} intensity={1.2} color={p.lightA} />
          <pointLight position={[-4, -3, -3]} intensity={1} color={p.lightB} />
          <LoaderCore p={p} />
          <Sparkles count={40} scale={4} size={1.5} speed={0.4} color={p.sparklesColor} />
        </Canvas>
      </div>
      <div style={{ ...wordmarkStyle, background: p.accentGradient }}>GIVSIATECH</div>
      <div style={barTrack}>
        <div style={{ ...barFill, width: `${progress}%`, background: p.accentGradient }} />
      </div>
      <div style={subtitleStyle}>Loading experience… {progress}%</div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "var(--bg)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "18px",
};

// `background` must stay ahead of the two `*BackgroundClip` keys here —
// React sets inline style properties in object key order, and since
// `background` is a shorthand, setting it *after* background-clip would
// silently reset background-clip back to its default (killing the
// text-clip gradient). Keeping the key present (even as `undefined`) below
// pins its position so a later `{ ...wordmarkStyle, background: ... }`
// override lands in the right spot instead of being appended at the end.
const wordmarkStyle = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "1.4rem",
  letterSpacing: "0.35em",
  background: undefined,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const barTrack = {
  width: 220,
  height: 3,
  borderRadius: 999,
  background: "var(--border)",
  overflow: "hidden",
};

const barFill = {
  height: "100%",
  borderRadius: 999,
};

const subtitleStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.8rem",
  color: "var(--text-dim)",
  letterSpacing: "0.05em",
};
