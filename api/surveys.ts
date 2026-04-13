import { ensureTables } from './_turso';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' } });
  }

  const url = new URL(req.url);
  const hospitalCode = url.searchParams.get('hospitalCode');
  const specialty = url.searchParams.get('specialty');

  if (!hospitalCode || !specialty) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
  }

  try {
    const db = await ensureTables();

    // GET
    if (req.method === 'GET') {
      const rs = await db.execute({
        sql: 'SELECT * FROM surveys WHERE hospital_code = ? AND specialty = ? ORDER BY created_at DESC',
        args: [hospitalCode, specialty],
      });
      return new Response(JSON.stringify({
        surveys: rs.rows.map((r: any) => ({
          id: r.id,
          patientName: r.patient_name,
          medicalRecordNumber: r.patient_rm,
          premScore: r.prem_score,
          promScore: r.prom_score,
          overallScore: r.overall_score,
          answers: r.answers ? JSON.parse(r.answers as string) : {},
          timestamp: r.created_at,
        })),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST
    if (req.method === 'POST') {
      const body = await req.json();
      const id = crypto.randomUUID();

      const existing = await db.execute({
        sql: 'SELECT id FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ?',
        args: [hospitalCode, specialty, body.medicalRecordNumber || ''],
      });
      if (existing.rows.length > 0) {
        return new Response(JSON.stringify({ error: 'Pasien sudah mengisi survei' }), { status: 409 });
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

      return new Response(JSON.stringify({ success: true, surveyId: id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE
    if (req.method === 'DELETE') {
      await db.execute({
        sql: 'DELETE FROM surveys WHERE hospital_code = ? AND specialty = ?',
        args: [hospitalCode, specialty],
      });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
