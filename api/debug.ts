import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({
    hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
    hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    // Jangan expose nilai sebenarnya — hanya cek keberadaan
    urlPrefix: process.env.TURSO_DATABASE_URL?.slice(0, 15) || "NOT SET",
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
  });
}
