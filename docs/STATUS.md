# 狀態快照（可公開）

> 無密鑰。  
> **最後更新**：2026-07-24  
> **程式版本**：v0.0.1（設計與骨架階段）

---

## 服務

| 項 | 狀態 |
|----|------|
| 生產部署 | **尚未**（P0 骨架） |
| Cloudflare | 規劃：**Free only**（Pages + Workers + D1） |
| Workers AI | **不使用** |
| 教練 AI | 預設 `none` 靜態句庫；可選 BYOK 多供應商 |

---

## 當前進度

| 項 | 狀態 | 說明 |
|----|------|------|
| 倉庫建立 | **進行中** | `AI-Phrixus/kids-go` |
| panbridge 級 docs | 進行中 | 本檔起持續寫入並 push |
| monorepo 空殼 | 待辦 | wrangler / web / go-engine / coach |
| 可玩課關 | 未開始 | P1 |

### 已鎖定的產品決策（勿在聊天另造）

1. 目標：小四 10–11 歲；暑假盡興 → 8 月中下學期續  
2. 寓教於樂 + 發展科學核心 + 近視友好休息  
3. 故事藍本：**《西遊記》**  
4. 角色叫 **child 暱稱**；語言 = UI（ja / zh-Hant / en）  
5. CF Free；教練可插拔；超時 fallback  
6. 抗中斷：每步 commit + push；真相源在 GitHub  

---

## 下一步（P0 剩餘）

1. 寫完科學／故事／護眼／課綱／工程文檔  
2. monorepo skeleton + D1 migration  
3. coach providers 介面 + none  
4. locales 占位  
5. 本檔更新為「P0 文檔與骨架完成」  

---

## 公開 vs 私有

| 位置 | 內容 |
|------|------|
| 本倉庫 `docs/*` | 可公開 |
| 本機 `kids-go-private-handoff/` | API Key 位置說明（勿提交） |
