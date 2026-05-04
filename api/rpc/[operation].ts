function sendJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (status === 204) {
    res.end();
    return;
  }

  res.end(JSON.stringify(body));
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

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const operation = req.query?.operation;
  if (typeof operation !== "string") {
    sendJson(res, 400, { error: "Missing operation" });
    return;
  }

  try {
    const { handleTursoOperation } = await import("../turso_ops.js");
    const result = await handleTursoOperation(operation, parseBody(req.body));
    sendJson(res, 200, { result: result ?? null });
  } catch (err: any) {
    console.error("RPC error:", err);
    sendJson(res, 500, { error: err?.message || "RPC operation failed" });
  }
}
