import { createClient } from "@libsql/client/web";

// Hubungkan ke Turso langsung dari browser! (Aman untuk solusi sementara)
let tursoClient: any = null;

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const PREFIX = "/api";

function getTurso() {
  if (tursoClient) return tursoClient;
  
  const url = import.meta.env.VITE_TURSO_DATABASE_URL || "";
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN || "";
  
  // Jangan membuat client jika belum ada token (untuk mencegah crash di UI)
  if (!url) {
    console.warn("Turso URL belum di-set di Vercel Env Vars");
    return null;
  }
  
  try {
    tursoClient = createClient({ url, authToken });
    return tursoClient;
  } catch (err: any) {
    console.error("Turso Create Client Error:", err);
    return null;
  }
}

// Inisialisasi Tabel secara otomatis (hanya dari sisi Admin saat pertama kali memuat halaman)
let tablesInitialized = false;

export async function initTursoTables() {
  if (tablesInitialized) return;
  const db = getTurso();
  if (!db) return; // Silent return here, endpoints will handle null db

  try {
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

    await db.execute(
      `CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        hospital_name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        pic_name TEXT,
        submitted_date TEXT,
        status TEXT,
        scores TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await db.execute(
      `CREATE TABLE IF NOT EXISTS hospital_accounts (
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
      )`
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS rankings (
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
      )`
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS news (
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
      )`
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS events (
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
      )`
    );
    // Ensure columns exist for older tables
    try { await db.execute("ALTER TABLE surveys ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''"); } catch(e) {}
    try { await db.execute("ALTER TABLE surveys ADD COLUMN patient_name TEXT DEFAULT ''"); } catch(e) {}
    try { await db.execute("ALTER TABLE surveys ADD COLUMN patient_rm TEXT DEFAULT ''"); } catch(e) {}
    try { await db.execute("ALTER TABLE surveys ADD COLUMN prem_score REAL DEFAULT 0"); } catch(e) {}
    try { await db.execute("ALTER TABLE surveys ADD COLUMN prom_score REAL DEFAULT 0"); } catch(e) {}
    try { await db.execute("ALTER TABLE surveys ADD COLUMN overall_score REAL DEFAULT 0"); } catch(e) {}
    try { await db.execute("ALTER TABLE surveys ADD COLUMN answers TEXT DEFAULT '{}'"); } catch(e) {}
    
    try { await db.execute("ALTER TABLE patients ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''"); } catch(e) {}
    try { await db.execute("ALTER TABLE patients ADD COLUMN specialty TEXT NOT NULL DEFAULT ''"); } catch(e) {}
    try { await db.execute("ALTER TABLE patients ADD COLUMN name TEXT NOT NULL DEFAULT ''"); } catch(e) {}
    try { await db.execute("ALTER TABLE patients ADD COLUMN rm TEXT NOT NULL DEFAULT ''"); } catch(e) {}
    
    try { await db.execute("ALTER TABLE drafts ADD COLUMN hospital_code TEXT NOT NULL DEFAULT ''"); } catch(e) {}
    try { await db.execute("ALTER TABLE drafts ADD COLUMN specialty TEXT NOT NULL DEFAULT ''"); } catch(e) {}

    tablesInitialized = true;
  } catch (err) {
    console.warn("Failed to init Turso tables:", err);
  }
}

// ============ HOSPITAL CODE UTILITY ============
// Derives a stable, unique hospital code from email (the true unique identifier in Turso).
// All surveys, patients, and drafts in Turso use hospital_code as a partition key.
// This must be called consistently across all pages — never derive ad-hoc from hospital name.
export function getHospitalCode(email: string): string {
  if (!email) return "UNKNOWN";
  const local = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return local.substring(0, 12) || "RS001";
}

// ============ HOSPITAL ACCOUNTS ============

export async function addHospitalAccount(acc: any): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  await db.execute({
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
      acc.registeredAt || new Date().toISOString()
    ]
  });
}

export async function getAllHospitalAccounts(): Promise<any[] | null> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return null; // null = no connection, [] = genuinely empty

  try {
    const rs = await db.execute("SELECT * FROM hospital_accounts ORDER BY registered_at DESC");
    return rs.rows.map((r: any) => ({
      email: r.email,
      password: r.password,
      hospitalName: r.hospital_name,
      picName: r.pic_name,
      province: r.province || "",
      city: r.city || "",
      status: r.status,
      suratTugasFileName: r.surat_tugas_filename,
      suratTugasData: r.surat_tugas_data,
      registeredAt: r.registered_at
    }));
  } catch (err) {
    console.error("Get Accounts Error:", err);
    return null;
  }
}

export async function updateAccountStatus(email: string, status: string): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
    await db.execute({
      sql: "UPDATE hospital_accounts SET status = ? WHERE email = ?",
      args: [status, email]
    });
  } catch (err) {
    console.error("Update Account Status Error:", err);
  }
}

// ============ SUBMISSIONS (ADMIN DASHBOARD) ============

export async function addSubmission(submission: any): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
    await db.execute({
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
        JSON.stringify(submission.details || {})
      ]
    });
  } catch (err) {
    console.error("Add Submission Error:", err);
  }
}

export async function getAllSubmissions(): Promise<any[] | null> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return null;

  try {
    const rs = await db.execute("SELECT * FROM submissions ORDER BY created_at DESC");
    return rs.rows.map((r: any) => ({
      id: r.id,
      hospitalName: r.hospital_name,
      specialty: r.specialty,
      picName: r.pic_name,
      submittedDate: r.submitted_date,
      status: r.status,
      scores: JSON.parse(r.scores as string),
      details: r.details ? JSON.parse(r.details as string) : {}
    }));
  } catch (err) {
    console.error("Get Submissions Error:", err);
    return null;
  }
}

export async function updateSubmissionStatus(id: string, status: string): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
    await db.execute({
      sql: "UPDATE submissions SET status = ? WHERE id = ?",
      args: [status, id]
    });
  } catch (err) {
    console.error("Update Status Error:", err);
  }
}

export async function updateSubmissionReview(id: string, status: string, details: any): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
    await db.execute({
      sql: "UPDATE submissions SET status = ?, details = ? WHERE id = ?",
      args: [status, JSON.stringify(details), id]
    });
  } catch (err) {
    console.error("Update Submission Review Error:", err);
  }
}

// ============ RANKINGS ============

export async function publishRankingToDb(ranking: any): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
    // Check if duplicate submission ID
    const existing = await db.execute({
      sql: "SELECT id FROM rankings WHERE submission_id = ?",
      args: [ranking.submissionId]
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE rankings SET 
                hospital_name = ?, city = ?, province = ?, specialty = ?, 
                final_score = ?, rsbk_score = ?, clinical_audit_score = ?, 
                patient_report_score = ?, grade = ?, approved_at = ? 
              WHERE submission_id = ?`,
        args: [
          ranking.hospitalName, ranking.city, ranking.province, ranking.specialty,
          ranking.finalScore, ranking.rsbkScore, ranking.clinicalAuditScore,
          ranking.patientReportScore, ranking.grade, ranking.approvedAt,
          ranking.submissionId
        ]
      });
    } else {
      await db.execute({
        sql: `INSERT INTO rankings (id, hospital_name, city, province, specialty, final_score, rsbk_score, clinical_audit_score, patient_report_score, grade, approved_at, submission_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          ranking.id, ranking.hospitalName, ranking.city, ranking.province, ranking.specialty,
          ranking.finalScore, ranking.rsbkScore, ranking.clinicalAuditScore,
          ranking.patientReportScore, ranking.grade, ranking.approvedAt, ranking.submissionId
        ]
      });
    }
  } catch (err) {
    console.error("Publish Ranking Error:", err);
  }
}

export async function unpublishRankingFromDb(submissionId: string): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
    await db.execute({
      sql: "DELETE FROM rankings WHERE submission_id = ?",
      args: [submissionId]
    });
  } catch (err) {
    console.error("Unpublish Ranking Error:", err);
  }
}

export async function getAllRankingsFromDb(): Promise<any[] | null> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return null;

  try {
    const rs = await db.execute("SELECT * FROM rankings ORDER BY final_score DESC");
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
      submissionId: r.submission_id
    }));
  } catch (err) {
    console.error("Get All Rankings Error:", err);
    return null;
  }
}

// ============ NEWS ============

export async function addNewsToDb(news: any): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
    await db.execute({
      sql: `INSERT INTO news (id, title, excerpt, content, category, image_url, author, published_at, featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        news.id, news.title, news.excerpt, news.content, news.category,
        news.imageUrl, news.author, news.publishedAt, news.featured ? 1 : 0
      ]
    });
  } catch (err) {
    console.error("Add News Error:", err);
  }
}

export async function deleteNewsFromDb(id: string): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;
  try {
    await db.execute({
      sql: "DELETE FROM news WHERE id = ?",
      args: [id]
    });
  } catch (err) {
    console.error("Delete News Error:", err);
  }
}

export async function getAllNews(): Promise<any[] | null> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return null;

  try {
    const rs = await db.execute("SELECT * FROM news ORDER BY published_at DESC");
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
      createdAt: r.created_at
    }));
  } catch (err) {
    console.error("Get All News Error:", err);
    return null;
  }
}

// ============ EVENTS ============

export async function addEventToDb(event: any): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
    await db.execute({
      sql: `INSERT INTO events (id, title, description, date, end_date, location, type, image_url, registration_url, featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        event.id, event.title, event.description, event.date, event.endDate || "",
        event.location, event.type, event.imageUrl, event.registrationUrl || "",
        event.featured ? 1 : 0
      ]
    });
  } catch (err) {
    console.error("Add Event Error:", err);
  }
}

export async function deleteEventFromDb(id: string): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;
  try {
    await db.execute({
      sql: "DELETE FROM events WHERE id = ?",
      args: [id]
    });
  } catch (err) {
    console.error("Delete Event Error:", err);
  }
}

export async function getAllEvents(): Promise<any[] | null> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return null;

  try {
    const rs = await db.execute("SELECT * FROM events ORDER BY date ASC");
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
      createdAt: r.created_at
    }));
  } catch (err) {
    console.error("Get All Events Error:", err);
    return null;
  }
}

// ============ PATIENT SURVEYS ============

export async function submitSurvey(
  hospitalCode: string,
  specialty: string,
  survey: any
): Promise<{ success: boolean; surveyId?: string; duplicate?: boolean }> {
  await initTursoTables();
  const db = getTurso();
  if (!db) {
    console.error("Turso not configured");
    return { success: false };
  }

  try {
    // Better Unique ID using Web Crypto API
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Check Dup
    const existing = await db.execute({
      sql: "SELECT id FROM surveys WHERE hospital_code = ? AND specialty = ? AND patient_rm = ?",
      args: [hospitalCode, specialty, survey.medicalRecordNumber || survey.qRm || ""]
    });
    
    if (existing.rows.length > 0) {
      return { success: false, duplicate: true };
    }

    await db.execute({
      sql: `INSERT INTO surveys (id, hospital_code, specialty, patient_name, patient_rm, prem_score, prom_score, overall_score, answers)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        hospitalCode,
        specialty,
        survey.patientName || survey.qName || "",
        survey.medicalRecordNumber || survey.qRm || "",
        survey.premScore ?? 0,
        survey.promScore ?? 0,
        survey.overallScore ?? 0,
        JSON.stringify(survey.answers || {})
      ]
    });
    
    return { success: true, surveyId: id };
  } catch (err: any) {
    console.error("Submit Survey Error:", err);
    throw err;
  }
}

export async function getSurveys(hospitalCode: string, specialty: string): Promise<any[]> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return [];

  try {
    const rs = await db.execute({
      sql: "SELECT * FROM surveys WHERE hospital_code = ? AND specialty = ? ORDER BY created_at DESC",
      args: [hospitalCode, specialty]
    });
    
    return rs.rows.map((r: any) => ({
      id: r.id,
      patientName: r.patient_name,
      medicalRecordNumber: r.patient_rm,
      premScore: r.prem_score,
      promScore: r.prom_score,
      overallScore: r.overall_score,
      answers: r.answers ? JSON.parse(r.answers as string) : {},
      timestamp: r.created_at
    }));
  } catch (err) {
    console.error("Get Surveys Error:", err);
    return [];
  }
}

export async function resetSurveys(hospitalCode: string, specialty: string): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;
  await db.execute({
    sql: "DELETE FROM surveys WHERE hospital_code = ? AND specialty = ?",
    args: [hospitalCode, specialty]
  });
}

// ============ REGISTERED PATIENTS ============

export async function registerPatient(
  hospitalCode: string,
  specialty: string,
  patient: any
): Promise<{ success: boolean; duplicate?: boolean; patient?: any; error?: string }> {
  try { await initTursoTables(); } catch(e) {}
  const db = getTurso();
  if (!db) return { success: false, error: "Koneksi ke Turso Gagal. Pastikan VITE_TURSO_DATABASE_URL valid (harus terdepan libsql://) di Dashboard Vercel lalu REDEPLOY." };

  try {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Check if duplicate RM
    const existing = await db.execute({
      sql: "SELECT id FROM patients WHERE hospital_code = ? AND specialty = ? AND rm = ?",
      args: [hospitalCode, specialty, patient.rm || ""]
    });
    
    if (existing.rows.length > 0) {
      return { success: false, duplicate: true };
    }

    await db.execute({
      sql: "INSERT INTO patients (id, hospital_code, specialty, name, rm) VALUES (?, ?, ?, ?, ?)",
      args: [id, hospitalCode, specialty, patient.name, patient.rm]
    });
    
    return { success: true, patient: { id, name: patient.name, rm: patient.rm } };
  } catch (err) {
    console.error("Register Patient Error:", err);
    throw err;
  }
}

export async function getPatients(hospitalCode: string, specialty: string): Promise<any[]> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return [];

  try {
    const rs = await db.execute({
      sql: "SELECT * FROM patients WHERE hospital_code = ? AND specialty = ? ORDER BY created_at ASC",
      args: [hospitalCode, specialty]
    });
    return rs.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      rm: r.rm,
      specialty,
      hospitalCode,
      createdAt: r.created_at
    }));
  } catch (err) {
    console.error("Get Patients Error:", err);
    return [];
  }
}

export async function removePatient(hospitalCode: string, specialty: string, patientId: string): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  await db.execute({
    sql: "DELETE FROM patients WHERE id = ? AND hospital_code = ?",
    args: [patientId, hospitalCode]
  });
}

// ============ DRAFTS ============

export async function getDraft(
  type: "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string
): Promise<any | null> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return null;

  const draftId = `${type}-${hospitalCode}-${specialty}`;
  try {
    const rs = await db.execute({
      sql: "SELECT data FROM drafts WHERE id = ?",
      args: [draftId]
    });
    if (rs.rows.length > 0) {
      return JSON.parse(rs.rows[0].data as string);
    }
    return null;
  } catch (err) {
    console.error("Get Draft Error:", err);
    return null;
  }
}

export async function saveDraft(
  type: "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string,
  draft: any
): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  const dataStr = JSON.stringify(draft);
  const draftId = `${type}-${hospitalCode}-${specialty}`;

  try {
    const existing = await db.execute({
      sql: "SELECT id FROM drafts WHERE id = ?",
      args: [draftId]
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE drafts SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [dataStr, draftId]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO drafts (id, type, hospital_code, specialty, data) VALUES (?, ?, ?, ?, ?)",
        args: [draftId, type, hospitalCode, specialty, dataStr]
      });
    }
  } catch (err) {
    console.error("Save Draft Error:", err);
  }
}

export async function saveHospitalDraft(draft: any): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  const dataStr = JSON.stringify(draft);
  const draftId = draft.draftId;

  try {
    const existing = await db.execute({
      sql: "SELECT id FROM drafts WHERE id = ?",
      args: [draftId]
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE drafts SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [dataStr, draftId]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO drafts (id, type, hospital_code, specialty, data) VALUES (?, ?, ?, ?, ?)",
        args: [draftId, "hospital-assessment", draft.hospitalName, "Multiple", dataStr]
      });
    }
  } catch (err) {
    console.error("Save Hospital Draft Error:", err);
  }
}

export async function getAllHospitalDrafts(): Promise<any[]> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return [];

  try {
    const rs = await db.execute("SELECT data FROM drafts WHERE type = 'hospital-assessment' ORDER BY updated_at DESC");
    return rs.rows.map((r: any) => JSON.parse(r.data as string));
  } catch (err) {
    console.error("Get All Hospital Drafts Error:", err);
    return [];
  }
}

export async function deleteHospitalDraft(draftId: string): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;
  await db.execute({
    sql: "DELETE FROM drafts WHERE id = ?",
    args: [draftId]
  });
}

export async function bulkAddSurveys(hospitalCode: string, specialty: string, surveys: any[]): Promise<void> {
  for (const survey of surveys) {
    await submitSurvey(hospitalCode, specialty, survey);
  }
}
