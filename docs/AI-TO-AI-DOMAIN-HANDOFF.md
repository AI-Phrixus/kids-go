# AI → AI 交接：域名綁定 + 驗收回報包

> **給執行 AI 的完整指令。**  
> 操作者把本檔給你後，按全文執行。  
> 你的**最後輸出**會被貼回**主 AI**，必須嚴格遵守第 3 節 JSON 格式。

---

## 背景（只讀）

| 項 | 值 |
|----|-----|
| 專案 | Kids Igo 兒童圍棋 |
| 倉庫 | https://github.com/AI-Phrixus/kids-go |
| 本機路徑（若有） | `/Users/phrixusjhon/kids-go` 或 `~/kids-go` |
| 已可用網址 | https://kids-go.phrixusjhon.workers.dev |
| 目標自訂域 | https://igo.142857.eu.cc |
| Cloudflare Zone | `142857.eu.cc`（帳戶內已 active） |
| Worker 名稱 | `kids-go` |
| 方案 | Workers **Free**（勿升級 Paid） |

**已完成：** Worker 路由已配置 `igo.142857.eu.cc/*` → zone `142857.eu.cc`。  
**未完成：** DNS 的 CNAME（此前權限無法代寫 DNS）。

參考文檔（倉庫內）：`docs/DOMAIN.md`、`docs/STATUS.md`、`docs/GOALS.md`。

---

## 你的任務（按順序做）

### 1. 測現況

在終端執行並保存結果：

```bash
curl -sS https://kids-go.phrixusjhon.workers.dev/api/health
curl -sS -o /dev/null -w "%{http_code}" https://kids-go.phrixusjhon.workers.dev/
curl -sS https://igo.142857.eu.cc/api/health || echo "CUSTOM_DOMAIN_FAIL"
```

### 2. 綁定域名（能做就做）

#### 方式 A（推薦）：Cloudflare 網頁

1. 打開 https://dash.cloudflare.com  
2. 進入域名 **142857.eu.cc** → **DNS** → **Add record**  
3. 填寫：
   - **Type:** CNAME  
   - **Name:** `igo`  
   - **Target:** `kids-go.phrixusjhon.workers.dev`  
   - **Proxy:** 開啟（Proxied / 橘雲）  
4. 保存，等待約 1～2 分鐘。  

或：Workers → **kids-go** → Triggers / Custom domains → 添加 `igo.142857.eu.cc`。

#### 方式 B：API（僅當操作者提供了帶 DNS 寫權限的 API Token）

```bash
export CLOUDFLARE_API_TOKEN="操作者給你的Token"

# 查 zone id
curl -sS "https://api.cloudflare.com/client/v4/zones?name=142857.eu.cc" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# 建立 CNAME（把 ZONE_ID 換成上一步的 id）
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "igo",
    "content": "kids-go.phrixusjhon.workers.dev",
    "proxied": true,
    "ttl": 1
  }'
```

**禁止**把 Token 寫進 Git 或公開貼文。

### 3. 再驗收（域名成功後必做；失敗則只驗 workers.dev）

```bash
# 把 BASE 換成實際可用的那個
BASE=https://igo.142857.eu.cc
# 若 igo 不通：BASE=https://kids-go.phrixusjhon.workers.dev

curl -sS "$BASE/api/health"
curl -sS -c /tmp/kgo.txt -b /tmp/kgo.txt -X POST "$BASE/api/auth/register/quick" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"域驗收","pin":"5566","locale":"zh-Hant"}'
curl -sS -c /tmp/kgo.txt -b /tmp/kgo.txt "$BASE/api/lessons" | head -c 500
curl -sS -c /tmp/kgo.txt -b /tmp/kgo.txt "$BASE/api/coach/status?locale=zh-Hant"
curl -sS -o /dev/null -w "%{http_code}" "$BASE/"
```

### 4. 若你改不了 DNS

- 不要假裝成功。  
- `domain_status` 填 `pending_user_dns`。  
- 仍完成 workers.dev 的 health 與 smoke。  
- 在 `notes` 寫清操作者要手動做的 3 步。

---

## 禁止

- 刪除 D1 資料、force-push、升級 Cloudflare 付費方案  
- 大改 Kids Igo 業務代碼（本任務以域名 + 驗收為主）  
- 在回報裡洩露 API Token、密碼、完整 PIN 以外的敏感信息  

---

## 最終輸出（唯一格式 · 主 AI 要這段）

你的**最後一條回覆**必須包含下面 JSON（可複製整段）。  
欄位盡量填滿；未知用 `null` 或 `""`。

```json
{
  "handoff_to": "main-ai-kids-go",
  "executor": "（你的模型名稱）",
  "timestamp_utc": "（ISO8601 時間）",
  "domain_status": "live 或 pending_user_dns 或 failed",
  "dns_action": {
    "attempted": true,
    "method": "dashboard 或 api 或 none",
    "record": "CNAME igo -> kids-go.phrixusjhon.workers.dev proxied",
    "api_success": null,
    "api_error": null,
    "notes": "人話說明你做了什麼"
  },
  "urls": {
    "workers_dev": "https://kids-go.phrixusjhon.workers.dev",
    "custom": "https://igo.142857.eu.cc"
  },
  "health": {
    "workers_dev": { "http_status": 0, "body_summary": "" },
    "custom": { "http_status": 0, "body_summary": "", "error": "" }
  },
  "smoke": {
    "base_used": "workers_dev 或 custom",
    "register_ok": false,
    "lessons_count": 0,
    "coach_chain": "",
    "homepage_status": 0,
    "errors": []
  },
  "blockers": [],
  "next_for_main_ai": [
    "請主 AI 根據本回報更新 STATUS / 確認域名 / 修復剩餘問題"
  ],
  "raw_logs": "關鍵命令輸出摘要（可截斷）"
}
```

### domain_status 怎麼選

| 值 | 含義 |
|----|------|
| `live` | `https://igo.142857.eu.cc/api/health` 返回 ok |
| `pending_user_dns` | workers.dev 正常，自訂域仍不通 |
| `failed` | 連 workers.dev 也異常 |

---

## 做完後

告訴操作者：

> 請把我輸出的 **整段 JSON** 複製，貼回主 AI（Grok），並說：「域名任務回報如下」。
