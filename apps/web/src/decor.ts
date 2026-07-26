/** Lightweight decorative SVGs — soft fantasy / nature (no IP). */

export function skyOrnamentHtml(): string {
  return `<div class="sky-ornament" aria-hidden="true">
    <span class="spark s1">✦</span>
    <span class="spark s2">✧</span>
    <span class="spark s3">✦</span>
  </div>`;
}

export function winSparklesHtml(): string {
  return `<div class="win-sparkles" aria-hidden="true">
    <span class="sp">✦</span><span class="sp">✧</span><span class="sp">★</span>
    <span class="sp">✦</span><span class="sp">✧</span><span class="sp">✿</span>
  </div>`;
}

/** Small path marker icons by lesson index (cycle). */
export function stopIcon(i: number): string {
  const icons = ["🌿", "🗻", "☁️", "🔥", "🌊", "⭐", "🍃", "🪨"];
  return icons[i % icons.length]!;
}
