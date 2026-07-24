# Kids Igo（兒童圍棋 · 西遊啟蒙）

**10～11 歲（日本小學四年生）暑假友好**的圍棋戰略思維遊戲：寓教於樂、護眼休息、三語家長陪學。  
敘事宇宙：**《西遊記》**取經路 = 課線；師徒角色叫孩子的**暱稱**，語言與 **UI（日／繁中／英）** 同步。

[![Cloudflare Free](https://img.shields.io/badge/Cloudflare-Free%20only-orange)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

| | |
|--|--|
| **版本** | **v0.7.3** · L01–L20 |
| **線上** | **https://go.tdtc.indevs.in** · https://go.tdtc.dpdns.org · workers.dev |
| **目標年齡** | 約 10–11 歲（小四 · 暑假→下學期） |
| **UI 語言** | 日本語 · 繁體中文 · English |
| **部署** | Cloudflare Workers Free + D1 Free（assets 一體） |
| **教練 AI** | 免費高效優先：Groq → OpenRouter free → Gemini free → CF soft → 句庫 |
| **社交** | 暱稱互加好友 · 短訊聊天 · 邀請分享（無陌生人列表） |
| **站內說明** | 完整九章「遊戲說明」目錄（三語） |
| **倉庫** | https://github.com/AI-Phrixus/kids-go |

> **新人接手請先讀**  
> 1. [docs/HANDOFF.md](docs/HANDOFF.md)  
> 2. [docs/STATUS.md](docs/STATUS.md)  
> 3. [docs/ROADMAP.md](docs/ROADMAP.md)  
>  
> API Key 與 secret **不在本倉庫**（見本機 `kids-go-private-handoff/` 或 `.env`）。

---

## 這是什麼

- **棋**：9 路啟蒙 → 每課教程後必有人機關卡（弱 AI，保自我效能）  
- **腦**：預見、連結、取捨、效率等**可遷移戰略標籤**  
- **故事**：凡敘事以《西遊記》為藍本（悟空教練、休息站八戒幽默等）  
- **眼**：20–20–20 與角色帶領的護眼儀式（遠眺、眼操…）  
- **帳號**：家長郵箱 **或** 暱稱+PIN；進度綁孩子檔案  
- **夥伴**：暱稱互加好友 + 短訊 + 邀請；可選暗號任務；舒服姿勢提示  
- **說明**：遊戲內完整使用指南（三語 · 歡迎頁／地圖／頁腳）  

**不是**職業強 AI 軟體，也**不依賴** Cloudflare 付費 AI。無公開排行、無陌生人廣場。

---

## 架構（一句話）

```text
Browser  →  go-engine + 棋盤 + 西遊 UI + 好友聊天 + 站內說明 + 休息鐘
       │ Cookie session
Workers Free (Hono)  →  D1 用戶/進度/好友/訊息
       └─ free_first 教練：Groq → OpenRouter free → Gemini free → CF soft → 句庫
```

詳見 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 快速開始（本機）

需要 Node 20+、pnpm（或 npm）。

```bash
git clone https://github.com/AI-Phrixus/kids-go.git
cd kids-go
cp .env.example .env
npm install --legacy-peer-deps
npm run build:web
npx wrangler d1 migrations apply kids-go --local
npx wrangler dev
# 開啟 http://localhost:8787
# 快速註冊暱稱+PIN → 西行地圖 → L01…
```

部署見 [docs/DEPLOY.md](docs/DEPLOY.md)。需先 `npx wrangler login`。

---

## 文件索引

| 文件 | 內容 |
|------|------|
| **[docs/HANDOFF.md](docs/HANDOFF.md)** | 接手必讀 |
| **[docs/STATUS.md](docs/STATUS.md)** | 進度快照 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | P0/P1/P2 |
| [docs/LEARNING-SCIENCE.md](docs/LEARNING-SCIENCE.md) | 認知／心理／行為 |
| [docs/EYECARE.md](docs/EYECARE.md) | 護眼與休息 |
| [docs/CHARACTER-CARE.md](docs/CHARACTER-CARE.md) | 角色、名字、幻想倫理 |
| [docs/STORY-XIYOU.md](docs/STORY-XIYOU.md) | 《西遊記》故事憲法 |
| [docs/PRODUCT.md](docs/PRODUCT.md) | 產品願景 |
| [docs/CURRICULUM.md](docs/CURRICULUM.md) | 課綱 L01–L12 |
| [docs/I18N.md](docs/I18N.md) | 三語與 {{name}} |
| [docs/COACH-PROVIDERS.md](docs/COACH-PROVIDERS.md) | 可插拔教練 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 工程架構 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 部署 |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | 運維 |
| [docs/API.md](docs/API.md) | API |

---

## 抗中斷約定

本專案假設對話／訂閱可能隨時中斷。  
**真相源 = GitHub `main` + `docs/STATUS.md`**。每完成一小步即 commit 並 push。
