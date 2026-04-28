import { createClient } from "@libsql/client";

const client = () =>
  createClient({
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });

// Auto-create the KV table on first use
let tableCreated = false;
async function ensureTable() {
  if (tableCreated) return;
  const db = client();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT NOT NULL PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  tableCreated = true;
}

// Set stores a key-value pair in the database.
export const set = async (key: string, value: any): Promise<void> => {
  await ensureTable();
  const db = client();
  await db.execute({
    sql: `INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`,
    args: [key, JSON.stringify(value)],
  });
};

// Get retrieves a value by key.
export const get = async (key: string): Promise<any> => {
  await ensureTable();
  const db = client();
  const result = await db.execute({
    sql: `SELECT value FROM kv_store WHERE key = ?`,
    args: [key],
  });
  if (result.rows.length === 0) return null;
  try {
    return JSON.parse(result.rows[0].value as string);
  } catch {
    return result.rows[0].value;
  }
};

// Delete a key.
export const del = async (key: string): Promise<void> => {
  await ensureTable();
  const db = client();
  await db.execute({
    sql: `DELETE FROM kv_store WHERE key = ?`,
    args: [key],
  });
};

// Set multiple key-value pairs.
export const mset = async (keys: string[], values: any[]): Promise<void> => {
  await ensureTable();
  const db = client();
  for (let i = 0; i < keys.length; i++) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`,
      args: [keys[i], JSON.stringify(values[i])],
    });
  }
};

// Get multiple values by keys.
export const mget = async (keys: string[]): Promise<any[]> => {
  await ensureTable();
  const db = client();
  const results: any[] = [];
  for (const key of keys) {
    const result = await db.execute({
      sql: `SELECT value FROM kv_store WHERE key = ?`,
      args: [key],
    });
    if (result.rows.length === 0) {
      results.push(null);
    } else {
      try {
        results.push(JSON.parse(result.rows[0].value as string));
      } catch {
        results.push(result.rows[0].value);
      }
    }
  }
  return results;
};

// Delete multiple keys.
export const mdel = async (keys: string[]): Promise<void> => {
  await ensureTable();
  const db = client();
  for (const key of keys) {
    await db.execute({
      sql: `DELETE FROM kv_store WHERE key = ?`,
      args: [key],
    });
  }
};

// Search by prefix.
export const getByPrefix = async (prefix: string): Promise<any[]> => {
  await ensureTable();
  const db = client();
  const result = await db.execute({
    sql: `SELECT value FROM kv_store WHERE key LIKE ?`,
    args: [prefix + "%"],
  });
  return result.rows.map((row) => {
    try {
      return JSON.parse(row.value as string);
    } catch {
      return row.value;
    }
  });
};