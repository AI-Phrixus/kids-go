/** Soft original mascot — Ghibli-inspired big eyes / warm tones (not any IP character). */

export function mascotSvg(mood: "idle" | "win" | "care" = "idle"): string {
  const smile =
    mood === "win"
      ? `<path d="M38 54 Q50 66 62 54" fill="none" stroke="#4a3a28" stroke-width="2.2" stroke-linecap="round"/>`
      : mood === "care"
        ? `<path d="M40 56 Q50 52 60 56" fill="none" stroke="#4a3a28" stroke-width="2" stroke-linecap="round"/>`
        : `<path d="M40 54 Q50 60 60 54" fill="none" stroke="#4a3a28" stroke-width="2" stroke-linecap="round"/>`;

  const blush =
    mood === "care"
      ? ""
      : `<ellipse cx="34" cy="52" rx="5" ry="3" fill="#f5a090" opacity="0.45"/>
         <ellipse cx="66" cy="52" rx="5" ry="3" fill="#f5a090" opacity="0.45"/>`;

  const spark =
    mood === "win"
      ? `<circle cx="18" cy="22" r="2.5" fill="#e8c46a"/><circle cx="82" cy="28" r="2" fill="#e8c46a"/>
         <path d="M78 18 l2 4 4 1 -3 3 1 4 -4-2 -4 2 1-4 -3-3 4-1z" fill="#fff8c8" opacity="0.9"/>`
      : mood === "care"
        ? `<path d="M20 30 Q16 24 22 22" fill="none" stroke="#8ec8e8" stroke-width="1.5" stroke-linecap="round"/>
           <path d="M80 32 Q84 26 78 24" fill="none" stroke="#8ec8e8" stroke-width="1.5" stroke-linecap="round"/>`
        : `<ellipse cx="22" cy="20" rx="8" ry="4" fill="#fff" opacity="0.5"/>
           <ellipse cx="78" cy="24" rx="10" ry="5" fill="#fff" opacity="0.4"/>`;

  const bounce = mood === "win" ? "mascot-bounce" : mood === "idle" ? "mascot-float" : "";

  return `
  <svg class="mascot ${bounce}" viewBox="0 0 100 100" width="84" height="84" aria-hidden="true">
    <defs>
      <radialGradient id="skin" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffe0b0"/>
        <stop offset="100%" stop-color="#f0b878"/>
      </radialGradient>
      <radialGradient id="fur" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#f0a060"/>
        <stop offset="100%" stop-color="#c45c3a"/>
      </radialGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c8e8f8" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#a8d4a0" stop-opacity="0.15"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="28" ry="5" fill="#5a8a6a" opacity="0.2"/>
    <circle cx="50" cy="50" r="40" fill="url(#sky)"/>
    ${spark}
    <!-- ears -->
    <ellipse cx="22" cy="38" rx="10" ry="14" fill="url(#fur)" transform="rotate(-18 22 38)"/>
    <ellipse cx="78" cy="38" rx="10" ry="14" fill="url(#fur)" transform="rotate(18 78 38)"/>
    <ellipse cx="22" cy="38" rx="5" ry="8" fill="#f5c8a0" transform="rotate(-18 22 38)"/>
    <ellipse cx="78" cy="38" rx="5" ry="8" fill="#f5c8a0" transform="rotate(18 78 38)"/>
    <!-- head -->
    <circle cx="50" cy="48" r="30" fill="url(#skin)"/>
    <!-- soft hair tuft -->
    <ellipse cx="50" cy="22" rx="24" ry="12" fill="url(#fur)"/>
    <path d="M28 28 Q50 8 72 28" fill="url(#fur)"/>
    <!-- big soft eyes -->
    <ellipse cx="38" cy="46" rx="8" ry="9" fill="#fff"/>
    <ellipse cx="62" cy="46" rx="8" ry="9" fill="#fff"/>
    <ellipse cx="39" cy="47" rx="4.5" ry="5.5" fill="#3a5038"/>
    <ellipse cx="63" cy="47" rx="4.5" ry="5.5" fill="#3a5038"/>
    <circle cx="40.5" cy="45" r="1.8" fill="#fff"/>
    <circle cx="64.5" cy="45" r="1.8" fill="#fff"/>
    ${blush}
    ${smile}
    <!-- soft scarf / journey cloth -->
    <path d="M36 74 Q50 82 64 74 L62 88 Q50 92 38 88 Z" fill="#6ecf8a" opacity="0.9"/>
    <ellipse cx="50" cy="76" rx="14" ry="5" fill="#e07a4a"/>
    <text x="50" y="98" text-anchor="middle" font-size="7.5" fill="#5a6a58" font-family="system-ui,sans-serif">行者</text>
  </svg>`;
}
