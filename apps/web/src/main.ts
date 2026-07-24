import {
  createEmptyBoard,
  listLegalMoves,
  pickAiMove,
  tryPlay,
  type BoardState,
  type Color,
} from "../../../packages/go-engine/src/index";
import { EyeCareClock } from "./eyecare";
import { t, type Locale } from "./i18n";

const app = document.querySelector<HTMLDivElement>("#app")!;
let locale: Locale = (localStorage.getItem("kids-go-locale") as Locale) || "ja";
let name = localStorage.getItem("kids-go-name") || "";
let board: BoardState = createEmptyBoard(9);
let started = false;

const clock = new EyeCareClock({ breakEveryMin: 1 }); // 1 min for demo; production 20
clock.onBreak = () => showBreak(true);

function save() {
  localStorage.setItem("kids-go-locale", locale);
  localStorage.setItem("kids-go-name", name);
}

function render() {
  const size = board.size;
  const cells = board.grid
    .map((c, i) => {
      const x = i % size;
      const y = Math.floor(i / size);
      const cls = c === "black" ? "black" : c === "white" ? "white" : "";
      return `<button class="cell ${cls}" data-x="${x}" data-y="${y}" aria-label="${x},${y}"></button>`;
    })
    .join("");

  app.innerHTML = `
    <header>
      <h1>${t(locale, "title")}</h1>
      <p class="sub">${t(locale, "subtitle")}</p>
    </header>
    <div class="row">
      <label>${t(locale, "lang")}
        <select id="locale">
          <option value="ja" ${locale === "ja" ? "selected" : ""}>日本語</option>
          <option value="zh-Hant" ${locale === "zh-Hant" ? "selected" : ""}>繁體中文</option>
          <option value="en" ${locale === "en" ? "selected" : ""}>English</option>
        </select>
      </label>
      <label>${t(locale, "name_label")}
        <input id="name" maxlength="12" placeholder="${t(locale, "name_ph")}" value="${escapeAttr(name)}" />
      </label>
      <button class="primary" id="start">${t(locale, "start")}</button>
    </div>
    <div class="card ${started ? "" : "hidden"}" id="play">
      <div class="row">
        <button id="ask">${t(locale, "ask_wukong")}</button>
        <span class="muted">${t(locale, "screen_time")}: <strong id="mins">0</strong> min</span>
      </div>
      <div class="board" style="grid-template-columns: repeat(${size}, 1fr)">${cells}</div>
      <div class="bubble" id="bubble">…</div>
    </div>
    <div class="overlay hidden" id="break">
      <div class="panel">
        <h2>${t(locale, "care_break")}</h2>
        <p id="care-text"></p>
        <p class="muted">20–20–20 · Journey rest station</p>
        <button class="primary" id="care-done">${t(locale, "care_done")}</button>
      </div>
    </div>
  `;

  document.querySelector("#locale")!.addEventListener("change", (e) => {
    locale = (e.target as HTMLSelectElement).value as Locale;
    save();
    render();
  });
  document.querySelector("#name")!.addEventListener("input", (e) => {
    name = (e.target as HTMLInputElement).value;
    save();
  });
  document.querySelector("#start")!.addEventListener("click", () => {
    name = (document.querySelector("#name") as HTMLInputElement).value.trim();
    save();
    started = true;
    board = createEmptyBoard(9);
    render();
    greet();
  });

  if (started) {
    document.querySelector("#ask")!.addEventListener("click", () => void askWukong());
    document.querySelectorAll<HTMLButtonElement>(".cell").forEach((btn) => {
      btn.addEventListener("click", () => {
        const x = Number(btn.dataset.x);
        const y = Number(btn.dataset.y);
        humanPlay(x, y);
      });
    });
    document.querySelector("#care-done")!.addEventListener("click", () => {
      showBreak(false);
      clock.resume();
    });
    const care = document.querySelector("#care-text")!;
    care.textContent = t(locale, "care_far", { name });
  }
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function setBubble(text: string) {
  const el = document.querySelector("#bubble");
  if (el) el.textContent = text;
}

function greet() {
  const lines: Record<Locale, string> = {
    ja: `${name || "きみ"}、西へ行こう！まずは黒から置いてみよう。`,
    "zh-Hant": `${name || "小朋友"}，我們一起西行！你先下黑子。`,
    en: `${name || "friend"}, let's head west! You play Black first.`,
  };
  setBubble(lines[locale]);
}

function humanPlay(x: number, y: number) {
  const next = tryPlay(board, x, y);
  if (!next) return;
  board = next;
  render();
  // AI reply
  const mv = pickAiMove(board, 0);
  if (mv) {
    const after = tryPlay(board, mv.x, mv.y);
    if (after) board = after;
  }
  render();
  const legal = listLegalMoves(board).length;
  setBubble(
    locale === "zh-Hant"
      ? `${name || "小朋友"}，這一手很穩！還有 ${legal} 處可下。`
      : locale === "ja"
        ? `${name || "きみ"}、いい手！合法点はあと ${legal}。`
        : `${name || "friend"}, nice move! ${legal} legal points left.`,
  );
}

async function askWukong() {
  setBubble("…");
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tone: "hint",
        speaker: "wukong",
        locale,
        childName: name || "friend",
        lessonId: "demo",
        boardSummary: `size=${board.size} toPlay=${board.toPlay}`,
      }),
    });
    if (!res.ok) throw new Error("coach http");
    const data = (await res.json()) as { say?: string };
    setBubble(data.say || staticHint());
  } catch {
    setBubble(staticHint());
  }
}

function staticHint(): string {
  if (locale === "zh-Hant") {
    return `${name || "小朋友"}，先數數氣，再出招——悟空也會停一秒！`;
  }
  if (locale === "ja") {
    return `${name || "きみ"}、呼吸を数えてから置こう！`;
  }
  return `${name || "friend"}, count liberties, then play!`;
}

function showBreak(on: boolean) {
  const el = document.querySelector("#break");
  if (!el) return;
  el.classList.toggle("hidden", !on);
  if (on) clock.pause();
}

setInterval(() => {
  clock.tick();
  const mins = document.querySelector("#mins");
  if (mins) mins.textContent = String(clock.activeMinutes());
}, 1000);

render();

// silence unused Color import if any
void (null as unknown as Color);
