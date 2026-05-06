// 上傳專用密碼 — 只在 admin.html 載入,客戶端 (index.html) 完全看不到
// Worker 同時用 Origin 白名單保護,雙層防護
const UPLOAD_TOKEN = "fys_2026_5e8a3c7d4f1b6a9e_upload";

document.addEventListener("DOMContentLoaded", () => {
  const loginPanel = document.getElementById("login-panel");
  const settingsPanel = document.getElementById("settings-panel");
  const loginForm = document.getElementById("login-form");
  const loginErr = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const settingsForm = document.getElementById("settings-form");
  const saveStatus = document.getElementById("save-status");

  const personEl = document.getElementById("set-person");
  const titleEl = document.getElementById("set-title");
  const serviceLabelEl = document.getElementById("set-service-label");
  const pronounEl = document.getElementById("set-pronoun");
  const clinicEl = document.getElementById("set-clinic");
  const addressEl = document.getElementById("set-address");
  const taglineEl = document.getElementById("set-tagline");
  const thankYouEl = document.getElementById("set-thank-you");
  const bottomSloganEl = document.getElementById("set-bottom-slogan");
  const googleEl = document.getElementById("set-google");
  const prosEl = document.getElementById("set-pros");
  const feelingsEl = document.getElementById("set-feelings");
  const newpassEl = document.getElementById("set-newpass");

  const shareUrlEl = document.getElementById("share-url");
  const copyShareBtn = document.getElementById("copy-share-btn");
  const previewLink = document.getElementById("preview-link");
  const qrImg = document.getElementById("qr-img");
  const downloadQrBtn = document.getElementById("download-qr-btn");
  const bulkNamesEl = document.getElementById("bulk-names");
  const bulkGenBtn = document.getElementById("bulk-generate-btn");
  const bulkDownloadAllBtn = document.getElementById("bulk-download-all-btn");
  const bulkResult = document.getElementById("bulk-result");
  const bulkStatus = document.getElementById("bulk-status");
  const imageInput = document.getElementById("image-input");
  const imageDrop = document.getElementById("image-drop");
  const imageGrid = document.getElementById("image-grid");
  const imageStatus = document.getElementById("image-status");

  // 內部狀態:目前已上傳圖片清單 [{key, url}]
  let images = [];
  const googlePreviewEl = document.getElementById("google-preview");
  const googlePreviewUrlEl = document.getElementById("google-preview-url");
  const googlePreviewStatusEl = document.getElementById(
    "google-preview-status"
  );

  function showLogin() {
    loginPanel.hidden = false;
    settingsPanel.hidden = true;
    document.getElementById("login-pass").focus();
  }

  function showSettings() {
    loginPanel.hidden = true;
    settingsPanel.hidden = false;
    populateForm();
    // 第一次登入沒 R2 config ID → 自動上傳一次,讓 share URL 立刻變短
    ensureR2Config();
  }

  // 確保 R2 上有目前 config,share URL 才會用 ?id= 短格式
  async function ensureR2Config() {
    if (AppConfig.getConfigId()) return; // 已有 ID
    try {
      const cfg = readForm();
      AppConfig.save(cfg);
      await AppConfig.saveConfigToR2(cfg, UPLOAD_TOKEN);
      refreshShare(cfg);
    } catch (e) {
      console.warn("[ensureR2Config] failed:", e);
      // 失敗就維持 fallback 長 URL,使用者點儲存還能再試
    }
  }

  function populateForm() {
    const cfg = AppConfig.load();
    personEl.value = cfg.person || "";
    titleEl.value = cfg.title || "";
    serviceLabelEl.value = cfg.serviceLabel || "";
    pronounEl.value = cfg.pronoun || "";
    clinicEl.value = cfg.clinic || "";
    addressEl.value = cfg.address || "";
    taglineEl.value = cfg.tagline || "";
    thankYouEl.value = cfg.thankYou || "";
    bottomSloganEl.value = cfg.bottomSlogan || "";
    googleEl.value = cfg.googleUrl || "";
    prosEl.value = (cfg.pros || []).join("\n");
    feelingsEl.value = (cfg.feelings || []).join("\n");
    newpassEl.value = "";
    images = Array.isArray(cfg.images) ? [...cfg.images] : [];
    renderImages();
    refreshShare(cfg);
    refreshGooglePreview();
  }

  function readForm() {
    return {
      person: personEl.value.trim(),
      title: titleEl.value.trim(),
      serviceLabel: serviceLabelEl.value.trim(),
      pronoun: pronounEl.value.trim() || "她",
      clinic: clinicEl.value.trim(),
      address: addressEl.value.trim(),
      tagline: taglineEl.value.trim(),
      thankYou: thankYouEl.value,
      bottomSlogan: bottomSloganEl.value.trim(),
      googleUrl: googleEl.value.trim(),
      pros: prosEl.value.split("\n").map((s) => s.trim()).filter(Boolean),
      feelings: feelingsEl.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      images: [...images]
    };
  }

  // ----- 圖片上傳 -----
  const MAX_IMAGES = 8;
  const MAX_DIM = 1000; // 長邊上限（壓更小,客戶下載快）
  const QUALITY = 0.7;

  async function compressImage(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    let { naturalWidth: w, naturalHeight: h } = img;
    if (w > MAX_DIM || h > MAX_DIM) {
      const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        QUALITY
      )
    );
  }

  function readFileAsDataUrl(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }
  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  async function uploadOne(blob) {
    const r = await fetch(`${AppConfig.WORKER_URL}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": blob.type || "image/jpeg",
        "X-Admin-Pass": UPLOAD_TOKEN
      },
      body: blob
    });
    const data = await r.json();
    if (!r.ok || !data.success) {
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    return { key: data.key, url: data.url };
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      imageStatus.textContent = `⚠️ 最多 ${MAX_IMAGES} 張,目前已有 ${images.length} 張`;
      imageStatus.dataset.ok = "0";
      return;
    }

    imageStatus.dataset.ok = "1";
    let done = 0;
    for (const file of files) {
      imageStatus.textContent = `上傳中… (${done + 1}/${files.length}) ${file.name}`;
      try {
        const blob = await compressImage(file);
        const result = await uploadOne(blob);
        images.push(result);
        renderImages();
        // 馬上把分享連結也更新（即使還沒按儲存,讓 admin 看到 QR 變化）
        refreshShare(readForm());
      } catch (e) {
        console.error(e);
        imageStatus.textContent = `❌ ${file.name} 上傳失敗:${e.message}`;
        imageStatus.dataset.ok = "0";
        return;
      }
      done++;
    }
    imageStatus.textContent = `✅ 上傳完成 ${done} 張`;

    // 自動同步到 R2 config,讓 share URL/QR 立刻反映新照片(不用等使用者點儲存)
    try {
      const cfg = readForm();
      AppConfig.save(cfg);
      await AppConfig.saveConfigToR2(cfg, UPLOAD_TOKEN);
      refreshShare(cfg);
    } catch (e) {
      console.warn("[handleFiles] auto-save failed:", e);
      imageStatus.textContent += "（連結尚未同步,請點儲存設定）";
    }
  }

  async function deleteImage(idx) {
    const img = images[idx];
    if (!img) return;
    if (!confirm("確定要刪除這張照片嗎？")) return;
    try {
      const r = await fetch(
        `${AppConfig.WORKER_URL}/image/${encodeURIComponent(img.key)}`,
        { method: "DELETE", headers: { "X-Admin-Pass": UPLOAD_TOKEN } }
      );
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
    } catch (e) {
      console.error(e);
      // 即使遠端刪除失敗,也從本地清單移除（admin 不會想看到不要的圖）
    }
    images.splice(idx, 1);
    renderImages();
    // 自動同步到 R2 config
    try {
      const cfg = readForm();
      AppConfig.save(cfg);
      await AppConfig.saveConfigToR2(cfg, UPLOAD_TOKEN);
      refreshShare(cfg);
    } catch (e) {
      console.warn("[deleteImage] auto-save failed:", e);
      refreshShare(readForm()); // 至少更新 UI
    }
  }

  function renderImages() {
    imageGrid.innerHTML = "";
    images.forEach((img, idx) => {
      const cell = document.createElement("div");
      cell.className = "image-cell";
      const im = document.createElement("img");
      im.src = img.url;
      im.alt = `照片 ${idx + 1}`;
      im.loading = "lazy";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "image-del";
      del.textContent = "×";
      del.title = "刪除";
      del.addEventListener("click", () => deleteImage(idx));
      cell.appendChild(im);
      cell.appendChild(del);
      imageGrid.appendChild(cell);
    });
  }

  function refreshShare(cfg) {
    const url = AppConfig.buildShareUrl(cfg);
    shareUrlEl.value = url;
    previewLink.href = url;
    qrImg.src =
      "https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&format=png&data=" +
      encodeURIComponent(url);
  }

  async function downloadQR() {
    const url = qrImg.src;
    if (!url) return;
    downloadQrBtn.disabled = true;
    const original = downloadQrBtn.textContent;
    downloadQrBtn.textContent = "下載中…";
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = (clinicEl.value || personEl.value || "share").replace(
        /[^\w一-鿿-]/g,
        ""
      );
      a.href = objUrl;
      a.download = `${name || "share"}-QR.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
      downloadQrBtn.textContent = "✅ 已下載";
    } catch (e) {
      console.error(e);
      // fallback: open in new tab so user can right-click save
      window.open(url, "_blank", "noopener");
      downloadQrBtn.textContent = "已開啟新分頁，右鍵另存";
    } finally {
      setTimeout(() => {
        downloadQrBtn.textContent = original;
        downloadQrBtn.disabled = false;
      }, 2500);
    }
  }

  function refreshGooglePreview() {
    const raw = googleEl.value.trim();
    if (!raw) {
      googlePreviewEl.hidden = true;
      return;
    }
    googlePreviewEl.hidden = false;
    const normalized = AppConfig.normalizeReviewUrl(raw);
    googlePreviewUrlEl.textContent = normalized;
    if (AppConfig.isWriteReviewUrl(normalized)) {
      googlePreviewStatusEl.textContent =
        "✅ 客戶會直接跳到「寫評論」頁面（不會卡在地圖）";
      googlePreviewStatusEl.dataset.ok = "1";
    } else if (AppConfig.isPlacePageUrl(normalized)) {
      googlePreviewStatusEl.textContent =
        "⚠️ 客戶會到店家頁（不是直接寫評論）。請客戶在頁面上點「撰寫評論」按鈕進入評論表單。如果想客戶免再點一次，請用商家後台的「分享評論連結」(g.page/r/.../review)";
      googlePreviewStatusEl.dataset.ok = "0";
    } else if (
      /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(raw) &&
      normalized === raw
    ) {
      googlePreviewStatusEl.textContent =
        "⚠️ 偵測到短網址，無法自動展開。請改貼完整 Google Maps 網址（網址列那段長的）";
      googlePreviewStatusEl.dataset.ok = "0";
    } else {
      googlePreviewStatusEl.textContent =
        "⚠️ 沒抓到店家 ID，客戶可能會跳到搜尋頁。建議改貼完整 Google Maps 店家網址（含 /place/ 那種）";
      googlePreviewStatusEl.dataset.ok = "0";
    }
  }

  // 登入
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = document.getElementById("login-user").value.trim();
    const p = document.getElementById("login-pass").value;
    if (u !== "admin") {
      loginErr.textContent = "❌ 帳號錯誤（固定為 admin）";
      return;
    }
    if (p !== AppConfig.getPassword()) {
      loginErr.textContent = "❌ 密碼錯誤";
      return;
    }
    loginErr.textContent = "";
    AppConfig.login();
    showSettings();
  });

  // 登出
  logoutBtn.addEventListener("click", () => {
    AppConfig.logout();
    showLogin();
  });

  // 儲存 — 同時把 config 上傳到 R2 拿短 ID
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cfg = readForm();
    AppConfig.save(cfg);
    if (newpassEl.value) {
      AppConfig.setPassword(newpassEl.value);
      newpassEl.value = "";
    }
    saveStatus.textContent = "上傳設定中…";
    saveStatus.dataset.ok = "1";
    try {
      await AppConfig.saveConfigToR2(cfg, UPLOAD_TOKEN);
      saveStatus.textContent = "✅ 已儲存，分享連結已縮短";
    } catch (err) {
      console.error(err);
      saveStatus.textContent =
        "⚠️ 儲存到雲端失敗,改用長網址（仍可使用）：" + err.message;
      saveStatus.dataset.ok = "0";
    }
    refreshShare(cfg);
    setTimeout(() => {
      saveStatus.textContent = "";
    }, 4000);
  });

  // 複製分享連結
  copyShareBtn.addEventListener("click", async () => {
    const ok = await copyText(shareUrlEl.value);
    copyShareBtn.textContent = ok ? "✅ 已複製" : "⚠️ 複製失敗";
    setTimeout(() => (copyShareBtn.textContent = "📋 複製"), 2000);
  });

  // 共用複製函式 (剪貼簿 API + textarea fallback)
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  // 即時預覽 Google URL 轉換結果
  googleEl.addEventListener("input", refreshGooglePreview);

  // QR 下載
  downloadQrBtn.addEventListener("click", downloadQR);

  // ----- 批次產生員工 QR -----
  let bulkResults = []; // [{name, url, qrUrl}]

  function generateBulk() {
    const names = bulkNamesEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      bulkStatus.textContent = "⚠️ 至少輸入一個員工姓名";
      bulkStatus.dataset.ok = "0";
      return;
    }
    if (names.length > 50) {
      bulkStatus.textContent = "⚠️ 一次最多 50 位";
      bulkStatus.dataset.ok = "0";
      return;
    }

    const baseCfg = readForm();
    const id = AppConfig.getConfigId();
    bulkResults = names.map((name) => {
      let url;
      if (id) {
        // 短 URL：?id=ABCDEFGH&p=曼蒂 (~25 chars total)
        url = AppConfig.buildShareUrlShort(id, name);
      } else {
        // fallback：base64 長 URL
        url = AppConfig.buildShareUrl({ ...baseCfg, person: name });
      }
      const qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&format=png&data=" +
        encodeURIComponent(url);
      return { name, url, qrUrl };
    });

    renderBulkResults();
    bulkDownloadAllBtn.disabled = false;
    bulkStatus.textContent = `✅ 已產生 ${names.length} 張 QR — 點下載按鈕個別下載,或下載全部`;
    bulkStatus.dataset.ok = "1";
  }

  function renderBulkResults() {
    bulkResult.innerHTML = "";
    bulkResults.forEach((r, idx) => {
      const card = document.createElement("div");
      card.className = "bulk-card";
      card.innerHTML = `
        <div class="bulk-qr-frame"><img src="${r.qrUrl}" alt="${escapeHtmlA(r.name)} QR" loading="lazy" /></div>
        <div class="bulk-info">
          <div class="bulk-name">${escapeHtmlA(r.name)}</div>
          <div class="bulk-row">
            <input type="text" readonly value="${escapeHtmlA(r.url)}" />
          </div>
          <div class="bulk-actions-row">
            <button type="button" class="secondary-btn" data-act="copy" data-i="${idx}">📋 複製連結</button>
            <button type="button" class="secondary-btn" data-act="download" data-i="${idx}">⬇ 下載 QR</button>
            <a class="secondary-btn" href="${escapeHtmlA(r.url)}" target="_blank" rel="noopener">👀 預覽</a>
          </div>
        </div>
      `;
      bulkResult.appendChild(card);
    });
  }

  function escapeHtmlA(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  bulkResult.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const i = parseInt(btn.dataset.i, 10);
    const item = bulkResults[i];
    if (!item) return;
    if (btn.dataset.act === "copy") {
      const ok = await copyText(item.url);
      btn.textContent = ok ? "✅ 已複製" : "⚠️ 複製失敗";
      setTimeout(() => (btn.textContent = "📋 複製連結"), 2000);
    } else if (btn.dataset.act === "download") {
      try {
        const r = await fetch(item.qrUrl);
        const blob = await r.blob();
        const a = document.createElement("a");
        const objUrl = URL.createObjectURL(blob);
        const safe = item.name.replace(/[^\w一-鿿-]/g, "");
        a.href = objUrl;
        a.download = `${safe || "QR"}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
        btn.textContent = "✅ 已下載";
        setTimeout(() => (btn.textContent = "⬇ 下載 QR"), 2000);
      } catch (err) {
        window.open(item.qrUrl, "_blank", "noopener");
      }
    }
  });

  async function downloadAllZip() {
    if (bulkResults.length === 0) return;
    bulkDownloadAllBtn.disabled = true;
    bulkDownloadAllBtn.textContent = "下載中…";
    try {
      // 沒 zip lib,改個別下載（瀏覽器會在「下載」資料夾收齊）
      for (let i = 0; i < bulkResults.length; i++) {
        const item = bulkResults[i];
        bulkDownloadAllBtn.textContent = `下載中 ${i + 1}/${bulkResults.length}…`;
        const r = await fetch(item.qrUrl);
        const blob = await r.blob();
        const a = document.createElement("a");
        const objUrl = URL.createObjectURL(blob);
        const safe = item.name.replace(/[^\w一-鿿-]/g, "");
        a.href = objUrl;
        a.download = `${safe || "QR"}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
        await new Promise((r) => setTimeout(r, 250)); // 避免被瀏覽器擋連續下載
      }
      bulkDownloadAllBtn.textContent = "✅ 全部已下載";
    } catch (e) {
      console.error(e);
      bulkDownloadAllBtn.textContent = "下載失敗";
    } finally {
      setTimeout(() => {
        bulkDownloadAllBtn.textContent = "⬇ 下載全部 QR";
        bulkDownloadAllBtn.disabled = false;
      }, 2500);
    }
  }

  bulkGenBtn.addEventListener("click", generateBulk);
  bulkDownloadAllBtn.addEventListener("click", downloadAllZip);

  // 圖片上傳
  imageInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    e.target.value = ""; // 允許重複選同檔
  });
  ["dragenter", "dragover"].forEach((evt) =>
    imageDrop.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      imageDrop.classList.add("drag-over");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    imageDrop.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      imageDrop.classList.remove("drag-over");
    })
  );
  imageDrop.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });

  // 啟動
  if (AppConfig.isLoggedIn()) {
    showSettings();
  } else {
    showLogin();
  }
});
