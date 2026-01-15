// pages/api/integrator-request.js
export const config = { runtime: "nodejs" };

// Reuse the Cloudflare Pages function implementation.
import handler from "../../api/integrator-request.js";

export default function vercelApi(req, res) {
  return handler(req, res);
}
