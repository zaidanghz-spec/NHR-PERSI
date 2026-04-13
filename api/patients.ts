import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureTables } from "./_turso";
import { randomUUID } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { hospitalCode, specialty, patientId } = req.query as {
    hospitalCode: string;
    specialty: string;
    patientId?: string;
  };

  try {
    const db = await ensureTables();

    if (req.method === "GET") {
      const rs = await db.execute({
        sql: "SELECT * FROM patients WHERE hospital_code = ? AND specialty = ? ORDER BY created_at ASC",
        args: [hospitalCode, specialty],
      });
      return res.json({
        patients: rs.rows.map((r) => ({
          id: r.id,
          name: r.name,
          rm: r.rm,
          specialty,
          hospitalCode,
          createdAt: r.created_at,
        })),
      });
    }

    if (req.method === "POST") {
      const body = req.body;
      const id = randomUUID();

      const existing = await db.execute({
        sql: "SELECT id FROM patients WHERE hospital_code = ? AND specialty = ? AND rm = ?",
        args: [hospitalCode, specialty, body.rm || ""],
      });
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "Pasien dengan RM ini sudah terdaftar" });
      }

      await db.execute({
        sql: "INSERT INTO patients (id, hospital_code, specialty, name, rm) VALUES (?, ?, ?, ?, ?)",
        args: [id, hospitalCode, specialty, body.name, body.rm],
      });
      return res.json({ success: true, patient: { id, name: body.name, rm: body.rm } });
    }

    if (req.method === "DELETE" && patientId) {
      await db.execute({
        sql: "DELETE FROM patients WHERE id = ? AND hospital_code = ?",
        args: [patientId, hospitalCode],
      });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("patients API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
