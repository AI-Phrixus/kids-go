# 可插拔教練 · Cloudflare 免費優先 · 防超額

## 預設鏈（`COACH_PROVIDER=auto`）

```text
1) Cloudflare Workers AI（免費額度）
2) 你填的第三方 BYOK（額度/軟上限到了自動切）
3) 本地靜態句庫（永遠可玩、零費用）
```

## 如何避免扣款

| 做法 | 說明 |
|------|------|
| **帳號維持 Workers Free** | Free 上 Workers AI 用完 **硬停**，不會像 Paid 那樣按 Neuron 續費 |
| **軟上限** `COACH_CF_SOFT_MAX_CALLS`（預設 40 次/UTC 日） | 在硬牆前改走第三方或靜態 |
| **硬限錯誤** | API 回 neuron/4006 時當日記入 `cf_fail_quota`，全日不再打 CF AI |
| **提醒** | `GET /api/coach/status` · `/api/health.coach` · 教練回應欄位 `reminder` |

官方免費量級：**約 10,000 Neurons／日**（UTC 重置）。短句教練仍建議軟上限保守。

> 若你升級到 **Workers Paid**，超過免費 Neuron 可能計費。本專案設計假設你保持 Free。

## 環境變數

見 `.env.example` · `wrangler.toml [vars]`。

```bash
# 第三方 Key（部署後）
npx wrangler secret put XAI_API_KEY
# 或
npx wrangler secret put GOOGLE_API_KEY
# 或
npx wrangler secret put AI_API_KEY
```

`wrangler.toml` 需有：

```toml
[ai]
binding = "AI"
```

## 非紅供應鏈 · 常見免費／有免費額 AI（備援參考）

「紅供應鏈」此處指 **PRC 國家力量深度關聯的雲／模型主體**（政策與信任偏好）。下列為常見 **非 PRC 主體** 選項；**是否免費、額度、地區限制請以官網當日為準**，自行註冊：

| 供應商 | 地區/主體（概況） | 用途 | 接入方式 |
|--------|-------------------|------|----------|
| **Cloudflare Workers AI** | 美 · Cloudflare | **預設第一優先** | `env.AI` |
| **Google AI Studio / Gemini** | 美 · Google | 常有 free tier | `google` + `GOOGLE_API_KEY` |
| **xAI Grok** | 美 · xAI | 付費為主，自行填 Key | `xai` + `XAI_API_KEY` |
| **Groq** | 美 · Groq | 常有免費額度／限速 | `openai_compatible` → `https://api.groq.com/openai/v1` |
| **OpenRouter** | 美 · 聚合 | 部分模型免費檔 | `openai_compatible` + 其 base URL |
| **Mistral** | 歐 · Mistral | 有實驗／免費檔可能 | openai 相容端點 |

**不預設接入**（紅供應鏈／PRC 主體雲常見例，僅列政策偏好）：阿里雲通義、百度文心、騰訊混元、字節豆包、訊飛、DeepSeek 官方雲等——你若自行填 `AI_BASE_URL` 仍可技術接通，但**產品文件不推薦**。

## 狀態 API

`GET /api/coach/status?locale=zh-Hant`

```json
{
  "dayUtc": "2026-07-24",
  "cfSoftMaxCalls": 40,
  "cfSuccessToday": 12,
  "byokConfigured": false,
  "workersAiBound": true,
  "reminder": "CF 免費教練今日已用 12/40 次。",
  "billingNote": "Stay on Workers Free..."
}
```

## 前端

教練 JSON 可含 `reminder`；家長可在設定頁輪詢 `/api/coach/status`（P1+ 可做橫幅）。
