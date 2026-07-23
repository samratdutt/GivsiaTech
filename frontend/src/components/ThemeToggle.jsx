import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-pressed={isLight}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-icon theme-toggle-icon-sun">☀</span>
        <span className="theme-toggle-icon theme-toggle-icon-moon">☾</span>
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}
