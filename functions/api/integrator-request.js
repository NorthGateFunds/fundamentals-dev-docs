export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  function json(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
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

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  // Accept only these two kinds (matches your wire.integrator_requests.kind usage)
  const kind = String(body.kind || "");
  const email = String(body.email || "").trim().toLowerCase();

  if (kind !== "push_access" && kind !== "integration") {
    return json(400, { ok: false, error: "invalid_kind" });
  }
  if (!email || !isEmail(email)) {
    return json(400, { ok: false, error: "invalid_email" });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { ok: false, error: "missing_env" });
  }

  // Call the public RPC that inserts into wire.integrator_requests
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
    p_source_path: cleanStr(body.source_path) || cleanStr(new URL(request.url).pathname),
    p_user_agent: cleanStr(request.headers.get("user-agent")),
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
    return json(500, { ok: false, error: "insert_failed", details: t.slice(0, 500) });
  }

  const id = await r.json().catch(() => null);
  return json(200, { ok: true, id });
}