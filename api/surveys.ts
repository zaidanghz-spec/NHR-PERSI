import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureTables } from "./_turso";
import { randomUUID } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { hospitalCode, specialty } = req.query as {
    hospitalCode: string;
    specialty: string;
  };

  try {
    const db = await ensureTables();

    // GET — ambil semua survei
    if (req.method === "GET") {
      const rs = await db.execute({
        sql: "SELECT * FROM surveys WHERE hospital_code = ? AND specialty = ? ORDER BY created_at DESC",
        args: [hospitalCode, specialty],
      });
      return res.json({
        surveys: rs.rows.map((r) => ({
          id: r.id,
          patientName: r.patient_name,
          medicalRecordNumber: r.patient_rm,
          premScore: r.prem_score,
          promScore: r.prom_score,
          overallScore: r.overall_score,
          answers: r.answers ? JSON.parse(r.answers as string) : {},
          timestamp: r.created_at,
        })),
      });
    }

    // POST — simpan survei baru
    if (req.method === "POST") {
      const body = req.body;
      const id = randomUUID();

      // Cek duplikat berdasarkan RM
      const existing = await db.execute({
        sql: "SELECT id FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ?",
        args: [hospitalCode, specialty, body.medicalRecordNumber || ""],
      });
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "Pasien sudah mengisi survei" });
      }

      await db.execute({
        sql: `INSERT INTO surveys (id, hospital_code, specialty, patient_name, patient_rm, prem_score, prom_score, overall_score, answers)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          hospitalCode,
          specialty,
          body.patientName || body.qName || "",
          body.medicalRecordNumber || body.qRm || "",
          body.premScore ?? 0,
          body.promScore ?? 0,
          body.overallScore ?? 0,
          JSON.stringify(body.answers || {}),
        ],
      });

      return res.json({ success: true, surveyId: id });
    }

    // DELETE — reset semua survei untuk specialty tertentu
    if (req.method === "DELETE") {
      await db.execute({
        sql: "DELETE FROM surveys WHERE hospital_code = ? AND specialty = ?",
        args: [hospitalCode, specialty],
      });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("surveys API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
