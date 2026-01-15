// pages/api/integrator-request.js
// Single source of truth: use the handler in /api so Vercel always runs the same code.

import handler from "../../api/integrator-request.js";

export const config = { runtime: "nodejs" };

export default async function route(req, res) {
  return handler(req, res);
}