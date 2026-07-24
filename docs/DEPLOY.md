# 部署（Cloudflare Free）

## 前提

- Cloudflare 帳號 · **Workers Free**  
- 本機：Node 20+、`pnpm` 或 `npm`、`wrangler`  
- **不要**依賴 Workers AI 付費路徑  

## 步驟（骨架成熟後）

```bash
cd kids-go
cp .env.example .env
# 可選：配置 COACH_* 

# 建立 D1（示例名）
wrangler d1 create kids-go

# 把 database_id 寫入 wrangler.toml

wrangler d1 migrations apply kids-go --local
wrangler d1 migrations apply kids-go --remote

# 可選 secrets
wrangler secret put SESSION_SECRET
# wrangler secret put AI_API_KEY

# 部署 Worker / Pages（以倉庫腳本為準）
wrangler deploy
# 或 Cloudflare Pages 連接本 GitHub 倉庫
```

## Free 注意

| 限制 | 對策 |
|------|------|
| Worker CPU 短 | 棋算在瀏覽器 |
| 請求額度 | 少輪詢；進度批量寫 |
| D1 寫入 | 通關再同步細節 |

## 自訂域

Pages 專案綁域名即可；HTTPS 由 CF 處理。

## 回滾

GitHub 回退 commit → 重新部署；D1 遷移需謹慎（見 OPERATIONS）。
