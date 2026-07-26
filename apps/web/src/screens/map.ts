import { api } from "../api";
import { stopIcon } from "../decor";
import { t } from "../i18n";
import { navigate } from "../router";
import { escapeHtml, displayName, setCoachBanner, setScreen } from "../shell";
import { state } from "../state";
import { openFriends } from "../friends";
import { openLesson } from "./lesson";
import { startFreePlay } from "./free";

export async function renderMap(): Promise<void> {
  const L = state.locale;
  setScreen(`<div class="card"><p class="muted">${t(L, "loading")}</p></div>`);

  let lessonsHtml = "";
  let progressPct = 0;
  let doneCount = 0;
  try {
    const data = await api.lessons();
    state.nickname = data.child.nickname;
    state.lessonTotal = data.lessons.length;
    state.allLessonIds = data.lessons.map((l) => l.id);
    doneCount = data.lessons.filter((l) => l.status === "completed").length;
    progressPct = Math.round((doneCount / Math.max(1, state.lessonTotal)) * 100);
    const cont = data.lessons.find((l) => l.status === "in_progress" && l.playable);
    state.continueLessonId =
      cont?.id ??
      data.lessons.find((l) => l.status !== "locked" && l.status !== "completed")?.id ??
      null;
    lessonsHtml = data.lessons
      .map((l, i) => {
        const title = l.titles[L] || l.titles.en || l.id;
        const locked = l.status === "locked" || !l.playable;
        const done = l.status === "completed";
        const stars = "★".repeat(l.stars) + "☆".repeat(Math.max(0, 3 - l.stars));
        const cls = locked ? "locked" : done ? "done" : "open";
        return `
          <button class="lesson ${cls} fade-in" style="animation-delay:${Math.min(i, 12) * 0.04}s" data-id="${l.id}" ${locked ? "disabled" : ""} aria-label="${escapeHtml(l.id)} ${escapeHtml(title)}">
            <span class="stop" title="">${stopIcon(i)}</span>
            <span class="lid">${l.id}</span>
            <span class="lt">${escapeHtml(title)}</span>
            <span class="ls">${locked ? t(L, "locked") : done ? stars : "▶"}</span>
          </button>`;
      })
      .join("");
  } catch {
    navigate("welcome", { push: false });
    return;
  }

  try {
    const st = await api.coachStatus(L);
    setCoachBanner(st.reminder || "");
  } catch {
    setCoachBanner("");
  }

  if (state.route !== "map") return; // user navigated away while loading

  const screen = setScreen(`
    <div class="card card-journey fade-in">
      <div class="journey-deco" aria-hidden="true">🍃 · ☁️ · 🗻 · 🌿</div>
      <div class="row between">
        <h2>${t(L, "journey")} · ${escapeHtml(displayName())}</h2>
        <div class="row">
          <button id="friends" class="primary">${t(L, "friends")}</button>
          <button id="guide-btn">${t(L, "guide")}</button>
          <button id="parent">${t(L, "parent")}</button>
          <button id="settings">${t(L, "settings")}</button>
          <button id="logout">${t(L, "logout")}</button>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-label">${t(L, "progress")}: ${doneCount}/${state.lessonTotal} · ${progressPct}%</div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${progressPct}%"></div></div>
      </div>
      <div class="row">
        ${state.continueLessonId ? `<button class="primary" id="continue">${t(L, "continue_lesson")} ${state.continueLessonId}</button>` : ""}
        <button id="free">${t(L, "free")}</button>
        <button id="friends2">${t(L, "friends_share")}</button>
      </div>
      <div class="map path" role="list">${lessonsHtml}</div>
    </div>
  `);

  screen.querySelector("#logout")?.addEventListener("click", async () => {
    await api.logout();
    state.nickname = "";
    navigate("welcome");
  });
  screen.querySelector("#settings")?.addEventListener("click", () => navigate("settings"));
  screen.querySelector("#parent")?.addEventListener("click", () => navigate("parent"));
  screen.querySelector("#guide-btn")?.addEventListener("click", () => navigate("help"));
  screen.querySelector("#friends")?.addEventListener("click", () => {
    state.friendsTab = "list";
    openFriends();
  });
  screen.querySelector("#friends2")?.addEventListener("click", () => {
    state.friendsTab = "share";
    openFriends();
  });
  screen.querySelector("#free")?.addEventListener("click", () => startFreePlay());
  screen.querySelector("#continue")?.addEventListener("click", () => {
    if (state.continueLessonId) void openLesson(state.continueLessonId);
  });
  screen.querySelectorAll(".lesson:not(.locked)").forEach((btn) => {
    btn.addEventListener("click", () => {
      void openLesson((btn as HTMLElement).dataset.id!);
    });
  });
}
