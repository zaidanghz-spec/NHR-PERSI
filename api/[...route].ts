import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTursoOperation } from "./turso_ops";

function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.json(body);
}

function parseBody(body: unknown) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }

  const url = req.url || "";

  if (req.method === "GET" && url.startsWith("/api/health")) {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  const rpcMatch = url.match(/^\/api\/rpc\/([^/?#]+)/);
  if (req.method === "POST" && rpcMatch) {
    try {
      const result = await handleTursoOperation(decodeURIComponent(rpcMatch[1]), parseBody(req.body));
      sendJson(res, 200, { result: result ?? null });
    } catch (err: any) {
      console.error("RPC error:", err);
      sendJson(res, 500, { error: err?.message || "RPC operation failed" });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}
