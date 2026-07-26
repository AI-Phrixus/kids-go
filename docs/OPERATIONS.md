# 運維

## 日常

| 動作 | 做法 |
|------|------|
| 看進度 | 讀 `docs/STATUS.md` + GitHub commits |
| 升級程式 | merge main → deploy |
| 換教練 API | 改 secret / env · 重部署或熱讀配置 |
| 關 AI | `COACH_PROVIDER=none` |

## 日誌

`wrangler tail`（部署後）看 Worker 錯誤。  
**勿**把 API Key 打進 log。

## 資料

- 用戶進度在 D1  
- 備份：定期 `wrangler d1 export`（操作者私有保存）  

## 遷移

新 SQL 放 `migrations/` 遞增編號；先 `--local` 驗證再 `--remote`。

## 事故

| 現象 | 處理 |
|------|------|
| 教練全失敗 | 自動靜態句庫；檢查 Key／額度 |
| 對局卡頓 | 確認未在主線程重算過大搜索 |
| 休息不出現 | 查前端 EyeCare 計時；與 API 無關 |

## 安全

- 輪換 SESSION_SECRET 會使舊 session 失效  
- PIN／密碼只存雜湊  
