# 架構說明

> v0.8.0 已對齊實作：前端是 **無框架的 vanilla TypeScript + Vite SPA**（不是 React），由 **Worker 直接服務 assets**（不是 Cloudflare Pages）。

## 總覽

```text
┌─────────────────────────────────────────────┐
│  Browser (SPA, served by the Worker)          │
│  vanilla TS + Vite · i18n · go-engine          │
│  SVG 棋盤 · 課播放器 · 西遊 UI · EyeCare · SW   │
└──────────────────┬──────────────────────────┘
                   │ Cookie session · 少請求
┌──────────────────▼──────────────────────────┐
│  Workers Free · Hono                          │
│  auth · children · progress · games · coach   │
│  middleware: cors 白名單 · rateLimit · guards  │
│  scheduled(): 每日清理過期 session             │
└───────┬───────────────────┬─────────────────┘
        │                   │
   ┌────▼────┐      ┌───────▼──────────────┐
   │ D1 Free │      │ Coach 管線            │
   │ 用戶進度 │      │ 快取→鏈→安全過濾→句庫 │
   └─────────┘      └──────────────────────┘
```

**約束**：Workers Free ~10ms CPU → **規則、計分與著法 AI 全在瀏覽器**（`packages/go-engine`）。
教練預設「免費優先」鏈，並以 **circuit breaker + Cache API** 降低外呼；遊戲流程**永不**阻塞在 LLM 上（一定有句庫回退）。

## 目錄職責

| 路徑 | 職責 |
|------|------|
| `apps/web/src/main.ts` | 僅啟動：註冊路由、掛 shell、boot |
| `apps/web/src/{state,router,shell,events}.ts` | 單一 AppState · history/popstate · 常駐 chrome · 委派 |
| `apps/web/src/screens/*` | 每屏一模組（welcome/map/lesson/free/settings/misc） |
| `apps/web/src/board/view.ts` | SVG 棋盤顯示層 + 透明 button 輸入層 + 動畫 |
| `apps/web/src/battle/runtime.ts` | 戰鬥規則、goal 判定、星數、AI 回手 |
| `apps/web/src/{friends,coach}.ts` | 好友聊天 · 教練提示 |
| `apps/web/locales/*`（規劃）／`src/i18n.ts` | 三語文案（單一來源化進行中） |
| `packages/go-engine` | 規則（合法子、氣、提、劫、超劫）、**計分/數地**、真眼、三檔 AI |
| `workers/api` | Hono API + middleware + coach 管線 |
| `migrations` | D1 SQL（0001–0008） |
| `scripts` | sync-version · validate-lessons · check-locales · adversarial |
| `docs` | 產品與交接 |

`content/` 目前不存在；課／故事內容內嵌於 `lessons-data.ts`（真相源）。

## D1 核心表

- `users` — parent | quick（+ `failed_login_attempts` / `login_locked_until`）
- `children` — nickname, preferred_locale, eyecare_json
- `sessions` — **id = sha256(token)**（雜湊存儲）
- `lesson_progress` — status, stars, `hints_used`, `moves_used`
- `games` — result, moves_json, `score_black` / `score_white`
- `badges` · `coach_quota` · `coach_provider_state`（熔斷）· `usage_events` · `friendships` · `friend_messages`

見 `migrations/`。

## Coach 模組

```text
workers/api/src/coach/
  service.ts      # 快取→鏈→解析→安全過濾→句庫；AbortController + 8s deadline
  cache.ts        # Cache API（{{name}} 佔位符，可跨孩子共用）
  breaker.ts      # circuit breaker（D1 coach_provider_state）
  safety.ts       # 輸出安全過濾（blocklist + 語言文字 + 句數）
  prompts.ts contract.ts quota.ts staticPhrases.ts freeRotation.ts
  providers/{openaiCompatible,google,workersAi,xai}.ts   # 均支援 AbortSignal + JSON mode
```

## 前端渲染模型（v0.8.0）

- `shell.ts` 只渲染一次「常駐 chrome」（header/tip/footer/**護眼遮罩**/好友 modal）；屏幕只替換 `#screen`。
  → 修復 v0.7「護眼遮罩在非同步屏幕上按鈕失效、無法關閉」的 P0 bug。
- `board/view.ts` **定點更新**：每手只變動被觸及的交叉點，落子 scale-in、提子淡出、焦點跨手保持（鍵盤下棋可連續）。
- `router.ts` 有真正的 `popstate`：瀏覽器返回鍵正常。
