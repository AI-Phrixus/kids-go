# 狀態快照（可公開）

> 無密鑰。  
> **最後更新**：2026-07-24  
> **程式版本**：v0.0.1（P0 骨架可 clone）

---

## 服務

| 項 | 狀態 |
|----|------|
| 生產部署 | **尚未** |
| GitHub | https://github.com/AI-Phrixus/kids-go · **main 已同步** |
| Cloudflare | 規劃 Free only；D1 id 仍為占位 |
| Workers AI | **不使用** |
| 教練 | 預設 `none` 靜態句庫；openai_compatible / xai / google 骨架已備 |

---

## 已完成（P0）

| 項 | 狀態 |
|----|------|
| panbridge 級 docs | **完成**（科學／西遊／護眼／課綱／架構／API…） |
| D1 `migrations/0001_init.sql` | **完成** |
| `packages/go-engine` | **完成**（氣、提子、弱 AI L0–L2） |
| `workers/api` Coach multi-provider | **完成**（含 `/api/health` `/api/coach`） |
| `apps/web` 演示殼 | **完成**（三語、暱稱、9 路試下、休息 overlay） |
| locales 護眼／故事占位 | **完成** |
| 私有 handoff 目錄 | 本機 `kids-go-private-handoff/`（不上庫） |

---

## 產品決策（鎖定）

1. 10–11 歲；暑假→8 月中下學期  
2. 《西遊記》唯一敘事宇宙  
3. 角色叫暱稱；語言=UI  
4. CF Free；教練可插拔  
5. 護眼休息角色化  
6. 抗中斷：commit+push 真相源  

---

## 下一步（P1）

1. `wrangler d1 create` 填真實 database_id  
2. 雙軌註冊 + session + progress API  
3. L01–L03 課內容 JSON + 課播放器  
4. 休息鐘改回 20 分鐘預設（演示現為 1 分鐘）  
5. 密碼雜湊與 rate limit  

---

## 本機

```bash
cd /Users/phrixusjhon/kids-go
npm install
npx wrangler dev   # API
npx vite --config apps/web/vite.config.ts  # UI
```
