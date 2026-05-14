import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

let tablesInitialized = false;

function db() {
  const url = process.env.TURSO_DATABASE_URL || "";
  const authToken = process.env.TURSO_AUTH_TOKEN || "";
  if (!url) throw new Error("TURSO_DATABASE_URL is not configured");
  return createClient({ url, authToken });
}

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseJson(value: unknown, fallback: any) {
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || "nhr-persi-session-secret";
}

function signToken(payload: object): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

function hospitalCodeFromEmail(email: string): string {
  if (!email) return "UNKNOWN";
  const local = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return local.substring(0, 12) || "RS001";
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

  return { idCol, typeCol, dataCol, hCol, sCol, updatedCol };
}

async function initTursoTables() {
  if (tablesInitialized) return;
  const client = db();

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
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      hospital_code TEXT NOT NULL,
      specialty TEXT NOT NULL,
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  const tablesToMigrate = ["surveys", "patients", "drafts", "submissions", "hospital_accounts", "rankings"];

  // Migrate news table columns (added after initial schema)
  const newsInfo = await client.execute("PRAGMA table_info(news)");
  const newsCols = newsInfo.rows.map((r: any) => r.name);
  if (!newsCols.includes("published_at")) await client.execute("ALTER TABLE news ADD COLUMN published_at TEXT");
  if (!newsCols.includes("author")) await client.execute("ALTER TABLE news ADD COLUMN author TEXT");
  if (!newsCols.includes("featured")) await client.execute("ALTER TABLE news ADD COLUMN featured BOOLEAN");

  const eventsInfo = await client.execute("PRAGMA table_info(events)");
  const eventsCols = eventsInfo.rows.map((r: any) => r.name);
  if (!eventsCols.includes("links")) await client.execute("ALTER TABLE events ADD COLUMN links TEXT DEFAULT '[]'");
  for (const table of tablesToMigrate) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    const existingColumns = info.rows.map((r: any) => r.name);

    if (table === "surveys") {
      if (!existingColumns.includes("hospital_code")) await client.execute("ALTER TABLE surveys ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.includes("patient_name")) await client.execute("ALTER TABLE surveys ADD COLUMN patient_name TEXT DEFAULT ''");
      if (!existingColumns.includes("patient_rm")) await client.execute("ALTER TABLE surveys ADD COLUMN patient_rm TEXT DEFAULT ''");
      if (!existingColumns.includes("prem_score")) await client.execute("ALTER TABLE surveys ADD COLUMN prem_score REAL DEFAULT 0");
      if (!existingColumns.includes("prom_score")) await client.execute("ALTER TABLE surveys ADD COLUMN prom_score REAL DEFAULT 0");
      if (!existingColumns.includes("overall_score")) await client.execute("ALTER TABLE surveys ADD COLUMN overall_score REAL DEFAULT 0");
      if (!existingColumns.includes("answers")) await client.execute("ALTER TABLE surveys ADD COLUMN answers TEXT DEFAULT '{}'");
    }

    if (table === "patients") {
      if (!existingColumns.includes("hospital_code") && !existingColumns.includes("hospitalCode")) {
        await client.execute("ALTER TABLE patients ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      }
      if (!existingColumns.includes("specialty")) await client.execute("ALTER TABLE patients ADD COLUMN specialty TEXT NOT NULL DEFAULT ''");
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

  tablesInitialized = true;
}

async function addHospitalAccount({ acc }: any) {
  await initTursoTables();
  const passwordHash = await bcrypt.hash(acc.password, 10);
  await db().execute({
    sql: `INSERT INTO hospital_accounts (email, password, password_hash, hospital_name, pic_name, province, city, status, surat_tugas_filename, surat_tugas_data, registered_at)
          VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      acc.email,
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
  const rs = await db().execute({
    sql: "SELECT email, password, password_hash, hospital_name, pic_name, province, city, status FROM hospital_accounts WHERE LOWER(email) = LOWER(?)",
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
    hospitalName: row.hospital_name,
    picName: row.pic_name,
    province: row.province || "",
    city: row.city || "",
    status: "activated" as const,
  };

  const token = signToken({ email: row.email, role: "hospital" });
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
    "SELECT email, hospital_name, pic_name, province, city, status, surat_tugas_filename, registered_at FROM hospital_accounts ORDER BY registered_at DESC"
  );
  return rs.rows.map((r: any) => ({
    email: r.email,
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

async function addSubmission({ submission, _hospitalEmail }: any) {
  await initTursoTables();
  const client = db();
  const hospitalCode = _hospitalEmail
    ? hospitalCodeFromEmail(_hospitalEmail)
    : (submission.hospitalCode || submission.details?.hospitalCode || "");
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
    sql: `INSERT INTO news (id, title, excerpt, content, category, image_url, author, published_at, featured)
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

async function submitSurvey({ hospitalCode, specialty, survey, _hospitalEmail }: any) {
  await initTursoTables();
  const effectiveCode = _hospitalEmail ? hospitalCodeFromEmail(_hospitalEmail) : hospitalCode;
  const client = db();
  const patientRm = survey.medicalRecordNumber || survey.qRm || "";
  const existing = await client.execute({
    sql: "SELECT id FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ?",
    args: [effectiveCode, specialty, patientRm],
  });
  if (existing.rows.length > 0) return { success: false, duplicate: true };

  const id = randomId();
  await client.execute({
    sql: `INSERT INTO surveys (id, hospital_code, specialty, patient_name, patient_rm, prem_score, prom_score, overall_score, answers)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, effectiveCode, specialty, survey.patientName || survey.qName || "", patientRm, survey.premScore ?? 0, survey.promScore ?? 0, survey.overallScore ?? 0, JSON.stringify(survey.answers || {})],
  });
  return { success: true, surveyId: id };
}

async function getSurveys({ hospitalCode, specialty }: any) {
  await initTursoTables();
  const rs = await db().execute({
    sql: "SELECT * FROM surveys WHERE hospital_code = ? AND specialty = ? ORDER BY created_at DESC",
    args: [hospitalCode, specialty],
  });
  return rs.rows.map((r: any) => ({
    id: r.id,
    patientName: r.patient_name,
    medicalRecordNumber: r.patient_rm,
    premScore: r.prem_score,
    promScore: r.prom_score,
    overallScore: r.overall_score,
    answers: parseJson(r.answers, {}),
    timestamp: r.created_at,
  }));
}

async function getSurveyByPatient({ hospitalCode, specialty, patientRm }: any) {
  await initTursoTables();
  const rs = await db().execute({
    sql: "SELECT * FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ? LIMIT 1",
    args: [hospitalCode, specialty, patientRm],
  });
  const r: any = rs.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    patientName: r.patient_name,
    medicalRecordNumber: r.patient_rm,
    premScore: r.prem_score,
    promScore: r.prom_score,
    overallScore: r.overall_score,
    answers: parseJson(r.answers, {}),
    submittedAt: r.created_at,
  };
}

async function resetSurveys({ hospitalCode, specialty }: any) {
  await initTursoTables();
  await db().execute({
    sql: "DELETE FROM surveys WHERE hospital_code = ? AND specialty = ?",
    args: [hospitalCode, specialty],
  });
}

async function registerPatient({ hospitalCode, specialty, patient, _hospitalEmail }: any) {
  await initTursoTables();
  const effectiveCode = _hospitalEmail ? hospitalCodeFromEmail(_hospitalEmail) : hospitalCode;
  const client = db();
  const id = randomId();
  const info = await client.execute("PRAGMA table_info(patients)");
  const existingCols = info.rows.map((r: any) => r.name);
  const hCols = existingCols.filter((c: string) => ["hospital_code", "hospitalcode"].includes(c.toLowerCase()));
  const nCols = existingCols.filter((c: string) => ["name", "patient_name", "patientname"].includes(c.toLowerCase()));
  const rCols = existingCols.filter((c: string) => ["rm", "patient_rm", "patientrm", "medical_record_number", "medicalrecordnumber"].includes(c.toLowerCase()));
  const sCols = existingCols.filter((c: string) => ["specialty", "specialty_name", "specialtyname"].includes(c.toLowerCase()));

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
  if (existingCols.includes("created_at")) { columns.push("created_at"); args.push(new Date().toISOString()); }

  await client.execute({
    sql: `INSERT INTO patients (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    args,
  });
  return { success: true, patient: { id, name: patient.name, rm: patient.rm } };
}

async function getPatients({ hospitalCode, specialty }: any) {
  await initTursoTables();
  const client = db();
  const info = await client.execute("PRAGMA table_info(patients)");
  const cols = info.rows.map((r: any) => r.name);
  const hCol = cols.find((c: string) => ["hospital_code", "hospitalcode"].includes(c.toLowerCase())) || "hospital_code";
  const sCol = cols.find((c: string) => ["specialty", "specialtyname"].includes(c.toLowerCase())) || "specialty";
  const nameCol = cols.find((c: string) => ["name", "patient_name"].includes(c.toLowerCase())) || "name";
  const rmCol = cols.find((c: string) => ["rm", "patient_rm"].includes(c.toLowerCase())) || "rm";
  const idCol = cols.find((c: string) => c.toLowerCase() === "id") || "id";
  const orderCol = cols.includes("created_at") ? "created_at" : "id";

  const rs = await client.execute({
    sql: `SELECT ${idCol} as id, ${nameCol} as name, ${rmCol} as rm, ${sCol} as specialty FROM patients WHERE ${hCol} = ? AND ${sCol} = ? ORDER BY ${orderCol} DESC`,
    args: [hospitalCode, specialty],
  });
  return rs.rows.map((r: any) => ({
    id: r.id || `temp-${Math.random()}`,
    name: r.name,
    rm: r.rm,
    specialty: r.specialty,
  }));
}

async function saveCustomSurveyMetadata({ hospitalCode, specialtyKey, data }: any) {
  await initTursoTables();
  const client = db();
  const draftId = `custom-survey-${hospitalCode}-${specialtyKey}`;
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol } = await getDraftSchema(client);
  const existing = await client.execute({ sql: `SELECT ${idCol} FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  const dataJson = JSON.stringify(data);
  if (existing.rows.length > 0) {
    await client.execute({ sql: `UPDATE drafts SET ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP WHERE ${idCol} = ?`, args: [dataJson, draftId] });
  } else {
    await client.execute({ sql: `INSERT INTO drafts (${idCol}, ${typeCol}, ${hCol}, ${sCol}, ${dataCol}) VALUES (?, ?, ?, ?, ?)`, args: [draftId, "custom-survey", hospitalCode, specialtyKey, dataJson] });
  }
}

async function saveCustomSurveyPdfChunk({ hospitalCode, specialtyKey, index, total, chunk }: any) {
  await initTursoTables();
  const client = db();
  const draftId = `custom-survey-pdf-${hospitalCode}-${specialtyKey}-${index}`;
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol } = await getDraftSchema(client);
  const existing = await client.execute({ sql: `SELECT ${idCol} FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  const dataJson = JSON.stringify({ index, total, chunk });
  if (existing.rows.length > 0) {
    await client.execute({ sql: `UPDATE drafts SET ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP WHERE ${idCol} = ?`, args: [dataJson, draftId] });
  } else {
    await client.execute({ sql: `INSERT INTO drafts (${idCol}, ${typeCol}, ${hCol}, ${sCol}, ${dataCol}) VALUES (?, ?, ?, ?, ?)`, args: [draftId, "custom-survey-pdf", hospitalCode, specialtyKey, dataJson] });
  }
}

async function getCustomSurveyMetadata({ hospitalCode, specialtyKey }: any) {
  await initTursoTables();
  const client = db();
  const { idCol, dataCol } = await getDraftSchema(client);
  const draftId = `custom-survey-${hospitalCode}-${specialtyKey}`;
  const rs = await client.execute({ sql: `SELECT ${dataCol} as data FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  if (!rs.rows[0]) return null;

  const metadata = parseJson((rs.rows[0] as any).data, null);
  if (!metadata?.pdfStoredInChunks || !metadata?.pdfChunkCount) return metadata;

  const chunks: string[] = [];
  for (let index = 0; index < metadata.pdfChunkCount; index++) {
    const chunkId = `custom-survey-pdf-${hospitalCode}-${specialtyKey}-${index}`;
    const chunkRs = await client.execute({ sql: `SELECT ${dataCol} as data FROM drafts WHERE ${idCol} = ?`, args: [chunkId] });
    const parsed = chunkRs.rows[0] ? parseJson((chunkRs.rows[0] as any).data, null) : null;
    chunks.push(parsed?.chunk || "");
  }
  return { ...metadata, base64: chunks.join("") };
}

async function deleteCustomSurveyMetadata({ hospitalCode, specialtyKey }: any) {
  await initTursoTables();
  const client = db();
  const { idCol } = await getDraftSchema(client);
  const draftId = `custom-survey-${hospitalCode}-${specialtyKey}`;
  const existing = await getCustomSurveyMetadata({ hospitalCode, specialtyKey });
  await client.execute({ sql: `DELETE FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  if (existing?.pdfChunkCount) {
    for (let index = 0; index < existing.pdfChunkCount; index++) {
      const chunkId = `custom-survey-pdf-${hospitalCode}-${specialtyKey}-${index}`;
      await client.execute({ sql: `DELETE FROM drafts WHERE ${idCol} = ?`, args: [chunkId] });
    }
  }
}

async function removePatient({ hospitalCode, patientId }: any) {
  await initTursoTables();
  const client = db();
  const info = await client.execute("PRAGMA table_info(patients)");
  const existingCols = info.rows.map((r: any) => r.name);
  const hCol = existingCols.includes("hospital_code") ? "hospital_code" : existingCols.includes("hospitalCode") ? "hospitalCode" : "hospital_code";
  await client.execute({
    sql: `DELETE FROM patients WHERE id = ? AND ${hCol} = ?`,
    args: [patientId, hospitalCode],
  });
}

async function getDraft({ type, hospitalCode, specialty }: any) {
  await initTursoTables();
  const client = db();
  const { idCol, dataCol } = await getDraftSchema(client);
  const draftId = `${type}-${hospitalCode}-${specialty}`;
  const rs = await client.execute({ sql: `SELECT ${dataCol} as data FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  return rs.rows[0] ? parseJson((rs.rows[0] as any).data, null) : null;
}

async function saveDraft({ type, hospitalCode, specialty, draft, _hospitalEmail }: any) {
  await initTursoTables();
  const effectiveCode = _hospitalEmail ? hospitalCodeFromEmail(_hospitalEmail) : hospitalCode;
  const client = db();
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol } = await getDraftSchema(client);
  const draftId = `${type}-${effectiveCode}-${specialty}`;
  const existing = await client.execute({ sql: `SELECT ${idCol} FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  if (existing.rows.length > 0) {
    await client.execute({ sql: `UPDATE drafts SET ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP WHERE ${idCol} = ?`, args: [JSON.stringify(draft), draftId] });
  } else {
    await client.execute({ sql: `INSERT INTO drafts (${idCol}, ${typeCol}, ${hCol}, ${sCol}, ${dataCol}) VALUES (?, ?, ?, ?, ?)`, args: [draftId, type, effectiveCode, specialty, JSON.stringify(draft)] });
  }
}

async function deleteDraft({ type, hospitalCode, specialty, _hospitalEmail }: any) {
  await initTursoTables();
  const effectiveCode = _hospitalEmail ? hospitalCodeFromEmail(_hospitalEmail) : hospitalCode;
  const client = db();
  const { idCol } = await getDraftSchema(client);
  const draftId = `${type}-${effectiveCode}-${specialty}`;
  await client.execute({ sql: `DELETE FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
}

async function saveHospitalDraft({ draft }: any) {
  await initTursoTables();
  const client = db();
  const { idCol, typeCol, hCol, sCol, dataCol, updatedCol } = await getDraftSchema(client);
  const draftId = draft.draftId;
  const existing = await client.execute({ sql: `SELECT ${idCol} FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
  if (existing.rows.length > 0) {
    await client.execute({ sql: `UPDATE drafts SET ${dataCol} = ?, ${updatedCol} = CURRENT_TIMESTAMP WHERE ${idCol} = ?`, args: [JSON.stringify(draft), draftId] });
  } else {
    await client.execute({ sql: `INSERT INTO drafts (${idCol}, ${typeCol}, ${hCol}, ${sCol}, ${dataCol}) VALUES (?, ?, ?, ?, ?)`, args: [draftId, "hospital-assessment", draft.hospitalName, "Multiple", JSON.stringify(draft)] });
  }
}

async function getAllHospitalDrafts() {
  await initTursoTables();
  const client = db();
  const { typeCol, dataCol, updatedCol } = await getDraftSchema(client);
  const rs = await client.execute(`SELECT ${dataCol} as data FROM drafts WHERE ${typeCol} = 'hospital-assessment' ORDER BY ${updatedCol} DESC`);
  return rs.rows.map((r: any) => parseJson(r.data, null)).filter(Boolean);
}

async function deleteHospitalDraft({ draftId }: any) {
  await initTursoTables();
  const client = db();
  const { idCol } = await getDraftSchema(client);
  await client.execute({ sql: `DELETE FROM drafts WHERE ${idCol} = ?`, args: [draftId] });
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
  submitSurvey,
  getSurveys,
  getSurveyByPatient,
  resetSurveys,
  registerPatient,
  getPatients,
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
  deleteHospitalDraft,
  bulkAddSurveys,
};

export async function handleTursoOperation(operation: string, payload: any) {
  const handler = operations[operation];
  if (!handler) throw new Error(`Unknown Turso operation: ${operation}`);
  return handler(payload || {});
}
