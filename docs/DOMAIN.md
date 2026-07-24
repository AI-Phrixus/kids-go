# 自訂域名

## 狀態

| 項 | 狀態 |
|----|------|
| Worker 路由 | ✅ 已部署 `igo.142857.eu.cc/*` → zone `142857.eu.cc` |
| DNS CNAME | ⚠️ 需你在 Dashboard **手動加一條**（OAuth 無 DNS 寫權限） |
| workers.dev | ✅ https://kids-go.phrixusjhon.workers.dev 已可用 |

## 請你完成（約 1 分鐘）

1. 打開 [Cloudflare Dashboard](https://dash.cloudflare.com) → 選 zone **142857.eu.cc** → **DNS**  
2. **Add record**：
   - Type: **CNAME**
   - Name: **igo**
   - Target: **kids-go.phrixusjhon.workers.dev**
   - Proxy: **Proxied**（橘雲）  
3. 儲存後等 1–2 分鐘，訪問：**https://igo.142857.eu.cc**

也可：Workers → **kids-go** → **Triggers** → **Custom Domains** → Add `igo.142857.eu.cc`（若介面提供一鍵綁定）。

## 程式配置（已提交）

`wrangler.toml`:

```toml
workers_dev = true
[[routes]]
pattern = "igo.142857.eu.cc/*"
zone_name = "142857.eu.cc"
```
