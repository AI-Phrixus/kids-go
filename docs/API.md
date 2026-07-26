# HTTP API（契約 · v0.8.0）

Base：同源 `/api`（Worker）。
認證：HTTP-only session cookie（`kids_go_sid`；DB 內以 **sha256(token)** 存儲）。
CORS：僅白名單 origin（正式三域名 + localhost）。錯誤統一 `{ "error": "code" }`；`app.onError` 回 `{ "error": "server_error" }`（不洩漏內部）。

## Health / Coach status

- `GET /api/health` → `{ ok, version, coachProvider, coach: { freeTierConfigured, workersAiBound } }`（**靜態，零 D1**）
- `GET /api/coach/status?locale=` → 配額/鏈狀態（**v0.8：需登入**）

## Auth

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/auth/register/parent` | email + password(≥6) + childNickname |
| POST | `/api/auth/register/quick` | nickname + 4–6 位 pin |
| POST | `/api/auth/login` | `mode: parent\|quick`；失敗 3 次起**指數退避鎖定**（`account_locked` + `retryAfterSec`） |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | user + active child + children |
| POST | `/api/auth/children` | 建檔 nickname, locale |
| PATCH | `/api/auth/locale` | |
| POST | `/api/auth/children/:id/select` | ownership 檢查 |

## Progress / Lessons / Games

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/lessons` | 列表 + 循序解鎖 |
| GET | `/api/lessons/:id` | 未解鎖回 403 `locked` |
| POST | `/api/progress/:lessonId` | `{ status: "in_progress"\|"completed", stars, hintsUsed?, movesUsed? }`；status 嚴格枚舉（非法回 400） |
| POST | `/api/games` | `{ lessonId?, boardSize, result?, moves(≤512), aiLevel, scoreBlack?, scoreWhite? }`；`moves_json` ≤32KB；限流 |
| GET | `/api/badges` | |
| GET | `/api/stats` | 30 日彙總 |
| GET | `/api/parent/summary?locale=` | 家長摘要（含本地化技能/徽章名，L01–L26） |
| POST | `/api/events` | 允許清單事件；需登入 + 限流 |

## Coach

`POST /api/coach`（需登入 + 已選孩子）

```json
{
  "tone": "hint",
  "speaker": "wukong",
  "locale": "zh-Hant",
  "lessonId": "L03",
  "skillTag": "capture",
  "boardSummary": "...",
  "recentMoves": []
}
```

- `childName` 由 session 暱稱強制填入（防冒名/prompt 濫用）；送往第三方時以 `{{name}}` 佔位符替換，**名字不外送**。
- 管線：**快取 →（熔斷過濾後的）provider 鏈 → JSON 解析 → 輸出安全過濾 → 句庫回退**；AbortController + 8s 總 deadline；解析失敗或安全不過**絕不**輸出原始模型文字。
- 超時或無 Key → 服務端以 skillTag 分組的靜態句庫填 `say`。契約見 [COACH-PROVIDERS.md](./COACH-PROVIDERS.md)。

## Settings（AI / BYOK）

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/settings/ai` | 遮罩後設定 + presets；`credentialRequired: true` |
| PUT | `/api/settings/ai` | 需 `credential`（家長密碼/PIN）；baseUrl 走 **SSRF 檢查**（https、禁私網/IP/憑證） |
| POST | `/api/settings/ai/test` | 需 `credential`；只打自己設定的端點，不回傳上游錯誤內文 |

## Friends（親社交，無陌生人）

`/api/friends`（列表 · JOIN 取暱稱）、`/friends/add`、`/friends/accept`、`/friends/remove`、`/friends/messages`（GET/POST）。
訊息經共用 blocklist（禁連結/聯絡方式/不當詞）與長度限制；所有寫入端點限流。

## 排程

`scheduled()`（wrangler `[triggers] crons`）每日清理過期 session 與 90 天前的 `usage_events`。
