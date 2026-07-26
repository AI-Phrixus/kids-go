import { api } from "../api";
import { friendlyError } from "../errors";
import { guideBodyHtml, guideTocHtml } from "../guide";
import { t } from "../i18n";
import { navigate } from "../router";
import { escapeHtml, setScreen } from "../shell";
import { state } from "../state";
import { privacyBodyHtml } from "../privacy-content";

function errMsg(e: unknown): string {
  return friendlyError(e instanceof Error ? e.message : String(e), state.locale);
}

function goHome(): void {
  navigate(state.nickname ? "map" : "welcome");
}

/* ---------------- help / guide ---------------- */

export function renderHelp(): void {
  const L = state.locale;
  const screen = setScreen(`
    <div class="card privacy guide-card">
      <div class="row between">
        <h2>${t(L, "guide_title")}</h2>
        <button type="button" class="primary" id="home">${t(L, "home")}</button>
      </div>
      <p class="story muted">${t(L, "guide_intro")}</p>
      <nav class="guide-toc" aria-label="TOC">${guideTocHtml(L)}</nav>
      <div class="guide-body">${guideBodyHtml(L)}</div>
      <div class="row">
        <button type="button" class="primary" id="home2">${t(L, "home")}</button>
        <button type="button" id="guide-top">${t(L, "guide_top")}</button>
      </div>
    </div>
  `);
  screen.querySelector("#home")?.addEventListener("click", goHome);
  screen.querySelector("#home2")?.addEventListener("click", goHome);
  screen.querySelector("#guide-top")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  screen.querySelectorAll(".guide-toc-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = (a as HTMLAnchorElement).getAttribute("href")?.slice(1);
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ---------------- privacy ---------------- */

export function renderPrivacy(): void {
  const screen = setScreen(
    `<div class="card privacy">${privacyBodyHtml(state.locale)}<button class="primary" id="home">${t(state.locale, "home")}</button></div>`,
  );
  screen.querySelector("#home")?.addEventListener("click", goHome);
}

/* ---------------- parent dashboard ---------------- */

export async function renderParent(): Promise<void> {
  const L = state.locale;
  setScreen(`<div class="card"><p class="muted">${t(L, "loading")}</p></div>`);
  let body: string;
  let copyText = "";
  try {
    const s = await api.parentSummary(L);
    let usageHtml = "";
    try {
      const u = await api.usageStats();
      usageHtml = `
        <h3>${t(L, "usage_30d")}</h3>
        <div class="stats">
          <div><strong>${u.summary.sessions}</strong><br/>${t(L, "sessions")}</div>
          <div><strong>${u.summary.lessonsCompleted}</strong><br/>${t(L, "lessons_done")}</div>
          <div><strong>${u.summary.eyeBreaks}</strong><br/>${t(L, "eye_breaks")}</div>
          <div><strong>${u.summary.freePlays}</strong><br/>${t(L, "free_plays")}</div>
        </div>
        <p class="muted">${t(L, "breaks_per")}: ${u.summary.breakPerLesson}</p>`;
    } catch {
      usageHtml = "";
    }
    const skills = s.skills
      .map(
        (sk) =>
          `<li><strong>${escapeHtml(sk.lessonId)}</strong> · ${escapeHtml(sk.skill)} · ${"★".repeat(sk.stars)}</li>`,
      )
      .join("");
    const badges = s.badges.length
      ? s.badges.map((b) => `<span class="badge-pill">${escapeHtml(b.name)}</span>`).join(" ")
      : `<span class="muted">—</span>`;
    const tips = s.parentTips.map((t0) => `<li>${escapeHtml(t0)}</li>`).join("");
    const next = s.nextLesson
      ? `${t(L, "next_stop")}: ${escapeHtml(s.nextLesson.id)} · ${escapeHtml(s.nextLesson.title)}`
      : "";
    body = `
      <p class="story">${escapeHtml(s.headline)}</p>
      <p class="muted">${escapeHtml(s.note)}</p>
      <div class="stats">
        <div><strong>${s.stats.completedCount}/${s.stats.totalLessons}</strong><br/>${t(L, "progress")}</div>
        <div><strong>${s.stats.totalStars}</strong><br/>${t(L, "stars")}</div>
        <div><strong>${s.stats.badgeCount}</strong><br/>${t(L, "badges")}</div>
        <div><strong>${s.stats.percent}%</strong><br/>%</div>
      </div>
      ${usageHtml}
      <h3>${t(L, "badges")}</h3>
      <div class="badge-row">${badges}</div>
      <h3>${t(L, "progress")}</h3>
      <ul class="skill-list">${skills || "<li>—</li>"}</ul>
      <p>${escapeHtml(next)}</p>
      <h3>${t(L, "parent")}</h3>
      <ul>${tips}</ul>
      <div class="row">
        <button class="primary" id="home">${t(L, "home")}</button>
        <button id="copy-sum">${t(L, "copy_summary")}</button>
      </div>
      <p class="muted" id="copy-msg" role="status"></p>
    `;
    copyText = [
      s.headline,
      `${s.stats.completedCount}/${s.stats.totalLessons} · ★${s.stats.totalStars}`,
      s.nextLesson ? `${s.nextLesson.id} ${s.nextLesson.title}` : "",
      ...s.parentTips,
    ]
      .filter(Boolean)
      .join("\n");
  } catch (e) {
    body = `<p class="err">${escapeHtml(errMsg(e))}</p>
      <button id="home">${t(L, "home")}</button>`;
  }
  if (state.route !== "parent") return;
  const screen = setScreen(`<div class="card">${body}</div>`);
  screen.querySelector("#home")?.addEventListener("click", () => navigate("map"));
  screen.querySelector("#copy-sum")?.addEventListener("click", async () => {
    const msg = screen.querySelector("#copy-msg");
    try {
      await navigator.clipboard.writeText(copyText);
      if (msg) msg.textContent = t(L, "copied");
    } catch {
      if (msg) msg.textContent = copyText.slice(0, 80);
    }
  });
}
