# HTTP API（契約草案）

Base：同源 `/api`（Worker）。  
認證：HTTP-only session cookie。

## Health

`GET /api/health` → `{ "ok": true, "version": "0.0.1" }`

## Auth

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/auth/register/parent` | email + password |
| POST | `/api/auth/register/quick` | nickname + pin |
| POST | `/api/auth/login` | |
| POST | `/api/auth/logout` | |
| GET | `/api/me` | user + children |

## Children

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/children` | 建檔 nickname, locale |
| POST | `/api/children/:id/select` | 當前孩子 |

## Progress / Lessons / Games

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/lessons` | 列表 + 解鎖 |
| GET | `/api/progress` | 當前孩子 |
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

## Settings

`PATCH /api/settings/eyecare` — break 間隔、每日上限等。
