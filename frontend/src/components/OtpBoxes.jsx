import { useEffect, useRef } from "react";

// Individually-boxed OTP digit input — auto-advances focus as each digit is
// typed, supports backspace-to-previous, arrow-key navigation, and pasting
// a full code across all boxes at once (e.g. copied from an SMS/WhatsApp
// message). `value` is the in-progress digit string; box i just reflects
// value[i].
export default function OtpBoxes({ length = 6, value, onChange, disabled, autoFocus }) {
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setValueAt = (i, char) => {
    const chars = value.split("");
    chars[i] = char;
    onChange(chars.join("").slice(0, length));
  };

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setValueAt(i, "");
      return;
    }
    setValueAt(i, raw[raw.length - 1]); // last digit typed, handles overtype-in-place
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setValueAt(i - 1, "");
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="otp-electric-wrap" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          className={`otp-electric-box${value[i] ? " filled" : ""}`}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
