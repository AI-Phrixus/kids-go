# 部署（Cloudflare Free）

## 前提

- Cloudflare 帳號（**Workers Free**）
- 本機 Node 20+、`npm`、`wrangler`（專案 devDependency）
- **不要**開 Workers AI 付費路徑

## 一鍵流程

```bash
cd kids-go
npm install --legacy-peer-deps
npx wrangler login

# 建立 D1（只做一次）
npx wrangler d1 create kids-go
# 複製輸出的 database_id，寫入 wrangler.toml 的 database_id 欄位

npx wrangler d1 migrations apply kids-go --remote
npm run deploy
```

成功後會給出 `*.workers.dev` URL。

## 可選：教練 API

```bash
npx wrangler secret put AI_API_KEY
# 並在 wrangler.toml [vars] 設 COACH_PROVIDER / AI_BASE_URL / AI_MODEL
# 或使用 xai / google 快捷（見 COACH-PROVIDERS.md）
```

## Free 注意

| 限制 | 對策 |
|------|------|
| Worker CPU | 棋算在瀏覽器 |
| D1 寫入額度 | 通關再寫進度 |
| Cookie | 生產環境建議 HTTPS（workers.dev 自帶） |

## 回滾

GitHub 回退 commit → `npm run deploy`；D1 資料需另做 export 備份。
