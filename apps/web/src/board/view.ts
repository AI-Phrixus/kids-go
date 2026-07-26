import {
  groupLiberties,
  idx,
  type BoardState,
  type Color,
  type Point,
} from "../../../../packages/go-engine/src/index";
import { state } from "../state";

/**
 * Board view v2 (v0.8.0).
 * - SVG display layer: real grid lines, star points, stones ON intersections,
 *   optional coordinates, capture/place animations, territory overlay.
 * - Input stays a transparent <button> grid overlay: a11y labels, focus and
 *   keyboard navigation are unchanged from v0.7, tap targets >= 44px via CSS.
 * - update() patches only changed intersections — no full re-render per move,
 *   so keyboard focus survives and stones can animate.
 */

const HOSHI_9: ReadonlyArray<readonly [number, number]> = [
  [2, 2],
  [2, 6],
  [4, 4],
  [6, 2],
  [6, 6],
];

export interface BoardView {
  el: HTMLElement;
  update(next: BoardState, opts?: UpdateOpts): void;
  setTerritory(map: (Color | "neutral" | null)[] | null): void;
  setInteractive(on: boolean): void;
  focusCell(p: Point): void;
  destroy(): void;
}

export interface UpdateOpts {
  lastMove?: Point | null;
  captured?: Point[];
  animate?: boolean;
}

export interface BoardViewOpts {
  interactive?: boolean;
  coords?: boolean;
  onTap?: (x: number, y: number) => void;
}

/** Geometry: viewBox units. One cell = 10; margin = 7 (room for coords). */
const CELL = 10;
const MARGIN = 7;

function pos(i: number): number {
  return MARGIN + i * CELL;
}

export function createBoardView(container: HTMLElement, board: BoardState, opts: BoardViewOpts = {}): BoardView {
  const size = board.size;
  const span = MARGIN * 2 + CELL * (size - 1);
  const coords = opts.coords ?? true;

  // --- SVG display layer ---
  const lines: string[] = [];
  for (let i = 0; i < size; i++) {
    lines.push(
      `<line x1="${pos(0)}" y1="${pos(i)}" x2="${pos(size - 1)}" y2="${pos(i)}" class="bl"/>`,
      `<line x1="${pos(i)}" y1="${pos(0)}" x2="${pos(i)}" y2="${pos(size - 1)}" class="bl"/>`,
    );
  }
  const hoshi = HOSHI_9.filter(() => size === 9)
    .map(([x, y]) => `<circle cx="${pos(x)}" cy="${pos(y)}" r="1.1" class="hoshi-dot"/>`)
    .join("");
  let coordHtml = "";
  if (coords) {
    const letters = "ABCDEFGHJKLMNOPQRST"; // no I, Go convention
    for (let i = 0; i < size; i++) {
      coordHtml += `<text x="${pos(i)}" y="${MARGIN - 4}" class="coord">${letters[i]}</text>`;
      coordHtml += `<text x="${MARGIN - 4.5}" y="${pos(i) + 1.3}" class="coord">${size - i}</text>`;
    }
  }

  container.innerHTML = `
    <div class="board2-wrap">
      <svg class="board2" viewBox="0 0 ${span} ${span}" aria-hidden="true">
        <rect x="1" y="1" width="${span - 2}" height="${span - 2}" rx="3" class="board-bg"/>
        ${lines.join("")}
        ${hoshi}
        ${coordHtml}
        <g id="territory-layer"></g>
        <g id="stone-layer"></g>
        <circle id="last-marker" class="last-marker hidden" r="1.6"/>
      </svg>
      <div class="board2-grid" role="grid" aria-label="Go board ${size}x${size}" tabindex="0"
           style="grid-template-columns:repeat(${size},1fr);--board-margin:${(MARGIN - CELL / 2) / span * 100}%;--board-span:${(CELL * size) / span * 100}%">
        ${board.grid
          .map((_, i) => {
            const x = i % size;
            const y = (i / size) | 0;
            return `<button type="button" class="cell2" data-x="${x}" data-y="${y}" aria-label="empty ${x + 1},${y + 1}"></button>`;
          })
          .join("")}
      </div>
    </div>`;

  const svg = container.querySelector<SVGSVGElement>(".board2")!;
  const stoneLayer = svg.querySelector<SVGGElement>("#stone-layer")!;
  const territoryLayer = svg.querySelector<SVGGElement>("#territory-layer")!;
  const lastMarker = svg.querySelector<SVGCircleElement>("#last-marker")!;
  const grid = container.querySelector<HTMLElement>(".board2-grid")!;

  let current: BoardState = board;
  let interactive = opts.interactive ?? true;
  grid.classList.toggle("noninteractive", !interactive);

  function stoneId(i: number): string {
    return `st-${i}`;
  }

  function drawStone(i: number, color: Color, animate: boolean): void {
    const x = i % size;
    const y = (i / size) | 0;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("id", stoneId(i));
    c.setAttribute("cx", String(pos(x)));
    c.setAttribute("cy", String(pos(y)));
    c.setAttribute("r", "4.6");
    c.setAttribute("class", `stone ${color}${animate ? " place-anim" : ""}`);
    stoneLayer.appendChild(c);
  }

  function removeStone(i: number, animate: boolean): void {
    const el = stoneLayer.querySelector(`#${stoneId(i)}`);
    if (!el) return;
    if (animate) {
      el.classList.add("capture-anim");
      window.setTimeout(() => el.remove(), 260);
    } else {
      el.remove();
    }
  }

  function syncCellLabel(i: number, color: Color | null, libs?: number): void {
    const x = i % size;
    const y = (i / size) | 0;
    const btn = grid.children[i] as HTMLButtonElement;
    btn.setAttribute(
      "aria-label",
      color ? `${color} ${x + 1},${y + 1}` : `empty ${x + 1},${y + 1}`,
    );
    btn.textContent = libs !== undefined && color ? String(libs) : "";
    btn.classList.toggle("has-lib-num", libs !== undefined && !!color);
    btn.classList.toggle("on-black", color === "black" && libs !== undefined);
  }

  function fullSync(next: BoardState, animate: boolean, capturedIdx?: Set<number>): void {
    for (let i = 0; i < next.grid.length; i++) {
      const was = current.grid[i] ?? null;
      const now = next.grid[i] ?? null;
      if (was !== now) {
        if (was) removeStone(i, animate && (capturedIdx?.has(i) ?? true));
        if (now) drawStone(i, now, animate);
      }
      const libs =
        state.showLibs && now ? groupLiberties(next, i % size, (i / size) | 0) : undefined;
      syncCellLabel(i, now, libs);
    }
  }

  function setLastMarker(p: Point | null): void {
    if (!p) {
      lastMarker.classList.add("hidden");
      return;
    }
    lastMarker.classList.remove("hidden");
    lastMarker.setAttribute("cx", String(pos(p.x)));
    lastMarker.setAttribute("cy", String(pos(p.y)));
    const onBlack = current.grid[idx(size, p.x, p.y)] === "black";
    lastMarker.classList.toggle("on-black", onBlack);
  }

  // initial paint (no animation)
  fullSync(board, false);
  current = board;

  // --- input ---
  const onClick = (e: Event): void => {
    if (!interactive) return;
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".cell2");
    if (!btn) return;
    const x = Number(btn.dataset.x);
    const y = Number(btn.dataset.y);
    state.focusCell = { x, y };
    syncFocus();
    opts.onTap?.(x, y);
  };
  grid.addEventListener("click", onClick);

  function syncFocus(focusDom = false): void {
    grid.querySelectorAll(".cell2.focus").forEach((el) => el.classList.remove("focus"));
    const f = state.focusCell;
    if (!f) return;
    const btn = grid.children[idx(size, f.x, f.y)] as HTMLButtonElement | undefined;
    btn?.classList.add("focus");
    if (focusDom) btn?.focus();
  }

  const onKey = (e: KeyboardEvent): void => {
    if (!interactive) return;
    if (!state.focusCell) state.focusCell = { x: (size / 2) | 0, y: (size / 2) | 0 };
    const f = state.focusCell;
    const k = e.key;
    let moved = false;
    if (k === "ArrowLeft") {
      state.focusCell = { x: Math.max(0, f.x - 1), y: f.y };
      moved = true;
    } else if (k === "ArrowRight") {
      state.focusCell = { x: Math.min(size - 1, f.x + 1), y: f.y };
      moved = true;
    } else if (k === "ArrowUp") {
      state.focusCell = { x: f.x, y: Math.max(0, f.y - 1) };
      moved = true;
    } else if (k === "ArrowDown") {
      state.focusCell = { x: f.x, y: Math.min(size - 1, f.y + 1) };
      moved = true;
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      opts.onTap?.(f.x, f.y);
      return;
    }
    if (moved) {
      e.preventDefault();
      syncFocus(true);
    }
  };
  grid.addEventListener("keydown", onKey);
  if (state.focusCell) syncFocus();

  return {
    el: container,
    update(next: BoardState, u: UpdateOpts = {}): void {
      const capturedIdx = new Set((u.captured ?? []).map((p) => idx(size, p.x, p.y)));
      fullSync(next, u.animate ?? true, capturedIdx);
      current = next;
      setLastMarker(u.lastMove ?? null);
      // focus persistence across updates (keyboard play keeps working)
      syncFocus();
      if (u.captured?.length && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(30);
        } catch {
          /* ignore */
        }
      }
    },
    setTerritory(map: (Color | "neutral" | null)[] | null): void {
      if (!map) {
        territoryLayer.innerHTML = "";
        return;
      }
      let dots = "";
      for (let i = 0; i < map.length; i++) {
        if (current.grid[i]) continue;
        const owner = map[i];
        if (owner !== "black" && owner !== "white") continue;
        const x = i % size;
        const y = (i / size) | 0;
        dots += `<rect x="${pos(x) - 1.4}" y="${pos(y) - 1.4}" width="2.8" height="2.8" rx="0.6" class="terr ${owner}"/>`;
      }
      territoryLayer.innerHTML = dots;
    },
    setInteractive(on: boolean): void {
      interactive = on;
      grid.classList.toggle("noninteractive", !on);
    },
    focusCell(p: Point): void {
      state.focusCell = p;
      syncFocus(true);
    },
    destroy(): void {
      grid.removeEventListener("click", onClick);
      grid.removeEventListener("keydown", onKey);
      container.innerHTML = "";
    },
  };
}

/** Captured-stone trays + turn indicator (small HTML helper shared by screens). */
export function capturesHtml(b: BoardState, labels: { black: string; white: string }): string {
  const tray = (n: number, color: Color) =>
    `<span class="tray ${color}" aria-label="${color} captures ${n}">` +
    "●".repeat(Math.min(n, 8)) +
    (n > 8 ? `<b>+${n - 8}</b>` : "") +
    `<i>${n}</i></span>`;
  return `<div class="tray-row">
    <span class="tray-item">${labels.black} ${tray(b.captured.black, "black")}</span>
    <span class="tray-item">${labels.white} ${tray(b.captured.white, "white")}</span>
  </div>`;
}
