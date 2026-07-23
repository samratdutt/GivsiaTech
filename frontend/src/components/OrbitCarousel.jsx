import { useEffect, useRef, useState } from "react";

/**
 * Arranges `items` around a 3D circle (rotateY + translateZ) that spins
 * continuously. Each card is counter-rotated so it always faces the viewer.
 * Pauses on hover. Only starts animating once scrolled into view.
 *
 * items: array of any shape
 * renderItem: (item, index) => ReactNode
 */
export default function OrbitCarousel({ items, renderItem, radius = 320, height = 420, duration = 26 }) {
  const stageRef = useRef();
  const [inView, setInView] = useState(false);
  // The 3D rotateY/translateZ math that makes this carousel work assumes
  // room on either side of the stage — on a narrow phone screen the cards
  // swing off past the viewport edge instead of orbiting into view, so
  // below this width it falls back to a plain stacked list instead.
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 700);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.25 }
    );
    if (stageRef.current) obs.observe(stageRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 700);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const angleStep = 360 / items.length;

  if (isNarrow) {
    return (
      <div className="orbit-stacked">
        {items.map((item, i) => (
          <div key={i} className="orbit-card">
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={stageRef} className="orbit-stage" style={{ height }}>
      <div
        className="orbit-ring"
        style={{
          animationDuration: `${duration}s`,
          animationPlayState: inView ? "running" : "paused",
        }}
      >
        {items.map((item, i) => {
          const angle = angleStep * i;
          return (
            <div
              key={i}
              className="orbit-item"
              style={{
                transform: `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px)`,
              }}
            >
              <div
                className="orbit-card orbit-bob"
                style={{
                  transform: `rotateY(${-angle}deg)`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                {renderItem(item, i)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
