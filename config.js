// 共用設定 / 預設值 / URL 編解碼
window.AppConfig = (() => {
  const STORAGE_KEY = "foryunsister_config_v1";
  const PASS_KEY = "foryunsister_admin_pass_v1";
  const SESSION_KEY = "foryunsister_admin_session";

  const DEFAULT = {
    person: "曼蒂",
    clinic: "青熙美學診所",
    address: "台中市南屯區益昌一街37號1樓",
    googleUrl: "",
    pros: [
      "講解細緻清晰",
      "減法建議不推銷",
      "新手友善沒壓力",
      "審美自然有質感",
      "觀察力極強",
      "流程專業誠懇",
      "動作輕柔穩定",
      "術後衛教專業",
      "風險告知坦白",
      "溝通非常有溫度"
    ],
    feelings: [
      "全程放鬆不緊張",
      "被細心呵護感",
      "諮詢後很安心",
      "聊天氛圍很愉快",
      "很滿意整體服務",
      "願意再次回來"
    ]
  };

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
    isWriteReviewUrl
  };
})();
