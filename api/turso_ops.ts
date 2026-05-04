import { createClient } from "@libsql/client";

let tablesInitialized = false;

function db() {
  const url = process.env.TURSO_DATABASE_URL || "";
  const authToken = process.env.TURSO_AUTH_TOKEN || "";

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({ url, authToken });
}

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseJson(value: unknown, fallback: any) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function initTursoTables() {
  if (tablesInitialized) return;
  const client = db();

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
      specialty TEXT NOT NULL,
      pic_name TEXT,
      submitted_date TEXT,
      status TEXT,
      scores TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS hospital_accounts (
      email TEXT PRIMARY KEY,
      password TEXT NOT NULL,
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
      submission_id TEXT
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
      featured BOOLEAN,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const tablesToMigrate = ["surveys", "patients", "drafts"];
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
      if (!existingColumns.includes("created_at")) await client.execute("ALTER TABLE patients ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
      if (!existingColumns.includes("id")) await client.execute("ALTER TABLE patients ADD COLUMN id TEXT");
      if (existingColumns.includes("hospitalCode") && !existingColumns.includes("hospital_code")) {
        await client.execute("ALTER TABLE patients ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      }
    }

    if (table === "drafts") {
      if (!existingColumns.includes("hospital_code")) await client.execute("ALTER TABLE drafts ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''");
      if (!existingColumns.includes("specialty")) await client.execute("ALTER TABLE drafts ADD COLUMN specialty TEXT NOT NULL DEFAULT ''");
    }
  }

  tablesInitialized = true;
}

async function addHospitalAccount({ acc }: any) {
  await initTursoTables();
  await db().execute({
    sql: `INSERT INTO hospital_accounts (email, password, hospital_name, pic_name, province, city, status, surat_tugas_filename, surat_tugas_data, registered_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      acc.email,
      acc.password,
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

async function getAllHospitalAccounts() {
  await initTursoTables();
  const rs = await db().execute("SELECT email, password, hospital_name, pic_name, province, city, status, surat_tugas_filename, registered_at FROM hospital_accounts ORDER BY registered_at DESC");
  return rs.rows.map((r: any) => ({
    email: r.email,
    password: r.password,
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

async function addSubmission({ submission }: any) {
  await initTursoTables();
  await db().execute({
    sql: `INSERT INTO submissions (id, hospital_name, specialty, pic_name, submitted_date, status, scores, details)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      submission.id,
      submission.hospitalName,
      submission.specialty,
      submission.picName,
      submission.submittedDate,
      submission.status,
      JSON.stringify(submission.scores),
      JSON.stringify(submission.details || {}),
    ],
  });
}

async function getAllSubmissions() {
  await initTursoTables();
  const rs = await db().execute("SELECT * FROM submissions ORDER BY created_at DESC");
  return rs.rows.map((r: any) => ({
    id: r.id,
    hospitalName: r.hospital_name,
    specialty: r.specialty,
    picName: r.pic_name,
    submittedDate: r.submitted_date,
    status: r.status,
    scores: parseJson(r.scores, {}),
    details: parseJson(r.details, {}),
  }));
}

async function updateSubmissionStatus({ id, status }: any) {
  await initTursoTables();
  await db().execute({
    sql: "UPDATE submissions SET status = ? WHERE id = ?",
    args: [status, id],
  });
}

async function updateSubmissionReview({ id, status, details }: any) {
  await initTursoTables();
  await db().execute({
    sql: "UPDATE submissions SET status = ?, details = ? WHERE id = ?",
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
              patient_report_score = ?, grade = ?, approved_at = ?
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
  const rs = await db().execute("SELECT * FROM rankings ORDER BY final_score DESC");
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
    sql: `INSERT INTO events (id, title, description, date, end_date, location, type, image_url, registration_url, featured)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [event.id, event.title, event.description, event.date, event.endDate || "", event.location, event.type, event.imageUrl, event.registrationUrl || "", event.featured ? 1 : 0],
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
    featured: r.featured === 1,
    createdAt: r.created_at,
  }));
}

async function submitSurvey({ hospitalCode, specialty, survey }: any) {
  await initTursoTables();
  const client = db();
  const patientRm = survey.medicalRecordNumber || survey.qRm || "";
  const existing = await client.execute({
    sql: "SELECT id FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ?",
    args: [hospitalCode, specialty, patientRm],
  });

  if (existing.rows.length > 0) {
    return { success: false, duplicate: true };
  }

  const id = randomId();
  await client.execute({
    sql: `INSERT INTO surveys (id, hospital_code, specialty, patient_name, patient_rm, prem_score, prom_score, overall_score, answers)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      hospitalCode,
      specialty,
      survey.patientName || survey.qName || "",
      patientRm,
      survey.premScore ?? 0,
      survey.promScore ?? 0,
      survey.overallScore ?? 0,
      JSON.stringify(survey.answers || {}),
    ],
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

async function registerPatient({ hospitalCode, specialty, patient }: any) {
  await initTursoTables();
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
    args: [hospitalCode, specialty, patient.rm || ""],
  });

  if (existing.rows.length > 0) {
    return { success: false, duplicate: true };
  }

  const columns = ["id", ...hCols, ...nCols, ...rCols, ...sCols];
  const args = [id];
  hCols.forEach(() => args.push(hospitalCode));
  nCols.forEach(() => args.push(patient.name));
  rCols.forEach(() => args.push(patient.rm || ""));
  sCols.forEach(() => args.push(specialty));
  if (existingCols.includes("created_at")) {
    columns.push("created_at");
    args.push(new Date().toISOString());
  }

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
  const info = await client.execute("PRAGMA table_info(drafts)");
  const cols = info.rows.map((r: any) => r.name);
  const hCol = cols.find((c: string) => ["hospitalcode", "hospital_code"].includes(c.toLowerCase())) || "hospital_code";
  const sCol = cols.find((c: string) => ["specialty", "specialty_name"].includes(c.toLowerCase())) || "specialty";

  await client.execute({
    sql: `INSERT INTO drafts (id, type, ${hCol}, ${sCol}, data)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
    args: [draftId, "custom-survey", hospitalCode, specialtyKey, JSON.stringify(data)],
  });
}

async function getCustomSurveyMetadata({ hospitalCode, specialtyKey }: any) {
  await initTursoTables();
  const draftId = `custom-survey-${hospitalCode}-${specialtyKey}`;
  const rs = await db().execute({ sql: "SELECT data FROM drafts WHERE id = ?", args: [draftId] });
  return rs.rows[0] ? parseJson((rs.rows[0] as any).data, null) : null;
}

async function deleteCustomSurveyMetadata({ hospitalCode, specialtyKey }: any) {
  await initTursoTables();
  const draftId = `custom-survey-${hospitalCode}-${specialtyKey}`;
  await db().execute({ sql: "DELETE FROM drafts WHERE id = ?", args: [draftId] });
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
  const draftId = `${type}-${hospitalCode}-${specialty}`;
  const rs = await db().execute({ sql: "SELECT data FROM drafts WHERE id = ?", args: [draftId] });
  return rs.rows[0] ? parseJson((rs.rows[0] as any).data, null) : null;
}

async function saveDraft({ type, hospitalCode, specialty, draft }: any) {
  await initTursoTables();
  const client = db();
  const draftId = `${type}-${hospitalCode}-${specialty}`;
  const existing = await client.execute({ sql: "SELECT id FROM drafts WHERE id = ?", args: [draftId] });
  if (existing.rows.length > 0) {
    await client.execute({ sql: "UPDATE drafts SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [JSON.stringify(draft), draftId] });
  } else {
    await client.execute({
      sql: "INSERT INTO drafts (id, type, hospital_code, specialty, data) VALUES (?, ?, ?, ?, ?)",
      args: [draftId, type, hospitalCode, specialty, JSON.stringify(draft)],
    });
  }
}

async function saveHospitalDraft({ draft }: any) {
  await initTursoTables();
  const client = db();
  const draftId = draft.draftId;
  const existing = await client.execute({ sql: "SELECT id FROM drafts WHERE id = ?", args: [draftId] });
  if (existing.rows.length > 0) {
    await client.execute({ sql: "UPDATE drafts SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [JSON.stringify(draft), draftId] });
  } else {
    await client.execute({
      sql: "INSERT INTO drafts (id, type, hospital_code, specialty, data) VALUES (?, ?, ?, ?, ?)",
      args: [draftId, "hospital-assessment", draft.hospitalName, "Multiple", JSON.stringify(draft)],
    });
  }
}

async function getAllHospitalDrafts() {
  await initTursoTables();
  const rs = await db().execute("SELECT data FROM drafts WHERE type = 'hospital-assessment' ORDER BY updated_at DESC");
  return rs.rows.map((r: any) => parseJson(r.data, null)).filter(Boolean);
}

async function deleteHospitalDraft({ draftId }: any) {
  await initTursoTables();
  await db().execute({ sql: "DELETE FROM drafts WHERE id = ?", args: [draftId] });
}

async function bulkAddSurveys({ hospitalCode, specialty, surveys }: any) {
  for (const survey of surveys || []) {
    await submitSurvey({ hospitalCode, specialty, survey });
  }
}

const operations: Record<string, (payload: any) => Promise<any>> = {
  initTursoTables,
  addHospitalAccount,
  getAllHospitalAccounts,
  getHospitalSuratTugas,
  updateAccountStatus,
  addSubmission,
  getAllSubmissions,
  updateSubmissionStatus,
  updateSubmissionReview,
  publishRankingToDb,
  unpublishRankingFromDb,
  getAllRankingsFromDb,
  addNewsToDb,
  deleteNewsFromDb,
  getAllNews,
  addEventToDb,
  deleteEventFromDb,
  getAllEvents,
  submitSurvey,
  getSurveys,
  getSurveyByPatient,
  resetSurveys,
  registerPatient,
  getPatients,
  saveCustomSurveyMetadata,
  getCustomSurveyMetadata,
  deleteCustomSurveyMetadata,
  removePatient,
  getDraft,
  saveDraft,
  saveHospitalDraft,
  getAllHospitalDrafts,
  deleteHospitalDraft,
  bulkAddSurveys,
};

export async function handleTursoOperation(operation: string, payload: any) {
  const handler = operations[operation];
  if (!handler) {
    throw new Error(`Unknown Turso operation: ${operation}`);
  }
  return handler(payload || {});
}
