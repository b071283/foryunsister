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
      btn.addEventListener("click", () => btn.classList.toggle("active"));
      grid.appendChild(btn);
    });
  }

  // 取得勾選的標籤
  function getSelected(group) {
    return Array.from(
      document.querySelectorAll(
        `.tag-grid[data-group="${group}"] .tag.active`
      )
    ).map((el) => el.textContent.trim());
  }

  // 組評論文字
  function buildComment() {
    const pros = getSelected("pros");
    const feelings = getSelected("feelings");

    const lines = [];
    const personLabel = cfg.person ? `推薦${cfg.person}` : "推薦這裡";

    if (pros.length) {
      lines.push(`✨ ${personLabel}的優點：${pros.join("、")}`);
    }
    if (feelings.length) {
      lines.push(`💖 當天的服務感受：${feelings.join("、")}`);
    }
    if (lines.length === 0) {
      return "";
    }
    if (cfg.clinic) {
      lines.push("");
      lines.push(`📍 ${cfg.clinic}`);
    }
    return lines.join("\n");
  }

  // 送出
  const submitBtn = document.getElementById("submit-btn");
  const modal = document.getElementById("result-modal");
  const preview = document.getElementById("comment-preview");
  const copyBtn = document.getElementById("copy-btn");
  const openBtn = document.getElementById("open-google-btn");
  const closeBtn = document.getElementById("modal-close");
  const status = document.getElementById("copy-status");

  submitBtn.addEventListener("click", async () => {
    const text = buildComment();
    if (!text) {
      alert("請至少勾選一項再送出 ✨");
      return;
    }
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
