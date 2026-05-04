function sendJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

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

function getPath(req: any) {
  const route = req.query?.route;
  if (Array.isArray(route)) return `/api/${route.join("/")}`;
  if (typeof route === "string") return `/api/${route}`;
  return (req.url || "").split("?")[0];
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }

  const path = getPath(req);

  if (req.method === "GET" && path === "/api/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  const rpcMatch = path.match(/^\/api\/rpc\/([^/?#]+)/);
  if (req.method === "POST" && rpcMatch) {
    try {
      const { handleTursoOperation } = await import("./turso_ops");
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
