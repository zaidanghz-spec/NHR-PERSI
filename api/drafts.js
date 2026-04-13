import { ensureTables } from './_turso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, hospitalCode, specialty } = req.query;

  try {
    const db = await ensureTables();
    const draftId = `${type}-${hospitalCode}-${specialty}`;

    if (req.method === 'GET') {
      const rs = await db.execute({
        sql: 'SELECT data FROM drafts WHERE id = ?',
        args: [draftId],
      });
      
      if (rs.rows.length === 0) {
        return res.status(200).json({ draft: null });
      }
      return res.status(200).json({ draft: JSON.parse(rs.rows[0].data) });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
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
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
