import { createClient } from '@libsql/client/web';

export function getTurso() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!url) throw new Error('TURSO_DATABASE_URL not set');
  
  return createClient({ url, authToken });
}

export async function ensureTables() {
  const db = getTurso();

  await db.execute(
    `CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      hospital_code TEXT NOT NULL,
      specialty TEXT NOT NULL,
      patient_name TEXT DEFAULT '',
      patient_rm TEXT DEFAULT '',
      prem_score REAL DEFAULT 0,
      prom_score REAL DEFAULT 0,
      overall_score REAL DEFAULT 0,
      answers TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      hospital_code TEXT NOT NULL,
      specialty TEXT NOT NULL,
      name TEXT NOT NULL,
      rm TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      hospital_code TEXT NOT NULL,
      specialty TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  return db;
}
