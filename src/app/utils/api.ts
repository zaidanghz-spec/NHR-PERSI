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
  
  tursoClient = createClient({ url, authToken });
  return tursoClient;
}

// Inisialisasi Tabel secara otomatis (hanya dari sisi Admin saat pertama kali memuat halaman)
export async function initTursoTables() {
  const db = getTurso();
  if (!db) return;

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
  } catch (err) {
    console.warn("Failed to init Turso tables:", err);
  }
}

// ============ PATIENT SURVEYS ============

export async function submitSurvey(
  hospitalCode: string,
  specialty: string,
  survey: any
): Promise<{ success: boolean; surveyId?: string; duplicate?: boolean }> {
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
): Promise<{ success: boolean; duplicate?: boolean; patient?: any }> {
  const db = getTurso();
  if (!db) return { success: false };

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

export async function getDraft(
  type: "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string
): Promise<any | null> {
  const db = getTurso();
  if (!db) return null;

  try {
    const draftId = `${type}-${hospitalCode}-${specialty}`;
    const rs = await db.execute({
      sql: "SELECT data FROM drafts WHERE id = ?",
      args: [draftId]
    });
    
    if (rs.rows.length === 0) return null;
    return JSON.parse(rs.rows[0].data as string);
  } catch (err) {
    console.error("Get Draft Error:", err);
    return null;
  }
}
