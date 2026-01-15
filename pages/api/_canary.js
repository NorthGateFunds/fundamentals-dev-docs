// pages/api/canary.js
export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("x-fw-canary", "pages/api/canary.js@2026-01-15T05:30Z");
  res.end(JSON.stringify({ ok: true, where: "pages/api/canary.js" }));
}