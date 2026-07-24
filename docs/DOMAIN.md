# 自訂域名

## 已配置

| 項 | 值 |
|----|-----|
| 子域 | **igo.142857.eu.cc** |
| Zone | `142857.eu.cc`（CF 帳戶內 active） |
| wrangler | `routes = [{ pattern = "igo.142857.eu.cc/*", zone_name = "142857.eu.cc" }]` |
| 原 workers.dev | 仍保留：https://kids-go.phrixusjhon.workers.dev |

部署後若 DNS 自動綁定成功，打開：

**https://igo.142857.eu.cc**

## 若未生效

1. Dashboard → Workers → kids-go → Triggers → Custom Domains → 新增 `igo.142857.eu.cc`  
2. 或 DNS 手動：CNAME `igo` → `kids-go.phrixusjhon.workers.dev`（Proxied）  

## 換域名

改 `wrangler.toml` 的 `routes` 後 `npm run deploy`。  
