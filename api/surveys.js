import { ensureTables } from './_turso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { hospitalCode, specialty } = req.query;

  if (!hospitalCode || !specialty) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const db = await ensureTables();

    if (req.method === 'GET') {
      const rs = await db.execute({
        sql: 'SELECT * FROM surveys WHERE hospital_code = ? AND specialty = ? ORDER BY created_at DESC',
        args: [hospitalCode, specialty],
      });
      return res.status(200).json({
        surveys: rs.rows.map(r => ({
          id: r.id,
          patientName: r.patient_name,
          medicalRecordNumber: r.patient_rm,
          premScore: r.prem_score,
          promScore: r.prom_score,
          overallScore: r.overall_score,
          answers: r.answers ? JSON.parse(r.answers) : {},
          timestamp: r.created_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const id = crypto.randomUUID();

      const existing = await db.execute({
        sql: 'SELECT id FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ?',
        args: [hospitalCode, specialty, body.medicalRecordNumber || ''],
      });
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Pasien sudah mengisi survei' });
      }

      await db.execute({
        sql: `INSERT INTO surveys (id, hospital_code, specialty, patient_name, patient_rm, prem_score, prom_score, overall_score, answers)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          hospitalCode,
          specialty,
          body.patientName || body.qName || '',
          body.medicalRecordNumber || body.qRm || '',
          body.premScore ?? 0,
          body.promScore ?? 0,
          body.overallScore ?? 0,
          JSON.stringify(body.answers || {}),
        ],
      });

      return res.status(200).json({ success: true, surveyId: id });
    }

    if (req.method === 'DELETE') {
      await db.execute({
        sql: 'DELETE FROM surveys WHERE hospital_code = ? AND specialty = ?',
        args: [hospitalCode, specialty],
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
