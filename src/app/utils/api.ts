import { createClient } from "@libsql/client/web";

// Hubungkan ke Turso langsung dari browser! (Aman untuk solusi sementara)
let tursoClient: any = null;

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
    tablesInitialized = true;
  } catch (err) {
    console.warn("Failed to init Turso tables:", err);
  }
}

// ============ HOSPITAL ACCOUNTS ============

export async function addHospitalAccount(acc: any): Promise<void> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return;

  try {
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
  } catch (err) {
    console.error("Add Account Error:", err);
  }
}

export async function getAllHospitalAccounts(): Promise<any[]> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return [];

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
    return [];
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

export async function getAllSubmissions(): Promise<any[]> {
  await initTursoTables();
  const db = getTurso();
  if (!db) return [];

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
    return [];
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
    // Basic Unique ID since Edge/Browser might not have node crypto
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
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
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
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
