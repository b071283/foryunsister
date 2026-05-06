document.addEventListener("DOMContentLoaded", () => {
  const loginPanel = document.getElementById("login-panel");
  const settingsPanel = document.getElementById("settings-panel");
  const loginForm = document.getElementById("login-form");
  const loginErr = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const settingsForm = document.getElementById("settings-form");
  const saveStatus = document.getElementById("save-status");

  const personEl = document.getElementById("set-person");
  const clinicEl = document.getElementById("set-clinic");
  const addressEl = document.getElementById("set-address");
  const googleEl = document.getElementById("set-google");
  const prosEl = document.getElementById("set-pros");
  const feelingsEl = document.getElementById("set-feelings");
  const newpassEl = document.getElementById("set-newpass");

  const shareUrlEl = document.getElementById("share-url");
  const copyShareBtn = document.getElementById("copy-share-btn");
  const previewLink = document.getElementById("preview-link");

  function showLogin() {
    loginPanel.hidden = false;
    settingsPanel.hidden = true;
    document.getElementById("login-pass").focus();
  }

  function showSettings() {
    loginPanel.hidden = true;
    settingsPanel.hidden = false;
    populateForm();
  }

  function populateForm() {
    const cfg = AppConfig.load();
    personEl.value = cfg.person || "";
    clinicEl.value = cfg.clinic || "";
    addressEl.value = cfg.address || "";
    googleEl.value = cfg.googleUrl || "";
    prosEl.value = (cfg.pros || []).join("\n");
    feelingsEl.value = (cfg.feelings || []).join("\n");
    newpassEl.value = "";
    refreshShare(cfg);
  }

  function readForm() {
    return {
      person: personEl.value.trim(),
      clinic: clinicEl.value.trim(),
      address: addressEl.value.trim(),
      googleUrl: googleEl.value.trim(),
      pros: prosEl.value.split("\n").map((s) => s.trim()).filter(Boolean),
      feelings: feelingsEl.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    };
  }

  function refreshShare(cfg) {
    const url = AppConfig.buildShareUrl(cfg);
    shareUrlEl.value = url;
    previewLink.href = url;
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

  // 儲存
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const cfg = readForm();
    AppConfig.save(cfg);
    if (newpassEl.value) {
      AppConfig.setPassword(newpassEl.value);
      newpassEl.value = "";
    }
    refreshShare(cfg);
    saveStatus.textContent = "✅ 已儲存，分享連結已更新";
    saveStatus.dataset.ok = "1";
    setTimeout(() => {
      saveStatus.textContent = "";
    }, 4000);
  });

  // 複製分享連結
  copyShareBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareUrlEl.value);
      copyShareBtn.textContent = "✅ 已複製";
      setTimeout(() => (copyShareBtn.textContent = "📋 複製"), 2000);
    } catch {
      shareUrlEl.select();
      document.execCommand("copy");
      copyShareBtn.textContent = "✅ 已複製";
      setTimeout(() => (copyShareBtn.textContent = "📋 複製"), 2000);
    }
  });

  // 啟動
  if (AppConfig.isLoggedIn()) {
    showSettings();
  } else {
    showLogin();
  }
});
