# 狀態快照（可公開）

> 無密鑰。  
> **最後更新**：2026-07-24  
> **程式版本**：v0.2.0（P2 體驗完善）

---

## 生產服務

| 項 | 狀態 |
|----|------|
| **URL** | **https://kids-go.phrixusjhon.workers.dev** |
| 健康檢查 | `GET /api/health` |
| 家長摘要 | `GET /api/parent/summary?locale=zh-Hant` |
| 教練狀態 | `GET /api/coach/status?locale=zh-Hant` |
| Cloudflare | **Workers Free**（已確認） |
| D1 | `kids-go` · APAC |
| 教練鏈 | `cloudflare_free → byok → static` · 軟上限 40/日 |

---

## 使用

1. https://kids-go.phrixusjhon.workers.dev  
2. 註冊 → 取經地圖 → 課  
3. **家長摘要** · **設定（第三方 AI）** · 頁腳隱私  

---

## v0.2.0 本階段完成

- 家長摘要（進度%、技能、徽章、陪學建議）  
- 地圖進度條 + 站點編號 · 完成/可玩/鎖定樣式  
- 棋盤：最後一手高亮、九路星位  
- 護眼儀式文案輪換  
- 隱私說明頁（三語）  

## 下一階段（P3）

- 觀測與課內容加深 · 美術 · 自訂域  

倉庫：https://github.com/AI-Phrixus/kids-go  
