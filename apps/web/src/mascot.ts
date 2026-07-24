/** Simple SVG mascot (Wukong-ish, original, no IP art) */
export function mascotSvg(mood: "idle" | "win" | "care" = "idle"): string {
  const smile =
    mood === "win"
      ? `<path d="M38 52 Q50 62 62 52" fill="none" stroke="#3d2b1f" stroke-width="2.5"/>`
      : mood === "care"
        ? `<path d="M40 54 Q50 50 60 54" fill="none" stroke="#3d2b1f" stroke-width="2"/>`
        : `<path d="M40 52 Q50 58 60 52" fill="none" stroke="#3d2b1f" stroke-width="2"/>`;
  const bounce = mood === "win" ? "mascot-bounce" : "";
  return `
  <svg class="mascot ${bounce}" viewBox="0 0 100 100" width="72" height="72" aria-hidden="true">
    <circle cx="50" cy="48" r="28" fill="#f0c27a"/>
    <ellipse cx="50" cy="22" rx="22" ry="10" fill="#c45c26"/>
    <circle cx="40" cy="46" r="3" fill="#2a2118"/>
    <circle cx="60" cy="46" r="3" fill="#2a2118"/>
    ${smile}
    <rect x="46" y="70" width="8" height="18" rx="3" fill="#c45c26"/>
    <text x="50" y="96" text-anchor="middle" font-size="8" fill="#6a5644">悟空</text>
  </svg>`;
}
