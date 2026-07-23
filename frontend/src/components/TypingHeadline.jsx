import { useEffect, useState } from "react";

/**
 * Types out `segments` (array of { text, accent?, break? }) character by
 * character across all segments in order, preserving per-segment styling.
 * `break: true` on a segment inserts a line break once that segment's
 * text has fully finished typing.
 */
export default function TypingHeadline({ segments, speed = 45, startDelay = 300, style }) {
  const [count, setCount] = useState(0);
  const fullLength = segments.reduce((sum, s) => sum + s.text.length, 0);

  useEffect(() => {
    let i = 0;
    let interval;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= fullLength) clearInterval(interval);
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let consumed = 0;
  const done = count >= fullLength;

  return (
    <h1 style={style}>
      {segments.map((seg, i) => {
        const start = consumed;
        consumed += seg.text.length;
        const visible = Math.max(0, Math.min(seg.text.length, count - start));
        const shown = seg.text.slice(0, visible);
        const segDone = count >= consumed;

        return (
          <span key={i}>
            <span style={seg.accent ? { color: "var(--yellow)" } : undefined}>{shown}</span>
            {seg.break && segDone && <br />}
          </span>
        );
      })}
      <span className="typing-cursor" style={{ opacity: done ? 1 : 1, height: "0.85em" }} />
    </h1>
  );
}
