document.addEventListener("DOMContentLoaded", () => {
  const cfg = AppConfig.load();

  // 套用文字內容
  document.getElementById("title").textContent = `✨ ${cfg.person || ""}專屬評價`;
  document.getElementById("clinic-name").textContent = cfg.clinic
    ? `📍 ${cfg.clinic}`
    : "";
  document.getElementById("clinic-address").textContent = cfg.address || "";

  // 渲染 tag
  renderTags("pros", cfg.pros);
  renderTags("feelings", cfg.feelings);

  function renderTags(group, items) {
    const grid = document.querySelector(`.tag-grid[data-group="${group}"]`);
    if (!grid) return;
    grid.innerHTML = "";
    items.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        updateCount(group);
        updateSubmitState();
      });
      grid.appendChild(btn);
    });
    updateCount(group);
  }

  function updateCount(group) {
    const count = document.querySelectorAll(
      `.tag-grid[data-group="${group}"] .tag.active`
    ).length;
    const el = document.querySelector(`.count[data-count="${group}"]`);
    if (el) el.textContent = String(count);
    el?.parentElement.classList.toggle("has-selection", count > 0);
  }

  function updateSubmitState() {
    const ok = !getValidationError();
    submitBtn?.classList.toggle("ready", ok);
  }

  // 取得勾選的標籤
  function getSelected(group) {
    return Array.from(
      document.querySelectorAll(
        `.tag-grid[data-group="${group}"] .tag.active`
      )
    ).map((el) => el.textContent.trim());
  }

  // 組評論文字 — 自然段落
  // 例:「大推醫美師曼蒂！她服務真的很{優點1}、{優點2}。這次過來覺得{感受1}，{感受2}。」
  function buildComment() {
    const pros = getSelected("pros");
    const feelings = getSelected("feelings");

    if (pros.length === 0 || feelings.length === 0) {
      return "";
    }

    const name = cfg.person || "";
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
    if (pros.length === 0) {
      return "「推薦的優點」至少要勾一個 👆";
    }
    if (feelings.length === 0) {
      return "「當天服務感受」至少要勾一個 👆";
    }
    return "";
  }

  // 送出 — 要在 renderTags 裡用,但要先宣告
  var submitBtn = document.getElementById("submit-btn");
  const modal = document.getElementById("result-modal");
  const preview = document.getElementById("comment-preview");
  const copyBtn = document.getElementById("copy-btn");
  const openBtn = document.getElementById("open-google-btn");
  const closeBtn = document.getElementById("modal-close");
  const status = document.getElementById("copy-status");

  submitBtn.addEventListener("click", async () => {
    const err = getValidationError();
    if (err) {
      alert(err);
      return;
    }
    const text = buildComment();
    preview.textContent = text;
    modal.hidden = false;

    // 自動複製到剪貼簿
    const ok = await copyToClipboard(text);
    status.textContent = ok ? "✅ 已自動複製，點下方按鈕前往 Google" : "⚠️ 自動複製失敗，請手動點「複製評論」";
    status.dataset.ok = ok ? "1" : "0";
  });

  copyBtn.addEventListener("click", async () => {
    const ok = await copyToClipboard(preview.textContent);
    status.textContent = ok ? "✅ 已複製！" : "⚠️ 複製失敗，請長按文字選取後手動複製";
  });

  openBtn.addEventListener("click", () => {
    if (!cfg.googleUrl) {
      alert("⚠️ 管理員尚未設定 Google 評論連結，請先到管理員頁面設定");
      return;
    }
    const url = AppConfig.normalizeReviewUrl(cfg.googleUrl);
    window.open(url, "_blank", "noopener");
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
      // fallback
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
});
