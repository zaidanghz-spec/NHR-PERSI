import jwt from "jsonwebtoken";

const PUBLIC_OPERATIONS = new Set([
  "loginHospital",
  "loginAdmin",
  "addHospitalAccount",
  "getAllRankingsFromDb",
  "getAllNews",
  "getAllEvents",
  "initTursoTables",
]);

function sendJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (status === 204) { res.end(); return; }
  res.end(JSON.stringify(body));
}

function parseBody(body: unknown) {
  if (!body) return {};
  if (typeof body === "string") { try { return JSON.parse(body); } catch { return {}; } }
  return body;
}

function getPath(req: any) {
  const route = req.query?.route;
  if (Array.isArray(route)) return `/api/${route.join("/")}`;
  if (typeof route === "string") return `/api/${route}`;
  return (req.url || "").split("?")[0];
}

function verifyJwt(req: any): boolean {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  const auth: string = req.headers?.authorization || req.headers?.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, secret) as any;
    req.hospitalEmail = decoded?.email || null;
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") { sendJson(res, 204, null); return; }

  const path = getPath(req);

  if (req.method === "GET" && path === "/api/health") {
    sendJson(res, 200, {
      status: "ok",
      tursoDatabaseUrlConfigured: Boolean(process.env.TURSO_DATABASE_URL),
      tursoAuthTokenConfigured: Boolean(process.env.TURSO_AUTH_TOKEN),
      jwtSecretConfigured: Boolean(process.env.JWT_SECRET),
    });
    return;
  }

  const rpcMatch = path.match(/^\/api\/rpc\/([^/?#]+)/);
  if (req.method === "POST" && rpcMatch) {
    const operation = decodeURIComponent(rpcMatch[1]);

    if (!PUBLIC_OPERATIONS.has(operation) && !verifyJwt(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const { handleTursoOperation } = await import("./turso_ops.js");
      const body: Record<string, any> = { ...parseBody(req.body) };
      if (req.hospitalEmail) body._hospitalEmail = req.hospitalEmail;
      const result = await handleTursoOperation(operation, body);
      sendJson(res, 200, { result: result ?? null });
    } catch (err: any) {
      console.error("RPC error:", err);
      const statusCode = err?.statusCode === 409 ? 409 : 500;
      sendJson(res, statusCode, { error: err?.message || "RPC operation failed" });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}
