import { api } from "./api";
import { nextPostureTip } from "./care-rituals";
import { friendlyError } from "./errors";
import { t } from "./i18n";
import { escapeHtml } from "./shell";
import { sfx } from "./sfx";
import { persist, state } from "./state";
import { checkTyping, pickPracticePhrase, targetHtml } from "./typing";

/** Friends modal + kid chat (extracted from main.ts in the v0.8.0 refactor). */

function errMsg(e: unknown): string {
  return friendlyError(e instanceof Error ? e.message : String(e), state.locale);
}

let shareText = "";

function stopChatPoll(): void {
  if (state.chatPollTimer) {
    window.clearInterval(state.chatPollTimer);
    state.chatPollTimer = null;
  }
}

export function openFriends(): void {
  state.friendsOpen = true;
  state.friendsStatus = "";
  void paintFriendsPanel();
  document.querySelector("#friends-modal")?.classList.remove("hidden");
}

export function closeFriends(): void {
  state.friendsOpen = false;
  stopChatPoll();
  document.querySelector("#friends-modal")?.classList.add("hidden");
}

async function paintFriendsPanel(): Promise<void> {
  const panel = document.querySelector("#friends-panel");
  const L = state.locale;
  if (!panel) return;
  panel.innerHTML = `<p class="muted">${t(L, "loading")}</p>`;
  try {
    const data = await api.friends();
    state.nickname = data.me.nickname || state.nickname;
    const siteUrl = location.origin + "/";
    const tabs = `
      <div class="tabs friends-tabs">
        <button data-ftab="list" class="${state.friendsTab === "list" ? "on" : ""}">${t(L, "friends_list")}</button>
        <button data-ftab="add" class="${state.friendsTab === "add" ? "on" : ""}">${t(L, "friends_add")}</button>
        <button data-ftab="chat" class="${state.friendsTab === "chat" ? "on" : ""}">${t(L, "friends_chat")}</button>
        <button data-ftab="share" class="${state.friendsTab === "share" ? "on" : ""}">${t(L, "friends_share")}</button>
      </div>`;

    let body = "";
    if (state.friendsTab === "list") {
      const pendingIn = data.pendingIn
        .map(
          (f) =>
            `<div class="friend-row">
              <span>${escapeHtml(f.nickname)}</span>
              <button data-accept="${f.id}" class="primary">${t(L, "friends_accept")}</button>
            </div>`,
        )
        .join("");
      const pendingOut = data.pendingOut
        .map((f) => `<div class="friend-row muted"><span>${escapeHtml(f.nickname)} …</span></div>`)
        .join("");
      const flist = data.friends.length
        ? data.friends
            .map(
              (f) =>
                `<div class="friend-row">
                  <button class="linkish" data-chat="${f.id}" data-nick="${escapeHtml(f.nickname)}">💬 ${escapeHtml(f.nickname)}</button>
                  <button data-rm="${f.id}" class="danger-lite">${t(L, "friends_remove")}</button>
                </div>`,
            )
            .join("")
        : `<p class="muted">${t(L, "friends_empty")}</p>`;
      body = `
        <p class="muted">${t(L, "friends_my_name")}: <strong>${escapeHtml(data.me.nickname)}</strong></p>
        ${data.pendingIn.length ? `<h3>${t(L, "friends_pending_in")}</h3>${pendingIn}` : ""}
        ${data.pendingOut.length ? `<h3>${t(L, "friends_pending_out")}</h3>${pendingOut}` : ""}
        <h3>${t(L, "friends_list")}</h3>
        ${flist}`;
    } else if (state.friendsTab === "add") {
      body = `
        <p class="story">${t(L, "friends_add_hint")}</p>
        <label>${t(L, "nickname")}<input id="fnick" maxlength="12" autocomplete="off" /></label>
        <button class="primary" id="fadd">${t(L, "friends_add")}</button>
        <p class="err" id="ferr" role="status">${escapeHtml(state.friendsStatus)}</p>`;
    } else if (state.friendsTab === "chat") {
      if (!state.chatFriendshipId) {
        const picks = data.friends
          .map(
            (f) =>
              `<button class="friend-chip" data-chat="${f.id}" data-nick="${escapeHtml(f.nickname)}">${escapeHtml(f.nickname)}</button>`,
          )
          .join("");
        body = `<p class="muted">${t(L, "friends_pick")}</p><div class="row">${picks || "—"}</div>`;
      } else {
        if (!state.typeTarget) state.typeTarget = pickPracticePhrase(L);
        if (!state.postureTip) state.postureTip = nextPostureTip(L);
        const bubbles = state.chatMsgs
          .map(
            (m) => `<div class="chat-bubble ${m.fromMe ? "me" : "them"}">${escapeHtml(m.body)}</div>`,
          )
          .join("");
        const practiceBar = state.typePractice
          ? `<div class="type-box type-quest">
              <div class="row between">
                <span class="type-quest-label">✨ ${t(L, "type_target")}</span>
                <button type="button" id="ftype-next">${t(L, "type_next")}</button>
              </div>
              <p class="type-hint muted">${t(L, "type_hint")}</p>
              <div class="type-target" id="ftype-target" aria-live="polite">${targetHtml(state.typeTarget, "")}</div>
              <div class="row type-meta">
                <span id="ftype-acc" class="type-acc">${t(L, "type_accuracy", { n: 0 })}</span>
                <span class="muted">${t(L, "type_stats", { n: state.typeWins })}</span>
              </div>
              <p id="ftype-tip" class="type-tip muted" role="status"></p>
            </div>`
          : "";
        body = `
          <p><strong>💬 ${escapeHtml(state.chatNick)}</strong></p>
          <div class="posture-tip" id="posture-tip" title="${escapeHtml(t(L, "type_posture"))}">
            <span>${escapeHtml(state.postureTip)}</span>
            <button type="button" class="linkish" id="posture-next">${t(L, "type_next")}</button>
          </div>
          <div class="row type-mode">
            <button type="button" id="mode-free" class="${!state.typePractice ? "primary" : ""}">${t(L, "type_free")}</button>
            <button type="button" id="mode-practice" class="${state.typePractice ? "primary" : ""}">${t(L, "type_practice")}</button>
          </div>
          ${practiceBar}
          <div class="chat-log" id="chat-log">${bubbles || `<p class="muted">…</p>`}</div>
          <div class="row chat-compose">
            <input id="fmsg" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="true"
              placeholder="${escapeHtml(state.typePractice ? state.typeTarget : t(L, "friends_msg_placeholder"))}" />
            <button class="primary" id="fsend" ${state.typePractice ? "disabled" : ""}>${t(L, "friends_send")}</button>
          </div>
          <p class="err" id="ferr" role="status">${escapeHtml(state.friendsStatus)}</p>`;
      }
    } else {
      const share = t(L, "friends_share_text", { name: data.me.nickname, url: siteUrl });
      body = `
        <p class="story">${escapeHtml(share)}</p>
        <p class="muted">${t(L, "friends_my_name")}: <strong>${escapeHtml(data.me.nickname)}</strong></p>
        <div class="row">
          <button class="primary" id="fcopy">${t(L, "copy_summary")}</button>
        </div>
        <p class="muted" id="ferr" role="status">${escapeHtml(state.friendsStatus)}</p>`;
      shareText = share;
    }

    panel.innerHTML = `
      <div class="row between">
        <h2>${t(L, "friends_title")}</h2>
        <button type="button" id="fclose">${t(L, "friends_close")}</button>
      </div>
      ${tabs}
      <div class="friends-body">${body}</div>`;

    panel.querySelector("#fclose")?.addEventListener("click", () => closeFriends());
    panel.querySelectorAll("[data-ftab]").forEach((b) =>
      b.addEventListener("click", () => {
        state.friendsTab = (b as HTMLElement).dataset.ftab as typeof state.friendsTab;
        if (state.friendsTab !== "chat") stopChatPoll();
        void paintFriendsPanel();
      }),
    );
    panel.querySelectorAll("[data-accept]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api.friendAccept((b as HTMLElement).dataset.accept!);
          void api.track("friend_accept");
          state.friendsStatus = t(L, "friends_added_mutual");
          void paintFriendsPanel();
        } catch (e) {
          state.friendsStatus = errMsg(e);
          void paintFriendsPanel();
        }
      }),
    );
    panel.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api.friendRemove((b as HTMLElement).dataset.rm!);
          if (state.chatFriendshipId === (b as HTMLElement).dataset.rm) {
            state.chatFriendshipId = null;
            state.chatMsgs = [];
            stopChatPoll();
          }
          void paintFriendsPanel();
        } catch (e) {
          state.friendsStatus = errMsg(e);
          void paintFriendsPanel();
        }
      }),
    );
    panel.querySelectorAll("[data-chat]").forEach((b) =>
      b.addEventListener("click", () => {
        state.chatFriendshipId = (b as HTMLElement).dataset.chat!;
        state.chatNick = (b as HTMLElement).dataset.nick || "";
        state.chatMsgs = [];
        state.chatSince = 0;
        state.friendsTab = "chat";
        state.friendsStatus = "";
        void startChat();
      }),
    );
    panel.querySelector("#fadd")?.addEventListener("click", async () => {
      const nick = (panel.querySelector("#fnick") as HTMLInputElement)?.value.trim() || "";
      try {
        const r = await api.friendAdd(nick);
        void api.track("friend_add", { status: r.status });
        state.friendsStatus =
          r.status === "accepted" || r.mutual
            ? t(L, "friends_added_mutual")
            : t(L, "friends_added_pending");
        if (r.status === "accepted") state.friendsTab = "list";
        void paintFriendsPanel();
      } catch (e) {
        state.friendsStatus = errMsg(e);
        const ferr = panel.querySelector("#ferr");
        if (ferr) ferr.textContent = state.friendsStatus;
      }
    });
    panel.querySelector("#mode-practice")?.addEventListener("click", () => {
      state.typePractice = true;
      persist("type");
      if (!state.typeTarget) state.typeTarget = pickPracticePhrase(L);
      state.friendsStatus = "";
      void paintFriendsPanel();
    });
    panel.querySelector("#mode-free")?.addEventListener("click", () => {
      state.typePractice = false;
      persist("type");
      state.friendsStatus = "";
      void paintFriendsPanel();
    });
    panel.querySelector("#posture-next")?.addEventListener("click", () => {
      state.postureTip = nextPostureTip(L);
      const el = panel.querySelector("#posture-tip span");
      if (el) el.textContent = state.postureTip;
    });
    panel.querySelector("#ftype-next")?.addEventListener("click", () => {
      state.typeTarget = pickPracticePhrase(L, state.typeTarget);
      const input = panel.querySelector("#fmsg") as HTMLInputElement | null;
      if (input) input.value = "";
      updateTypeFeedback("");
      if (input) {
        input.placeholder = state.typeTarget;
        input.focus();
      }
    });
    panel.querySelector("#fsend")?.addEventListener("click", () => void sendChat());
    const fmsg = panel.querySelector("#fmsg") as HTMLInputElement | null;
    fmsg?.addEventListener("input", () => {
      updateTypeFeedback(fmsg.value);
    });
    fmsg?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        void sendChat();
      }
    });
    if (state.friendsTab === "chat" && state.chatFriendshipId) {
      fmsg?.focus();
      if (state.typePractice) updateTypeFeedback(fmsg?.value || "");
    }
    panel.querySelector("#fcopy")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareText);
        state.friendsStatus = t(L, "copied");
        void api.track("friend_share");
      } catch {
        state.friendsStatus = shareText.slice(0, 60);
      }
      const ferr = panel.querySelector("#ferr");
      if (ferr) ferr.textContent = state.friendsStatus;
    });
    const log = panel.querySelector("#chat-log");
    if (log) log.scrollTop = log.scrollHeight;
  } catch (e) {
    panel.innerHTML = `<p class="err">${escapeHtml(errMsg(e))}</p>
      <button id="fclose">${t(L, "friends_close")}</button>`;
    panel.querySelector("#fclose")?.addEventListener("click", () => closeFriends());
  }
}

function updateTypeFeedback(typed: string): void {
  if (!state.typePractice || !state.typeTarget) return;
  const L = state.locale;
  const chk = checkTyping(state.typeTarget, typed);
  const targetEl = document.querySelector("#ftype-target");
  const accEl = document.querySelector("#ftype-acc");
  const tipEl = document.querySelector("#ftype-tip");
  const sendBtn = document.querySelector("#fsend") as HTMLButtonElement | null;
  if (targetEl) targetEl.innerHTML = targetHtml(state.typeTarget, typed);
  if (accEl) accEl.textContent = t(L, "type_accuracy", { n: chk.accuracy });
  accEl?.classList.toggle("type-good", chk.exact);
  accEl?.classList.toggle("type-warn", !chk.exact && typed.length > 0);
  if (tipEl) {
    if (!typed) tipEl.textContent = t(L, "type_hint");
    else if (chk.exact) tipEl.textContent = t(L, "type_ok");
    else tipEl.textContent = t(L, "type_fix");
  }
  if (sendBtn) sendBtn.disabled = !chk.exact;
}

async function startChat(): Promise<void> {
  stopChatPoll();
  if (!state.typeTarget) state.typeTarget = pickPracticePhrase(state.locale);
  try {
    const res = await api.friendMessages(state.chatFriendshipId!, 0);
    state.chatMsgs = res.messages;
    state.chatSince = state.chatMsgs.reduce((m, x) => Math.max(m, x.at), 0);
  } catch {
    state.chatMsgs = [];
  }
  await paintFriendsPanel();
  state.chatPollTimer = window.setInterval(() => void pollChat(), 4000);
}

function repaintLog(): void {
  const log = document.querySelector("#chat-log");
  if (!log) return;
  log.innerHTML = state.chatMsgs
    .map((m) => `<div class="chat-bubble ${m.fromMe ? "me" : "them"}">${escapeHtml(m.body)}</div>`)
    .join("");
  log.scrollTop = log.scrollHeight;
}

async function pollChat(): Promise<void> {
  if (!state.chatFriendshipId || !state.friendsOpen) return;
  if (document.visibilityState === "hidden") return; // v0.8.0: no polling in background tabs
  try {
    const res = await api.friendMessages(state.chatFriendshipId, state.chatSince);
    if (res.messages.length) {
      state.chatMsgs = [...state.chatMsgs, ...res.messages].slice(-80);
      state.chatSince = state.chatMsgs.reduce((m, x) => Math.max(m, x.at), state.chatSince);
      repaintLog();
    }
  } catch {
    /* ignore poll errors */
  }
}

async function sendChat(): Promise<void> {
  if (!state.chatFriendshipId) return;
  const L = state.locale;
  const input = document.querySelector("#fmsg") as HTMLInputElement | null;
  let body = input?.value || "";
  if (state.typePractice) {
    const chk = checkTyping(state.typeTarget, body);
    if (!chk.exact) {
      state.friendsStatus = t(L, "type_fix");
      updateTypeFeedback(body);
      const ferr = document.querySelector("#ferr");
      if (ferr) ferr.textContent = state.friendsStatus;
      sfx.wrong();
      return;
    }
    body = state.typeTarget;
  } else {
    body = body.trim();
  }
  if (!body) return;
  try {
    const r = await api.friendSend(state.chatFriendshipId, body);
    state.chatMsgs.push(r.message);
    state.chatSince = Math.max(state.chatSince, r.message.at);
    if (input) input.value = "";
    state.friendsStatus = "";
    if (state.typePractice) {
      state.typeWins += 1;
      persist("type-wins");
      state.typeTarget = pickPracticePhrase(L, state.typeTarget);
      sfx.ok();
      void api.track("friend_msg", { practice: true, accuracy: 100 });
      updateTypeFeedback("");
      if (input) input.placeholder = state.typeTarget;
    } else {
      void api.track("friend_msg", { practice: false });
    }
    repaintLog();
    const statsHint = document.querySelector(".type-meta .muted");
    if (statsHint && state.typePractice) statsHint.textContent = t(L, "type_stats", { n: state.typeWins });
    const tip = document.querySelector("#ftype-tip");
    if (tip && state.typePractice) tip.textContent = t(L, "type_ok");
    input?.focus();
  } catch (e) {
    state.friendsStatus = errMsg(e);
    const ferr = document.querySelector("#ferr");
    if (ferr) ferr.textContent = state.friendsStatus;
  }
}
