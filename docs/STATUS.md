# 狀態快照（可公開）

> 無密鑰。  
> **最後更新**：2026-07-24  
> **程式版本**：v0.1.2（已部署 · 含第三方 AI 設定頁）

---

## 生產服務

| 項 | 狀態 |
|----|------|
| **URL** | **https://kids-go.phrixusjhon.workers.dev** |
| 健康檢查 | `GET /api/health` |
| 教練狀態 | `GET /api/coach/status?locale=zh-Hant` |
| Cloudflare 帳號 | phrixusjhon@gmail.com · Free 建議維持 |
| D1 | `kids-go` · `35d8acbd-2abd-4a68-b62e-88dfa1f0fd0d` · APAC |
| Workers AI | 已綁定 `env.AI` · `COACH_PROVIDER=auto` |
| 軟上限 | 40 次 CF 教練／UTC 日 → 再 BYOK／靜態 |

---

## 使用方式

1. 打開 https://kids-go.phrixusjhon.workers.dev  
2. 選語言 → **快速註冊**（暱稱 + 4～6 位 PIN）或家長郵箱  
3. 西行地圖 → L01…L12  
4. 約 20 分鐘會有護眼歇腳站  

### 第三方教練（網頁填寫）

登入 → 地圖右上 **「設定（第三方 AI）」** → 填 **Base URL / API Key / Model** → 儲存／測試連線。  
亦可 `npx wrangler secret put …` 作全域備援。

---

## 已完成

- 雙軌註冊 · Session · L01–L12 · 弱 AI · 三語 · 暱稱  
- Workers AI 免費優先 + 軟上限提醒 + BYOK/靜態降級  
- GitHub：https://github.com/AI-Phrixus/kids-go  

## 後續可選

- 自訂域名  
- 家長摘要 UI 橫幅  
- 調高/調低 `COACH_CF_SOFT_MAX_CALLS`  
- 更精美棋盤與西遊立繪  
