import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureTables } from "./_turso";
import { randomUUID } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { type, hospitalCode, specialty } = req.query as {
    type: string;
    hospitalCode: string;
    specialty: string;
  };

  try {
    const db = await ensureTables();

    if (req.method === "GET") {
      const rs = await db.execute({
        sql: "SELECT data FROM drafts WHERE type = ? AND hospital_code = ? AND specialty = ?",
        args: [type, hospitalCode, specialty],
      });
      if (rs.rows.length === 0) return res.json({ draft: null });
      return res.json({ draft: JSON.parse(rs.rows[0].data as string) });
    }

    if (req.method === "POST") {
      const body = req.body;
      const id = `${type}-${hospitalCode}-${specialty}`;
      await db.execute({
        sql: `INSERT INTO drafts (id, type, hospital_code, specialty, data, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
        args: [id, type, hospitalCode, specialty, JSON.stringify(body)],
      });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("drafts API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
