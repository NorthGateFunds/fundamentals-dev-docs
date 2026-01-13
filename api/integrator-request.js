// api/integrator-request.js
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

function cleanStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
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

  // We CANNOT write to wire.* through /rest/v1/table unless Supabase exposes the wire schema.
  // So we call an RPC in public that inserts into wire.integrator_requests.
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/submit_integrator_request`;

  const payload = {
    p_kind: kind,
    p_email: email,
    p_company: cleanStr(body.company),
    p_name: cleanStr(body.name),
    p_role: cleanStr(body.role),
    p_endpoint_url: cleanStr(body.endpoint_url),
    // accept either delivery_env or environment from your forms
    p_delivery_env: cleanStr(body.delivery_env || body.environment),
    p_format_preference: cleanStr(body.format_preference),
    p_notes: cleanStr(body.notes),
    p_source_path: cleanStr(body.source_path) || cleanStr(req?.headers?.referer) || null,
    p_user_agent: cleanStr(req.headers["user-agent"]),
  };

  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return send(res, 500, {
      ok: false,
      error: "insert_failed",
      details: t.slice(0, 500),
    });
  }

  // Supabase RPC returns the function result directly (uuid as JSON string)
  const id = await r.json().catch(() => null);
  return send(res, 200, { ok: true, id });
}