---
name: foryunsister-platform
description: foryunsister 評價系統的跨裝置（iOS / Android / 桌面）必守規則 — 圖片下載必須背景靜默、剪貼簿在 user gesture 內、FTID 不可轉 writereview、禁止 fallback 到 window.open。每次工作此專案前必讀。
---

# foryunsister 跨裝置規則

## 觸發時機
工作目錄在 `E:\CODEFORZHANG\foryunsister\` 或檔名涉及 `index.html` / `admin.html` / `script.js` / `admin.js` / `config.js` / `styles.css` 任一。

## 動工前必做

1. **讀 `CLAUDE.md`** — 整個專案的規格、架構、必守規則寫在那（不重複）
2. **讀目前的 `config.js` `DEFAULT`** — 看現在的店家資料、URL、預設標籤
3. **讀 `workers/upload-worker/index.js`** — Worker 路由、auth、CORS 都在那

## 修改時硬規則 ⚠️

### A. 圖片下載 (script.js `downloadFile`)
```js
// ✅ 對的: fetch + blob + 隱形 anchor + 失敗就靜默
async function downloadFile(url, filename) {
  try {
    const r = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { /* cleanup */ }, 1500);
    return true;
  } catch (err) {
    console.warn("[download] failed:", filename, err);
    return false;  // ← 絕對不可 fallback 到 window.open
  }
}
```

**禁止改成:**
- ❌ `window.open(url)` 當 fallback — 會在新分頁打開圖片打擾客戶
- ❌ 平行下載（`Promise.all`） — 瀏覽器會節流
- ❌ 拿掉 `cache: "force-cache"` — R2 沒 cache header 時會重複下載

### B. Google 評論 URL (config.js `normalizeReviewUrl`)
```
ChIJ Place ID                    → writereview URL (✅ 接受)
g.page/r/.../review              → 原樣（✅ 直達評論表單）
writereview?placeid=ChIJ...      → 原樣
任何其他 (含 FTID Maps URL)       → 原樣（客戶到店家頁,點「撰寫評論」進入）
```

**禁止改成:**
- ❌ FTID `0x...:0x...` → writereview URL — Google 回 404
- ❌ 短網址 `maps.app.goo.gl` 自動展開 — 純前端做不到

### C. 剪貼簿複製 (script.js)
- 必須在 click handler 內**第一個** `await`
- 不要 await 其他 promise 後再呼叫 `navigator.clipboard.writeText` — user gesture 過期

### D. window.open
- 整個送出流程**只呼叫一次**（最後開 Google review URL）
- 期間不可有其他 window.open（mobile 會擋 popup）

### E. 觸控目標
- `.tag` `min-height: 48px`
- `.primary-btn` `min-height: 50px`
- `.secondary-btn` `min-height: 44px`

### F. Sticky 手機送出按鈕（max-width: 540px）
```css
.actions {
  position: sticky;
  bottom: 0;
  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0));
  background: linear-gradient(180deg, rgba(...,0) 0%, rgba(...,0.97) 30%, rgba(...,0.98) 100%);
  backdrop-filter: blur(6px);
}
```
不可改成 `position: fixed`（會蓋到內容）。

## 必跑驗證

每次完成代碼變更前，跑以下檢查：

### 自動化（preview）
```js
// 1. 客戶頁載入,確認 tags 渲染
location.href = '/?id=...&p=曼蒂';
// 等 loadAsync,檢查 prosCount=10, feelingsCount=10

// 2. 模擬送出 + 開 Google,確認 window.open 只 1 次
let opens = [];
window.open = (...a) => { opens.push(a[0]); return null; };
document.querySelectorAll('.tag-list[data-group="pros"] .tag')[0].click();
document.querySelectorAll('.tag-list[data-group="feelings"] .tag')[0].click();
document.getElementById('submit-btn').click();
await delay(200);
document.getElementById('open-google-btn').click();
await delay(1500);
// 預期 opens.length === 1, opens[0] = Google review URL
```

### 手動（真機，使用者跑）
1. 手機掃 QR → 確認頁面正常顯示，不是短網址預覽
2. 點下載按鈕 → 確認**沒有任何新分頁打開**（除了最後的 Google）
3. 檢查相簿 / 下載資料夾，確認照片真的下載到位
4. 換不同瀏覽器（Safari、Chrome）跑一遍

## 部屬流程

### Static
1. 改完 commit + push
2. `gh api repos/b071283/foryunsister/pages/builds/latest` 等 status=built
3. 開站確認改動生效

### Worker
1. 改 `workers/upload-worker/index.js`
2. 重 PUT 到 CF API（用 `metadata.json` + `index.js`）
3. `curl https://foryunsister-upload.rxrxttb.workers.dev/` 應回 `{"ok":true}`

## 失敗排查

| 症狀 | 可能原因 | 檢查 |
|---|---|---|
| 客戶點按鈕沒反應 | clipboard permission | console 看 `[clipboard]` log |
| 圖片下載失敗 | R2 CORS / 圖沒上傳 | curl `https://pub-xxx.r2.dev/<key>` 看 status + 標頭 |
| 短 URL 載入空白 | R2 config JSON 沒上傳成功 | curl `https://pub-xxx.r2.dev/cfg/<id>.json` |
| Google 開到 404 | 用了 FTID writereview URL | 看 `normalizeReviewUrl` 邏輯沒被改回去 |
| 手機開圖到新分頁 | downloadFile fallback 觸發 | 檢查有沒有不小心加了 `window.open` fallback |

## 最重要的事

**絕對不要破壞「客戶體驗 = 點一個按鈕 → 評論複製 + 照片背景下載 + Google 開」這條主線。** 任何優化、重構、視覺改動，都不能讓客戶在中途看到任何意外的新分頁、popup、預覽框、確認對話框。
