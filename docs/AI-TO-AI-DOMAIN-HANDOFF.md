# 給執行 AI：只做 DNS 這一件事

你**不需要**看 GitHub、不需要理解 Kids Igo 專案。  
你只是**代替操作者**在 Cloudflare 上加一條 DNS，然後把結果回報。

---

## 任務（唯一）

在 Cloudflare 為域名 **142857.eu.cc** 新增一條記錄：

| 欄位 | 填什麼 |
|------|--------|
| Type | **CNAME** |
| Name | **igo** |
| Target / Content | **kids-go.phrixusjhon.workers.dev** |
| Proxy | **開著**（Proxied，橘雲） |

等 1～2 分鐘後，在終端執行：

```bash
curl -sS https://igo.142857.eu.cc/api/health
```

---

## 怎麼做

1. 打開 https://dash.cloudflare.com（用操作者已登入的瀏覽器／帳戶）  
2. 點選域名 **142857.eu.cc**  
3. 左側 **DNS** → **Add record**  
4. 按上表填寫並保存  

若介面是 Workers → **kids-go** → Custom Domains / Triggers，能直接添加 **igo.142857.eu.cc** 也可以，效果相同。

---

## 禁止

- 不要改其它 DNS 記錄  
- 不要升級付費方案  
- 不要改 Worker 程式碼  
- 不要刪除任何資料  

---

## 做完後只回這一段（給主 AI 用）

```json
{
  "task": "dns_cname_igo",
  "done": true,
  "method": "dashboard或其它",
  "record": "CNAME igo -> kids-go.phrixusjhon.workers.dev (proxied)",
  "curl_health": "這裡貼 curl 的完整輸出，失敗就貼錯誤原文",
  "http_ok": false,
  "notes": "其它說明，沒有就空字串"
}
```

- 若 `curl` 返回含 `"ok":true` → `"http_ok": true`  
- 若加不了 DNS 或 curl 失敗 → `"done": false`，`notes` 寫原因  

**不要**長篇解釋專案；**只要**上面 JSON。
