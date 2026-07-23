import { useRef, useState } from "react";

export default function TiltCard({ children, style, className = "", glow = false }) {
  const ref = useRef();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ mx: "50%", my: "50%" });
  const [pulse, setPulse] = useState(false);

  const handleMove = (e) => {
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x, y });

    if (glow) setGlowPos({ mx: `${(x + 0.5) * 100}%`, my: `${(y + 0.5) * 100}%` });
  };

  const handleLeave = () => setTilt({ x: 0, y: 0 });

  const handleClick = () => {
    if (!glow) return;
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const scale = pulse ? 1.07 : 1;
  const lift = tilt.x || tilt.y ? -4 : 0;

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      className={`${glow ? "glow-card" : ""} ${pulse ? "glow-active" : ""} ${className}`}
      style={{
        ...style,
        "--mx": glowPos.mx,
        "--my": glowPos.my,
        transform: `perspective(900px) scale(${scale}) rotateY(${tilt.x * 10}deg) rotateX(${-tilt.y * 10}deg) translateY(${lift}px)`,
        transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.3s ease",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
