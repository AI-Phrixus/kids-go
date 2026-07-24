# 自訂域名狀態

## 結論（2026-07-24）

| 項 | 狀態 |
|----|------|
| DNS CNAME | ✅ 已建立：`igo` → `kids-go.phrixusjhon.workers.dev`（Proxied） |
| Worker 路由 | ✅ `igo.142857.eu.cc/*` → Worker `kids-go` |
| 公網 DNS（1.1.1.1 / cloudflare-dns.com） | ✅ 解析到 Cloudflare 邊緣 IP（104.21.x / 172.67.x） |
| **本機／部分網路訪問** | ⚠️ `dig` 對 `*.eu.cc` 回 **0.0.0.0**，HTTPS 連不上 |
| **正式使用網址** | ✅ **https://kids-go.phrixusjhon.workers.dev** |

**配置已正確。** 部分網路攔截/污染 `.eu.cc` 時會打不開自訂域，與 Worker 無關。  
孩子與家長請優先用 **workers.dev**；換手機 4G 或其它網路可再試 `https://igo.142857.eu.cc`。

## 若換可連的域名

改 `wrangler.toml` 的 `[[routes]]` 為你帳戶裡**在本機 dig 不是 0.0.0.0** 的 zone，再 `wrangler deploy`，並加對應 CNAME。

## 執行 AI 回報摘要

- method: dashboard  
- record: CNAME igo → kids-go.phrixusjhon.workers.dev proxied  
- workers.dev health: ok  
- custom curl: connection_refused / SSL fail（根域同樣失敗 → 網路層）  
