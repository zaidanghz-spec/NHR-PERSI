import { ensureTables } from './_turso';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' } });
  }

  const url = new URL(req.url);
  const hospitalCode = url.searchParams.get('hospitalCode');
  const specialty = url.searchParams.get('specialty');
  const patientId = url.searchParams.get('patientId');

  try {
    const db = await ensureTables();

    // GET
    if (req.method === 'GET') {
      const rs = await db.execute({
        sql: 'SELECT * FROM patients WHERE hospital_code = ? AND specialty = ? ORDER BY created_at ASC',
        args: [hospitalCode, specialty],
      });
      return new Response(JSON.stringify({
        patients: rs.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          rm: r.rm,
          specialty,
          hospitalCode,
          createdAt: r.created_at,
        })),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST
    if (req.method === 'POST') {
      const body = await req.json();
      const id = crypto.randomUUID();

      const existing = await db.execute({
        sql: 'SELECT id FROM patients WHERE hospital_code = ? AND specialty = ? AND rm = ?',
        args: [hospitalCode, specialty, body.rm || ''],
      });
      if (existing.rows.length > 0) {
        return new Response(JSON.stringify({ error: 'Pasien sudah terdaftar' }), { status: 409 });
      }

      await db.execute({
        sql: 'INSERT INTO patients (id, hospital_code, specialty, name, rm) VALUES (?, ?, ?, ?, ?)',
        args: [id, hospitalCode, specialty, body.name, body.rm],
      });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE
    if (req.method === 'DELETE' && patientId) {
      await db.execute({
        sql: 'DELETE FROM patients WHERE id = ? AND hospital_code = ?',
        args: [patientId, hospitalCode],
      });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
