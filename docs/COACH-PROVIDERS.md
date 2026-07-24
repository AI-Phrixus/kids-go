# 可插拔教練（Multi-Provider）

## 原則

1. **不綁死**任一廠商（Grok / Gemini / 中轉皆可）  
2. 預設 **`none`**：本地句庫，零延遲  
3. 第三方必有延遲 → 超時、樂觀 UI、可取消、不擋對局  
4. 換廠 = 改環境變數，不改 UI／課綱  

## Provider

| id | 說明 |
|----|------|
| `none` | 靜態 `locales/*/coach.json` |
| `openai_compatible` | 任意 `BASE_URL` + Key + Model |
| `xai` | 快捷預填 `https://api.x.ai/v1` |
| `google` | Gemini API（常有免費／優惠檔） |

## 環境變數

見倉庫根目錄 `.env.example`。

```bash
COACH_PROVIDER=none
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
COACH_TIMEOUT_MS=2500
```

## 輸出契約

```json
{
  "say": "給孩子的 1～2 句",
  "tags": ["atari"],
  "praiseBehavior": "具體行為",
  "parentNote": "給家長",
  "tone": "hint",
  "speaker": "wukong"
}
```

請求上下文：`locale, childName, speaker, lessonId, boardSummary, recentMoves, tone`。

## 調用場景

| 場景 | 觸發 |
|------|------|
| hint | 孩子點幫忙 |
| celebrate | 過關 |
| comfort | 連敗≥2 |
| parent_summary | 家長角 |

**不**每手調用。

## 切換劇本

| 情況 | 動作 |
|------|------|
| 慢／貴／掛 | 換 PROVIDER + Key |
| 谷歌優惠 | `google` + GOOGLE_API_KEY |
| 網路不穩 | `none` |

## 安全

Key 只在 Worker secrets／`.env`；不進前端 bundle；不進 Git。
