// 共用設定 / 預設值 / URL 編解碼
window.AppConfig = (() => {
  const STORAGE_KEY = "foryunsister_config_v1";
  const PASS_KEY = "foryunsister_admin_pass_v1";
  const SESSION_KEY = "foryunsister_admin_session";

  const WORKER_URL = "https://foryunsister-upload.rxrxttb.workers.dev";

  const DEFAULT = {
    person: "勻勻",
    title: "醫美諮詢師",
    serviceLabel: "醫美諮詢服務",
    pronoun: "她",
    clinic: "",
    address: "",
    googleUrl: "",
    tagline: "用專業陪伴你，變美更安心",
    thankYou: "謝謝你的信任與分享\n每一份回饋，都是{name}繼續用心服務的動力",
    bottomSlogan: "美麗的事，交給專業｜安心的事，交給{name}",
    images: [], // [{key, url}]
    pros: [
      "👤 客製化評估，不制式推療程",
      "💬 全程陪同說明，不讓你有距離感",
      "💰 依預算給建議，不硬推高單價",
      "🩺 操作醫師風格會先幫你評估適合度",
      "💗 新手也能安心了解療程",
      "📅 術前術後都會追蹤關心",
      "✨ 重視自然感，不做過度改變",
      "🛡️ 風險與恢復期講清楚",
      "👁️ 細節觀察到位（臉型／比例／狀態）",
      "👫 溝通不尷尬，像朋友但有專業"
    ],
    feelings: [
      "🌿 過程輕鬆，沒有壓力",
      "💗 被理解需求，給的建議很實在",
      "💬 很有耐心，仔細解說",
      "✅ 整體流程順暢不混亂",
      "🛋️ 環境舒適，讓人放鬆",
      "🌟 當下就有想變美的動力",
      "💡 諮詢專業，解答清楚",
      "💲 價格透明，沒有隱藏費用",
      "🔒 隱私保護做得很好",
      "😊 期待下次再來"
    ]
  };

  // 從一行字解析「icon 文字」格式 → {icon, text}
  function parseTag(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed) return null;
    const idx = trimmed.indexOf(" ");
    if (idx === -1) return { icon: "", text: trimmed };
    const head = trimmed.slice(0, idx);
    const rest = trimmed.slice(idx + 1).trim();
    // head 看起來像 emoji / 符號（不含中英數）→ 視為 icon
    if (head.length <= 4 && !/[一-鿿A-Za-z0-9]/.test(head)) {
      return { icon: head, text: rest };
    }
    return { icon: "", text: trimmed };
  }

  // 把 {name} 之類的佔位字替換掉
  function template(str, vars) {
    if (!str) return "";
    return String(str).replace(/\{(\w+)\}/g, (_, k) => vars[k] || "");
  }

  // UTF-8 safe URL-safe Base64
  function encodeConfig(obj) {
    const json = JSON.stringify(obj);
    const utf8 = new TextEncoder().encode(json);
    let bin = "";
    utf8.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function decodeConfig(b64url) {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(b64 + pad);
    const utf8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(utf8);
    return JSON.parse(json);
  }

  // 讀順序：URL ?c= → localStorage → DEFAULT
  function load() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("c");
    if (fromUrl) {
      try {
        return mergeDefaults(decodeConfig(fromUrl));
      } catch (e) {
        console.warn("URL config parse failed, falling back", e);
      }
    }
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (fromStorage) {
      try {
        return mergeDefaults(JSON.parse(fromStorage));
      } catch (e) {
        console.warn("LocalStorage config parse failed", e);
      }
    }
    return { ...DEFAULT };
  }

  function save(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function mergeDefaults(partial) {
    return { ...DEFAULT, ...partial };
  }

  // 密碼（明文存 localStorage,純客戶端站防君子用）
  function getPassword() {
    return localStorage.getItem(PASS_KEY) || "admin";
  }
  function setPassword(p) {
    localStorage.setItem(PASS_KEY, p);
  }
  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  }
  function login() {
    sessionStorage.setItem(SESSION_KEY, "1");
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // 把 admin 貼的各種 Google 連結（包含一般地圖店家頁）轉成「直接打開寫評論頁」
  // 支援:
  //   - 純 Place ID: ChIJxxxxx
  //   - 純 FTID: 0xHEX:0xHEX
  //   - 含 ?placeid= 或 ?place_id= 的 URL
  //   - Google Maps 店家頁 URL（從 !1s0xHEX:0xHEX 或 data 區段抽 FTID）
  //   - 已是 writereview / g.page/r 連結（原樣返回）
  // 不支援:
  //   - maps.app.goo.gl / goo.gl/maps 短網址（純前端無法展開,直接打開會到地圖頁）
  function normalizeReviewUrl(input) {
    if (!input) return "";
    const trimmed = input.trim();

    // 1. 純 Place ID
    if (/^ChIJ[\w-]{20,}$/.test(trimmed)) {
      return `https://search.google.com/local/writereview?placeid=${trimmed}`;
    }

    // 2. 純 FTID 格式（0xHEX:0xHEX）
    if (/^0x[\da-f]+:0x[\da-f]+$/i.test(trimmed)) {
      return `https://search.google.com/local/writereview?placeid=${trimmed}`;
    }

    // 3. 已是 writereview / g.page 連結 → 原樣
    if (/search\.google\.com\/local\/writereview/i.test(trimmed)) {
      return trimmed;
    }
    if (/^https?:\/\/g\.page\/r\//i.test(trimmed)) {
      return trimmed;
    }

    // 4. URL 含 placeid / place_id 參數
    try {
      const url = new URL(trimmed);
      const pid =
        url.searchParams.get("placeid") || url.searchParams.get("place_id");
      if (pid) {
        return `https://search.google.com/local/writereview?placeid=${pid}`;
      }
    } catch {}

    // 5. 從整段 URL 抽 FTID 模式（最常見：Google Maps 店家頁的 !1s0xHEX:0xHEX）
    const ftid = trimmed.match(/0x[\da-f]+:0x[\da-f]+/i);
    if (ftid) {
      return `https://search.google.com/local/writereview?placeid=${ftid[0]}`;
    }

    // 6. ChIJ Place ID 藏在 URL 任意位置
    const pidIn = trimmed.match(/ChIJ[\w-]{20,}/);
    if (pidIn) {
      return `https://search.google.com/local/writereview?placeid=${pidIn[0]}`;
    }

    // 7. 短網址或無法解析 → 原樣（會到地圖頁,提示在 admin 端顯示）
    return trimmed;
  }

  // 判斷 normalize 是否真的轉成了寫評論連結（給 admin 端做顯示）
  function isWriteReviewUrl(url) {
    if (!url) return false;
    return (
      /search\.google\.com\/local\/writereview/i.test(url) ||
      /^https?:\/\/g\.page\/r\//i.test(url)
    );
  }

  function buildShareUrl(cfg) {
    const url = new URL(location.href);
    url.pathname = url.pathname.replace(/admin\.html$/, "");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.search = "?c=" + encodeConfig(cfg);
    url.hash = "";
    return url.toString();
  }

  return {
    DEFAULT,
    WORKER_URL,
    load,
    save,
    getPassword,
    setPassword,
    isLoggedIn,
    login,
    logout,
    buildShareUrl,
    encodeConfig,
    decodeConfig,
    normalizeReviewUrl,
    isWriteReviewUrl,
    parseTag,
    template
  };
})();
