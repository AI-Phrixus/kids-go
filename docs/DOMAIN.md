# 域名

## 請給人用的主網址（已驗證可連）

# https://go.tdtc.indevs.in

短前綴 **go** = 圍棋 / Go，好記。

| 網址 | 用途 |
|------|------|
| **https://go.tdtc.indevs.in** | **主網址（推薦）** |
| https://go.tdtc.dpdns.org | 備用（同樣 live） |
| https://kids-go.phrixusjhon.workers.dev | 技術備用 |
| https://igo.142857.eu.cc | 已配 DNS；部分網路攔截 `.eu.cc` |

選擇依據：帳戶內 zone 可掛子域；本機可 dig 且 HTTPS 200；名稱短。  
`tdtc.indevs.in` 等 zone 在 CF 內 active，用 Workers Custom Domain 自動簽 SSL。

## 技術

- Worker：`kids-go`
- 綁定方式：Cloudflare Workers Domains API + wrangler `[[routes]]`
