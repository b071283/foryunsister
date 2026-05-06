document.addEventListener("DOMContentLoaded", async () => {
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

  // 送出 → 顯示 modal,等待「前往 Google 評論」按鈕一鍵搞定所有動作
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

    // 2) 背景下載照片(全部完成才放行)
    const picks = selectedImageIndices();
    let succeeded = 0;
    if (picks.length > 0 && Array.isArray(cfg.images)) {
      for (let i = 0; i < picks.length; i++) {
        openBtn.textContent = `下載照片 ${i + 1}/${picks.length}…`;
        const img = cfg.images[picks[i]];
        if (img?.url) {
          const ok = await downloadFile(img.url, `photo-${i + 1}.jpg`);
          if (ok) succeeded++;
        }
        // 小延遲避免某些瀏覽器併發下載被 throttle
        await new Promise((r) => setTimeout(r, 200));
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

  // 背景下載到客戶設備預設下載位置 — 完全靜默,不開新分頁
  // 失敗就記 console,絕對不 fallback 到 window.open（會打開新分頁打擾客戶）
  // 回傳 true/false 讓呼叫端統計成功數
  async function downloadFile(url, filename) {
    try {
      const r = await fetch(url, { mode: "cors", cache: "force-cache" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
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
      console.warn("[download] failed:", filename, err);
      return false;
    }
  }
});
