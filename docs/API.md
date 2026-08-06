# HTTP API

Base：同源 `/api`（Worker）。  
認證：HTTP-only session cookie。

## Health

`GET /api/health` → `{ "ok": true, "version": "0.7.7" }`

## Auth

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/auth/register/parent` | email + password |
| POST | `/api/auth/register/quick` | nickname + 6 位數字 pin |
| POST | `/api/auth/login` | 新帳號 6 位 PIN；舊帳號相容 4–6 位 |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | user + children |

## Children

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/auth/children` | 家長建檔 nickname, locale, parentPassword（最多 5 位孩子） |
| POST | `/api/auth/children/:id/select` | 以 parentPassword 驗證後選擇當前孩子 |

## Parent

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/parent/summary` | parentPassword + locale；取得家長摘要 |

## Progress / Lessons / Games

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/lessons` | 列表 + 解鎖 |
| POST | `/api/progress/:lessonId` | 更新通關 |
| POST | `/api/games` | 存對局摘要 |

## Coach

`POST /api/coach`

```json
{
  "tone": "hint",
  "speaker": "wukong",
  "locale": "zh-Hant",
  "childName": "太郎",
  "lessonId": "L03",
  "boardSummary": "...",
  "recentMoves": []
}
```

→ 契約見 [COACH-PROVIDERS.md](./COACH-PROVIDERS.md)。  
超時或無 Key → 服務端用靜態句庫填 `say`。

服務端不信任客戶端傳入的 `childName`；使用外部教練服務時會改用通用稱呼，避免傳出孩子暱稱。

## Settings

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/settings/ai` | 家長帳號讀取已遮蔽 Key 的教練設定 |
| PUT | `/api/settings/ai` | parentPassword 驗證後儲存 HTTPS 公網教練設定 |
| POST | `/api/settings/ai/test` | parentPassword 驗證後測試自行提供的教練服務 |
