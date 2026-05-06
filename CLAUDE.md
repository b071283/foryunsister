# foryunsister — 專案規格與必守規則

## 一句話描述
靜態前端評價系統，給診所多名員工各自客戶留 Google 評論。掃 QR → 勾標籤 → 一鍵下載診所照片 + 開 Google 寫評論。Pure-frontend + 1 個 Cloudflare Worker（圖片上傳 + 短 URL 配置儲存）。

## 部屬

- 客戶端 + admin: GitHub Pages → `https://sister.socialcontactapp.net`
- 圖片儲存: R2 bucket `foryunsister-images`（公開 r2.dev domain `https://pub-fe48d0757d44404188398c4b0f1c3d76.r2.dev`）
- 上傳 Worker: `https://foryunsister-upload.rxrxttb.workers.dev`
- DNS: socialcontactapp.net zone (`b2e2a549cf72bbe547ab1e43e56523d0`)，CNAME `sister` → `b071283.github.io`（DNS only）
- CF Account: `9cce85848b5b5f61662e10efb87bd186` (B071283@gmail.com)

## 架構

```
[客戶手機] ─掃 QR (?id=ABCDEFGH&p=曼蒂)─→ [GitHub Pages 客戶頁]
                                          │
                                  loadAsync → [R2 cfg/{id}.json] (config)
                                          │
                                  顯示頁面 → 客戶選 tag + 送出
                                          │
                                          ├─ 複製評論文字到剪貼簿（user gesture）
                                          ├─ 背景下載勾選照片從 [R2 公開 URL]
                                          └─ 開 Google 評論新分頁

[admin (master)] ── 設定 + 上圖 ─→ [Worker]
                                    ├─ POST /upload   → R2 image
                                    ├─ POST /config   → R2 cfg/{id}.json (短 ID)
                                    ├─ GET  /list     → 列出 R2
                                    └─ DELETE /image  → 刪除
```

## **跨裝置必守規則** ⚠️

每次更動都要確保以下情境正常（或至少不破壞）：

### 必測 6 個情境

| 裝置 / 瀏覽器 | 必確認 |
|---|---|
| **iPhone Safari** (iOS 16+) | 客戶頁 layout、tag 點選、送出、剪貼簿複製、blob+anchor 下載、開 Google 新分頁 |
| **iPhone Chrome** | 同上（多數行為跟 Safari 一樣，因 iOS WebKit 強制） |
| **Android Chrome** | 同上 + 確認多張下載不被 throttle |
| **桌面 Chrome / Edge** | admin 完整流程 + 拖曳上圖 + 批次 QR + 客戶端送出 |
| **桌面 Safari (macOS)** | 同上 |
| **桌面 Firefox** | 客戶端 fallback 路徑（沒 clipboard API 時） |

### 跨裝置注意事項

1. **圖片下載絕不開新分頁**
   - 用 `fetch(url, {mode:'cors'})` + `URL.createObjectURL(blob)` + 隱形 `<a download>`
   - 失敗就**靜默失敗**（log to console），**不要** fallback 到 `window.open`，否則客戶會看到圖片被開到新分頁
   - 每張下載間 200ms 延遲，避免瀏覽器併發節流
   - R2 物件必須有 `Content-Disposition: attachment` 標頭（worker `/upload` 自動設）

2. **剪貼簿複製要在 user gesture 內**
   - 必須在 click handler 直接 await `navigator.clipboard.writeText`
   - **不可以**先 await 別的 promise 再呼叫 clipboard（user gesture 會失效）
   - fallback: `<textarea>` + `document.execCommand("copy")`（舊版 iOS）

3. **`window.open` 一個流程只呼叫一次**
   - 連續多次呼叫 mobile 會被當 popup 擋下
   - 整個送出流程結束才開 Google 評論

4. **觸控目標 ≥ 44px**（iOS HIG / Android Material 規範）
   - 標籤按鈕 `min-height: 48px`
   - 主要按鈕 `min-height: 50px`
   - 次要按鈕 `min-height: 44px`

5. **手機版 sticky 送出按鈕**（max-width: 540px 啟動）
   - 半透明漸層背景，避免遮到 tag 看不見
   - `padding-bottom: env(safe-area-inset-bottom)` 處理 iPhone 底部 home indicator

6. **viewport meta**：`width=device-width, initial-scale=1.0, viewport-fit=cover`
   - `viewport-fit=cover` 讓 safe-area-inset 生效

## **絕對不能做的事** 🚫

1. **不要把 FTID 轉成 writereview URL** — Google 會回 404
   - FTID 格式 `0x...:0x...` 只能用在 Maps `/place/...` URL 中
   - writereview 只接受 ChIJ 格式 Place ID 或 g.page/r/.../review 連結
   - `normalizeReviewUrl` 邏輯已經處理，**不要回退這個改動**

2. **不要在 customer 端 fetch 圖片時 fallback 到 `window.open`**（會打開新分頁打擾客戶）

3. **不要刪除 `Content-Disposition: attachment` 邏輯**（worker `/upload` 設的）

4. **不要把 admin 上傳 token 暴露到 customer 頁**
   - `UPLOAD_TOKEN` 只在 admin.js（admin.html 才載入）
   - customer 的 index.html / script.js 完全不應該有 UPLOAD_TOKEN

5. **不要改 R2 bucket / Worker / domain 設定**而沒有同時更新 CLAUDE.md / SKILL.md / config.js 的 hardcoded 值

## 設計風格 (locked)

- 配色：dusty rose `#b86a78` + blush `#f5d4d0` + cream `#fdf6f3`
- 字體：Noto Serif TC + PingFang TC（典雅）
- 品牌：勻勻 + ♡ + YUN YUN（雙語識別）
- Tag：pill 形 + 圓形 emoji icon chip 在左、文字右
- 頁尾：dashed-border 感謝卡 + 信封 icon + 簽名
- 底部：gradient bar 標語

## 常用編輯位置

| 任務 | 改哪裡 |
|---|---|
| 改預設店家資料 | `config.js` `DEFAULT` |
| 改評論模板 | `script.js` `buildComment()` |
| 改標籤 icon 解析 | `config.js` `parseTag()` |
| 改 admin 表單欄位 | `admin.html` + `admin.js` populateForm/readForm |
| 改 worker 路由 | `workers/upload-worker/index.js` 然後重新部屬 |
| 改視覺風格 | `styles.css` （注意 `:root` CSS 變數） |

## 部屬流程

### Static 前端
- `git push origin main` → GitHub Pages 自動 build（30-60 秒）
- 驗證：`gh api repos/b071283/foryunsister/pages/builds/latest`

### Worker
```bash
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/9cce85848b5b5f61662e10efb87bd186/workers/scripts/foryunsister-upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'metadata=@workers/upload-worker/metadata.json;type=application/json' \
  -F 'index.js=@workers/upload-worker/index.js;type=application/javascript+module'
```

`metadata.json` 含 R2 binding (`IMAGES`)、`PUBLIC_BASE` 變數、`ADMIN_PASS` secret。secret 值: `fys_2026_5e8a3c7d4f1b6a9e_upload`。

## 帳密與密碼

- Admin 登入: `admin` / `admin`（可在 admin 頁改密碼）
- Worker upload: `fys_2026_5e8a3c7d4f1b6a9e_upload`（hardcoded in admin.js）

## 驗證清單（每次重大變更後跑一遍）

- [ ] 客戶頁載入沒 console error
- [ ] tag 點選有計數器 + has-selection class
- [ ] 沒勾就送出 → alert 提示
- [ ] 兩段都勾後 submit → modal 顯示評論文字
- [ ] 點「下載照片並前往 Google 評論」→ 進度條 → 完成 → 開 Google
- [ ] window.open 整個流程只呼叫 1 次（測 customer 點按鈕後）
- [ ] admin 登入 → 所有欄位預填正確
- [ ] 上傳一張圖 → 出現在 grid + R2 檔大小 < 200KB
- [ ] 點儲存 → 出現「✅ 已儲存，分享連結已縮短」
- [ ] 分享連結長度 < 100 字
- [ ] 批次產生 5 個員工 → 5 張不同名字 QR
- [ ] 在手機上掃 QR 確認載入正確（不能跳成短網址預覽 / 預覽圖被擋）
