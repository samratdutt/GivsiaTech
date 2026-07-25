// Lightweight User-Agent parsing with no external dependency — good enough
// for the admin Visitors tab's browser/OS/device-type columns, not meant to
// be exhaustive (a real UA-parsing library would handle far more edge cases).
export function parseUserAgent(ua = "") {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /CriOS/.test(ua)
        ? "Chrome (iOS)"
        : /Chrome\//.test(ua) && !/Chromium/.test(ua)
          ? "Chrome"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua) && /Version\//.test(ua)
              ? "Safari"
              : "Other";

  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Other";

  const deviceType = /iPad|Tablet/.test(ua) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop";

  return { browser, os, deviceType };
}
