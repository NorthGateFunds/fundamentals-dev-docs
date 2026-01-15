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

const ALLOWED_KINDS = new Set([
  "integration",
  "push_test",
  "push_enable",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return send(res, 500, {
      ok: false,
      error: "missing_env",
      required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { ok: false, error: "invalid_json" });
  }

  const kind = cleanStr(body.kind);
  const email = cleanStr(body.email)?.toLowerCase() ?? null;

  if (!kind || !ALLOWED_KINDS.has(kind)) {
    return send(res, 400, {
      ok: false,
      error: "invalid_kind",
      allowed: Array.from(ALLOWED_KINDS),
    });
  }

  if (!email || !isEmail(email)) {
    return send(res, 400, { ok: false, error: "invalid_email" });
  }

  /**
   * IMPORTANT
   * =========
   * All tables live in the `wire` schema.
   * We insert ONLY through an RPC to avoid exposing wire.*
   */
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/submit_integrator_request`;

  const payload = {
    p_kind: kind,
    p_email: email,
    p_company: cleanStr(body.company),
    p_name: cleanStr(body.name),
    p_role: cleanStr(body.role),
    p_endpoint_url: cleanStr(body.endpoint_url),
    p_delivery_env: cleanStr(body.delivery_env || body.environment),
    p_format_preference: cleanStr(body.format_preference),
    p_notes: cleanStr(body.notes),
    p_source_path:
      cleanStr(body.source_path) ||
      cleanStr(req.headers.referer) ||
      null,
    p_user_agent: cleanStr(req.headers["user-agent"]),
  };

  let rpcRes;
  try {
    rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return send(res, 502, {
      ok: false,
      error: "supabase_unreachable",
    });
  }

  if (!rpcRes.ok) {
    const text = await rpcRes.text().catch(() => "");
    return send(res, 500, {
      ok: false,
      error: "rpc_failed",
      status: rpcRes.status,
      details: text.slice(0, 500),
    });
  }

  // RPC returns the inserted row id (uuid)
  const id = await rpcRes.json().catch(() => null);

  return send(res, 200, { ok: true, id });
}