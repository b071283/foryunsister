// 共用設定 / 預設值 / URL 編解碼
window.AppConfig = (() => {
  const STORAGE_KEY = "foryunsister_config_v1";
  const PASS_KEY = "foryunsister_admin_pass_v1";
  const SESSION_KEY = "foryunsister_admin_session";

  const WORKER_URL = "https://foryunsister-upload.rxrxttb.workers.dev";
  const R2_PUBLIC_BASE = "https://pub-fe48d0757d44404188398c4b0f1c3d76.r2.dev";
  const CONFIG_ID_KEY = "foryunsister_config_id_v1";

  const DEFAULT = {
    person: "勻勻",
    title: "醫美諮詢師",
    serviceLabel: "醫美諮詢服務",
    pronoun: "她",
    clinic: "青熙美學診所",
    address: "台中市南屯區益昌一街37號1樓",
    // 青熙美學診所 Maps URL（含 FTID 0x34693df6e7682a5d:0x223a9200e0fdb18a）
    // 桌機:會到店家頁,點「撰寫評論」進入表單(1 個動作)
    // 手機:Maps APP 攔截到店家頁,同樣點「撰寫評論」進入
    // 想 100% 直達評論表單,請去 business.google.com 拿青熙的 g.page/r/.../review 連結覆蓋這條
    googleUrl:
      "https://www.google.com/maps/place/%E9%9D%92%E7%86%99%E7%BE%8E%E5%AD%B8%E8%A8%BA%E6%89%80/@24.1385039,120.6332114,17z/data=!3m1!4b1!4m6!3m5!1s0x34693df6e7682a5d:0x223a9200e0fdb18a!8m2!3d24.1385039!4d120.6332114!16s%2Fg%2F11s5twf6hf",
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

  // 同步讀（不含 R2 fetch）：URL ?c=BASE64 → localStorage → DEFAULT
  // 客戶端 use loadAsync() 才能解析 ?id=ABCDEFGH 短 URL
  function load() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("c");
    if (fromUrl) {
      try {
        return applyOverrides(mergeDefaults(decodeConfig(fromUrl)), params);
      } catch (e) {
        console.warn("URL config parse failed, falling back", e);
      }
    }
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (fromStorage) {
      try {
        return applyOverrides(mergeDefaults(JSON.parse(fromStorage)), params);
      } catch (e) {
        console.warn("LocalStorage config parse failed", e);
      }
    }
    return applyOverrides({ ...DEFAULT }, params);
  }

  // Async load — 支援 ?id=ABCDEFGH 從 R2 拉 config
  async function loadAsync() {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (id) {
      try {
        const cfgUrl = `${R2_PUBLIC_BASE}/cfg/${encodeURIComponent(id)}.json`;
        const r = await fetch(cfgUrl, { cache: "force-cache" });
        if (r.ok) {
          const data = await r.json();
          return applyOverrides(mergeDefaults(data), params);
        }
      } catch (e) {
        console.warn("R2 config fetch failed, falling back to local", e);
      }
    }
    return load();
  }

  // ?p=員工名 (encoded) → 覆蓋 person 欄位 (用於批次 QR 共用同一個 base config)
  function applyOverrides(cfg, params) {
    const p = params.get("p");
    if (p) cfg.person = decodeURIComponent(p);
    return cfg;
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

  // 把 admin 貼的各種 Google 連結轉成最佳的目標 URL
  //
  // 重要：Google writereview 只接受 ChIJ 格式 Place ID,FTID (0x...:0x...) 會回 404！
  // 所以對 Maps 店家頁 URL（FTID 格式）我們**不轉成 writereview**,
  // 直接傳店家頁 URL 過去,讓客戶看到店家頁後點「撰寫評論」進入。
  //
  // 真正會「直達評論表單」的只有兩種格式:
  //   - g.page/r/.../review     ← 商家後台「分享評論連結」
  //   - writereview?placeid=ChIJ... ← 真實 Place ID（不是 FTID）
  function normalizeReviewUrl(input) {
    if (!input) return "";
    const trimmed = input.trim();

    // 已是直達格式 → 原樣返回
    if (/^https?:\/\/g\.page\/r\//i.test(trimmed)) return trimmed;
    if (/search\.google\.com\/local\/writereview\?placeid=ChIJ/i.test(trimmed))
      return trimmed;

    // 純 ChIJ Place ID → 組成 writereview（這個格式 Google 接受）
    if (/^ChIJ[\w-]{20,}$/.test(trimmed)) {
      return `https://search.google.com/local/writereview?placeid=${trimmed}`;
    }

    // URL 中含 ChIJ 格式 placeid → writereview
    try {
      const url = new URL(trimmed);
      const pid =
        url.searchParams.get("placeid") || url.searchParams.get("place_id");
      if (pid && /^ChIJ[\w-]{20,}$/.test(pid)) {
        return `https://search.google.com/local/writereview?placeid=${pid}`;
      }
    } catch {}
    const chijIn = trimmed.match(/ChIJ[\w-]{20,}/);
    if (chijIn) {
      return `https://search.google.com/local/writereview?placeid=${chijIn[0]}`;
    }

    // 其他（Maps /place/...、FTID URL、純 FTID、短網址等）→ 原樣
    // 客戶會到店家頁,需要再點「撰寫評論」按鈕
    return trimmed;
  }

  // 判斷 URL 是否會「直達寫評論表單」（不需客戶再點按鈕）
  function isWriteReviewUrl(url) {
    if (!url) return false;
    return (
      /^https?:\/\/g\.page\/r\//i.test(url) ||
      /search\.google\.com\/local\/writereview\?placeid=ChIJ/i.test(url)
    );
  }

  // 判斷 URL 是否會抵達「正確的店家頁」（不會 404,但需點「撰寫評論」進入）
  function isPlacePageUrl(url) {
    if (!url) return false;
    if (isWriteReviewUrl(url)) return false; // 直達是更好的
    if (/google\.com\/maps\/place\//i.test(url)) return true;
    if (/0x[\da-f]+:0x[\da-f]+/i.test(url)) return true; // 含 FTID 的任何 URL
    return false;
  }

  // 短 URL 版（基於 R2 上的 cfg/{id}.json）。可選擇覆蓋 person 給批次 QR 用。
  function buildShareUrlShort(id, personOverride) {
    const url = new URL(location.href);
    url.pathname = url.pathname.replace(/admin\.html$/, "");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    const params = new URLSearchParams({ id });
    if (personOverride) params.set("p", personOverride);
    url.search = "?" + params.toString();
    url.hash = "";
    return url.toString();
  }

  // 舊版（base64 整包塞 URL）— 保留作 fallback,當沒有 R2 ID 時用
  function buildShareUrl(cfg) {
    const id = localStorage.getItem(CONFIG_ID_KEY);
    if (id) {
      // 有 ID 就走短 URL 版
      return buildShareUrlShort(id, cfg.person);
    }
    const url = new URL(location.href);
    url.pathname = url.pathname.replace(/admin\.html$/, "");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.search = "?c=" + encodeConfig(cfg);
    url.hash = "";
    return url.toString();
  }

  function getConfigId() {
    return localStorage.getItem(CONFIG_ID_KEY);
  }
  function setConfigId(id) {
    if (id) localStorage.setItem(CONFIG_ID_KEY, id);
    else localStorage.removeItem(CONFIG_ID_KEY);
  }

  // 把整個 config 上傳到 R2,回傳 ID
  async function saveConfigToR2(cfg, uploadToken) {
    const r = await fetch(`${WORKER_URL}/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Pass": uploadToken
      },
      body: JSON.stringify(cfg)
    });
    const data = await r.json();
    if (!r.ok || !data.success) {
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    setConfigId(data.id);
    return data.id;
  }

  return {
    DEFAULT,
    WORKER_URL,
    R2_PUBLIC_BASE,
    load,
    loadAsync,
    save,
    saveConfigToR2,
    getConfigId,
    setConfigId,
    buildShareUrlShort,
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
    isPlacePageUrl,
    parseTag,
    template
  };
})();
