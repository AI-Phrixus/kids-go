# 狀態快照（可公開）

> 無密鑰。  
> **最後更新**：2026-07-24  
> **程式版本**：v0.1.0（可玩閉環 · 待 Cloudflare 遠端部署）

---

## 服務

| 項 | 狀態 |
|----|------|
| 本機 | `npx wrangler dev` → http://localhost:8787 |
| 生產部署 | **待** `wrangler login` + `d1 create` + `deploy` |
| GitHub | https://github.com/AI-Phrixus/kids-go |
| 教練 | 預設 `none` 靜態；可配 BYOK |

---

## 已完成

| 項 | 狀態 |
|----|------|
| 雙軌註冊 | parent email / quick nick+PIN |
| Session Cookie | `/api/auth/*` |
| L01–L12 課 + 人機 | 解鎖鏈 + 徽章 |
| 三語 UI + {{name}} | ja / zh-Hant / en |
| 護眼休息 | 20 分鐘 + 20 秒倒數 overlay |
| go-engine | 合法子、氣、提、弱 AI |
| 多供應商教練骨架 | none / openai_compatible / xai / google |
| 靜態資源 | Vite build → Worker ASSETS |

---

## 部署清單（需操作者授權 Cloudflare）

```bash
cd ~/kids-go
npx wrangler login          # 瀏覽器授權
npx wrangler d1 create kids-go
# 把 database_id 寫入 wrangler.toml
npx wrangler d1 migrations apply kids-go --remote
npm run deploy
```

---

## 本機玩

```bash
cd ~/kids-go
npm install --legacy-peer-deps
npm run build:web
npx wrangler d1 migrations apply kids-go --local
npx wrangler dev
# 開 http://localhost:8787
```
