export const config = { runtime: "nodejs" };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return send(res, 500, { ok: false, error: "missing_env" });
  }

  let body = {};
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { ok: false, error: "invalid_json" });
  }

  const kind = String(body.kind || "");
  const email = String(body.email || "").trim().toLowerCase();

  if (kind !== "push_access" && kind !== "integration") {
    return send(res, 400, { ok: false, error: "invalid_kind" });
  }
  if (!email || !isEmail(email)) {
    return send(res, 400, { ok: false, error: "invalid_email" });
  }

  const payload = {
    kind,
    email,
    company: body.company ? String(body.company).trim() : null,
    name: body.name ? String(body.name).trim() : null,
    role: body.role ? String(body.role).trim() : null,
    endpoint_url: body.endpoint_url ? String(body.endpoint_url).trim() : null,
    delivery_env: body.delivery_env ? String(body.delivery_env).trim() : null,
    format_preference: body.format_preference ? String(body.format_preference).trim() : null,
    notes: body.notes ? String(body.notes).trim() : null,
    source_path: body.source_path ? String(body.source_path).trim() : null,
    user_agent: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
  };

  // IMPORTANT: target the wire schema using PostgREST profiles
  const insertUrl = `${SUPABASE_URL}/rest/v1/integrator_requests`;

  const r = await fetch(insertUrl, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      "content-type": "application/json",
      prefer: "return=representation",

      // ✅ This is what makes it write to wire.integrator_requests
      "Content-Profile": "wire",
      "Accept-Profile": "wire",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return send(res, 500, { ok: false, error: "insert_failed", details: t.slice(0, 500) });
  }

  const rows = await r.json().catch(() => []);
  const row = rows && rows[0];

  return send(res, 200, { ok: true, id: row?.id || null });
}