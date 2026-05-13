/**
 * One-time admin setup script.
 * Run: npx tsx setup-admin.ts
 *
 * WARNING: Change the password immediately after first login.
 */
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("TURSO_DATABASE_URL not set");
  process.exit(1);
}

const client = createClient({ url, authToken: authToken || "" });

const ADMIN_USERNAME = "admin@persi";
const ADMIN_PASSWORD = "ChangeMe123!";

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existing = await client.execute({
    sql: "SELECT id FROM admins WHERE username = ?",
    args: [ADMIN_USERNAME],
  });

  if (existing.rows.length > 0) {
    console.log(`Admin '${ADMIN_USERNAME}' already exists. Skipping.`);
    return;
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await client.execute({
    sql: "INSERT INTO admins (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
    args: [id, ADMIN_USERNAME, passwordHash, "admin"],
  });

  console.log(`\nAdmin created successfully.`);
  console.log(`  Username: ${ADMIN_USERNAME}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`\n⚠  WARNING: Change this password immediately after first login.\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
