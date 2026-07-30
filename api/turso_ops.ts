import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";

let tablesInitialized = false;
let tablesInitializing: Promise<void> | null = null;
let draftWriteQueue: Promise<void> = Promise.resolve();
let databaseClient: ReturnType<typeof createClient> | null = null;
let databaseClientKey = "";
let localDatabasePragmasReady: Promise<void> | null = null;
let databaseExecuteQueue: Promise<void> = Promise.resolve();
const surveyBackupRestoreCheckedAt = new Map<string, number>();

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.LIBSQL_URL ||
    process.env.TURSO_DATABASE_URL ||
    "file:./data/nhr-persi.db"
  );
}

function isFileDatabaseUrl(url: string) {
  return url.startsWith("file:");
}

function ensureFileDatabaseDirectory(url: string) {
  if (!isFileDatabaseUrl(url)) return;
  const rawPath = url.slice("file:".length);
  if (!rawPath || rawPath === ":memory:") return;
  const databasePath = rawPath.startsWith("//") ? new URL(url).pathname : rawPath;
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function db() {
  const url = getDatabaseUrl();
  const authToken = process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  if (!url) throw new Error("DATABASE_URL is not configured");
  ensureFileDatabaseDirectory(url);
  const clientKey = `${url}\u0000${authToken}`;

  // Keep one client for the lifetime of the server. Creating a new SQLite
  // client for every RPC left many handles competing for the same WAL file;
  // under concurrent autosaves that could lock the database and break login.
  if (databaseClient && databaseClientKey === clientKey) return databaseClient;

  const rawClient = isFileDatabaseUrl(url)
    ? createClient({ url })
    : createClient({ url, authToken });
  databaseClient = new Proxy(rawClient, {
    get(target, property, receiver) {
      if (property === "execute") {
        return (...args: any[]) => {
          // SQLite permits many readers, but only one writer. Serializing the
          // client calls prevents reconcile/autosave writes from racing and
          // turning a transient lock into a failed login or lost draft.
          const previous = databaseExecuteQueue.catch(() => undefined);
          let release!: () => void;
          databaseExecuteQueue = new Promise<void>((resolve) => {
            release = resolve;
          });
          return previous
            .then(() => target.execute(...args))
            .finally(() => release());
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as ReturnType<typeof createClient>;
  databaseClientKey = clientKey;
  localDatabasePragmasReady = null;
  databaseExecuteQueue = Promise.resolve();
  return databaseClient;
}

async function prepareLocalDatabase(client: ReturnType<typeof createClient>) {
  if (!isFileDatabaseUrl(getDatabaseUrl())) return;
  if (!localDatabasePragmasReady) {
    localDatabasePragmasReady = client
      .execute("PRAGMA busy_timeout = 15000")
      .then(() => undefined)
      .catch((error) => {
        localDatabasePragmasReady = null;
        throw error;
      });
  }
  await localDatabasePragmasReady;
}

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseJson(value: unknown, fallback: any) {
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function withDraftWriteQueue<T>(fn: () => Promise<T>): Promise<T> {
  const previous = draftWriteQueue.catch(() => undefined);
  let release!: () => void;
  draftWriteQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function normalizePatientCodeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\d+/g, (digits) => String(Number(digits)));
}

function normalizePatientNameKey(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getSpecialtyBaseKey(specialty: unknown) {
  return String(specialty || "").replace(/-d\d+$/, "");
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || "nhr-persi-session-secret";
}

function signToken(payload: object): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "30d" });
}

function hospitalCodeFromEmail(email: string): string {
  if (!email) return "UNKNOWN";
  const cleanEmail = email.trim().toLowerCase();
  const local = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 8);
  let hash = 0;
  for (let i = 0; i < cleanEmail.length; i++) {
    hash = (hash << 5) - hash + cleanEmail.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36).toUpperCase().substring(0, 4);
  return (local + hashStr) || "RS001";
}

function uniqueHospitalCode(baseCode: string, usedCodes: Set<string>) {
  const base = (baseCode || "RS001").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12) || "RS001";
  let code = base;
  let suffix = 2;
  while (usedCodes.has(code)) {
    const tail = String(suffix++);
    code = `${base.slice(0, Math.max(1, 12 - tail.length))}${tail}`;
  }
  usedCodes.add(code);
  return code;
}

let ensureHospitalAccountCodesRun = false;
async function ensureHospitalAccountCodes(client: any) {
  if (ensureHospitalAccountCodesRun) return;
  try {
    const info = await client.execute("PRAGMA table_info(hospital_accounts)");
    const cols = info.rows.map((r: any) => r.name);
    if (!cols.includes("hospital_code")) {
      await client.execute("ALTER TABLE hospital_accounts ADD COLUMN hospital_code TEXT DEFAULT ''");
    }

    const rs = await client.execute("SELECT email, hospital_code FROM hospital_accounts ORDER BY registered_at ASC, email ASC");
    const rows = rs.rows as any[];
    const baseCounts = new Map<string, number>();
    const codeCounts = new Map<string, number>();
    rows.forEach((row) => {
      const base = hospitalCodeFromEmail(String(row.email || ""));
      baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
      const existingCode = String(row.hospital_code || "").trim().toUpperCase();
      if (existingCode) codeCounts.set(existingCode, (codeCounts.get(existingCode) || 0) + 1);
    });

    const usedCodes = new Set<string>();
    rows.forEach((row) => {
      const existingCode = String(row.hospital_code || "").trim().toUpperCase();
      if (existingCode && codeCounts.get(existingCode) === 1) usedCodes.add(existingCode);
    });

    const baseOrdinals = new Map<string, number>();
    for (const row of rows) {
      const base = hospitalCodeFromEmail(String(row.email || ""));
      const existingCode = String(row.hospital_code || "").trim().toUpperCase();
      const duplicateBase = (baseCounts.get(base) || 0) > 1;
      // Once an account has a unique persistent code, never rotate it on startup.
      // Rotating these codes is what can make old drafts look like they belong to another RS.
      if (existingCode && codeCounts.get(existingCode) === 1) {
        continue;
      }

      let seed = base;
      if (duplicateBase) {
        const ordinal = (baseOrdinals.get(base) || 0) + 1;
        baseOrdinals.set(base, ordinal);
        const suffix = String(ordinal);
        seed = `${base.slice(0, Math.max(1, 12 - suffix.length))}${suffix}`;
      }
      const code = uniqueHospitalCode(seed, usedCodes);
      await client.execute({
        sql: "UPDATE hospital_accounts SET hospital_code = ? WHERE LOWER(email) = LOWER(?)",
        args: [code, row.email],
      });
    }
    ensureHospitalAccountCodesRun = true;
  } catch (err) {
    console.error("Failed to ensure hospital account codes:", err);
  }
}

async function getHospitalCodeForEmail(client: any, email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return "";
  try {
    await ensureHospitalAccountCodes(client);
    const rs = await client.execute({
      sql: "SELECT hospital_code FROM hospital_accounts WHERE LOWER(email) = LOWER(?) LIMIT 1",
      args: [normalizedEmail],
    });
    return String((rs.rows[0] as any)?.hospital_code || "").trim() || hospitalCodeFromEmail(normalizedEmail);
  } catch {
    return hospitalCodeFromEmail(normalizedEmail);
  }
}

async function getHospitalIdentityForEmail(client: any, email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  await ensureHospitalAccountCodes(client);
  const rs = await client.execute({
    sql: "SELECT email, hospital_code, hospital_name FROM hospital_accounts WHERE LOWER(email) = LOWER(?) LIMIT 1",
    args: [normalizedEmail],
  });
  const row = rs.rows[0] as any;
  if (!row) return null;
  return {
    email: String(row.email || "").trim().toLowerCase(),
    hospitalCode: String(row.hospital_code || "").trim(),
    hospitalName: String(row.hospital_name || "").trim(),
  };
}

function normalizeHospitalNameKey(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function resolveEffectiveHospitalCode(client: any, { hospitalCode, _hospitalCode, _hospitalEmail }: any = {}) {
  if (_hospitalEmail) return await getHospitalCodeForEmail(client, _hospitalEmail);
  if (_hospitalCode) return String(_hospitalCode).trim();
  return String(hospitalCode || "").trim();
}

function getSurveyToken(survey: any) {
  return String(survey?.patientToken || survey?.surveyToken || survey?.token || survey?.qToken || "").trim();
}

function createHttpError(message: string, statusCode = 409) {
  const err = new Error(message) as any;
  err.statusCode = statusCode;
  return err;
}

function normalizeAdminId(value: string = "") {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getConfiguredAdminUsername(): string {
  return String(
    process.env.VITE_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.VITE_ADMIN_USERNAME ||
    process.env.ADMIN_USERNAME ||
    process.env.VITE_EMAIL ||
    ""
  );
}

function getConfiguredAdminPassword(): string {
  return String(
    process.env.VITE_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    process.env.VITE_PASSWORD ||
    ""
  );
}

function isConfiguredAdminLogin(username: string, password: string): boolean {
  const configuredUsername = getConfiguredAdminUsername();
  const configuredPassword = getConfiguredAdminPassword();
  if (!configuredUsername || !configuredPassword) return false;
  return (
    normalizeAdminId(username) === normalizeAdminId(configuredUsername) &&
    String(password || "").trim() === configuredPassword.trim()
  );
}

async function getDraftSchema(client: any) {
  const info = await client.execute("PRAGMA table_info(drafts)");
  const cols = info.rows.map((r: any) => r.name);

  let idCol = cols.find((c: string) => ["id", "draft_id", "draftId"].includes(c));
  if (!idCol) {
    await client.execute("ALTER TABLE drafts ADD COLUMN id TEXT");
    cols.push("id"); idCol = "id";
  }

  let typeCol = cols.find((c: string) => ["type", "draft_type", "draftType"].includes(c));
  if (!typeCol) {
    await client.execute("ALTER TABLE drafts ADD COLUMN type TEXT NOT NULL DEFAULT ''");
    cols.push("type"); typeCol = "type";
  }

  let dataCol = cols.find((c: string) => ["data", "draft_data", "draftData"].includes(c));
  if (!dataCol) {
    await client.execute("ALTER TABLE drafts ADD COLUMN data TEXT DEFAULT '{}'");
    cols.push("data"); dataCol = "data";
  }

  let hCol = cols.find((c: string) => ["hospital_code", "hospitalCode"].includes(c));
  if (!hCol) {
    await client.execute("ALTER TABLE drafts ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
    cols.push("hospital_code"); hCol = "hospital_code";
  }

  let sCol = cols.find((c: string) => ["specialty", "specialty_name", "specialtyName"].includes(c));
  if (!sCol) {
    await client.execute("ALTER TABLE drafts ADD COLUMN specialty TEXT NOT NULL DEFAULT ''");
    cols.push("specialty"); sCol = "specialty";
  }

  let updatedCol = cols.find((c: string) => ["updated_at", "updatedAt"].includes(c));
  if (!updatedCol) {
    await client.execute("ALTER TABLE drafts ADD COLUMN updated_at TEXT DEFAULT ''");
    updatedCol = "updated_at";
  }

  let versionCol = cols.find((c: string) => ["version", "draft_version"].includes(c));
  if (!versionCol) {
    await client.execute("ALTER TABLE drafts ADD COLUMN version INTEGER NOT NULL DEFAULT 0");
    versionCol = "version";
  }

  let operationCol = cols.find((c: string) => ["last_operation_id", "lastOperationId"].includes(c));
  if (!operationCol) {
    await client.execute("ALTER TABLE drafts ADD COLUMN last_operation_id TEXT DEFAULT ''");
    operationCol = "last_operation_id";
  }

  return { idCol, typeCol, dataCol, hCol, sCol, updatedCol, versionCol, operationCol };
}

async function normalizeDraftOwnership(client: any, draftId?: string) {
  const { idCol, typeCol, dataCol, hCol } = await getDraftSchema(client);
  const oneDraftClause = draftId ? ` AND ${idCol} = ?` : "";
  const oneDraftArgs = draftId ? [draftId] : [];

  await client.execute({
    sql: `
      UPDATE drafts
      SET ${hCol} = (
            SELECT h.hospital_code
            FROM hospital_accounts h
            WHERE lower(trim(h.email)) = lower(trim(json_extract(drafts.${dataCol}, '$.hospitalEmail')))
            LIMIT 1
          ),
          ${dataCol} = json_set(
            ${dataCol},
            '$.hospitalCode',
            (
              SELECT h.hospital_code
              FROM hospital_accounts h
              WHERE lower(trim(h.email)) = lower(trim(json_extract(drafts.${dataCol}, '$.hospitalEmail')))
              LIMIT 1
            )
          )
      WHERE ${typeCol} = 'hospital-assessment'
        ${oneDraftClause}
        AND json_extract(${dataCol}, '$.hospitalEmail') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM hospital_accounts h
          WHERE lower(trim(h.email)) = lower(trim(json_extract(drafts.${dataCol}, '$.hospitalEmail')))
        )
        AND ${hCol} <> (
          SELECT h.hospital_code
          FROM hospital_accounts h
          WHERE lower(trim(h.email)) = lower(trim(json_extract(drafts.${dataCol}, '$.hospitalEmail')))
          LIMIT 1
        )
    `,
    args: oneDraftArgs,
  });

  await client.execute({
    sql: `
      UPDATE drafts
      SET ${hCol} = (
            SELECT p.${hCol}
            FROM drafts p
            WHERE p.${idCol} = json_extract(drafts.${dataCol}, '$.draftId')
              AND p.${typeCol} = 'hospital-assessment'
            LIMIT 1
          ),
          ${dataCol} = json_set(
            ${dataCol},
            '$.hospitalCode',
            (
              SELECT p.${hCol}
              FROM drafts p
              WHERE p.${idCol} = json_extract(drafts.${dataCol}, '$.draftId')
                AND p.${typeCol} = 'hospital-assessment'
              LIMIT 1
            )
          )
      WHERE ${typeCol} IN ('rsbk', 'clinical-audit', 'patient-report')
        ${oneDraftClause}
        AND EXISTS (
          SELECT 1
          FROM drafts p
          WHERE p.${idCol} = json_extract(drafts.${dataCol}, '$.draftId')
            AND p.${typeCol} = 'hospital-assessment'
        )
        AND ${hCol} <> (
          SELECT p.${hCol}
          FROM drafts p
          WHERE p.${idCol} = json_extract(drafts.${dataCol}, '$.draftId')
            AND p.${typeCol} = 'hospital-assessment'
          LIMIT 1
        )
    `,
    args: oneDraftArgs,
  });

  if (draftId) {
    await client.execute({
      sql: `
        UPDATE drafts
        SET ${hCol} = (
              SELECT p.${hCol}
              FROM drafts p
              WHERE p.${idCol} = ?
                AND p.${typeCol} = 'hospital-assessment'
              LIMIT 1
            ),
            ${dataCol} = json_set(
              ${dataCol},
              '$.hospitalCode',
              (
                SELECT p.${hCol}
                FROM drafts p
                WHERE p.${idCol} = ?
                  AND p.${typeCol} = 'hospital-assessment'
                LIMIT 1
              )
            )
        WHERE ${typeCol} IN ('rsbk', 'clinical-audit', 'patient-report')
          AND json_extract(${dataCol}, '$.draftId') = ?
          AND EXISTS (
            SELECT 1
            FROM drafts p
            WHERE p.${idCol} = ?
              AND p.${typeCol} = 'hospital-assessment'
          )
          AND ${hCol} <> (
            SELECT p.${hCol}
            FROM drafts p
            WHERE p.${idCol} = ?
              AND p.${typeCol} = 'hospital-assessment'
            LIMIT 1
          )
      `,
      args: [draftId, draftId, draftId, draftId, draftId],
    });
  }
}

async function initTursoTables() {
  if (tablesInitialized) return;
  if (tablesInitializing) {
    await tablesInitializing;
    return;
  }

  // Several requests can hit a cold process at the same time. Without this
  // single-flight guard, each request runs migrations and draft normalization
  // concurrently, which can lock SQLite and make the whole app feel frozen.
  tablesInitializing = initTursoTablesOnce();
  try {
    await tablesInitializing;
  } finally {
    tablesInitializing = null;
  }
}

async function initTursoTablesOnce() {
  if (tablesInitialized) return;
  const client = db();
  await prepareLocalDatabase(client);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      hospital_code TEXT NOT NULL,
      specialty TEXT NOT NULL,
      patient_id TEXT DEFAULT '',
      patient_token TEXT DEFAULT '',
      patient_name TEXT DEFAULT '',
      patient_rm TEXT DEFAULT '',
      prem_score REAL DEFAULT 0,
      prom_score REAL DEFAULT 0,
      overall_score REAL DEFAULT 0,
      answers TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS survey_backups (
      id TEXT PRIMARY KEY,
      hospital_code TEXT NOT NULL,
      specialty TEXT NOT NULL,
      patient_token TEXT DEFAULT '',
      patient_name TEXT DEFAULT '',
      patient_rm TEXT DEFAULT '',
      payload TEXT DEFAULT '{}',
      status TEXT DEFAULT 'received',
      error TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      hospital_code TEXT NOT NULL,
      specialty TEXT NOT NULL,
      survey_token TEXT DEFAULT '',
      name TEXT NOT NULL,
      rm TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      hospital_code TEXT NOT NULL,
      specialty TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version INTEGER NOT NULL DEFAULT 0,
      last_operation_id TEXT DEFAULT ''
    )
  `);

  // Durable idempotency records prevent a retry from being applied twice,
  // including when the duplicate arrives after a newer autosave.
  await client.execute(`
    CREATE TABLE IF NOT EXISTS draft_sync_operations (
      operation_id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      hospital_name TEXT NOT NULL,
      hospital_code TEXT DEFAULT '',
      specialty TEXT NOT NULL,
      pic_name TEXT,
      submitted_date TEXT,
      status TEXT,
      scores TEXT,
      details TEXT,
      deleted_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS hospital_accounts (
      email TEXT PRIMARY KEY,
      hospital_code TEXT DEFAULT '',
      password TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      hospital_name TEXT NOT NULL,
      pic_name TEXT,
      province TEXT DEFAULT '',
      city TEXT DEFAULT '',
      status TEXT,
      surat_tugas_filename TEXT,
      surat_tugas_data TEXT,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS rankings (
      id TEXT PRIMARY KEY,
      hospital_name TEXT NOT NULL,
      city TEXT,
      province TEXT,
      specialty TEXT,
      final_score REAL,
      rsbk_score REAL,
      clinical_audit_score REAL,
      patient_report_score REAL,
      grade TEXT,
      approved_at TEXT,
      submission_id TEXT,
      deleted_at DATETIME DEFAULT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      excerpt TEXT,
      content TEXT,
      category TEXT,
      image_url TEXT,
      author TEXT,
      published_at TEXT,
      featured BOOLEAN,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      end_date TEXT,
      location TEXT,
      type TEXT,
      image_url TEXT,
      registration_url TEXT,
      links TEXT DEFAULT '[]',
      featured BOOLEAN,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const tablesToMigrate = ["surveys", "survey_backups", "patients", "drafts", "submissions", "hospital_accounts", "rankings"];

  // Migrate news table columns (added after initial schema)
  const newsInfo = await client.execute("PRAGMA table_info(news)");
  const newsCols = newsInfo.rows.map((r: any) => r.name);
  if (!newsCols.includes("excerpt")) await client.execute("ALTER TABLE news ADD COLUMN excerpt TEXT");
  if (!newsCols.includes("content")) await client.execute("ALTER TABLE news ADD COLUMN content TEXT");
  if (!newsCols.includes("category")) await client.execute("ALTER TABLE news ADD COLUMN category TEXT");
  if (!newsCols.includes("image_url")) await client.execute("ALTER TABLE news ADD COLUMN image_url TEXT");
  if (!newsCols.includes("published_at")) await client.execute("ALTER TABLE news ADD COLUMN published_at TEXT");
  if (!newsCols.includes("author")) await client.execute("ALTER TABLE news ADD COLUMN author TEXT");
  if (!newsCols.includes("featured")) await client.execute("ALTER TABLE news ADD COLUMN featured BOOLEAN");

  const eventsInfo = await client.execute("PRAGMA table_info(events)");
  const eventsCols = eventsInfo.rows.map((r: any) => r.name);
  if (!eventsCols.includes("description")) await client.execute("ALTER TABLE events ADD COLUMN description TEXT");
  if (!eventsCols.includes("date")) await client.execute("ALTER TABLE events ADD COLUMN date TEXT");
  if (!eventsCols.includes("end_date")) await client.execute("ALTER TABLE events ADD COLUMN end_date TEXT");
  if (!eventsCols.includes("location")) await client.execute("ALTER TABLE events ADD COLUMN location TEXT");
  if (!eventsCols.includes("type")) await client.execute("ALTER TABLE events ADD COLUMN type TEXT");
  if (!eventsCols.includes("image_url")) await client.execute("ALTER TABLE events ADD COLUMN image_url TEXT");
  if (!eventsCols.includes("registration_url")) await client.execute("ALTER TABLE events ADD COLUMN registration_url TEXT");
  if (!eventsCols.includes("links")) await client.execute("ALTER TABLE events ADD COLUMN links TEXT DEFAULT '[]'");
  if (!eventsCols.includes("featured")) await client.execute("ALTER TABLE events ADD COLUMN featured BOOLEAN");
  for (const table of tablesToMigrate) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    const existingColumns = info.rows.map((r: any) => r.name);

    if (table === "surveys") {
      if (!existingColumns.includes("hospital_code")) await client.execute("ALTER TABLE surveys ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.includes("patient_id")) await client.execute("ALTER TABLE surveys ADD COLUMN patient_id TEXT DEFAULT ''");
      if (!existingColumns.includes("patient_token")) await client.execute("ALTER TABLE surveys ADD COLUMN patient_token TEXT DEFAULT ''");
      if (!existingColumns.includes("patient_name")) await client.execute("ALTER TABLE surveys ADD COLUMN patient_name TEXT DEFAULT ''");
      if (!existingColumns.includes("patient_rm")) await client.execute("ALTER TABLE surveys ADD COLUMN patient_rm TEXT DEFAULT ''");
      if (!existingColumns.includes("prem_score")) await client.execute("ALTER TABLE surveys ADD COLUMN prem_score REAL DEFAULT 0");
      if (!existingColumns.includes("prom_score")) await client.execute("ALTER TABLE surveys ADD COLUMN prom_score REAL DEFAULT 0");
      if (!existingColumns.includes("overall_score")) await client.execute("ALTER TABLE surveys ADD COLUMN overall_score REAL DEFAULT 0");
      if (!existingColumns.includes("answers")) await client.execute("ALTER TABLE surveys ADD COLUMN answers TEXT DEFAULT '{}'");
    }

    if (table === "survey_backups") {
      if (!existingColumns.includes("hospital_code")) await client.execute("ALTER TABLE survey_backups ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.includes("specialty")) await client.execute("ALTER TABLE survey_backups ADD COLUMN specialty TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.includes("patient_token")) await client.execute("ALTER TABLE survey_backups ADD COLUMN patient_token TEXT DEFAULT ''");
      if (!existingColumns.includes("patient_name")) await client.execute("ALTER TABLE survey_backups ADD COLUMN patient_name TEXT DEFAULT ''");
      if (!existingColumns.includes("patient_rm")) await client.execute("ALTER TABLE survey_backups ADD COLUMN patient_rm TEXT DEFAULT ''");
      if (!existingColumns.includes("payload")) await client.execute("ALTER TABLE survey_backups ADD COLUMN payload TEXT DEFAULT '{}'");
      if (!existingColumns.includes("status")) await client.execute("ALTER TABLE survey_backups ADD COLUMN status TEXT DEFAULT 'received'");
      if (!existingColumns.includes("error")) await client.execute("ALTER TABLE survey_backups ADD COLUMN error TEXT DEFAULT ''");
      if (!existingColumns.includes("created_at")) await client.execute("ALTER TABLE survey_backups ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
      if (!existingColumns.includes("updated_at")) await client.execute("ALTER TABLE survey_backups ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }

    if (table === "patients") {
      if (!existingColumns.includes("hospital_code") && !existingColumns.includes("hospitalCode")) {
        await client.execute("ALTER TABLE patients ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      }
      if (!existingColumns.includes("specialty")) await client.execute("ALTER TABLE patients ADD COLUMN specialty TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.includes("survey_token")) await client.execute("ALTER TABLE patients ADD COLUMN survey_token TEXT DEFAULT ''");
      if (!existingColumns.includes("name")) await client.execute("ALTER TABLE patients ADD COLUMN name TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.includes("rm") && !existingColumns.includes("patient_rm")) {
        await client.execute("ALTER TABLE patients ADD COLUMN rm TEXT NOT NULL DEFAULT ''");
      }
      if (!existingColumns.includes("created_at")) await client.execute("ALTER TABLE patients ADD COLUMN created_at TEXT DEFAULT ''");
      if (!existingColumns.includes("id")) await client.execute("ALTER TABLE patients ADD COLUMN id TEXT");
      if (existingColumns.includes("hospitalCode") && !existingColumns.includes("hospital_code")) {
        await client.execute("ALTER TABLE patients ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      }
    }

    if (table === "drafts") {
      if (!existingColumns.some((c: string) => ["id", "draft_id", "draftId"].includes(c))) await client.execute("ALTER TABLE drafts ADD COLUMN id TEXT");
      if (!existingColumns.some((c: string) => ["type", "draft_type", "draftType"].includes(c))) await client.execute("ALTER TABLE drafts ADD COLUMN type TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.some((c: string) => ["data", "draft_data", "draftData"].includes(c))) await client.execute("ALTER TABLE drafts ADD COLUMN data TEXT DEFAULT '{}'");
      if (!existingColumns.some((c: string) => ["hospital_code", "hospitalCode"].includes(c))) await client.execute("ALTER TABLE drafts ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.some((c: string) => ["specialty", "specialty_name", "specialtyName"].includes(c))) await client.execute("ALTER TABLE drafts ADD COLUMN specialty TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.some((c: string) => ["updated_at", "updatedAt"].includes(c))) await client.execute("ALTER TABLE drafts ADD COLUMN updated_at TEXT DEFAULT ''");
    }

    if (table === "submissions") {
      if (!existingColumns.includes("id")) await client.execute("ALTER TABLE submissions ADD COLUMN id TEXT");
      if (!existingColumns.includes("hospital_name")) await client.execute("ALTER TABLE submissions ADD COLUMN hospital_name TEXT DEFAULT ''");
      if (!existingColumns.includes("hospital_code")) await client.execute("ALTER TABLE submissions ADD COLUMN hospital_code TEXT DEFAULT ''");
      if (!existingColumns.includes("specialty")) await client.execute("ALTER TABLE submissions ADD COLUMN specialty TEXT DEFAULT ''");
      if (!existingColumns.includes("pic_name")) await client.execute("ALTER TABLE submissions ADD COLUMN pic_name TEXT DEFAULT ''");
      if (!existingColumns.includes("submitted_date")) await client.execute("ALTER TABLE submissions ADD COLUMN submitted_date TEXT DEFAULT ''");
      if (!existingColumns.includes("details")) await client.execute("ALTER TABLE submissions ADD COLUMN details TEXT DEFAULT '{}'");
      if (!existingColumns.includes("scores")) await client.execute("ALTER TABLE submissions ADD COLUMN scores TEXT DEFAULT '{}'");
      if (!existingColumns.includes("status")) await client.execute("ALTER TABLE submissions ADD COLUMN status TEXT DEFAULT 'Pending'");
      if (!existingColumns.includes("created_at")) await client.execute("ALTER TABLE submissions ADD COLUMN created_at TEXT DEFAULT ''");
      if (!existingColumns.includes("deleted_at")) await client.execute("ALTER TABLE submissions ADD COLUMN deleted_at DATETIME DEFAULT NULL");
      if (!existingColumns.includes("updated_at")) {
        await client.execute("ALTER TABLE submissions ADD COLUMN updated_at TEXT DEFAULT ''");
      }
    }

    if (table === "hospital_accounts") {
      if (!existingColumns.includes("hospital_code")) await client.execute("ALTER TABLE hospital_accounts ADD COLUMN hospital_code TEXT DEFAULT ''");
      if (!existingColumns.includes("password_hash")) await client.execute("ALTER TABLE hospital_accounts ADD COLUMN password_hash TEXT");
      if (!existingColumns.includes("surat_tugas_filename")) await client.execute("ALTER TABLE hospital_accounts ADD COLUMN surat_tugas_filename TEXT DEFAULT ''");
      if (!existingColumns.includes("surat_tugas_data")) await client.execute("ALTER TABLE hospital_accounts ADD COLUMN surat_tugas_data TEXT DEFAULT ''");
      if (!existingColumns.includes("province")) await client.execute("ALTER TABLE hospital_accounts ADD COLUMN province TEXT DEFAULT ''");
      if (!existingColumns.includes("city")) await client.execute("ALTER TABLE hospital_accounts ADD COLUMN city TEXT DEFAULT ''");
      if (!existingColumns.includes("registered_at")) await client.execute("ALTER TABLE hospital_accounts ADD COLUMN registered_at TEXT DEFAULT ''");
    }

    if (table === "rankings") {
      if (!existingColumns.includes("deleted_at")) await client.execute("ALTER TABLE rankings ADD COLUMN deleted_at DATETIME DEFAULT NULL");
    }
  }

  await ensureHospitalAccountCodes(client);

  // Migration: add UNIQUE(hospital_name, specialty) constraint to submissions
  try {
    const tblInfo = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='submissions'");
    const tblSql: string = (tblInfo.rows[0] as any)?.sql || "";
    if (!tblSql.toUpperCase().includes("UNIQUE")) {
      await client.execute(`
        CREATE TABLE submissions_new (
          id TEXT PRIMARY KEY,
          hospital_name TEXT NOT NULL,
          hospital_code TEXT DEFAULT '',
          specialty TEXT NOT NULL,
          pic_name TEXT,
          submitted_date TEXT,
          status TEXT,
          scores TEXT,
          details TEXT,
          deleted_at DATETIME DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hospital_name, specialty)
        )
      `);
      await client.execute(`
        INSERT OR IGNORE INTO submissions_new
          (id, hospital_name, hospital_code, specialty, pic_name, submitted_date, status, scores, details, deleted_at, created_at)
        SELECT id, hospital_name, hospital_code, specialty, pic_name, submitted_date, status, scores, details, deleted_at, created_at
        FROM submissions
      `);
      await client.execute("DROP TABLE submissions");
      await client.execute("ALTER TABLE submissions_new RENAME TO submissions");
    }
  } catch (e) {
    console.warn("Submissions UNIQUE constraint migration skipped:", e);
  }

  try {
    const tokenInfo = await client.execute("PRAGMA table_info(patients)");
    const patientCols = tokenInfo.rows.map((r: any) => r.name);
    if (patientCols.includes("survey_token")) {
      const idCol = patientCols.find((c: string) => c.toLowerCase() === "id") || "id";
      const missingTokens = await client.execute(`SELECT ${idCol} as id FROM patients WHERE survey_token IS NULL OR survey_token = ''`);
      for (const row of missingTokens.rows as any[]) {
        if (!row.id) continue;
        await client.execute({
          sql: `UPDATE patients SET survey_token = ? WHERE ${idCol} = ?`,
          args: [randomId(), row.id],
        });
      }
    }
  } catch (e) {
    console.warn("Patient survey token backfill skipped:", e);
  }

  tablesInitialized = true;
}

async function addHospitalAccount({ acc }: any) {
  await initTursoTables();
  const client = db();
  await ensureHospitalAccountCodes(client);
  const codeRows = await client.execute("SELECT email, hospital_code FROM hospital_accounts");
  const usedCodes = new Set((codeRows.rows as any[]).map((row) => String(row.hospital_code || "").trim().toUpperCase()).filter(Boolean));
  const baseCode = hospitalCodeFromEmail(acc.email);
  const existingSameBaseCount = (codeRows.rows as any[]).filter((row) => hospitalCodeFromEmail(String(row.email || "")) === baseCode).length;
  const suffix = existingSameBaseCount > 0 ? String(existingSameBaseCount + 1) : "";
  const seedCode = suffix ? `${baseCode.slice(0, Math.max(1, 12 - suffix.length))}${suffix}` : baseCode;
  const hospitalCode = uniqueHospitalCode(seedCode, usedCodes);
  const passwordHash = await bcrypt.hash(acc.password, 10);
  await client.execute({
    sql: `INSERT INTO hospital_accounts (email, hospital_code, password, password_hash, hospital_name, pic_name, province, city, status, surat_tugas_filename, surat_tugas_data, registered_at)
          VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      acc.email,
      hospitalCode,
      passwordHash,
      acc.hospitalName,
      acc.picName,
      acc.province || "",
      acc.city || "",
      acc.status,
      acc.suratTugasFileName || "",
      acc.suratTugasData || "",
      acc.registeredAt || new Date().toISOString(),
    ],
  });
}

async function loginHospital({ email, password }: any) {
  await initTursoTables();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "").trim();
  const client = db();
  await ensureHospitalAccountCodes(client);
  const rs = await client.execute({
    sql: "SELECT email, hospital_code, password, password_hash, hospital_name, pic_name, province, city, status FROM hospital_accounts WHERE LOWER(email) = LOWER(?)",
    args: [normalizedEmail],
  });

  const row = rs.rows[0] as any;
  if (!row) {
    return { success: false, error: "invalid_credentials" };
  }

  let match = false;
  if (row.password_hash) {
    match = await bcrypt.compare(normalizedPassword, row.password_hash);
  } else if (row.password) {
    // Backward compatibility: older registered accounts stored plaintext passwords.
    // On successful login, migrate them to bcrypt so the secure auth flow owns future logins.
    match = String(row.password).trim() === normalizedPassword;
    if (match) {
      const passwordHash = await bcrypt.hash(normalizedPassword, 10);
      await db().execute({
        sql: "UPDATE hospital_accounts SET password_hash = ?, password = '' WHERE LOWER(email) = LOWER(?)",
        args: [passwordHash, normalizedEmail],
      });
    }
  }

  if (!match) {
    return { success: false, error: "invalid_credentials" };
  }

  const status = row.status as string;
  if (status !== "activated" && status !== "active" && status !== "aktif") {
    if (status === "rejected" || status === "ditolak") {
      return { success: false, error: "rejected" };
    }
    return { success: false, error: "pending_activation" };
  }

  const account = {
    email: row.email,
    hospitalCode: row.hospital_code || hospitalCodeFromEmail(row.email),
    hospitalName: row.hospital_name,
    picName: row.pic_name,
    province: row.province || "",
    city: row.city || "",
    status: "activated" as const,
  };

  const token = signToken({ email: row.email, hospitalCode: account.hospitalCode, role: "hospital" });
  return { success: true, token, account };
}

async function loginAdmin({ username, password }: any) {
  await initTursoTables();
  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password || "").trim();
  if (isConfiguredAdminLogin(normalizedUsername, normalizedPassword)) {
    const token = signToken({ username: getConfiguredAdminUsername() || normalizedUsername, role: "admin" });
    return { success: true, token };
  }

  const rs = await db().execute({
    sql: "SELECT id, username, password_hash, role FROM admins WHERE LOWER(username) = LOWER(?)",
    args: [normalizedUsername],
  });

  const row = rs.rows[0] as any;
  if (!row) return { success: false, error: "invalid_credentials" };

  const match = await bcrypt.compare(normalizedPassword, row.password_hash);
  if (!match) return { success: false, error: "invalid_credentials" };

  const token = signToken({ username: row.username, role: row.role || "admin" });
  return { success: true, token };
}

async function getAllHospitalAccounts() {
  await initTursoTables();
  const rs = await db().execute(
    "SELECT email, hospital_code, hospital_name, pic_name, province, city, status, surat_tugas_filename, registered_at FROM hospital_accounts ORDER BY registered_at DESC"
  );
  return rs.rows.map((r: any) => ({
    email: r.email,
    hospitalCode: r.hospital_code || hospitalCodeFromEmail(r.email),
    hospitalName: r.hospital_name,
    picName: r.pic_name,
    province: r.province || "",
    city: r.city || "",
    status: r.status,
    suratTugasFileName: r.surat_tugas_filename,
    registeredAt: r.registered_at,
  }));
}

async function getHospitalSuratTugas({ email }: any) {
  await initTursoTables();
  const rs = await db().execute({
    sql: "SELECT surat_tugas_data FROM hospital_accounts WHERE email = ?",
    args: [email],
  });
  return rs.rows[0]?.surat_tugas_data || null;
}

async function updateAccountStatus({ email, status }: any) {
  await initTursoTables();
  await db().execute({
    sql: "UPDATE hospital_accounts SET status = ? WHERE email = ?",
    args: [status, email],
  });
}

async function deleteHospitalAccount({ email, _authRole }: any) {
  if (_authRole !== "admin") {
    const err: any = new Error("Admin authorization required");
    err.statusCode = 401;
    throw err;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    const err: any = new Error("Hospital account email is required");
    err.statusCode = 400;
    throw err;
  }

  await initTursoTables();
  const result = await db().execute({
    sql: "DELETE FROM hospital_accounts WHERE LOWER(email) = LOWER(?)",
    args: [normalizedEmail],
  });

  return { success: true, deleted: Number(result.rowsAffected || 0) > 0 };
}

async function resetHospitalPassword({ email, password, _authRole }: any) {
  if (_authRole !== "admin") {
    const err: any = new Error("Admin authorization required");
    err.statusCode = 401;
    throw err;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "").trim();
  if (!normalizedEmail || normalizedPassword.length < 6) {
    const err: any = new Error("Email and password with at least 6 characters are required");
    err.statusCode = 400;
    throw err;
  }

  await initTursoTables();
  const passwordHash = await bcrypt.hash(normalizedPassword, 10);
  const result = await db().execute({
    sql: "UPDATE hospital_accounts SET password_hash = ?, password = '' WHERE LOWER(email) = LOWER(?)",
    args: [passwordHash, normalizedEmail],
  });

  if (!result.rowsAffected) {
    const err: any = new Error("Hospital account not found");
    err.statusCode = 404;
    throw err;
  }

  return { success: true };
}

async function addSubmission({ submission, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const hospitalCode = await resolveEffectiveHospitalCode(client, {
    hospitalCode: submission.hospitalCode || submission.details?.hospitalCode || "",
    _hospitalEmail,
  });
  const details = {
    ...(submission.details || {}),
    hospitalCode,
    hospitalName: submission.hospitalName,
  };

  const info = await client.execute("PRAGMA table_info(submissions)");
  const existingColumns = info.rows.map((r: any) => r.name);
  const createdAt = new Date().toISOString();
  const valuesByColumn: Record<string, any> = {
    id: submission.id,
    hospital_name: submission.hospitalName,
    hospitalName: submission.hospitalName,
    hospital_code: hospitalCode,
    hospitalCode,
    specialty: submission.specialty,
    disease: submission.disease || "",
    pic_name: submission.picName,
    picName: submission.picName,
    submitted_date: submission.submittedDate,
    submittedDate: submission.submittedDate,
    status: submission.status,
    scores: JSON.stringify(submission.scores || {}),
    details: JSON.stringify(details),
    created_at: createdAt,
    createdAt,
  };
  const insertColumns = existingColumns.filter((column: string) =>
    Object.prototype.hasOwnProperty.call(valuesByColumn, column)
  );

  await client.execute({
    sql: `INSERT OR REPLACE INTO submissions (${insertColumns.join(", ")})
          VALUES (${insertColumns.map(() => "?").join(", ")})`,
    args: insertColumns.map((column: string) => valuesByColumn[column]),
  });
}

async function getAllSubmissions() {
  await initTursoTables();
  const rs = await db().execute("SELECT * FROM submissions WHERE deleted_at IS NULL ORDER BY created_at DESC");
  return rs.rows.map((r: any) => {
    const details = parseJson(r.details, {});
    return {
      id: r.id,
      hospitalName: r.hospital_name || r.hospitalName || details.hospitalName || "",
      hospitalCode: r.hospital_code || r.hospitalCode || details.hospitalCode || "",
      specialty: r.specialty || details.specialty || "",
      picName: r.pic_name || r.picName || details.picName || "",
      submittedDate: r.submitted_date || r.submittedDate || "",
      status: r.status,
      scores: parseJson(r.scores, {}),
      details,
      reviewerNotes: details.reviewerNotes || "",
      updatedAt: r.updated_at || null,
    };
  });
}

async function softDeleteSubmission({ id }: any) {
  await initTursoTables();
  const now = new Date().toISOString();
  const client = db();
  await client.execute({ sql: "UPDATE submissions SET deleted_at = ? WHERE id = ?", args: [now, id] });
  await client.execute({ sql: "UPDATE rankings SET deleted_at = ? WHERE submission_id = ?", args: [now, id] });
}

async function restoreSubmission({ id }: any) {
  await initTursoTables();
  const client = db();
  await client.execute({ sql: "UPDATE submissions SET deleted_at = NULL WHERE id = ?", args: [id] });
  await client.execute({ sql: "UPDATE rankings SET deleted_at = NULL WHERE submission_id = ?", args: [id] });
}

async function getDeletedSubmissions() {
  await initTursoTables();
  const rs = await db().execute("SELECT * FROM submissions WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC");
  return rs.rows.map((r: any) => {
    const details = parseJson(r.details, {});
    return {
      id: r.id,
      hospitalName: r.hospital_name || details.hospitalName || "",
      hospitalCode: r.hospital_code || details.hospitalCode || "",
      specialty: r.specialty || "",
      picName: r.pic_name || details.picName || "",
      submittedDate: r.submitted_date || "",
      status: r.status,
      scores: parseJson(r.scores, {}),
      details,
      deletedAt: r.deleted_at,
    };
  });
}

async function updateSubmissionStatus({ id, status, updatedAt }: any) {
  await initTursoTables();
  const result = await db().execute({
    sql: "UPDATE submissions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (updated_at = ? OR updated_at IS NULL)",
    args: [status, id, updatedAt ?? null],
  });
  if (result.rowsAffected === 0) {
    const err: any = new Error("Conflict: submission was modified by another session");
    err.statusCode = 409;
    throw err;
  }
}

async function updateSubmissionReview({ id, status, details }: any) {
  await initTursoTables();
  await db().execute({
    sql: "UPDATE submissions SET status = ?, details = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [status, JSON.stringify(details), id],
  });
}

async function publishRankingToDb({ ranking }: any) {
  await initTursoTables();
  const client = db();
  const existing = await client.execute({
    sql: "SELECT id FROM rankings WHERE submission_id = ?",
    args: [ranking.submissionId],
  });

  if (existing.rows.length > 0) {
    await client.execute({
      sql: `UPDATE rankings SET
              hospital_name = ?, city = ?, province = ?, specialty = ?,
              final_score = ?, rsbk_score = ?, clinical_audit_score = ?,
              patient_report_score = ?, grade = ?, approved_at = ?, deleted_at = NULL
            WHERE submission_id = ?`,
      args: [
        ranking.hospitalName, ranking.city, ranking.province, ranking.specialty,
        ranking.finalScore, ranking.rsbkScore, ranking.clinicalAuditScore,
        ranking.patientReportScore, ranking.grade, ranking.approvedAt,
        ranking.submissionId,
      ],
    });
  } else {
    await client.execute({
      sql: `INSERT INTO rankings (id, hospital_name, city, province, specialty, final_score, rsbk_score, clinical_audit_score, patient_report_score, grade, approved_at, submission_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ranking.id, ranking.hospitalName, ranking.city, ranking.province, ranking.specialty,
        ranking.finalScore, ranking.rsbkScore, ranking.clinicalAuditScore,
        ranking.patientReportScore, ranking.grade, ranking.approvedAt, ranking.submissionId,
      ],
    });
  }
}

async function unpublishRankingFromDb({ submissionId }: any) {
  await initTursoTables();
  await db().execute({
    sql: "DELETE FROM rankings WHERE submission_id = ?",
    args: [submissionId],
  });
}

async function getAllRankingsFromDb() {
  await initTursoTables();
  const rs = await db().execute("SELECT * FROM rankings WHERE deleted_at IS NULL ORDER BY final_score DESC");
  return rs.rows.map((r: any) => ({
    id: r.id,
    hospitalName: r.hospital_name,
    city: r.city,
    province: r.province,
    specialty: r.specialty,
    finalScore: r.final_score,
    rsbkScore: r.rsbk_score,
    clinicalAuditScore: r.clinical_audit_score,
    patientReportScore: r.patient_report_score,
    grade: r.grade,
    approvedAt: r.approved_at,
    submissionId: r.submission_id,
  }));
}

async function addNewsToDb({ news }: any) {
  await initTursoTables();
  await db().execute({
    sql: `INSERT OR REPLACE INTO news (id, title, excerpt, content, category, image_url, author, published_at, featured)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [news.id, news.title, news.excerpt, news.content, news.category, news.imageUrl, news.author, news.publishedAt, news.featured ? 1 : 0],
  });
}

async function updateNewsInDb({ id, news }: any) {
  await initTursoTables();
  await db().execute({
    sql: `UPDATE news SET title=?, excerpt=?, content=?, category=?, image_url=?, author=?, published_at=?, featured=? WHERE id=?`,
    args: [news.title, news.excerpt, news.content, news.category, news.imageUrl, news.author, news.publishedAt, news.featured ? 1 : 0, id],
  });
}

async function deleteNewsFromDb({ id }: any) {
  await initTursoTables();
  await db().execute({ sql: "DELETE FROM news WHERE id = ?", args: [id] });
}

async function getAllNews() {
  await initTursoTables();
  const rs = await db().execute("SELECT * FROM news ORDER BY published_at DESC");
  return rs.rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    content: r.content,
    category: r.category,
    imageUrl: r.image_url,
    author: r.author,
    publishedAt: r.published_at,
    featured: r.featured === 1,
    createdAt: r.created_at,
  }));
}

async function addEventToDb({ event }: any) {
  await initTursoTables();
  await db().execute({
    sql: `INSERT INTO events (id, title, description, date, end_date, location, type, image_url, registration_url, links, featured)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [event.id, event.title, event.description, event.date, event.endDate || "", event.location, event.type, event.imageUrl, event.registrationUrl || "", JSON.stringify(event.links || []), event.featured ? 1 : 0],
  });
}

async function updateEventInDb({ id, event }: any) {
  await initTursoTables();
  await db().execute({
    sql: `UPDATE events SET title=?, description=?, date=?, end_date=?, location=?, type=?, image_url=?, registration_url=?, links=?, featured=? WHERE id=?`,
    args: [event.title, event.description, event.date, event.endDate || "", event.location, event.type, event.imageUrl, event.registrationUrl || "", JSON.stringify(event.links || []), event.featured ? 1 : 0, id],
  });
}

async function deleteEventFromDb({ id }: any) {
  await initTursoTables();
  await db().execute({ sql: "DELETE FROM events WHERE id = ?", args: [id] });
}

async function getAllEvents() {
  await initTursoTables();
  const rs = await db().execute("SELECT * FROM events ORDER BY date ASC");
  return rs.rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    date: r.date,
    endDate: r.end_date,
    location: r.location,
    type: r.type,
    imageUrl: r.image_url,
    registrationUrl: r.registration_url,
    links: parseJson(r.links, []),
    featured: r.featured === 1,
    createdAt: r.created_at,
  }));
}

async function getPatientTableSchema(client: any) {
  const info = await client.execute("PRAGMA table_info(patients)");
  const cols = info.rows.map((r: any) => r.name);
  return {
    cols,
    idCol: cols.find((c: string) => c.toLowerCase() === "id") || "id",
    hCol: cols.find((c: string) => ["hospital_code", "hospitalcode"].includes(c.toLowerCase())) || "hospital_code",
    sCol: cols.find((c: string) => ["specialty", "specialtyname"].includes(c.toLowerCase())) || "specialty",
    nameCol: cols.find((c: string) => ["name", "patient_name", "patientname"].includes(c.toLowerCase())) || "name",
    rmCol: cols.find((c: string) => ["rm", "patient_rm", "patientrm", "medical_record_number", "medicalrecordnumber"].includes(c.toLowerCase())) || "rm",
    tokenCol: cols.find((c: string) => ["survey_token", "surveytoken", "patient_token", "patienttoken"].includes(c.toLowerCase())) || "survey_token",
  };
}

async function resolveRegisteredSurveyPatient(
  client: any,
  {
    hospitalCode,
    specialty,
    patientRm,
    patientName,
    patientToken,
  }: {
    hospitalCode: string;
    specialty: string;
    patientRm: string;
    patientName: string;
    patientToken?: string;
  }
) {
  const { cols, idCol, hCol, sCol, nameCol, rmCol, tokenCol } = await getPatientTableSchema(client);
  const requestedHospitalCode = String(hospitalCode || "").trim();
  const requestedSpecialty = String(specialty || "").trim();
  const requestedRmKey = normalizePatientCodeKey(patientRm);
  const requestedNameKey = normalizePatientNameKey(patientName);
  const token = String(patientToken || "").trim();

  if (token && cols.includes(tokenCol)) {
    const tokenRs = await client.execute({
      sql: `SELECT ${idCol} as id, ${hCol} as hospitalCode, ${sCol} as specialty, ${nameCol} as name, ${rmCol} as rm, ${tokenCol} as surveyToken
            FROM patients
            WHERE ${tokenCol} = ?
            LIMIT 2`,
      args: [token],
    });
    if (tokenRs.rows.length !== 1) return null;
    const row: any = tokenRs.rows[0];
    const rowRmKey = normalizePatientCodeKey(row.rm);
    const rowNameKey = normalizePatientNameKey(row.name);
    if (requestedRmKey && rowRmKey && requestedRmKey !== rowRmKey) return null;
    if (requestedNameKey && rowNameKey && requestedNameKey !== rowNameKey) return null;
    return {
      id: String(row.id || ""),
      hospitalCode: String(row.hospitalCode || ""),
      specialty: String(row.specialty || ""),
      name: String(row.name || ""),
      rm: String(row.rm || ""),
      surveyToken: String(row.surveyToken || token),
    };
  }

  if (!requestedHospitalCode || !requestedRmKey) return null;
  const baseSpecialty = getSpecialtyBaseKey(requestedSpecialty);
  const registered = await client.execute({
    sql: `SELECT ${idCol} as id, ${hCol} as hospitalCode, ${sCol} as specialty, ${nameCol} as name, ${rmCol} as rm, ${cols.includes(tokenCol) ? tokenCol : "''"} as surveyToken
          FROM patients
          WHERE ${hCol} = ? ${baseSpecialty ? `AND ${sCol} LIKE ?` : ""}`,
    args: baseSpecialty ? [requestedHospitalCode, `${baseSpecialty}-d%`] : [requestedHospitalCode],
  });
  const candidates = registered.rows
    .map((row: any) => ({
      id: String(row.id || ""),
      hospitalCode: String(row.hospitalCode || ""),
      specialty: String(row.specialty || ""),
      name: String(row.name || ""),
      rm: String(row.rm || ""),
      surveyToken: String(row.surveyToken || ""),
      rmKey: normalizePatientCodeKey(row.rm),
      nameKey: normalizePatientNameKey(row.name),
    }))
    .filter((row: any) => row.rmKey && row.rmKey === requestedRmKey);
  const exactNameMatches = requestedNameKey
    ? candidates.filter((row: any) => row.nameKey && row.nameKey === requestedNameKey)
    : candidates;

  if (exactNameMatches.length !== 1) return null;
  const patient = exactNameMatches[0];
  return {
    id: patient.id,
    hospitalCode: patient.hospitalCode,
    specialty: patient.specialty,
    name: patient.name,
    rm: patient.rm,
    surveyToken: patient.surveyToken,
  };
}

async function saveSurveyBackup({ hospitalCode, specialty, survey, status = "received", error = "", _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const requestedCode = (await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail })) || "UNKNOWN";
  const patientRm = survey?.medicalRecordNumber || survey?.qRm || "";
  const patientName = survey?.patientName || survey?.qName || "";
  const patientToken = getSurveyToken(survey);
  const registeredPatient = await resolveRegisteredSurveyPatient(client, {
    hospitalCode: requestedCode,
    specialty,
    patientRm,
    patientName,
    patientToken,
  });
  const effectiveCode = registeredPatient?.hospitalCode || requestedCode;
  const effectiveSpecialty = registeredPatient?.specialty || specialty || "";
  const id = `survey-backup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await client.execute({
    sql: `INSERT INTO survey_backups (id, hospital_code, specialty, patient_token, patient_name, patient_rm, payload, status, error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      effectiveCode,
      effectiveSpecialty,
      registeredPatient?.surveyToken || patientToken,
      registeredPatient?.name || patientName,
      registeredPatient?.rm || patientRm,
      JSON.stringify({ ...(survey || {}), patientId: registeredPatient?.id, patientToken: registeredPatient?.surveyToken || patientToken }),
      status,
      error || "",
    ],
  });
  return { success: true, backupId: id };
}

async function getSurveyBackups({ hospitalCode, specialty, limit = 200 }: any) {
  await initTursoTables();
  const args: any[] = [hospitalCode];
  let where = "hospital_code = ?";
  if (specialty) {
    where += " AND specialty = ?";
    args.push(specialty);
  }
  args.push(Math.max(1, Math.min(1000, Number(limit) || 200)));
  const rs = await db().execute({
    sql: `SELECT * FROM survey_backups WHERE ${where} ORDER BY created_at DESC LIMIT ?`,
    args,
  });
  return rs.rows.map((r: any) => ({
    id: r.id,
    hospitalCode: r.hospital_code,
    specialty: r.specialty,
    patientName: r.patient_name,
    medicalRecordNumber: r.patient_rm,
    payload: parseJson(r.payload, {}),
    status: r.status,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function submitSurvey({ hospitalCode, specialty, survey, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const patientRm = survey.medicalRecordNumber || survey.qRm || "";
  const patientName = survey.patientName || survey.qName || "";
  const patientToken = getSurveyToken(survey);
  const requestedCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });

  const registeredPatient = await resolveRegisteredSurveyPatient(client, {
    hospitalCode: requestedCode,
    specialty,
    patientRm,
    patientName,
    patientToken,
  });

  if (!registeredPatient) {
    await saveSurveyBackup({
      hospitalCode: requestedCode,
      specialty,
      survey,
      status: "submit-rejected-unmatched-patient",
      error: "Patient identity did not match a registered PRM patient",
    });
    throw createHttpError("Data pasien tidak cocok dengan QR/daftar pasien rumah sakit. Silakan minta petugas RS membuat ulang QR code.", 409);
  }

  const effectiveCode = registeredPatient.hospitalCode;
  const effectiveSpecialty = registeredPatient.specialty;
  const effectivePatientName = registeredPatient.name || patientName;
  const effectivePatientRm = registeredPatient.rm || patientRm;

  await saveSurveyBackup({
    hospitalCode: effectiveCode,
    specialty: effectiveSpecialty,
    survey: {
      ...survey,
      patientId: registeredPatient.id,
      patientToken: registeredPatient.surveyToken,
      patientName: effectivePatientName,
      medicalRecordNumber: effectivePatientRm,
      resolvedHospitalCode: effectiveCode,
      resolvedSpecialty: effectiveSpecialty,
    },
    status: "submit-received",
  });

  let existing = await client.execute({
    sql: `SELECT id FROM surveys
          WHERE hospital_code = ?
            AND specialty = ?
            AND patient_id = ?
            AND patient_id != ''
          LIMIT 1`,
    args: [effectiveCode, effectiveSpecialty, registeredPatient.id],
  });
  if (existing.rows.length === 0) {
    existing = await client.execute({
      sql: `SELECT id FROM surveys
            WHERE hospital_code = ?
              AND specialty = ?
              AND patient_rm = ?
              AND LOWER(TRIM(patient_name)) = LOWER(TRIM(?))
              AND (patient_id IS NULL OR patient_id = '')
            LIMIT 1`,
      args: [effectiveCode, effectiveSpecialty, effectivePatientRm, effectivePatientName],
    });
  }
  if (existing.rows.length > 0) {
    const existingId = String((existing.rows[0] as any).id);
    await client.execute({
      sql: `UPDATE surveys
            SET patient_id = ?, patient_token = ?, patient_name = ?, patient_rm = ?, prem_score = ?, prom_score = ?, overall_score = ?, answers = ?
            WHERE id = ?`,
      args: [
        registeredPatient.id,
        registeredPatient.surveyToken,
        effectivePatientName,
        effectivePatientRm,
        survey.premScore ?? 0,
        survey.promScore ?? 0,
        survey.overallScore ?? 0,
        JSON.stringify(survey.answers || {}),
        existingId,
      ],
    });
    await saveSurveyBackup({
      hospitalCode: effectiveCode,
      specialty: effectiveSpecialty,
      survey: {
        ...survey,
        surveyId: existingId,
        patientId: registeredPatient.id,
        patientToken: registeredPatient.surveyToken,
        patientName: effectivePatientName,
        medicalRecordNumber: effectivePatientRm,
        resolvedHospitalCode: effectiveCode,
        resolvedSpecialty: effectiveSpecialty,
      },
      status: "submit-updated-existing",
    });
    return { success: true, duplicate: true, updated: true, surveyId: existingId };
  }

  const id = randomId();
  await client.execute({
    sql: `INSERT INTO surveys (id, hospital_code, specialty, patient_id, patient_token, patient_name, patient_rm, prem_score, prom_score, overall_score, answers)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      effectiveCode,
      effectiveSpecialty,
      registeredPatient.id,
      registeredPatient.surveyToken,
      effectivePatientName,
      effectivePatientRm,
      survey.premScore ?? 0,
      survey.promScore ?? 0,
      survey.overallScore ?? 0,
      JSON.stringify(survey.answers || {}),
    ],
  });
  await saveSurveyBackup({
    hospitalCode: effectiveCode,
    specialty: effectiveSpecialty,
    survey: {
      ...survey,
      surveyId: id,
      patientId: registeredPatient.id,
      patientToken: registeredPatient.surveyToken,
      patientName: effectivePatientName,
      medicalRecordNumber: effectivePatientRm,
      resolvedHospitalCode: effectiveCode,
      resolvedSpecialty: effectiveSpecialty,
    },
    status: "submit-inserted",
  });
  return { success: true, surveyId: id };
}

async function resolveRegisteredPatientSpecialty(
  client: any,
  hospitalCode: string,
  specialty: string,
  patientRm: string,
  patientName: string
) {
  const patientInfo = await client.execute("PRAGMA table_info(patients)");
  const patientCols = patientInfo.rows.map((r: any) => r.name);
  const hCol = patientCols.find((c: string) => ["hospital_code", "hospitalcode"].includes(c.toLowerCase())) || "hospital_code";
  const sCol = patientCols.find((c: string) => ["specialty", "specialtyname"].includes(c.toLowerCase())) || "specialty";
  const rmCol = patientCols.find((c: string) => ["rm", "patient_rm", "patientrm", "medical_record_number", "medicalrecordnumber"].includes(c.toLowerCase())) || "rm";
  const nameCol = patientCols.find((c: string) => ["name", "patient_name", "patientname"].includes(c.toLowerCase())) || "name";
  const baseSpecialty = getSpecialtyBaseKey(specialty);
  const registered = await client.execute({
    sql: `SELECT ${sCol} as specialty, ${nameCol} as name, ${rmCol} as rm
          FROM patients
          WHERE ${hCol} = ? ${baseSpecialty ? `AND ${sCol} LIKE ?` : ""}`,
    args: baseSpecialty ? [hospitalCode, `${baseSpecialty}-d%`] : [hospitalCode],
  });
  const requestedRmKey = normalizePatientCodeKey(patientRm);
  const requestedNameKey = normalizePatientNameKey(patientName);
  const candidates = registered.rows
    .map((row: any) => ({
      specialty: String(row.specialty || ""),
      nameKey: normalizePatientNameKey(row.name),
      rmKey: normalizePatientCodeKey(row.rm),
    }))
    .filter((row: any) => row.rmKey && row.rmKey === requestedRmKey);
  const nameMatches = candidates.filter((row: any) => row.nameKey && row.nameKey === requestedNameKey);
  const resolvedCandidates = requestedNameKey ? nameMatches : candidates;
  const uniqueSpecialties = Array.from(new Set(resolvedCandidates.map((row: any) => row.specialty).filter(Boolean)));
  return uniqueSpecialties.length === 1 ? String(uniqueSpecialties[0]) : null;
}

function mapSurveyRow(r: any) {
  return {
    id: r.id,
    patientId: r.patient_id,
    patientToken: r.patient_token,
    patientName: r.patient_name,
    medicalRecordNumber: r.patient_rm,
    specialty: r.specialty,
    premScore: r.prem_score,
    promScore: r.prom_score,
    overallScore: r.overall_score,
    answers: parseJson(r.answers, {}),
    submittedAt: r.created_at,
    timestamp: r.created_at,
  };
}

async function reconcileSurveySpecialties(client: any, hospitalCode: string) {
  if (!hospitalCode) return;

  // Older QR links could carry a stale disease index, so some surveys landed under
  // the wrong disease key. The patient registry is the source of truth for PRM.
  await client.execute({
    sql: `UPDATE surveys
          SET specialty = (
            SELECT p.specialty
            FROM patients p
            WHERE p.hospital_code = surveys.hospital_code
              AND p.rm = surveys.patient_rm
              AND LOWER(TRIM(p.name)) = LOWER(TRIM(surveys.patient_name))
            LIMIT 1
          )
          WHERE hospital_code = ?
            AND EXISTS (
              SELECT 1
              FROM patients p
              WHERE p.hospital_code = surveys.hospital_code
                AND p.rm = surveys.patient_rm
                AND LOWER(TRIM(p.name)) = LOWER(TRIM(surveys.patient_name))
                AND p.specialty <> surveys.specialty
            )`,
    args: [hospitalCode],
  });

  const [patientsRs, surveysRs] = await Promise.all([
    client.execute({
      sql: "SELECT hospital_code, specialty, name, rm FROM patients WHERE hospital_code = ?",
      args: [hospitalCode],
    }),
    client.execute({
      sql: "SELECT id, hospital_code, specialty, patient_name, patient_rm FROM surveys WHERE hospital_code = ?",
      args: [hospitalCode],
    }),
  ]);
  const patients = patientsRs.rows.map((row: any) => ({
    specialty: String(row.specialty || ""),
    nameKey: normalizePatientNameKey(row.name),
    rmKey: normalizePatientCodeKey(row.rm),
  }));

  for (const survey of surveysRs.rows as any[]) {
    const surveyRmKey = normalizePatientCodeKey(survey.patient_rm);
    if (!surveyRmKey) continue;
    const surveyNameKey = normalizePatientNameKey(survey.patient_name);
    const sameCode = patients.filter((patient: any) => patient.rmKey === surveyRmKey);
    const sameCodeAndName = sameCode.filter((patient: any) => patient.nameKey && patient.nameKey === surveyNameKey);
    const candidates = surveyNameKey ? sameCodeAndName : sameCode;
    const uniqueSpecialties = Array.from(new Set(candidates.map((patient: any) => patient.specialty).filter(Boolean)));

    if (uniqueSpecialties.length === 1 && uniqueSpecialties[0] !== survey.specialty) {
      await client.execute({
        sql: "UPDATE surveys SET specialty = ? WHERE id = ?",
        args: [uniqueSpecialties[0], survey.id],
      });
    }
  }
}

async function restoreSurveyRowsFromBackups(client: any, hospitalCode: string) {
  if (!hospitalCode) return;
  const now = Date.now();
  const lastChecked = surveyBackupRestoreCheckedAt.get(hospitalCode) || 0;
  if (now - lastChecked < 60_000) return;

  const backups = await client.execute({
    sql: `SELECT hospital_code, specialty, patient_name, patient_rm, payload, created_at
          FROM survey_backups
          WHERE hospital_code = ?
          ORDER BY created_at ASC`,
    args: [hospitalCode],
  });
  const latestByPatient = new Map<string, any>();

  for (const backup of backups.rows as any[]) {
    const payload = parseJson(backup.payload, {});
    const survey = payload?.response || payload;
    const patientRm = survey?.medicalRecordNumber || survey?.qRm || backup.patient_rm || "";
    const patientName = survey?.patientName || survey?.qName || backup.patient_name || "";
    const patientToken = getSurveyToken(survey) || String((backup as any).patient_token || "");
    const answers = survey?.answers || {};
    if (!patientRm || Object.keys(answers).length === 0) continue;

    const patient = await resolveRegisteredSurveyPatient(client, {
      hospitalCode,
      specialty: backup.specialty,
      patientRm,
      patientName,
      patientToken,
    });
    if (!patient || patient.hospitalCode !== hospitalCode) continue;
    const key = `${patient.id || patient.specialty}::${normalizePatientCodeKey(patient.rm || patientRm)}`;
    latestByPatient.set(key, {
      patientId: patient.id,
      patientToken: patient.surveyToken,
      specialty: patient.specialty,
      patientName: patient.name || patientName,
      patientRm: patient.rm || patientRm,
      premScore: survey?.premScore ?? 0,
      promScore: survey?.promScore ?? 0,
      overallScore: survey?.overallScore ?? 0,
      answers,
    });
  }

  for (const item of latestByPatient.values()) {
    let exists = await client.execute({
      sql: "SELECT id FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_id = ? AND patient_id != '' LIMIT 1",
      args: [hospitalCode, item.specialty, item.patientId],
    });
    if (exists.rows.length === 0) {
      exists = await client.execute({
        sql: "SELECT id FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ? AND LOWER(TRIM(patient_name)) = LOWER(TRIM(?)) AND (patient_id IS NULL OR patient_id = '') LIMIT 1",
        args: [hospitalCode, item.specialty, item.patientRm, item.patientName],
      });
    }
    if (exists.rows.length > 0) continue;

    await client.execute({
      sql: `INSERT INTO surveys (id, hospital_code, specialty, patient_id, patient_token, patient_name, patient_rm, prem_score, prom_score, overall_score, answers)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        randomId(),
        hospitalCode,
        item.specialty,
        item.patientId,
        item.patientToken,
        item.patientName,
        item.patientRm,
        item.premScore,
        item.promScore,
        item.overallScore,
        JSON.stringify(item.answers || {}),
      ],
    });
  }
  surveyBackupRestoreCheckedAt.set(hospitalCode, now);
}

async function getSurveys({ hospitalCode, specialty, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  await reconcileSurveySpecialties(client, effectiveCode);
  await restoreSurveyRowsFromBackups(client, effectiveCode);
  await reconcileSurveySpecialties(client, effectiveCode);
  const { idCol: pIdCol, hCol, sCol, nameCol, rmCol, tokenCol } = await getPatientTableSchema(client);
  const rs = await client.execute({
    sql: `SELECT s.*
          FROM surveys s
          WHERE s.hospital_code = ?
            AND s.specialty = ?
            AND EXISTS (
              SELECT 1
              FROM patients p
              WHERE p.${hCol} = s.hospital_code
                AND p.${sCol} = s.specialty
                AND (
                  (s.patient_id IS NOT NULL AND s.patient_id != '' AND p.${pIdCol} = s.patient_id)
                  OR (s.patient_token IS NOT NULL AND s.patient_token != '' AND p.${tokenCol} = s.patient_token)
                  OR (p.${rmCol} = s.patient_rm AND LOWER(TRIM(p.${nameCol})) = LOWER(TRIM(s.patient_name)))
                )
            )
          ORDER BY s.created_at DESC`,
    args: [effectiveCode, specialty],
  });
  return rs.rows.map(mapSurveyRow);
}

async function getSurveyByPatient({ hospitalCode, specialty, patientRm, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  await reconcileSurveySpecialties(client, effectiveCode);
  await restoreSurveyRowsFromBackups(client, effectiveCode);
  await reconcileSurveySpecialties(client, effectiveCode);
  const { idCol: pIdCol, hCol, sCol, nameCol, rmCol, tokenCol } = await getPatientTableSchema(client);
  const rs = await client.execute({
    sql: `SELECT s.*
          FROM surveys s
          WHERE s.hospital_code = ?
            AND s.specialty = ?
            AND s.patient_rm = ?
            AND EXISTS (
              SELECT 1
              FROM patients p
              WHERE p.${hCol} = s.hospital_code
                AND p.${sCol} = s.specialty
                AND (
                  (s.patient_id IS NOT NULL AND s.patient_id != '' AND p.${pIdCol} = s.patient_id)
                  OR (s.patient_token IS NOT NULL AND s.patient_token != '' AND p.${tokenCol} = s.patient_token)
                  OR (p.${rmCol} = s.patient_rm AND LOWER(TRIM(p.${nameCol})) = LOWER(TRIM(s.patient_name)))
                )
            )
          LIMIT 1`,
    args: [effectiveCode, specialty, patientRm],
  });
  const r: any = rs.rows[0];
  if (!r) return null;
  return mapSurveyRow(r);
}

async function resetSurveys({ hospitalCode, specialty, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  await client.execute({
    sql: "DELETE FROM surveys WHERE hospital_code = ? AND specialty = ?",
    args: [effectiveCode, specialty],
  });
}

async function registerPatient({ hospitalCode, specialty, patient, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const id = randomId();
  const info = await client.execute("PRAGMA table_info(patients)");
  const existingCols = info.rows.map((r: any) => r.name);
  const hCols = existingCols.filter((c: string) => ["hospital_code", "hospitalcode"].includes(c.toLowerCase()));
  const nCols = existingCols.filter((c: string) => ["name", "patient_name", "patientname"].includes(c.toLowerCase()));
  const rCols = existingCols.filter((c: string) => ["rm", "patient_rm", "patientrm", "medical_record_number", "medicalrecordnumber"].includes(c.toLowerCase()));
  const sCols = existingCols.filter((c: string) => ["specialty", "specialty_name", "specialtyname"].includes(c.toLowerCase()));
  const tokenCols = existingCols.filter((c: string) => ["survey_token", "surveytoken", "patient_token", "patienttoken"].includes(c.toLowerCase()));

  if (hCols.length === 0 || nCols.length === 0 || rCols.length === 0 || sCols.length === 0) {
    return { success: false, error: "Schema tabel pasien belum lengkap. Muat ulang halaman admin untuk menjalankan migrasi tabel." };
  }

  const hColForSelect = hCols[0];
  const rmColForSelect = rCols[0];
  const sColForSelect = sCols[0];
  const existing = await client.execute({
    sql: `SELECT id FROM patients WHERE ${hColForSelect} = ? AND ${sColForSelect} = ? AND ${rmColForSelect} = ?`,
    args: [effectiveCode, specialty, patient.rm || ""],
  });
  if (existing.rows.length > 0) return { success: false, duplicate: true };

  const columns = ["id", ...hCols, ...nCols, ...rCols, ...sCols];
  const args: any[] = [id];
  hCols.forEach(() => args.push(effectiveCode));
  nCols.forEach(() => args.push(patient.name));
  rCols.forEach(() => args.push(patient.rm || ""));
  sCols.forEach(() => args.push(specialty));
  const surveyToken = randomId();
  tokenCols.forEach(() => args.push(surveyToken));
  columns.push(...tokenCols);
  if (existingCols.includes("created_at")) { columns.push("created_at"); args.push(new Date().toISOString()); }

  await client.execute({
    sql: `INSERT INTO patients (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    args,
  });
  return { success: true, patient: { id, name: patient.name, rm: patient.rm, surveyToken } };
}

async function getPatients({ hospitalCode, specialty, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  await reconcileSurveySpecialties(client, effectiveCode);
  const info = await client.execute("PRAGMA table_info(patients)");
  const cols = info.rows.map((r: any) => r.name);
  const hCol = cols.find((c: string) => ["hospital_code", "hospitalcode"].includes(c.toLowerCase())) || "hospital_code";
  const sCol = cols.find((c: string) => ["specialty", "specialtyname"].includes(c.toLowerCase())) || "specialty";
  const nameCol = cols.find((c: string) => ["name", "patient_name"].includes(c.toLowerCase())) || "name";
  const rmCol = cols.find((c: string) => ["rm", "patient_rm"].includes(c.toLowerCase())) || "rm";
  const idCol = cols.find((c: string) => c.toLowerCase() === "id") || "id";
  const tokenCol = cols.find((c: string) => ["survey_token", "surveytoken", "patient_token", "patienttoken"].includes(c.toLowerCase())) || "survey_token";
  const orderCol = cols.includes("created_at") ? "created_at" : "id";

  const rs = await client.execute({
    sql: `SELECT ${idCol} as id, ${nameCol} as name, ${rmCol} as rm, ${sCol} as specialty, ${tokenCol} as surveyToken FROM patients WHERE ${hCol} = ? AND ${sCol} = ? ORDER BY ${orderCol} DESC`,
    args: [effectiveCode, specialty],
  });
  return rs.rows.map((r: any) => ({
    diseaseIndex: Number(String(r.specialty || "").match(/-d(\d+)$/)?.[1] ?? 0),
    diseaseKey: r.specialty,
    id: r.id || `temp-${Math.random()}`,
    name: r.name,
    rm: r.rm,
    specialty: r.specialty,
    surveyToken: r.surveyToken,
  }));
}

async function resolvePatientSurveyDisease({ hospitalCode, specialty, patientName, patientRm, patientToken }: any) {
  await initTursoTables();
  const client = db();
  const patient = await resolveRegisteredSurveyPatient(client, {
    hospitalCode,
    specialty,
    patientName,
    patientRm,
    patientToken,
  });
  if (patient) {
    const diseaseIndex = Number(String(patient.specialty).match(/-d(\d+)$/)?.[1] ?? 0);
    return {
      found: true,
      diseaseIndex,
      diseaseKey: patient.specialty,
    };
  }
  const info = await client.execute("PRAGMA table_info(patients)");
  const cols = info.rows.map((r: any) => r.name);
  const hCol = cols.find((c: string) => ["hospital_code", "hospitalcode"].includes(c.toLowerCase())) || "hospital_code";
  const sCol = cols.find((c: string) => ["specialty", "specialtyname"].includes(c.toLowerCase())) || "specialty";
  const nameCol = cols.find((c: string) => ["name", "patient_name"].includes(c.toLowerCase())) || "name";
  const rmCol = cols.find((c: string) => ["rm", "patient_rm"].includes(c.toLowerCase())) || "rm";
  const specialtyPrefix = specialty ? `${String(specialty)}-d` : "";

  const rs = await client.execute({
    sql: `SELECT ${nameCol} as name, ${rmCol} as rm, ${sCol} as specialty
          FROM patients
          WHERE ${hCol} = ? ${specialtyPrefix ? `AND ${sCol} LIKE ?` : ""}`,
    args: specialtyPrefix ? [hospitalCode, `${specialtyPrefix}%`] : [hospitalCode],
  });

  const requestedRmKey = normalizePatientCodeKey(patientRm);
  const requestedNameKey = normalizePatientNameKey(patientName);
  const candidates = rs.rows
    .map((row: any) => ({
      name: String(row.name || ""),
      rm: String(row.rm || ""),
      specialty: String(row.specialty || ""),
      rmKey: normalizePatientCodeKey(row.rm),
      nameKey: normalizePatientNameKey(row.name),
    }))
    .filter((row: any) => row.rmKey && row.rmKey === requestedRmKey);
  const nameMatches = candidates.filter((row: any) => row.nameKey && row.nameKey === requestedNameKey);
  const resolvedCandidates = requestedNameKey ? nameMatches : candidates;
  const uniqueSpecialties = Array.from(new Set(resolvedCandidates.map((row: any) => row.specialty).filter(Boolean)));

  if (uniqueSpecialties.length !== 1) return { found: false };
  const diseaseIndex = Number(String(uniqueSpecialties[0]).match(/-d(\d+)$/)?.[1] ?? 0);
  return {
    found: true,
    diseaseIndex,
    diseaseKey: uniqueSpecialties[0],
  };
}

async function saveCustomSurveyMetadata({ hospitalCode, specialtyKey, data, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const draftId = `custom-survey-${effectiveCode}-${specialtyKey}`;
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol } = await getDraftSchema(client);
  const existing = await client.execute({ sql: `SELECT ${idCol} FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  const dataJson = JSON.stringify({ ...(data || {}), hospitalCode: effectiveCode });
  if (existing.rows.length > 0) {
    await client.execute({ sql: `UPDATE drafts SET ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP WHERE ${idCol} = ?`, args: [dataJson, draftId] });
  } else {
    await client.execute({ sql: `INSERT INTO drafts (${idCol}, ${typeCol}, ${hCol}, ${sCol}, ${dataCol}) VALUES (?, ?, ?, ?, ?)`, args: [draftId, "custom-survey", effectiveCode, specialtyKey, dataJson] });
  }
}

async function saveCustomSurveyPdfChunk({ hospitalCode, specialtyKey, index, total, chunk, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const draftId = `custom-survey-pdf-${effectiveCode}-${specialtyKey}-${index}`;
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol } = await getDraftSchema(client);
  const existing = await client.execute({ sql: `SELECT ${idCol} FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  const dataJson = JSON.stringify({ index, total, chunk });
  if (existing.rows.length > 0) {
    await client.execute({ sql: `UPDATE drafts SET ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP WHERE ${idCol} = ?`, args: [dataJson, draftId] });
  } else {
    await client.execute({ sql: `INSERT INTO drafts (${idCol}, ${typeCol}, ${hCol}, ${sCol}, ${dataCol}) VALUES (?, ?, ?, ?, ?)`, args: [draftId, "custom-survey-pdf", effectiveCode, specialtyKey, dataJson] });
  }
}

async function getCustomSurveyMetadata({ hospitalCode, specialtyKey, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const { idCol, dataCol } = await getDraftSchema(client);
  const draftId = `custom-survey-${effectiveCode}-${specialtyKey}`;
  const rs = await client.execute({ sql: `SELECT ${dataCol} as data FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  if (!rs.rows[0]) return null;

  const metadata = parseJson((rs.rows[0] as any).data, null);
  if (!metadata?.pdfStoredInChunks || !metadata?.pdfChunkCount) return metadata;

  const chunks: string[] = [];
  for (let index = 0; index < metadata.pdfChunkCount; index++) {
    const chunkId = `custom-survey-pdf-${effectiveCode}-${specialtyKey}-${index}`;
    const chunkRs = await client.execute({ sql: `SELECT ${dataCol} as data FROM drafts WHERE ${idCol} = ?`, args: [chunkId] });
    const parsed = chunkRs.rows[0] ? parseJson((chunkRs.rows[0] as any).data, null) : null;
    chunks.push(parsed?.chunk || "");
  }
  return { ...metadata, base64: chunks.join("") };
}

async function deleteCustomSurveyMetadata({ hospitalCode, specialtyKey, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const { idCol } = await getDraftSchema(client);
  const draftId = `custom-survey-${effectiveCode}-${specialtyKey}`;
  const existing = await getCustomSurveyMetadata({ hospitalCode: effectiveCode, specialtyKey });
  await client.execute({ sql: `DELETE FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  if (existing?.pdfChunkCount) {
    for (let index = 0; index < existing.pdfChunkCount; index++) {
      const chunkId = `custom-survey-pdf-${effectiveCode}-${specialtyKey}-${index}`;
      await client.execute({ sql: `DELETE FROM drafts WHERE ${idCol} = ?`, args: [chunkId] });
    }
  }
}

async function removePatient({ hospitalCode, specialty, patientId, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const info = await client.execute("PRAGMA table_info(patients)");
  const existingCols = info.rows.map((r: any) => r.name);
  const hCol = existingCols.includes("hospital_code") ? "hospital_code" : existingCols.includes("hospitalCode") ? "hospitalCode" : "hospital_code";
  const sCol = existingCols.find((c: string) => ["specialty", "specialtyname"].includes(c.toLowerCase())) || "specialty";
  const rmCol = existingCols.find((c: string) => ["rm", "patient_rm", "patientrm", "medical_record_number", "medicalrecordnumber"].includes(c.toLowerCase())) || "rm";
  const nameCol = existingCols.find((c: string) => ["name", "patient_name", "patientname"].includes(c.toLowerCase())) || "name";
  const existing = await client.execute({
    sql: `SELECT ${sCol} as specialty, ${rmCol} as rm, ${nameCol} as name FROM patients WHERE id = ? AND ${hCol} = ? LIMIT 1`,
    args: [patientId, effectiveCode],
  });
  const patient: any = existing.rows[0];
  const patientSpecialty = patient?.specialty || specialty || "";
  const patientRm = patient?.rm || "";

  await client.execute({
    sql: `DELETE FROM patients WHERE id = ? AND ${hCol} = ?`,
    args: [patientId, effectiveCode],
  });

  if (patientRm) {
    await client.execute({
      sql: "DELETE FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ?",
      args: [effectiveCode, patientSpecialty, patientRm],
    });
    await client.execute({
      sql: "DELETE FROM survey_backups WHERE hospital_code = ? AND specialty = ? AND patient_rm = ?",
      args: [effectiveCode, patientSpecialty, patientRm],
    });
  }
  return { success: true };
}

async function getDraft({ type, hospitalCode, specialty, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const { idCol, dataCol, versionCol } = await getDraftSchema(client);
  const draftId = `${type}-${effectiveCode}-${specialty}`;
  const rs = await client.execute({ sql: `SELECT ${dataCol} as data, ${versionCol} as version FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  if (!rs.rows[0]) return null;
  const snapshot = parseJson((rs.rows[0] as any).data, null);
  return snapshot ? { ...snapshot, serverVersion: Number((rs.rows[0] as any).version || 0) } : null;
}

function mergeDraftPatch(existingDraft: any, patch: any, effectiveCode: string) {
  const base = existingDraft && typeof existingDraft === "object" ? existingDraft : {};
  const fields = patch?.fields && typeof patch.fields === "object" ? patch.fields : {};
  const merged = { ...base, ...fields, hospitalCode: effectiveCode };

  // Map fields are merged by key so a delayed request from another tab cannot
  // erase answers that were added after it was created.
  for (const field of ["formData", "patientMeta", "data", "summary"]) {
    const changes = patch?.maps?.[field];
    if (!changes || typeof changes !== "object") continue;
    const current = base[field] && typeof base[field] === "object" ? base[field] : {};
    const next = { ...current };
    Object.entries(changes).forEach(([key, value]) => {
      next[key] = value;
    });
    const removed = Array.isArray(patch?.deletes?.[field]) ? patch.deletes[field] : [];
    removed.forEach((key: string) => delete next[key]);
    merged[field] = next;
  }

  if (Array.isArray(patch?.registeredPatients)) {
    merged.registeredPatients = patch.registeredPatients;
  }

  return merged;
}

async function saveDraft({ type, hospitalCode, specialty, draft, patch, baseVersion, operationId, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol, versionCol, operationCol } = await getDraftSchema(client);
  const draftId = `${type}-${effectiveCode}-${specialty}`;

  return await withDraftWriteQueue(async () => {
    if (operationId) {
      const applied = await client.execute({
        sql: "SELECT operation_id FROM draft_sync_operations WHERE operation_id = ? AND draft_id = ? LIMIT 1",
        args: [String(operationId), draftId],
      });
      if (applied.rows.length > 0) {
        const current = await client.execute({ sql: `SELECT ${versionCol} as version FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
        return { accepted: true, duplicate: true, serverVersion: Number((current.rows[0] as any)?.version || 0) };
      }
    }

    const existing = await client.execute({
      sql: `SELECT ${idCol}, ${hCol} as hospitalCode, ${dataCol} as data, ${versionCol} as version, ${operationCol} as lastOperation FROM drafts WHERE ${idCol} = ?`,
      args: [draftId],
    });
    const existingDraft = existing.rows[0] ? parseJson((existing.rows[0] as any).data, {}) : {};
    const currentVersion = Number((existing.rows[0] as any)?.version || 0);

    if (operationId && String((existing.rows[0] as any)?.lastOperation || "") === String(operationId)) {
      return { accepted: true, duplicate: true, serverVersion: currentVersion };
    }

    // Full snapshots are kept for backwards compatibility, but a caller that
    // supplies a version must not overwrite newer server state with an older
    // snapshot. Delta patches can safely merge field-by-field instead.
    if (!patch && baseVersion !== undefined && Number(baseVersion) !== currentVersion) {
      return { accepted: false, conflict: true, serverVersion: currentVersion };
    }

    let normalizedDraft = patch
      ? mergeDraftPatch(existingDraft, patch, effectiveCode)
      : { ...(draft || {}), hospitalCode: effectiveCode };

    if (type === "patient-report") {
      // Keep the patient registry server-authoritative while merging the draft
      // summary. This prevents saving one disease from erasing another.
      const patientSchema = await getPatientTableSchema(client);
      const createdCol = patientSchema.cols.includes("created_at") ? "created_at" : patientSchema.idCol;
      const patientRows = await client.execute({
        sql: `SELECT ${patientSchema.idCol} as id, ${patientSchema.sCol} as specialty,
                     ${patientSchema.nameCol} as name, ${patientSchema.rmCol} as rm,
                     ${patientSchema.tokenCol} as surveyToken, ${createdCol} as registeredAt
              FROM patients
              WHERE ${patientSchema.hCol} = ?
                AND (${patientSchema.sCol} = ? OR ${patientSchema.sCol} LIKE ?)
              ORDER BY ${patientSchema.sCol}, ${createdCol}, ${patientSchema.idCol}`,
        args: [effectiveCode, specialty, `${specialty}-d%`],
      });
      const serverPatients = (patientRows.rows as any[]).map((row) => ({
        diseaseIndex: Number(String(row.specialty || "").match(/-d(\d+)$/)?.[1] ?? 0),
        diseaseKey: row.specialty,
        id: row.id,
        name: row.name,
        rm: row.rm,
        specialty: row.specialty,
        surveyToken: row.surveyToken || "",
        registeredAt: row.registeredAt || "",
      }));
      const incomingPatients = Array.isArray(normalizedDraft.registeredPatients)
        ? normalizedDraft.registeredPatients
        : [];
      const byPatient = new Map<string, any>();
      [...serverPatients, ...incomingPatients].forEach((patient: any) => {
        const key = `${patient.id || patient.rm || patient.name}|${patient.diseaseKey || patient.specialty || ""}`;
        if (!byPatient.has(key)) byPatient.set(key, patient);
      });
      normalizedDraft = { ...normalizedDraft, registeredPatients: Array.from(byPatient.values()) };
    }

    const incomingAnswers = type === "clinical-audit" && normalizedDraft.formData && typeof normalizedDraft.formData === "object"
      ? Object.keys(normalizedDraft.formData)
      : [];
    const existingAnswers = type === "clinical-audit" && existingDraft.formData && typeof existingDraft.formData === "object"
      ? Object.keys(existingDraft.formData)
      : [];

    // A stale tab can autosave its initial empty state after another device
    // has already entered the audit. Never let that empty response erase a
    // non-empty server draft; the next real answer save can still update it.
    if (type === "clinical-audit" && existingAnswers.length > 0 && incomingAnswers.length === 0) {
      if (operationId) {
        await client.execute({
          sql: "INSERT OR IGNORE INTO draft_sync_operations (operation_id, draft_id) VALUES (?, ?)",
          args: [String(operationId), draftId],
        });
      }
      return { accepted: true, preserved: true, serverVersion: currentVersion };
    }

    const dataJson = JSON.stringify(normalizedDraft);
    let shouldNormalizeOwnership = false;
    if (existing.rows.length > 0) {
      const row = existing.rows[0] as any;
      const hospitalChanged = String(row.hospitalCode || "") !== effectiveCode;
      if (!hospitalChanged && String(row.data || "") === dataJson) {
        if (operationId) {
          await client.execute({
            sql: "INSERT OR IGNORE INTO draft_sync_operations (operation_id, draft_id) VALUES (?, ?)",
            args: [String(operationId), draftId],
          });
        }
        return { accepted: true, unchanged: true, serverVersion: currentVersion };
      }
      await client.execute({
        sql: `UPDATE drafts SET ${hCol} = ?, ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP, ${versionCol} = ?, ${operationCol} = ? WHERE ${idCol} = ?`,
        args: [effectiveCode, dataJson, currentVersion + 1, operationId || "", draftId],
      });
      shouldNormalizeOwnership = hospitalChanged;
    } else {
      await client.execute({
        sql: `INSERT INTO drafts (${idCol}, ${typeCol}, ${hCol}, ${sCol}, ${dataCol}, ${versionCol}, ${operationCol}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [draftId, type, effectiveCode, specialty, dataJson, 1, operationId || ""],
      });
      shouldNormalizeOwnership = true;
    }
    if (operationId) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO draft_sync_operations (operation_id, draft_id) VALUES (?, ?)",
        args: [String(operationId), draftId],
      });
    }
    if (shouldNormalizeOwnership) await normalizeDraftOwnership(client, draftId);
    return { accepted: true, serverVersion: existing.rows.length > 0 ? currentVersion + 1 : 1 };
  });
}

async function deleteDraft({ type, hospitalCode, specialty, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail });
  const { idCol } = await getDraftSchema(client);
  const draftId = `${type}-${effectiveCode}-${specialty}`;
  await client.execute({ sql: `DELETE FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
}

async function saveHospitalDraft({ draft, _hospitalEmail, _hospitalCode, _authRole }: any) {
  await initTursoTables();
  const client = db();
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol } = await getDraftSchema(client);
  const draftId = draft.draftId;
  const authoritativeEmail = String(_hospitalEmail || draft.hospitalEmail || "").trim().toLowerCase();
  const authenticatedHospital = _hospitalEmail
    ? await getHospitalIdentityForEmail(client, _hospitalEmail)
    : null;
  if (
    authenticatedHospital?.hospitalName &&
    draft.hospitalName &&
    normalizeHospitalNameKey(authenticatedHospital.hospitalName) !== normalizeHospitalNameKey(draft.hospitalName)
  ) {
    // A stale browser once re-owned drafts from other hospitals by submitting
    // them with the current session email. Reject the payload before any row is
    // inserted or updated; authenticated account identity is authoritative.
    throw createHttpError("Draft rumah sakit tidak sesuai dengan akun yang sedang login.", 403);
  }
  const effectiveCode = await resolveEffectiveHospitalCode(client, {
    hospitalCode: draft.hospitalCode,
    _hospitalCode,
    _hospitalEmail: authoritativeEmail,
  });
  const normalizedDraft = {
    ...draft,
    hospitalCode: effectiveCode || draft.hospitalCode,
    // Authenticated hospital sessions are authoritative. Stale localStorage can
    // carry another RS email; never let that payload re-own a server draft.
    hospitalEmail: authoritativeEmail || draft.hospitalEmail,
    hospitalName: authenticatedHospital?.hospitalName || draft.hospitalName,
  };
  const hospitalKey = effectiveCode || normalizedDraft.hospitalCode || normalizedDraft.hospitalEmail || normalizedDraft.hospitalName;
  const dataJson = JSON.stringify(normalizedDraft);
  await withDraftWriteQueue(async () => {
    const existing = await client.execute({ sql: `SELECT ${idCol}, ${typeCol} as type, ${hCol} as hospitalCode, ${dataCol} as data FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
    let shouldNormalizeOwnership = false;
    if (existing.rows.length > 0) {
      const row = existing.rows[0] as any;
      if (row.type === "hospital-assessment-deleted" && _authRole !== "admin") {
        throw createHttpError("Draft ini telah dihapus dan tidak dapat dipulihkan dari cache lama.", 409);
      }
      const hospitalChanged = String(row.hospitalCode || "") !== hospitalKey;
      if (!hospitalChanged && String(row.data || "") === dataJson) return;
      await client.execute({
        sql: `UPDATE drafts SET ${typeCol} = 'hospital-assessment', ${hCol} = ?, ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP WHERE ${idCol} = ?`,
        args: [hospitalKey, dataJson, draftId],
      });
      shouldNormalizeOwnership = hospitalChanged;
    } else {
      await client.execute({
        sql: `INSERT INTO drafts (${idCol}, ${typeCol}, ${hCol}, ${sCol}, ${dataCol}) VALUES (?, ?, ?, ?, ?)`,
        args: [draftId, "hospital-assessment", hospitalKey, "Multiple", dataJson],
      });
      shouldNormalizeOwnership = true;
    }
    if (shouldNormalizeOwnership) await normalizeDraftOwnership(client, draftId);
  });
}

async function getAllHospitalDrafts({ _hospitalEmail, _hospitalCode, _authRole }: any = {}) {
  await initTursoTables();
  const client = db();
  const { typeCol, hCol, dataCol, updatedCol } = await getDraftSchema(client);
  const isHospital = _authRole === "hospital" || Boolean(_hospitalEmail);
  const effectiveCode = isHospital
    ? await resolveEffectiveHospitalCode(client, { _hospitalEmail, _hospitalCode })
    : "";
  const shouldScopeToHospital = isHospital && Boolean(effectiveCode);
  const authenticatedHospital = shouldScopeToHospital && _hospitalEmail
    ? await getHospitalIdentityForEmail(client, _hospitalEmail)
    : null;
  const rs = shouldScopeToHospital
    ? await client.execute({
        sql: `SELECT ${dataCol} as data FROM drafts WHERE ${typeCol} = 'hospital-assessment' AND ${hCol} = ? ORDER BY ${updatedCol} DESC`,
        args: [effectiveCode],
      })
    : await client.execute(`SELECT ${dataCol} as data FROM drafts WHERE ${typeCol} = 'hospital-assessment' ORDER BY ${updatedCol} DESC`);
  return rs.rows
    .map((r: any) => parseJson(r.data, null))
    .filter(Boolean)
    .filter((draft: any) => {
      if (!authenticatedHospital?.hospitalName || !draft.hospitalName) return true;
      return normalizeHospitalNameKey(draft.hospitalName) === normalizeHospitalNameKey(authenticatedHospital.hospitalName);
    });
}

async function getHospitalModuleDrafts({ hospitalCode, _hospitalEmail, _hospitalCode }: any) {
  await initTursoTables();
  const client = db();
  const effectiveCode = await resolveEffectiveHospitalCode(client, { hospitalCode, _hospitalEmail, _hospitalCode });
  if (!effectiveCode) return [];
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol } = await getDraftSchema(client);
  const rs = await client.execute({
    sql: `SELECT ${idCol} as id, ${typeCol} as type, ${hCol} as hospitalCode, ${sCol} as specialty, ${dataCol} as data, ${updatedCol} as updatedAt
          FROM drafts
          WHERE ${hCol} = ?
            AND ${typeCol} IN ('rsbk', 'clinical-audit', 'patient-report')
          ORDER BY ${updatedCol} DESC`,
    args: [effectiveCode],
  });
  return rs.rows.map((r: any) => ({
    id: r.id,
    type: r.type,
    hospitalCode: r.hospitalCode,
    specialty: r.specialty,
    data: parseJson(r.data, null),
    updatedAt: r.updatedAt,
  })).filter((draft: any) => {
    if (!draft.data) return false;
    // Legacy ownership corruption can leave another hospital's draft row with
    // this hospital_code. The canonical ID is the authoritative ownership key;
    // never hydrate a module whose ID does not match the authenticated RS.
    const canonicalId = `${draft.type}-${effectiveCode}-${draft.specialty}`;
    return draft.id === canonicalId;
  });
}

async function deleteHospitalDraft({ draftId, _hospitalEmail, _authRole }: any) {
  await initTursoTables();
  const client = db();
  const { idCol, typeCol, hCol, dataCol, updatedCol } = await getDraftSchema(client);
  const existing = await client.execute({
    sql: `SELECT ${hCol} as hospitalCode, ${dataCol} as data FROM drafts WHERE ${idCol} = ? LIMIT 1`,
    args: [draftId],
  });
  const row = existing.rows[0] as any;
  if (!row) return;

  if (_authRole !== "admin") {
    if (!_hospitalEmail) throw createHttpError("Unauthorized", 401);
    const effectiveCode = await resolveEffectiveHospitalCode(client, { _hospitalEmail });
    if (String(row.hospitalCode || "") !== effectiveCode) {
      throw createHttpError("Draft bukan milik rumah sakit yang sedang login.", 403);
    }
    const authenticatedHospital = await getHospitalIdentityForEmail(client, _hospitalEmail);
    const draft = parseJson(row.data, null);
    if (
      authenticatedHospital?.hospitalName &&
      draft?.hospitalName &&
      normalizeHospitalNameKey(authenticatedHospital.hospitalName) !== normalizeHospitalNameKey(draft.hospitalName)
    ) {
      throw createHttpError("Draft bukan milik rumah sakit yang sedang login.", 403);
    }
  }

  const tombstone = JSON.stringify({ draftId, deletedAt: new Date().toISOString() });
  await client.execute({
    sql: `UPDATE drafts SET ${typeCol} = 'hospital-assessment-deleted', ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP WHERE ${idCol} = ?`,
    args: [tombstone, draftId],
  });
}

async function bulkAddSurveys({ hospitalCode, specialty, surveys }: any) {
  for (const survey of surveys || []) {
    await submitSurvey({ hospitalCode, specialty, survey });
  }
}

const operations: Record<string, (payload: any) => Promise<any>> = {
  initTursoTables,
  addHospitalAccount,
  loginHospital,
  loginAdmin,
  getAllHospitalAccounts,
  getHospitalSuratTugas,
  updateAccountStatus,
  deleteHospitalAccount,
  resetHospitalPassword,
  addSubmission,
  getAllSubmissions,
  softDeleteSubmission,
  restoreSubmission,
  getDeletedSubmissions,
  updateSubmissionStatus,
  updateSubmissionReview,
  publishRankingToDb,
  unpublishRankingFromDb,
  getAllRankingsFromDb,
  addNewsToDb,
  updateNewsInDb,
  deleteNewsFromDb,
  getAllNews,
  addEventToDb,
  updateEventInDb,
  deleteEventFromDb,
  getAllEvents,
  saveSurveyBackup,
  getSurveyBackups,
  submitSurvey,
  getSurveys,
  getSurveyByPatient,
  resetSurveys,
  registerPatient,
  getPatients,
  resolvePatientSurveyDisease,
  saveCustomSurveyMetadata,
  saveCustomSurveyPdfChunk,
  getCustomSurveyMetadata,
  deleteCustomSurveyMetadata,
  removePatient,
  getDraft,
  saveDraft,
  deleteDraft,
  saveHospitalDraft,
  getAllHospitalDrafts,
  getHospitalModuleDrafts,
  deleteHospitalDraft,
  bulkAddSurveys,
};

export async function handleTursoOperation(operation: string, payload: any) {
  const handler = operations[operation];
  if (!handler) throw new Error(`Unknown Turso operation: ${operation}`);
  return handler(payload || {});
}
