export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const PREFIX = "/api";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const API_REQUEST_TIMEOUT_MS = 15000;

async function rpc<T>(
  operation: string,
  payload: Record<string, any> = {},
  options: { retries?: number } = {}
): Promise<T> {
  const maxAttempts = Math.max(1, (options.retries || 0) + 1);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await rpcOnce<T>(operation, payload);
    } catch (err: any) {
      lastError = err;
      const isTransient = /\((429|500|502|503|504)\)|FUNCTION_INVOCATION_FAILED|network|fetch|abort|aborted/i.test(err?.message || "");
      if (!isTransient || attempt >= maxAttempts) break;
      await sleep(350 * attempt);
    }
  }

  throw lastError || new Error(`${operation} failed`);
}

async function rpcOnce<T>(operation: string, payload: Record<string, any> = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  const response = await fetch(`${API_BASE_URL}${PREFIX}/rpc/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));

  const raw = await response.text();
  let body: any = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }

  if (!response.ok) {
    const details = body.error || raw || response.statusText || "Unknown server error";
    throw new Error(`${operation} failed (${response.status}): ${details}`);
  }

  return body.result as T;
}

export async function initTursoTables() {
  await rpc("initTursoTables");
}

export function getHospitalCode(email: string): string {
  if (!email) return "UNKNOWN";
  const local = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return local.substring(0, 12) || "RS001";
}

export async function addHospitalAccount(acc: any): Promise<void> {
  await rpc("addHospitalAccount", { acc });
}

export async function getAllHospitalAccounts(): Promise<any[] | null> {
  try {
    return await rpc<any[]>("getAllHospitalAccounts");
  } catch (err) {
    console.error("Get Accounts Error:", err);
    return null;
  }
}

export async function getHospitalSuratTugas(email: string): Promise<string | null> {
  try {
    return await rpc<string | null>("getHospitalSuratTugas", { email });
  } catch (err) {
    console.error("Fetch PDF Error:", err);
    return null;
  }
}

export async function updateAccountStatus(email: string, status: string): Promise<void> {
  await rpc("updateAccountStatus", { email, status });
}

export async function addSubmission(submission: any): Promise<void> {
  await rpc("addSubmission", { submission });
}

export async function getAllSubmissions(): Promise<any[] | null> {
  try {
    return await rpc<any[]>("getAllSubmissions");
  } catch (err) {
    console.error("Get Submissions Error:", err);
    return null;
  }
}

export async function updateSubmissionStatus(id: string, status: string): Promise<void> {
  await rpc("updateSubmissionStatus", { id, status });
}

export async function updateSubmissionReview(id: string, status: string, details: any): Promise<void> {
  await rpc("updateSubmissionReview", { id, status, details });
}

export async function publishRankingToDb(ranking: any): Promise<void> {
  await rpc("publishRankingToDb", { ranking });
}

export async function unpublishRankingFromDb(submissionId: string): Promise<void> {
  await rpc("unpublishRankingFromDb", { submissionId });
}

export async function getAllRankingsFromDb(): Promise<any[] | null> {
  try {
    return await rpc<any[]>("getAllRankingsFromDb");
  } catch (err) {
    console.error("Get All Rankings Error:", err);
    return null;
  }
}

export async function addNewsToDb(news: any): Promise<void> {
  await rpc("addNewsToDb", { news });
}

export async function deleteNewsFromDb(id: string): Promise<void> {
  await rpc("deleteNewsFromDb", { id });
}

export async function getAllNews(): Promise<any[] | null> {
  try {
    return await rpc<any[]>("getAllNews");
  } catch (err) {
    console.error("Get All News Error:", err);
    return null;
  }
}

export async function addEventToDb(event: any): Promise<void> {
  await rpc("addEventToDb", { event });
}

export async function deleteEventFromDb(id: string): Promise<void> {
  await rpc("deleteEventFromDb", { id });
}

export async function getAllEvents(): Promise<any[] | null> {
  try {
    return await rpc<any[]>("getAllEvents");
  } catch (err) {
    console.error("Get All Events Error:", err);
    return null;
  }
}

export async function submitSurvey(
  hospitalCode: string,
  specialty: string,
  survey: any
): Promise<{ success: boolean; surveyId?: string; duplicate?: boolean }> {
  return rpc("submitSurvey", { hospitalCode, specialty, survey });
}

export async function getSurveys(hospitalCode: string, specialty: string): Promise<any[]> {
  try {
    return await rpc<any[]>("getSurveys", { hospitalCode, specialty }, { retries: 2 });
  } catch (err) {
    console.error("Get Surveys Error:", err);
    return [];
  }
}

export async function getSurveyByPatient(hospitalCode: string, specialty: string, patientRm: string): Promise<any | null> {
  try {
    return await rpc<any | null>("getSurveyByPatient", { hospitalCode, specialty, patientRm });
  } catch (err) {
    console.error("Get Survey By Patient Error:", err);
    return null;
  }
}

export async function resetSurveys(hospitalCode: string, specialty: string): Promise<void> {
  await rpc("resetSurveys", { hospitalCode, specialty });
}

export async function registerPatient(
  hospitalCode: string,
  specialty: string,
  patient: any
): Promise<{ success: boolean; duplicate?: boolean; patient?: any; error?: string }> {
  try {
    return await rpc("registerPatient", { hospitalCode, specialty, patient });
  } catch (err: any) {
    console.error("Register Patient Error:", err);
    return { success: false, error: err.message || "Koneksi ke server gagal." };
  }
}

export async function getPatients(hospitalCode: string, specialty: string): Promise<any[]> {
  try {
    return await rpc<any[]>("getPatients", { hospitalCode, specialty }, { retries: 2 });
  } catch (err) {
    console.error("Get Patients Error:", err);
    return [];
  }
}

const CUSTOM_SURVEY_CHUNK_SIZE = 600_000;

export async function saveCustomSurveyMetadata(hospitalCode: string, specialtyKey: string, data: any): Promise<void> {
  const base64 = typeof data?.base64 === "string" ? data.base64 : "";

  if (base64.length > CUSTOM_SURVEY_CHUNK_SIZE) {
    const chunks = base64.match(new RegExp(`.{1,${CUSTOM_SURVEY_CHUNK_SIZE}}`, "g")) || [];
    const metadata = {
      ...data,
      base64: "",
      pdfStoredInChunks: true,
      pdfChunkCount: chunks.length,
    };

    await rpc("saveCustomSurveyMetadata", { hospitalCode, specialtyKey, data: metadata });
    for (let index = 0; index < chunks.length; index++) {
      await rpc("saveCustomSurveyPdfChunk", {
        hospitalCode,
        specialtyKey,
        index,
        total: chunks.length,
        chunk: chunks[index],
      });
    }
    return;
  }

  await rpc("saveCustomSurveyMetadata", { hospitalCode, specialtyKey, data });
}

export async function getCustomSurveyMetadata(hospitalCode: string, specialtyKey: string): Promise<any | null> {
  try {
    return await rpc<any | null>("getCustomSurveyMetadata", { hospitalCode, specialtyKey }, { retries: 2 });
  } catch (err) {
    console.error("Get Custom Survey Error:", err);
    return null;
  }
}

export async function deleteCustomSurveyMetadata(hospitalCode: string, specialtyKey: string): Promise<void> {
  await rpc("deleteCustomSurveyMetadata", { hospitalCode, specialtyKey });
}

export async function removePatient(hospitalCode: string, specialty: string, patientId: string): Promise<void> {
  await rpc("removePatient", { hospitalCode, specialty, patientId });
}

export async function getDraft(
  type: "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string
): Promise<any | null> {
  try {
    return await rpc<any | null>("getDraft", { type, hospitalCode, specialty });
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
  await rpc("saveDraft", { type, hospitalCode, specialty, draft });
}

export async function saveHospitalDraft(draft: any): Promise<void> {
  await rpc("saveHospitalDraft", { draft });
}

export async function getAllHospitalDrafts(): Promise<any[]> {
  try {
    return await rpc<any[]>("getAllHospitalDrafts");
  } catch (err) {
    console.error("Get All Hospital Drafts Error:", err);
    return [];
  }
}

export async function deleteHospitalDraft(draftId: string): Promise<void> {
  await rpc("deleteHospitalDraft", { draftId });
}

export async function bulkAddSurveys(hospitalCode: string, specialty: string, surveys: any[]): Promise<void> {
  await rpc("bulkAddSurveys", { hospitalCode, specialty, surveys });
}
