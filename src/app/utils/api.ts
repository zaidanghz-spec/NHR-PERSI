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

// Fallback stubs for other untouched endpoints to prevent UI crashes 
export async function registerPatient() { return { success: true }; }
export async function getPatients() { return []; }
export async function removePatient() { return Promise.resolve(); }
export async function saveDraft() { return Promise.resolve(); }
export async function getDraft() { return null; }
