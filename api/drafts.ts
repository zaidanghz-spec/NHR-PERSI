import { ensureTables } from './_turso';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const hospitalCode = url.searchParams.get('hospitalCode');
  const specialty = url.searchParams.get('specialty');

  try {
    const db = await ensureTables();
    const draftId = `${type}-${hospitalCode}-${specialty}`;

    // GET
    if (req.method === 'GET') {
      const rs = await db.execute({
        sql: 'SELECT data FROM drafts WHERE id = ?',
        args: [draftId],
      });
      if (rs.rows.length === 0) {
        return new Response(JSON.stringify({ draft: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ draft: JSON.parse(rs.rows[0].data as string) }), { status: 200 });
    }

    // POST
    if (req.method === 'POST') {
      const body = await req.json();
      const dataStr = JSON.stringify(body);

      const existing = await db.execute({
        sql: 'SELECT id FROM drafts WHERE id = ?',
        args: [draftId],
      });

      if (existing.rows.length > 0) {
        await db.execute({
          sql: 'UPDATE drafts SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          args: [dataStr, draftId],
        });
      } else {
        await db.execute({
          sql: 'INSERT INTO drafts (id, type, hospital_code, specialty, data) VALUES (?, ?, ?, ?, ?)',
          args: [draftId, type, hospitalCode, specialty, dataStr],
        });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
