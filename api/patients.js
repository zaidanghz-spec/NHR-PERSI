import { ensureTables } from './_turso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { hospitalCode, specialty, patientId } = req.query;

  try {
    const db = await ensureTables();

    if (req.method === 'GET') {
      const rs = await db.execute({
        sql: 'SELECT * FROM patients WHERE hospital_code = ? AND specialty = ? ORDER BY created_at ASC',
        args: [hospitalCode, specialty],
      });
      return res.status(200).json({
        patients: rs.rows.map(r => ({
          id: r.id,
          name: r.name,
          rm: r.rm,
          specialty,
          hospitalCode,
          createdAt: r.created_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const id = crypto.randomUUID();

      const existing = await db.execute({
        sql: 'SELECT id FROM patients WHERE hospital_code = ? AND specialty = ? AND rm = ?',
        args: [hospitalCode, specialty, body.rm || ''],
      });
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Pasien sudah terdaftar' });
      }

      await db.execute({
        sql: 'INSERT INTO patients (id, hospital_code, specialty, name, rm) VALUES (?, ?, ?, ?, ?)',
        args: [id, hospitalCode, specialty, body.name, body.rm],
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && patientId) {
      await db.execute({
        sql: 'DELETE FROM patients WHERE id = ? AND hospital_code = ?',
        args: [patientId, hospitalCode],
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
