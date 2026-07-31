export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const PREFIX = "/api";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DRAFT_SYNC_QUEUE_KEY = "nhr-draft-sync-queue-v1";
const DRAFT_MAP_FIELDS = ["formData", "patientMeta", "data", "summary"] as const;
type DraftSyncMapField = (typeof DRAFT_MAP_FIELDS)[number];
type DraftSyncKey = string;
type DraftSyncBaseline = { snapshot: Record<string, any>; version: number };
type PendingDraftSave = {
  key: DraftSyncKey;
  type: "rsbk" | "clinical-audit" | "patient-report";
  hospitalCode: string;
  specialty: string;
  patch: Record<string, any>;
  baseVersion: number;
  operationId: string;
  createdAt: string;
};

const draftBaselines = new Map<DraftSyncKey, DraftSyncBaseline>();
const draftSaveQueues = new Map<DraftSyncKey, Promise<any>>();

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function draftSyncKey(type: string, hospitalCode: string, specialty: string): DraftSyncKey {
  return `${type}|${hospitalCode}|${specialty}`;
}

function readPendingDraftSaves(): PendingDraftSave[] {
  if (!canUseBrowserStorage()) return [];
  try {
    const raw = localStorage.getItem(DRAFT_SYNC_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingDraftSaves(items: PendingDraftSave[]) {
  if (!canUseBrowserStorage()) return;
  try {
    if (items.length === 0) localStorage.removeItem(DRAFT_SYNC_QUEUE_KEY);
    else localStorage.setItem(DRAFT_SYNC_QUEUE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Unable to persist pending draft sync queue:", err);
  }
}

function sameValue(left: any, right: any) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function makeDraftPatch(previous: Record<string, any>, next: Record<string, any>) {
  const maps: Record<string, Record<string, any>> = {};
  const deletes: Record<string, string[]> = {};
  const fields: Record<string, any> = {};

  for (const field of DRAFT_MAP_FIELDS) {
    const before = previous[field] && typeof previous[field] === "object" ? previous[field] : {};
    const after = next[field] && typeof next[field] === "object" ? next[field] : {};
    const changed: Record<string, any> = {};
    Object.keys(after).forEach((key) => {
      if (!sameValue(before[key], after[key])) changed[key] = after[key];
    });
    const removed = Object.keys(before).filter((key) => !(key in after));
    if (Object.keys(changed).length > 0) maps[field] = changed;
    if (removed.length > 0) deletes[field] = removed;
  }

  const ignored = new Set<string>([...DRAFT_MAP_FIELDS, "registeredPatients", "serverVersion"]);
  Object.keys(next).forEach((key) => {
    if (!ignored.has(key) && !sameValue(previous[key], next[key])) fields[key] = next[key];
  });

  const patch: Record<string, any> = { fields };
  if (Object.keys(maps).length > 0) patch.maps = maps;
  if (Object.keys(deletes).length > 0) patch.deletes = deletes;
  if (Array.isArray(next.registeredPatients) && !sameValue(previous.registeredPatients, next.registeredPatients)) {
    patch.registeredPatients = next.registeredPatients;
  }
  return patch;
}

function applyDraftPatch(snapshot: Record<string, any>, patch: Record<string, any>) {
  const merged = { ...(snapshot || {}), ...(patch?.fields || {}) };
  for (const field of DRAFT_MAP_FIELDS) {
    const changes = patch?.maps?.[field];
    const removed = Array.isArray(patch?.deletes?.[field]) ? patch.deletes[field] : [];
    if (!changes && removed.length === 0) continue;
    const next = { ...((snapshot || {})[field] || {}) };
    Object.entries(changes || {}).forEach(([key, value]) => { next[key] = value; });
    removed.forEach((key: string) => delete next[key]);
    merged[field] = next;
  }
  if (Array.isArray(patch?.registeredPatients)) merged.registeredPatients = patch.registeredPatients;
  return merged;
}

function appendPendingDraftSave(item: PendingDraftSave) {
  const queue = readPendingDraftSaves();
  queue.push(item);
  writePendingDraftSaves(queue);
}

function removePendingDraftSave(operationId: string) {
  writePendingDraftSaves(readPendingDraftSaves().filter((item) => item.operationId !== operationId));
}

async function flushPendingDraftSavesForKey(key: DraftSyncKey) {
  const pending = readPendingDraftSaves().filter((item) => item.key === key);
  for (const item of pending) {
    let result: any;
    try {
      result = await rpc<any>("saveDraft", {
        type: item.type,
        hospitalCode: item.hospitalCode,
        specialty: item.specialty,
        patch: item.patch,
        baseVersion: item.baseVersion,
        operationId: item.operationId,
      }, { retries: 2, timeoutMs: 15000 });
    } catch (err) {
      // Keep the patch on disk. A later edit, refresh, or online event will retry it.
      throw err;
    }

    if (result?.conflict) {
      // Delta patches are mergeable. Rebase the patch on the server version
      // instead of dropping it or replacing the newer server snapshot.
      item.baseVersion = Number(result.serverVersion || item.baseVersion || 0);
      writePendingDraftSaves(readPendingDraftSaves().map((entry) => entry.operationId === item.operationId ? item : entry));
      continue;
    }

    if (result?.resetConflict) {
      // This patch was created before an administrator reset the audit.
      // Drop it permanently and hydrate the baseline from the reset snapshot
      // so a stale offline queue cannot repopulate deleted patient answers.
      removePendingDraftSave(item.operationId);
      const serverDraft = await rpc<any | null>("getDraft", {
        type: item.type,
        hospitalCode: item.hospitalCode,
        specialty: item.specialty,
      }, { retries: 1, timeoutMs: 15000 });
      const snapshot = serverDraft ? { ...serverDraft } : {};
      const serverVersion = Number(snapshot.serverVersion || result.serverVersion || 0);
      delete snapshot.serverVersion;
      draftBaselines.set(key, { snapshot, version: serverVersion });
      throw new Error("Draft audit telah direset oleh admin. Muat ulang halaman sebelum mengisi kembali.");
    }

    removePendingDraftSave(item.operationId);
    const baseline = draftBaselines.get(key) || { snapshot: {}, version: item.baseVersion };
    draftBaselines.set(key, {
      snapshot: applyDraftPatch(baseline.snapshot, item.patch),
      version: Number(result?.serverVersion || baseline.version + 1),
    });
  }
  return true;
}

function flushAllPendingDraftSaves() {
  const keys = Array.from(new Set(readPendingDraftSaves().map((item) => item.key)));
  return Promise.all(keys.map((key) => flushPendingDraftSavesForKey(key).catch(() => false)));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushAllPendingDraftSaves(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushAllPendingDraftSaves();
  });
}

export function getAuthHeaders(): Record<string, string> {
  const token =
    sessionStorage.getItem("auth_token") ||
    sessionStorage.getItem("hospitalToken") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("hospitalToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function rpc<T>(
  operation: string,
  payload: Record<string, any> = {},
  options: { retries?: number; timeoutMs?: number } = {}
): Promise<T> {
  const maxAttempts = Math.max(1, (options.retries || 0) + 1);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await rpcOnce<T>(operation, payload, options.timeoutMs || 15000);
    } catch (err: any) {
      lastError = err;
      const isTransient = /\((408|429|500|502|503|504)\)|FUNCTION_INVOCATION_FAILED|network|fetch|timeout|aborted/i.test(err?.message || "");
      if (!isTransient || attempt >= maxAttempts) break;
      await sleep(Math.min(30000, 2000 * (2 ** (attempt - 1))));
    }
  }

  throw lastError || new Error(`${operation} failed`);
}

async function rpcOnce<T>(operation: string, payload: Record<string, any> = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${PREFIX}/rpc/${operation}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    const message = err?.name === "AbortError" ? `${operation} request timeout` : (err?.message || "Network request failed");
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }

  if (!response.ok) {
    const details = response.status === 401
      ? "Sesi login sudah tidak valid. Silakan logout lalu login ulang sebagai RS/Admin."
      : body.error || raw || response.statusText || "Unknown server error";
    const err: any = new Error(`${operation} failed (${response.status}): ${details}`);
    err.statusCode = response.status;
    throw err;
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

export async function loginHospital(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; account?: any; error?: string }> {
  return rpc("loginHospital", { email, password });
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  return rpc("loginAdmin", { username, password });
}

export async function addHospitalAccount(acc: any): Promise<void> {
  await rpc("addHospitalAccount", { acc });
}

export async function getAllHospitalAccounts(): Promise<any[] | null> {
  try { return await rpc<any[]>("getAllHospitalAccounts"); }
  catch (err) { console.error("Get Accounts Error:", err); return null; }
}

export async function getHospitalSuratTugas(email: string): Promise<string | null> {
  try { return await rpc<string | null>("getHospitalSuratTugas", { email }); }
  catch (err) { console.error("Fetch PDF Error:", err); return null; }
}

export async function updateAccountStatus(email: string, status: string): Promise<void> {
  await rpc("updateAccountStatus", { email, status });
}

export async function deleteHospitalAccount(email: string): Promise<void> {
  await rpc("deleteHospitalAccount", { email });
}

export async function resetHospitalPassword(email: string, password: string): Promise<void> {
  await rpc("resetHospitalPassword", { email, password });
}

export async function addSubmission(submission: any): Promise<void> {
  await rpc("addSubmission", { submission });
}

export async function getAllSubmissions(): Promise<any[] | null> {
  try { return await rpc<any[]>("getAllSubmissions"); }
  catch (err) { console.error("Get Submissions Error:", err); return null; }
}

export async function softDeleteSubmission(id: string): Promise<void> {
  await rpc("softDeleteSubmission", { id });
}

export async function restoreSubmission(id: string): Promise<void> {
  await rpc("restoreSubmission", { id });
}

export async function getDeletedSubmissions(): Promise<any[] | null> {
  try { return await rpc<any[]>("getDeletedSubmissions"); }
  catch (err) { console.error("Get Deleted Submissions Error:", err); return null; }
}

export async function updateSubmissionStatus(id: string, status: string, updatedAt?: string | null): Promise<void> {
  await rpc("updateSubmissionStatus", { id, status, updatedAt });
}

export async function deleteDraft(
  type: string,
  hospitalCode: string,
  specialty: string
): Promise<void> {
  try { await rpc("deleteDraft", { type, hospitalCode, specialty }); }
  catch (err) { console.error("Delete Draft Error:", err); }
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
  try { return await rpc<any[]>("getAllRankingsFromDb"); }
  catch (err) { console.error("Get All Rankings Error:", err); return null; }
}

export async function addNewsToDb(news: any): Promise<void> {
  await rpc("addNewsToDb", { news });
}

export async function updateNewsInDb(id: string, news: any): Promise<void> {
  await rpc("updateNewsInDb", { id, news });
}

export async function deleteNewsFromDb(id: string): Promise<void> {
  await rpc("deleteNewsFromDb", { id });
}

export async function getAllNews(): Promise<any[] | null> {
  try { return await rpc<any[]>("getAllNews"); }
  catch (err) { console.error("Get All News Error:", err); return null; }
}

export async function addEventToDb(event: any): Promise<void> {
  await rpc("addEventToDb", { event });
}

export async function updateEventInDb(id: string, event: any): Promise<void> {
  await rpc("updateEventInDb", { id, event });
}

export async function deleteEventFromDb(id: string): Promise<void> {
  await rpc("deleteEventFromDb", { id });
}

export async function getAllEvents(): Promise<any[] | null> {
  try { return await rpc<any[]>("getAllEvents"); }
  catch (err) { console.error("Get All Events Error:", err); return null; }
}

export async function submitSurvey(
  hospitalCode: string,
  specialty: string,
  survey: any
): Promise<{ success: boolean; surveyId?: string; duplicate?: boolean; updated?: boolean }> {
  return rpc("submitSurvey", { hospitalCode, specialty, survey });
}

export async function saveSurveyBackup(
  hospitalCode: string,
  specialty: string,
  survey: any,
  status = "client-backup",
  error = ""
): Promise<{ success: boolean; backupId?: string }> {
  return rpc("saveSurveyBackup", { hospitalCode, specialty, survey, status, error });
}

export async function resolvePatientSurveyDisease(
  hospitalCode: string,
  specialty: string,
  patientName: string,
  patientRm: string,
  patientToken?: string
): Promise<{ found: boolean; diseaseIndex?: number; diseaseKey?: string }> {
  try {
    return await rpc("resolvePatientSurveyDisease", { hospitalCode, specialty, patientName, patientRm, patientToken });
  } catch (err) {
    console.error("Resolve Patient Survey Disease Error:", err);
    return { found: false };
  }
}

export async function getSurveys(hospitalCode: string, specialty: string): Promise<any[]> {
  try { return await rpc<any[]>("getSurveys", { hospitalCode, specialty }, { retries: 2 }); }
  catch (err) { console.error("Get Surveys Error:", err); return []; }
}

export async function getSurveyByPatient(hospitalCode: string, specialty: string, patientRm: string): Promise<any | null> {
  try { return await rpc<any | null>("getSurveyByPatient", { hospitalCode, specialty, patientRm }); }
  catch (err) { console.error("Get Survey By Patient Error:", err); return null; }
}

export async function resetSurveys(hospitalCode: string, specialty: string): Promise<void> {
  await rpc("resetSurveys", { hospitalCode, specialty });
}

export async function registerPatient(
  hospitalCode: string,
  specialty: string,
  patient: any
): Promise<{ success: boolean; duplicate?: boolean; patient?: any; error?: string }> {
  try { return await rpc("registerPatient", { hospitalCode, specialty, patient }); }
  catch (err: any) {
    console.error("Register Patient Error:", err);
    return { success: false, error: err.message || "Koneksi ke server gagal." };
  }
}

export async function getPatients(hospitalCode: string, specialty: string): Promise<any[]> {
  try { return await rpc<any[]>("getPatients", { hospitalCode, specialty }, { retries: 2 }); }
  catch (err) { console.error("Get Patients Error:", err); return []; }
}

const CUSTOM_SURVEY_CHUNK_SIZE = 600_000;

export async function saveCustomSurveyMetadata(hospitalCode: string, specialtyKey: string, data: any): Promise<void> {
  const base64 = typeof data?.base64 === "string" ? data.base64 : "";

  if (base64.length > CUSTOM_SURVEY_CHUNK_SIZE) {
    const chunks = base64.match(new RegExp(`.{1,${CUSTOM_SURVEY_CHUNK_SIZE}}`, "g")) || [];
    const metadata = { ...data, base64: "", pdfStoredInChunks: true, pdfChunkCount: chunks.length };
    await rpc("saveCustomSurveyMetadata", { hospitalCode, specialtyKey, data: metadata });
    for (let index = 0; index < chunks.length; index++) {
      await rpc("saveCustomSurveyPdfChunk", { hospitalCode, specialtyKey, index, total: chunks.length, chunk: chunks[index] });
    }
    return;
  }

  await rpc("saveCustomSurveyMetadata", { hospitalCode, specialtyKey, data });
}

export async function getCustomSurveyMetadata(hospitalCode: string, specialtyKey: string): Promise<any | null> {
  try { return await rpc<any | null>("getCustomSurveyMetadata", { hospitalCode, specialtyKey }, { retries: 2 }); }
  catch (err) { console.error("Get Custom Survey Error:", err); return null; }
}

export async function deleteCustomSurveyMetadata(hospitalCode: string, specialtyKey: string): Promise<void> {
  await rpc("deleteCustomSurveyMetadata", { hospitalCode, specialtyKey });
}

export async function removePatient(hospitalCode: string, specialty: string, patientId: string): Promise<void> {
  await rpc("removePatient", { hospitalCode, specialty, patientId });
}

export async function getDraft(
  type: "rsbk" | "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string
): Promise<any | null> {
  const key = draftSyncKey(type, hospitalCode, specialty);
  // Flush previously persisted patches when possible, but do not block page
  // hydration forever if the network is currently unavailable.
  try { await flushPendingDraftSavesForKey(key); } catch {}
  try {
    const serverDraft = await rpc<any | null>("getDraft", { type, hospitalCode, specialty }, { retries: 1, timeoutMs: 15000 });
    const serverVersion = Number(serverDraft?.serverVersion || 0);
    const snapshot = serverDraft ? { ...serverDraft } : {};
    delete snapshot.serverVersion;
    draftBaselines.set(key, { snapshot, version: serverVersion });

    // If the request was offline, overlay only the persisted unsent patches
    // for this draft. The server remains the source of truth once acknowledged.
    const localPending = readPendingDraftSaves().filter((item) => item.key === key);
    const hydrated = localPending.reduce((current, item) => applyDraftPatch(current, item.patch), snapshot);
    return serverDraft ? { ...hydrated, serverVersion } : (localPending.length > 0 ? hydrated : null);
  }
  catch (err) { console.error("Get Draft Error:", err); return null; }
}

export async function saveDraft(
  type: "rsbk" | "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string,
  draft: any
): Promise<void> {
  const key = draftSyncKey(type, hospitalCode, specialty);
  const previous = draftBaselines.get(key) || { snapshot: {}, version: 0 };
  const patch = makeDraftPatch(previous.snapshot, draft || {});
  const hasChanges = Object.keys(patch.fields || {}).length > 0 ||
    Object.keys(patch.maps || {}).length > 0 ||
    Object.keys(patch.deletes || {}).length > 0 ||
    Array.isArray(patch.registeredPatients);
  if (!hasChanges) return;

  const item: PendingDraftSave = {
    key,
    type,
    hospitalCode,
    specialty,
    patch,
    baseVersion: previous.version,
    operationId: typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };

  // Optimistically advance only the in-memory baseline so rapid edits produce
  // small deltas. The durable queue remains pending until the server confirms.
  draftBaselines.set(key, {
    snapshot: applyDraftPatch(previous.snapshot, patch),
    version: previous.version,
  });
  appendPendingDraftSave(item);

  const run = (draftSaveQueues.get(key) || Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      await flushPendingDraftSavesForKey(key);
    });
  draftSaveQueues.set(key, run);
  try {
    await run;
  } finally {
    if (draftSaveQueues.get(key) === run) draftSaveQueues.delete(key);
  }
}

export async function saveHospitalDraft(draft: any): Promise<void> {
  await rpc("saveHospitalDraft", { draft });
}

export async function getAllHospitalDrafts(): Promise<any[]> {
  try { return await rpc<any[]>("getAllHospitalDrafts"); }
  catch (err) { console.error("Get All Hospital Drafts Error:", err); return []; }
}

export async function getHospitalModuleDrafts(hospitalCode: string): Promise<any[]> {
  try { return await rpc<any[]>("getHospitalModuleDrafts", { hospitalCode }); }
  catch (err) { console.error("Get Hospital Module Drafts Error:", err); return []; }
}

export async function deleteHospitalDraft(draftId: string): Promise<void> {
  await rpc("deleteHospitalDraft", { draftId });
}

export async function bulkAddSurveys(hospitalCode: string, specialty: string, surveys: any[]): Promise<void> {
  await rpc("bulkAddSurveys", { hospitalCode, specialty, surveys });
}
