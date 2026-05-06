document.addEventListener("DOMContentLoaded", async () => {
  // 偵測 in-app browser（LINE / FB / IG），下載功能受限,顯示警告 banner
  detectAndWarnWebview();

  // loadAsync 會處理 ?id=ABCDEFGH 短 URL（從 R2 拉 config）。如果失敗或沒有 id 參數,fallback 到 sync load()
  const cfg = await AppConfig.loadAsync();
  const name = cfg.person || "勻勻";
  const vars = { name };

  // 套用品牌文字
  document.getElementById("brand-mark").innerHTML =
    `${escapeHtml(name)} <span class="brand-heart">♡</span>`;
  setText("title", `${name}${cfg.serviceLabel || "專屬評價"}`);
  setText("tagline", cfg.tagline ? `${cfg.tagline} ♡` : "");
  setText("group-pros-label", `為什麼選擇${name}`);

  // clinic
  if (cfg.clinic) {
    document.getElementById("clinic-name").innerHTML =
      `<span class="pin">📍</span> ${escapeHtml(cfg.clinic)}`;
    document.getElementById("clinic-address").textContent = cfg.address || "";
  } else {
    document.getElementById("clinic-card").hidden = true;
  }

  // thanks
  if (cfg.thankYou) {
    document.getElementById("thank-you-text").textContent =
      AppConfig.template
        ? AppConfig.template(cfg.thankYou, vars)
        : cfg.thankYou.replace(/\{name\}/g, name);
    document.getElementById("thank-you-sign").textContent = `— ${name}`;
  } else {
    document.getElementById("thanks-card").hidden = true;
  }

  // bottom slogan
  if (cfg.bottomSlogan) {
    document.getElementById("slogan-text").textContent = cfg.bottomSlogan.replace(
      /\{name\}/g,
      name
    );
  } else {
    document.getElementById("bottom-slogan").hidden = true;
  }

  // 渲染 tag
  renderTags("pros", cfg.pros);
  renderTags("feelings", cfg.feelings);

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // 偵測常見 in-app browser → 顯示警告 + 「立即在外部瀏覽器開啟」按鈕
  function detectAndWarnWebview() {
    const ua = navigator.userAgent || "";
    let name = null;
    if (/Line\//i.test(ua)) name = "LINE";
    else if (/FBAN|FBAV|FB_IAB/i.test(ua)) name = "Facebook";
    else if (/Instagram/i.test(ua)) name = "Instagram";
    else if (/MicroMessenger/i.test(ua)) name = "WeChat";
    else if (/Threads/i.test(ua)) name = "Threads";
    if (!name) return;

    const banner = document.getElementById("webview-banner");
    const nameEl = document.getElementById("webview-name");
    const browserEl = document.getElementById("webview-browser");
    const msgEl = document.getElementById("webview-msg");
    const openBtn = document.getElementById("webview-open-btn");
    const copyBtn = document.getElementById("webview-copy-btn");
    if (!banner) return;

    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    nameEl.textContent = name;
    browserEl.textContent = isIOS ? "Safari" : "Chrome";
    banner.hidden = false;

    if (isAndroid) {
      // Android 可以用 intent:// URL 強制 Chrome 接管
      openBtn.textContent = "🚀 立即在 Chrome 開啟";
      openBtn.addEventListener("click", () => {
        const httpsUrl = location.href.replace(/^https?:\/\//, "");
        const intentUrl = `intent://${httpsUrl}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(location.href)};end`;
        location.href = intentUrl;
      });
    } else if (isIOS) {
      // iOS 沒辦法強制開 Safari（Apple 政策）→ 改成顯示步驟
      openBtn.textContent = "📖 怎麼在 Safari 開啟";
      msgEl.innerHTML =
        "iOS 不允許網頁強制開 Safari，請手動：點右上角 <code>⋯</code> → 「<strong>在 Safari 開啟</strong>」";
      openBtn.addEventListener("click", () => {
        alert(
          `請按照下列步驟：\n\n1. 點${name}畫面右上角 ⋯ 選單\n2. 找「在 Safari 開啟」或「以瀏覽器開啟」\n3. 點下去就會切到 Safari\n\n（Apple 不允許網頁自動切換瀏覽器，必須手動）`
        );
      });
    } else {
      // 其他作業系統 → 隱藏按鈕,只顯示複製網址
      openBtn.style.display = "none";
    }

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = location.href;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      copyBtn.textContent = "✅ 已複製";
      setTimeout(() => (copyBtn.textContent = "📋 複製網址"), 2000);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function renderTags(group, items) {
    const list = document.querySelector(`.tag-list[data-group="${group}"]`);
    if (!list) return;
    list.innerHTML = "";
    (items || []).forEach((raw) => {
      const parsed =
        AppConfig.parseTag?.(raw) ||
        (typeof raw === "object" ? raw : { icon: "", text: raw });
      if (!parsed || !parsed.text) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag";
      btn.dataset.text = parsed.text;
      const iconSpan = document.createElement("span");
      iconSpan.className = "tag-icon";
      iconSpan.textContent = parsed.icon || "·";
      const txtSpan = document.createElement("span");
      txtSpan.className = "tag-text";
      txtSpan.textContent = parsed.text;
      btn.appendChild(iconSpan);
      btn.appendChild(txtSpan);
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        updateCount(group);
        updateSubmitState();
      });
      list.appendChild(btn);
    });
    updateCount(group);
  }

  function updateCount(group) {
    const count = document.querySelectorAll(
      `.tag-list[data-group="${group}"] .tag.active`
    ).length;
    const el = document.querySelector(`.count[data-count="${group}"]`);
    if (el) el.textContent = String(count);
    el?.parentElement.classList.toggle("has-selection", count > 0);
  }

  function updateSubmitState() {
    const ok = !getValidationError();
    submitBtn?.classList.toggle("ready", ok);
  }

  function getSelected(group) {
    return Array.from(
      document.querySelectorAll(`.tag-list[data-group="${group}"] .tag.active`)
    ).map((el) => el.dataset.text || el.textContent.trim());
  }

  // 評論文字 — 自然段落
  function buildComment() {
    const pros = getSelected("pros");
    const feelings = getSelected("feelings");
    if (pros.length === 0 || feelings.length === 0) return "";

    const title = cfg.title || "";
    const pronoun = cfg.pronoun || "她";
    const subject = `${title}${name}` || "這位老師";
    const prosText = pros.join("、");
    const feelingsText = feelings.join("，");

    return `大推${subject}！${pronoun}服務真的很${prosText}。這次過來覺得${feelingsText}。`;
  }

  function getValidationError() {
    const pros = getSelected("pros");
    const feelings = getSelected("feelings");
    if (pros.length === 0 && feelings.length === 0) {
      return "請至少從每一段各勾選一項再送出 ✨";
    }
    if (pros.length === 0) return "「為什麼選擇」段落至少要勾一個 👆";
    if (feelings.length === 0) return "「當天體驗感受」段落至少要勾一個 👆";
    return "";
  }

  // 元素
  var submitBtn = document.getElementById("submit-btn");
  const modal = document.getElementById("result-modal");
  const preview = document.getElementById("comment-preview");
  const openBtn = document.getElementById("open-google-btn");
  const closeBtn = document.getElementById("modal-close");
  const status = document.getElementById("copy-status");
  const imagePickerSec = document.getElementById("image-picker-section");
  const imagePicker = document.getElementById("image-picker");
  const stepImageHint = document.getElementById("step-image-hint");
  const stepNoImageHint = document.getElementById("step-no-image-hint");
  const stepImagePhoto = document.getElementById("step-image-photo");

  // 預先抓取的圖片 blob 快取（避免 click 時還在 await fetch 導致 user gesture 失效）
  // 客戶在 modal 打開時就背景開始下載到記憶體,點按鈕時直接用 cached blob 觸發下載 click
  const blobCache = new Map(); // url → blob

  function prefetchImages() {
    const list = Array.isArray(cfg.images) ? cfg.images : [];
    list.forEach((img) => {
      if (!img?.url || blobCache.has(img.url)) return;
      fetch(img.url, { mode: "cors", cache: "force-cache" })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => {
          if (b) blobCache.set(img.url, b);
        })
        .catch((e) => console.warn("[prefetch] failed:", img.url, e));
    });
  }

  // 圖片選擇器（如果 admin 有上傳）
  function renderImagePicker() {
    imagePicker.innerHTML = "";
    const list = Array.isArray(cfg.images) ? cfg.images : [];
    if (list.length === 0) {
      imagePickerSec.hidden = true;
      stepImageHint.hidden = true;
      stepImagePhoto.hidden = true;
      stepNoImageHint.hidden = false;
      openBtn.textContent = "前往 Google 評論";
      return;
    }
    imagePickerSec.hidden = false;
    stepImageHint.hidden = false;
    stepImagePhoto.hidden = false;
    stepNoImageHint.hidden = true;
    openBtn.textContent = "📥 下載照片並前往 Google 評論";

    list.forEach((img, i) => {
      const wrap = document.createElement("label");
      wrap.className = "image-pick-cell active";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset.idx = String(i);
      cb.addEventListener("change", () =>
        wrap.classList.toggle("active", cb.checked)
      );
      const im = document.createElement("img");
      im.src = img.url;
      im.alt = `照片 ${i + 1}`;
      im.loading = "lazy";
      const tick = document.createElement("span");
      tick.className = "image-pick-tick";
      tick.textContent = "✓";
      wrap.appendChild(cb);
      wrap.appendChild(im);
      wrap.appendChild(tick);
      imagePicker.appendChild(wrap);
    });
  }

  function selectedImageIndices() {
    return Array.from(
      imagePicker.querySelectorAll("input[type=checkbox]:checked")
    ).map((cb) => parseInt(cb.dataset.idx, 10));
  }

  // 送出 → 顯示 modal + 預先抓取圖片 blob 到記憶體
  submitBtn.addEventListener("click", () => {
    const err = getValidationError();
    if (err) {
      alert(err);
      return;
    }
    const text = buildComment();
    preview.textContent = text;
    renderImagePicker();
    status.textContent = "";
    modal.hidden = false;
    // Modal 打開的同時就開始抓圖,客戶讀完文字、選照片大概 3-5 秒,圖片應該都到位了
    prefetchImages();
  });

  // 點「下載照片並前往 Google 評論」:
  // 1) 複製評論到剪貼簿(user gesture 內才 work)
  // 2) 背景下載勾選的照片(全部完成後才繼續)
  // 3) 確認下載完成後,自動開 Google 評論新分頁
  openBtn.addEventListener("click", async () => {
    if (!cfg.googleUrl) {
      alert("⚠️ 管理員尚未設定 Google 評論連結");
      return;
    }

    const oldText = openBtn.textContent;
    openBtn.disabled = true;

    // 1) 複製評論
    const copied = await copyToClipboard(preview.textContent);

    // 2) 同步觸發下載 — 從 prefetch 的 blob cache 拿,user gesture 不失效
    const picks = selectedImageIndices();
    let succeeded = 0;
    if (picks.length > 0 && Array.isArray(cfg.images)) {
      // 先檢查 cache 命中率
      const cached = picks.filter((idx) => blobCache.has(cfg.images[idx]?.url)).length;
      if (cached < picks.length) {
        openBtn.textContent = `等待圖片載入… (${cached}/${picks.length})`;
        // 簡單等一下沒抓到的圖（最多 3 秒）
        let waited = 0;
        while (waited < 3000) {
          const now = picks.filter((idx) => blobCache.has(cfg.images[idx]?.url)).length;
          if (now === picks.length) break;
          await new Promise((r) => setTimeout(r, 100));
          waited += 100;
        }
      }
      // 觸發下載 — 全部用同步 anchor click
      for (let i = 0; i < picks.length; i++) {
        openBtn.textContent = `下載 ${i + 1}/${picks.length}…`;
        const img = cfg.images[picks[i]];
        if (img?.url) {
          const ok = await downloadOne(img.url, `photo-${i + 1}.jpg`);
          if (ok) succeeded++;
        }
        // 100ms 延遲避免併發節流
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // 顯示狀態
    const parts = [];
    parts.push(copied ? "✅ 評論已複製" : "⚠️ 評論複製失敗,到 Google 後請自行選取上面文字複製");
    if (picks.length > 0) {
      parts.push(succeeded === picks.length
        ? `✅ 已下載 ${succeeded} 張照片`
        : `⚠️ 下載 ${succeeded}/${picks.length} 張(部分失敗)`);
    }
    status.textContent = parts.join("、") + "，前往 Google 評論…";
    status.dataset.ok = copied && succeeded === picks.length ? "1" : "0";

    // 3) 自動開 Google
    openBtn.textContent = "已開啟 Google";
    const url = AppConfig.normalizeReviewUrl(cfg.googleUrl);
    window.open(url, "_blank", "noopener");

    setTimeout(() => {
      // 還原預設文字
      const list = Array.isArray(cfg.images) ? cfg.images : [];
      openBtn.textContent =
        list.length > 0 ? "📥 下載照片並前往 Google 評論" : "前往 Google 評論";
      openBtn.disabled = false;
    }, 1500);
  });

  closeBtn.addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      console.error("clipboard error", e);
      return false;
    }
  }

  // 同步觸發 blob 下載（不 fetch,從 cache 拿）— 保留 user gesture 給 Android Chrome
  function triggerBlobDownload(blob, filename) {
    try {
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(objUrl);
      }, 1500);
      return true;
    } catch (err) {
      console.warn("[download] anchor click failed:", filename, err);
      return false;
    }
  }

  // 用 cached blob 同步下載一張圖,沒 cached 就 fallback 即時 fetch
  // 回傳 boolean 給呼叫端統計
  async function downloadOne(url, filename) {
    const cached = blobCache.get(url);
    if (cached) {
      return triggerBlobDownload(cached, filename);
    }
    // 沒抓到（prefetch 還沒回來、或失敗）→ 即時 fetch（user gesture 可能會過期,但盡量試）
    try {
      const r = await fetch(url, { mode: "cors", cache: "force-cache" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      blobCache.set(url, blob);
      return triggerBlobDownload(blob, filename);
    } catch (err) {
      console.warn("[download] live fetch failed:", filename, err);
      return false;
    }
  }
});
