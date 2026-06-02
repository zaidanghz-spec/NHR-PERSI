import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { handleTursoOperation } from "./dist-server/turso_ops.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

loadEnvFile(path.join(__dirname, ".env"));

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 25 * 1024 * 1024);

const PUBLIC_OPERATIONS = new Set([
  "loginHospital",
  "loginAdmin",
  "addHospitalAccount",
  "getAllRankingsFromDb",
  "getAllNews",
  "getAllEvents",
  "initTursoTables",
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || "nhr-persi-session-secret";
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL || "";
}

function getDatabaseMode(url) {
  if (!url) return "not-configured";
  if (url.startsWith("file:")) return "sqlite-file";
  if (url.startsWith("libsql:")) return "libsql-remote";
  return "custom";
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(res, status, body) {
  res.statusCode = status;
  setCors(res);
  res.setHeader("Content-Type", "application/json");
  if (status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(body));
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(Object.assign(new Error("Request body is too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}

function verifyJwt(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.hospitalEmail = decoded?.email || null;
    req.authRole = decoded?.role || null;
    return true;
  } catch {
    return false;
  }
}

function serveStatic(req, res, url) {
  const requestedPath = decodeURIComponent(url.pathname);
  const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const candidate = path.normalize(path.join(distDir, relativePath));
  const safeCandidate = candidate.startsWith(distDir) ? candidate : path.join(distDir, "index.html");
  const filePath = fs.existsSync(safeCandidate) && fs.statSync(safeCandidate).isFile()
    ? safeCandidate
    : path.join(distDir, "index.html");

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeTypes[path.extname(filePath)] || "application/octet-stream");
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    const databaseUrl = getDatabaseUrl();
    sendJson(res, 200, {
      status: "ok",
      databaseConfigured: Boolean(databaseUrl),
      databaseMode: getDatabaseMode(databaseUrl),
      tursoDatabaseUrlConfigured: Boolean(process.env.TURSO_DATABASE_URL),
      tursoAuthTokenConfigured: Boolean(process.env.TURSO_AUTH_TOKEN),
      jwtSecretConfigured: Boolean(process.env.JWT_SECRET),
    });
    return;
  }

  const rpcMatch = url.pathname.match(/^\/api\/rpc\/([^/?#]+)/);
  if (req.method === "POST" && rpcMatch) {
    const operation = decodeURIComponent(rpcMatch[1]);

    if (!PUBLIC_OPERATIONS.has(operation) && !verifyJwt(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const body = await parseRequestBody(req);
      if (req.hospitalEmail) body._hospitalEmail = req.hospitalEmail;
      if (req.authRole) body._authRole = req.authRole;
      const result = await handleTursoOperation(operation, body);
      sendJson(res, 200, { result: result ?? null });
    } catch (err) {
      console.error("RPC error:", err);
      sendJson(res, err?.statusCode || 500, { error: err?.message || "RPC operation failed" });
    }
    return;
  }

  if (url.pathname.startsWith("/api")) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  serveStatic(req, res, url);
});

server.listen(port, host, () => {
  console.log(`NHR PERSI server listening on http://${host}:${port}`);
});
