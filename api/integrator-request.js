// api/integrator-request.js
// Node runtime endpoint for docs site.
// - Inserts integrator request via Supabase RPC (SECURITY DEFINER)
// - If Step 1 test (push_access + delivery_env=test), POSTs a minimal NewsML 1.2 XML payload
//   to the provided HTTPS endpoint and returns delivery status + headers.
//
// NOTE: Keep this file path exactly as your repo expects: api/integrator-request.js

export const config = { runtime: "nodejs" };

// Change this string any time you want to verify what Vercel is *actually* running.
const HANDLER_VERSION = "integrator-request@2026-01-15T04:30Z";

/* ---------------- tiny utils ---------------- */

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  // hard marker in headers so curl -D - shows it
  res.setHeader("x-fw-handler-version", HANDLER_VERSION);
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function cleanStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* ---------------- NewsML helpers (minimal) ---------------- */

function dateIdFromIso(iso) {
  const d = new Date(iso);
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function dateTimeFromIso(iso) {
  const d = new Date(iso);
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}+0000`;
}

function buildPublicIdentifier({ providerId, dateId, newsItemId, revisionId }) {
  return `urn:newsml:${providerId}:${dateId}:${newsItemId}:${revisionId}`;
}

function normalizeXhtmlDoc(innerHtml, titleText) {
  const safeTitle = titleText ? xmlEscape(titleText) : "";
  const body = (innerHtml || "").trim();
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${safeTitle}</title></head><body>${body}</body></html>`;
}

function makeTestNewsML({ providerId, providerName, createdIso, newsItemId }) {
  const dt = dateTimeFromIso(createdIso);
  const dateId = dateIdFromIso(createdIso);
  const revisionId = "1";

  const publicIdentifier = buildPublicIdentifier({
    providerId,
    dateId,
    newsItemId,
    revisionId,
  });

  const title = "Fundamentals Wire — HTTPS Push Test Delivery";
  const dateline = `NEW YORK--(FUNDAMENTALS WIRE)--${createdIso.slice(0, 10)}`;

  const bodyXhtml = normalizeXhtmlDoc(
    `<p><b>This is a test delivery.</b></p>
<p>If you can read this, your endpoint accepted an HTTPS POST containing NewsML 1.2.</p>
<p>newsItemId: <code>${xmlEscape(newsItemId)}</code></p>
<p>created: <code>${xmlEscape(createdIso)}</code></p>
<p>handler: <code>${xmlEscape(HANDLER_VERSION)}</code></p>`,
    ""
  );

  const headlineDoc = normalizeXhtmlDoc(
    `<p class="fwtextaligncenter"><b>${xmlEscape(title)}</b></p>`,
    ""
  );

  const minimalCss = `.fwtextaligncenter { text-align: center; }`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<NewsML xmlns="http://iptc.org/std/NewsML/1.2/" Version="1.2">
  <Catalog Href="https://wire.fundamentals.so/schema/newsml/FundamentalsWireNewsMLCatalog.xml"/>

  <NewsEnvelope>
    <DateAndTime>${dt}</DateAndTime>

    <SentFrom>
      <Party FormalName="${xmlEscape(providerName)}">
        <Property FormalName="ProviderProfile" Value="FundamentalsWireProfile"/>
        <Property FormalName="ProviderProfileVersion" Value="1.0"/>
      </Party>
    </SentFrom>

    <NewsService FormalName="${xmlEscape(providerName)}"/>
    <NewsProduct FormalName="PressRelease"/>
  </NewsEnvelope>

  <NewsItem>
    <Identification>
      <NewsIdentifier>
        <ProviderId>${xmlEscape(providerId)}</ProviderId>
        <DateId>${dateId}</DateId>
        <NewsItemId>${xmlEscape(newsItemId)}</NewsItemId>
        <RevisionId PreviousRevision="0" Update="N">${revisionId}</RevisionId>
        <PublicIdentifier>${xmlEscape(publicIdentifier)}</PublicIdentifier>
      </NewsIdentifier>
    </Identification>

    <NewsManagement>
      <NewsItemType FormalName="Release"/>
      <FirstCreated>${dt}</FirstCreated>
      <ThisRevisionCreated>${dt}</ThisRevisionCreated>
      <Status FormalName="Usable"/>
    </NewsManagement>

    <NewsComponent>
      <BasisForChoice Rank="1">./NewsComponent/Role</BasisForChoice>

      <NewsLines>
        <HeadLine>${xmlEscape(title)}</HeadLine>
        <DateLine>${xmlEscape(dateline)}</DateLine>
        <SlugLine>HTTPS Push Test</SlugLine>
      </NewsLines>

      <DescriptiveMetadata>
        <Language FormalName="en"/>
        <Genre FormalName="Release"/>
      </DescriptiveMetadata>

      <NewsComponent>
        <Role FormalName="HeadLine"/>
        <BasisForChoice Rank="1">./ContentItem/Format</BasisForChoice>
        <DescriptiveMetadata><Language FormalName="en"/></DescriptiveMetadata>
        <ContentItem Duid="${xmlEscape(newsItemId)}.headline">
          <Format FormalName="XHTML"/>
          <MimeType FormalName="text/xhtml"/>
          <DataContent>${headlineDoc}</DataContent>
        </ContentItem>
      </NewsComponent>

      <NewsComponent>
        <Role FormalName="Body"/>
        <BasisForChoice Rank="1">./ContentItem/Format</BasisForChoice>
        <DescriptiveMetadata><Language FormalName="en"/></DescriptiveMetadata>
        <ContentItem Duid="${xmlEscape(newsItemId)}.body">
          <Format FormalName="XHTML"/>
          <MimeType FormalName="text/xhtml"/>
          <DataContent>${bodyXhtml}</DataContent>
        </ContentItem>
      </NewsComponent>

      <NewsComponent>
        <Role FormalName="StyleSheet"/>
        <BasisForChoice Rank="1">./ContentItem/Format</BasisForChoice>
        <DescriptiveMetadata><Language FormalName="en"/></DescriptiveMetadata>
        <ContentItem Duid="${xmlEscape(newsItemId)}.stylesheet">
          <Format FormalName="CSS"/>
          <MimeType FormalName="text/css"/>
          <DataContent>${xmlEscape(minimalCss)}</DataContent>
        </ContentItem>
      </NewsComponent>

    </NewsComponent>
  </NewsItem>
</NewsML>`;
}

/* ---------------- kind/env normalization ---------------- */

function isHttpsUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeKindAndEnv(kind, deliveryEnvRaw) {
  const delivery_env = cleanStr(deliveryEnvRaw);

  if (kind === "push_test") {
    return { dbKind: "push_access", delivery_env: delivery_env || "test", isTest: true };
  }
  if (kind === "push_enable") {
    return { dbKind: "push_access", delivery_env: delivery_env || "production", isTest: false };
  }
  if (kind === "push_access") {
    const env = delivery_env || "test";
    return { dbKind: "push_access", delivery_env: env, isTest: env === "test" };
  }
  if (kind === "integration") {
    return { dbKind: "integration", delivery_env, isTest: false };
  }

  return { dbKind: null, delivery_env, isTest: false };
}

function pickHeaders(h) {
  const out = {};
  if (!h || typeof h.get !== "function") return out;
  const keys = [
    "content-type",
    "content-length",
    "server",
    "date",
    "cf-ray",
    "x-vercel-id",
    "x-vercel-cache",
  ];
  for (const k of keys) {
    const v = h.get(k);
    if (v) out[k] = v;
  }
  return out;
}

/* ---------------- NEW: persist delivery attempts ---------------- */

async function postDeliveryAttempt({
  SUPABASE_URL,
  SERVICE_ROLE,
  request_id,
  delivery_env,
  endpoint_url,
  attempted,
  delivered,
  http_status,
  response_headers,
  response_snippet,
  error,
  error_detail,
  timeout_ms,
  sent_bytes,
  newsml_news_item_id,
}) {
  // Never block user response on logging; best-effort only.
  try {
    // If you want this scoped to "wire" explicitly, set REST schema header.
    // Many setups default to "public"; if your table is in "wire", you either:
    //  1) expose it via PostgREST schema config, or
    //  2) create an RPC SECURITY DEFINER to insert attempts.
    //
    // This code assumes the table is reachable at /rest/v1/integrator_delivery_attempts
    // (as you described: wire.integrator_delivery_attempts).
    await fetch(`${SUPABASE_URL}/rest/v1/integrator_delivery_attempts`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
        "content-type": "application/json",
        prefer: "return=minimal",
        // Uncomment if your Supabase PostgREST honors per-request schema:
        // "Accept-Profile": "wire",
        // "Content-Profile": "wire",
      },
      body: JSON.stringify({
        request_id,
        delivery_env: delivery_env || null,
        endpoint_url: endpoint_url || null,
        attempted: !!attempted,
        delivered: delivered === null || delivered === undefined ? null : !!delivered,
        http_status: http_status ?? null,
        response_headers: response_headers || null,
        response_snippet: response_snippet || null,
        error: error || null,
        error_detail: error_detail || null,
        timeout_ms: timeout_ms ?? null,
        sent_bytes: sent_bytes ?? null,
        newsml_news_item_id: newsml_news_item_id || null,
        handler_version: HANDLER_VERSION,
        created_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {
    // swallow
  }
}

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: "method_not_allowed", v: HANDLER_VERSION });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return send(res, 500, {
      ok: false,
      error: "missing_env",
      required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      v: HANDLER_VERSION,
    });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { ok: false, error: "invalid_json", v: HANDLER_VERSION });
  }

  const incomingKind = cleanStr(body.kind);
  const email = cleanStr(body.email)?.toLowerCase() ?? null;

  if (!incomingKind) {
    return send(res, 400, { ok: false, error: "invalid_kind", v: HANDLER_VERSION });
  }

  const { dbKind, delivery_env, isTest } = normalizeKindAndEnv(
    incomingKind,
    body.delivery_env || body.environment
  );

  if (!dbKind) {
    return send(res, 400, {
      ok: false,
      error: "invalid_kind",
      allowed: ["push_access", "integration", "push_test (legacy)", "push_enable (legacy)"],
      v: HANDLER_VERSION,
    });
  }

  if (!email || !isEmail(email)) {
    return send(res, 400, { ok: false, error: "invalid_email", v: HANDLER_VERSION });
  }

  const endpoint_url = cleanStr(body.endpoint_url);

  if (dbKind === "push_access" && isTest) {
    if (!endpoint_url) {
      return send(res, 400, { ok: false, error: "missing_endpoint_url", v: HANDLER_VERSION });
    }
    if (!isHttpsUrl(endpoint_url)) {
      return send(res, 400, { ok: false, error: "endpoint_must_be_https", v: HANDLER_VERSION });
    }
  }

  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/submit_integrator_request`;

  const rpcPayload = {
    p_kind: dbKind,
    p_email: email,
    p_company: cleanStr(body.company),
    p_name: cleanStr(body.name),
    p_role: cleanStr(body.role),
    p_endpoint_url: endpoint_url,
    p_delivery_env: delivery_env,
    p_format_preference: cleanStr(body.format_preference),
    p_notes: cleanStr(body.notes),
    p_source_path: cleanStr(body.source_path) || cleanStr(req.headers.referer) || null,
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
      body: JSON.stringify(rpcPayload),
    });
  } catch {
    return send(res, 502, { ok: false, error: "supabase_unreachable", v: HANDLER_VERSION });
  }

  if (!rpcRes.ok) {
    const text = await rpcRes.text().catch(() => "");
    return send(res, 500, {
      ok: false,
      error: "rpc_failed",
      status: rpcRes.status,
      details: text.slice(0, 500),
      v: HANDLER_VERSION,
    });
  }

  const id = await rpcRes.json().catch(() => null);

  // Step 1 test delivery
  if (dbKind === "push_access" && isTest) {
    const createdIso = new Date().toISOString();
    const newsItemId = String(id || `test-${Date.now()}`);

    const xml = makeTestNewsML({
      providerId: "wire.fundamentals.so",
      providerName: "Fundamentals Wire",
      createdIso,
      newsItemId,
    });

    const controller = new AbortController();
    const timeoutMs = 12_000;
    const t = setTimeout(() => controller.abort(), timeoutMs);

    let outRes;
    try {
      outRes = await fetch(endpoint_url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "user-agent": "FundamentalsWireHTTPSPushTest/1.0",
          "x-fw-handler-version": HANDLER_VERSION,
          "x-fw-delivery": "1",
          "x-fw-delivery-env": "test",
          "x-fw-request-id": String(id || ""),
        },
        body: xml,
      });
    } catch (e) {
      clearTimeout(t);
      const msg = String(e && e.message ? e.message : e || "");
      const isAbort = msg.toLowerCase().includes("abort");
      const errCode = isAbort ? "endpoint_timeout" : "endpoint_unreachable";

      // NEW: persist attempt (failure)
      await postDeliveryAttempt({
        SUPABASE_URL,
        SERVICE_ROLE,
        request_id: id,
        delivery_env,
        endpoint_url,
        attempted: true,
        delivered: false,
        http_status: null,
        response_headers: null,
        response_snippet: null,
        error: errCode,
        error_detail: msg.slice(0, 200),
        timeout_ms: timeoutMs,
        sent_bytes: Buffer.byteLength(xml, "utf8"),
        newsml_news_item_id: newsItemId,
      });

      return send(res, 200, {
        ok: true,
        id,
        attempted: true,
        delivered: false,
        endpoint: endpoint_url,
        error: errCode,
        error_detail: msg.slice(0, 200),
        timeout_ms: timeoutMs,
        sent_bytes: Buffer.byteLength(xml, "utf8"),
        newsml_news_item_id: newsItemId,
        v: HANDLER_VERSION,
      });
    } finally {
      clearTimeout(t);
    }

    const respText = await outRes.text().catch(() => "");
    const snippet = String(respText || "").slice(0, 300);

    // NEW: persist attempt (success or non-2xx)
    await postDeliveryAttempt({
      SUPABASE_URL,
      SERVICE_ROLE,
      request_id: id,
      delivery_env,
      endpoint_url,
      attempted: true,
      delivered: outRes.ok,
      http_status: outRes.status,
      response_headers: pickHeaders(outRes.headers),
      response_snippet: snippet,
      error: outRes.ok ? null : "endpoint_rejected",
      error_detail: outRes.ok ? null : `http_status=${outRes.status}`,
      timeout_ms: timeoutMs,
      sent_bytes: Buffer.byteLength(xml, "utf8"),
      newsml_news_item_id: newsItemId,
    });

    return send(res, 200, {
      ok: true,
      id,
      attempted: true,
      delivered: outRes.ok,
      endpoint: endpoint_url,
      http_status: outRes.status,
      response_headers: pickHeaders(outRes.headers),
      response_snippet: snippet,
      sent_bytes: Buffer.byteLength(xml, "utf8"),
      newsml_news_item_id: newsItemId,
      v: HANDLER_VERSION,
    });
  }

  // Always include version so we can see what’s live
  return send(res, 200, { ok: true, id, v: HANDLER_VERSION });
}