# 架構說明

## 總覽

```text
┌─────────────────────────────────────────────┐
│  Cloudflare Pages (Free)                      │
│  React + Vite + TS · i18n · go-engine          │
│  棋盤 · 課播放器 · 西遊 UI · EyeCare           │
└──────────────────┬──────────────────────────┘
                   │ Cookie session · 少請求
┌──────────────────▼──────────────────────────┐
│  Workers Free · Hono                          │
│  auth · children · progress · games · coach   │
└───────┬───────────────────┬─────────────────┘
        │                   │
   ┌────▼────┐      ┌───────▼────────┐
   │ D1 Free │      │ CoachProvider  │
   │ 用戶進度 │      │ 可選出站 API   │
   └─────────┘      └────────────────┘
```

**約束**：Workers Free ~10ms CPU → **規則與著法 AI 在瀏覽器**。  
**不用** Workers AI。

## 目錄職責

| 路徑 | 職責 |
|------|------|
| `apps/web` | 前端 SPA |
| `workers/api` | Hono API |
| `packages/go-engine` | 共享規則（合法子、氣、提） |
| `migrations` | D1 SQL |
| `locales` | 三語文案 |
| `content` | 課／故事大綱 |
| `docs` | 產品與交接 |

## D1 核心表（概念）

- `users` — parent | quick  
- `children` — nickname, preferred_locale, eyecare_json  
- `sessions`  
- `lesson_progress`  
- `games`  
- `badges`  

見 `migrations/0001_init.sql`。

## Coach 模組

```text
workers/api/src/coach/
  service.ts      # timeout / fallback
  prompts.ts
  contract.ts
  providers/
    none.ts
    openaiCompatible.ts
    xai.ts
    google.ts
```

## 前端關鍵 feature

- `features/eyecare` — 休息鐘與儀式  
- `features/board` — 棋盤  
- `features/lesson` — 課播放  
- `features/i18n` — locale + {{name}}  
