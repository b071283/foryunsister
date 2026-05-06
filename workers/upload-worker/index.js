// foryunsister-upload — Cloudflare Worker
// Admin uploads images via password auth, stores in R2, returns public r2.dev URL
//
// Routes:
//   POST   /upload          → upload image (Content-Type: image/*, body: bytes)
//   GET    /list            → list images in bucket (admin only)
//   DELETE /image/:key      → delete image (admin only)
// Auth: header X-Admin-Pass must match env.ADMIN_PASS
//
// Bindings:
//   IMAGES        R2 bucket binding for foryunsister-images
//   ADMIN_PASS    secret string
//   PUBLIC_BASE   var like "https://pub-XXXX.r2.dev"

const ALLOWED_ORIGINS = new Set([
  "https://sister.socialcontactapp.net",
  "http://localhost:8765",
  "http://127.0.0.1:8765"
]);

const EXT_MAP = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp"
};

const MAX_BYTES = 3 * 1024 * 1024; // 3MB hard cap

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://sister.socialcontactapp.net";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Pass",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json"
    }
  });
}

function checkAuth(request, env) {
  const pass = request.headers.get("X-Admin-Pass") || "";
  if (!env.ADMIN_PASS) return false;
  if (pass.length !== env.ADMIN_PASS.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < pass.length; i++) {
    diff |= pass.charCodeAt(i) ^ env.ADMIN_PASS.charCodeAt(i);
  }
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // POST /upload
    if (request.method === "POST" && url.pathname === "/upload") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return json({ error: "origin not allowed" }, 403, origin);
      }
      if (!checkAuth(request, env)) {
        return json({ error: "forbidden" }, 403, origin);
      }

      const ct = (request.headers.get("Content-Type") || "").split(";")[0].trim();
      if (!ct.startsWith("image/")) {
        return json({ error: "content-type must be image/*" }, 400, origin);
      }
      const ext = EXT_MAP[ct] || "bin";

      const cl = parseInt(request.headers.get("Content-Length") || "0", 10);
      if (cl > MAX_BYTES) {
        return json({ error: "image too large (max 3MB)" }, 413, origin);
      }

      // Generate key
      const ts = Date.now();
      const rand = crypto.randomUUID().slice(0, 8);
      const key = `${ts}-${rand}.${ext}`;

      try {
        await env.IMAGES.put(key, request.body, {
          httpMetadata: {
            contentType: ct,
            // 強制下載而不是預覽,讓客戶手機直接收到檔案到相簿/檔案管理員
            contentDisposition: `attachment; filename="${key}"`
          }
        });
      } catch (e) {
        return json({ error: "r2 put failed", detail: String(e) }, 500, origin);
      }

      return json(
        {
          success: true,
          key,
          url: `${env.PUBLIC_BASE.replace(/\/$/, "")}/${key}`,
          contentType: ct,
          size: cl
        },
        200,
        origin
      );
    }

    // POST /config — 把整個 admin config 存到 R2,回傳一個短 ID
    // 之後分享連結就只是 ?id=ABCDEFGH (~8 chars)
    if (request.method === "POST" && url.pathname === "/config") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return json({ error: "origin not allowed" }, 403, origin);
      }
      if (!checkAuth(request, env)) {
        return json({ error: "forbidden" }, 403, origin);
      }
      const body = await request.text();
      if (body.length > 200 * 1024) {
        return json({ error: "config too large" }, 413, origin);
      }
      // 8-char base32-ish ID（無歧義字元）
      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      const buf = new Uint8Array(8);
      crypto.getRandomValues(buf);
      const id = Array.from(buf, (b) => alphabet[b % alphabet.length]).join("");
      const key = `cfg/${id}.json`;
      try {
        await env.IMAGES.put(key, body, {
          httpMetadata: { contentType: "application/json; charset=utf-8" }
        });
      } catch (e) {
        return json({ error: "r2 put failed", detail: String(e) }, 500, origin);
      }
      return json(
        {
          success: true,
          id,
          url: `${env.PUBLIC_BASE.replace(/\/$/, "")}/${key}`
        },
        200,
        origin
      );
    }

    // GET /list
    if (request.method === "GET" && url.pathname === "/list") {
      if (!checkAuth(request, env)) {
        return json({ error: "forbidden" }, 403, origin);
      }
      const list = await env.IMAGES.list({ limit: 200 });
      const items = list.objects.map((o) => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded,
        url: `${env.PUBLIC_BASE.replace(/\/$/, "")}/${o.key}`
      }));
      return json({ success: true, items }, 200, origin);
    }

    // DELETE /image/:key
    if (request.method === "DELETE" && url.pathname.startsWith("/image/")) {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return json({ error: "origin not allowed" }, 403, origin);
      }
      if (!checkAuth(request, env)) {
        return json({ error: "forbidden" }, 403, origin);
      }
      const key = decodeURIComponent(url.pathname.replace("/image/", ""));
      if (!key) return json({ error: "missing key" }, 400, origin);
      await env.IMAGES.delete(key);
      return json({ success: true, deleted: key }, 200, origin);
    }

    // health check
    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "foryunsister-upload" }, 200, origin);
    }

    return json({ error: "not found" }, 404, origin);
  }
};
