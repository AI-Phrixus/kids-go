# Kids Igo 交接手冊（新帳號／新 AI 接手必讀）

> 版本：**v0.7.7**
> 最後更新：2026-08-06
> 目的：在**不依賴舊對話**的情況下接續開發與部署。

---

## 1. 這是什麼

**Kids Igo** = 兒童圍棋 Web 遊戲（Cloudflare Free）：

- 對象：約 10–11 歲（日本小四），家長可用日／繁中／英陪學  
- 故事：《西遊記》取經路包裝教程與休息  
- 每課教程後人機（弱 AI）；進度雲端（D1）  
- 護眼休息（20–20–20 + 角色儀式）  
- 教練：隱私優先 cf_first（CF soft → 已設定免費額／家長 BYOK → 句庫；外部請求不含孩子暱稱）
- 好友：暱稱互加 + 短訊 + 邀請分享；可選暗號任務；姿勢小提示  
- 站內「遊戲說明」完整教程（`apps/web/src/guide.ts`）  
- Secrets：`GROQ_API_KEY` / `OPENROUTER_API_KEY` / `GOOGLE_API_KEY`（見 [FREE-AI.md](./FREE-AI.md)）  


本地路徑（操作者）：

```text
/Users/phrixusjhon/kids-go
```

公開倉庫：

```text
https://github.com/AI-Phrixus/kids-go
```

教練防超額 / 下一任 AI：

```text
docs/AI-TO-AI-QUOTA.md
```

生產 URL：

```text
https://go.tdtc.indevs.in
https://go.tdtc.dpdns.org
https://kids-go.phrixusjhon.workers.dev
```

Cloudflare Account ID：`d86285bf94fd736fc841fc71f40a4172`  
D1 `kids-go` id：`35d8acbd-2abd-4a68-b62e-88dfa1f0fd0d`

---

## 2. 接手順序（強制）

1. `git clone` 本倉庫 · 讀 **STATUS.md**（做到哪）  
2. 讀 **ROADMAP.md**（下一步優先級）  
3. 讀 **STORY-XIYOU.md** · **LEARNING-SCIENCE.md** · **EYECARE.md**（產品憲法）  
4. 讀 **ARCHITECTURE.md** · **COACH-PROVIDERS.md**  
5. 本機 `cp .env.example .env`（Key 向操作者私有目錄索取，**不要猜**）  
6. `npm test` + `scripts/local-smoke.sh` 驗證後再提交

**禁止**把聊天記錄當真相源。

---

## 3. 環境與密鑰（只寫位置，不寫值）

| 項 | 位置 |
|----|------|
| 公開程式 | GitHub `AI-Phrixus/kids-go` |
| 本機 clone | 操作者機器上的 `kids-go/` |
| `.env` / secrets | **不上 Git**；見操作者 `kids-go-private-handoff/` |
| Cloudflare 帳號 | 操作者自有 · **Free plan only** |
| 第三方 AI Key | 可選；`COACH_PROVIDER` + Key（見 COACH-PROVIDERS.md） |

---

## 4. 本地開發（骨架成熟後）

```bash
cd kids-go
npm install
npm run db:local
npm run dev
# 開啟 http://localhost:8787；本機教練使用內建句庫，不需 Cloudflare 登入
```

健康檢查：`GET /api/health` → `{ ok: true, version: "..." }`

---

## 5. 部署要點（摘要）

- 僅 Cloudflare Free：Pages + Workers + D1  
- **不要**開 Workers AI 付費路徑  
- D1 migrations 在 `migrations/`  
- 詳見 [DEPLOY.md](./DEPLOY.md) · [OPERATIONS.md](./OPERATIONS.md)

---

## 6. 產品紅線（改碼前必讀）

1. 休息／健康由**西遊角色**說，禁止醫學恐嚇彈窗  
2. 角色必須用 **{{name}}** 暱稱；語言 = UI locale  
3. 故事宇宙唯一：《西遊記》少兒向  
4. 對局不阻塞於 LLM；超時用靜態句庫  
5. 不公開羞辱榜；保孩子自我效能  

---

## 7. 給下一任 AI 的一句話

先 `git pull` 與讀 STATUS；從 ROADMAP 未完成項接著做；每完成一單元就 push。
