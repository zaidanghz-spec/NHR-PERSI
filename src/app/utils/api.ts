// API client — calls Vercel Serverless Functions backed by Turso
// Base URL adalah path relatif, artinya akan otomatis ke domain yang sama (prod maupun dev proxy)
const BASE = "";

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`API Error [${res.status}] ${path}:`, data);
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

// ============ PATIENT SURVEYS ============

export async function submitSurvey(
  hospitalCode: string,
  specialty: string,
  survey: any
): Promise<{ success: boolean; surveyId?: string; duplicate?: boolean }> {
  try {
    return await request(`/api/surveys/${hospitalCode}/${specialty}`, {
      method: "POST",
      body: JSON.stringify(survey),
    });
  } catch (err: any) {
    if (err.message?.includes("sudah mengisi") || err.message?.includes("409")) {
      return { success: false, duplicate: true };
    }
    throw err;
  }
}

export async function getSurveys(
  hospitalCode: string,
  specialty: string
): Promise<any[]> {
  const data = await request(`/api/surveys/${hospitalCode}/${specialty}`);
  return data.surveys || [];
}

export async function resetSurveys(
  hospitalCode: string,
  specialty: string
): Promise<void> {
  await request(`/api/surveys/${hospitalCode}/${specialty}`, { method: "DELETE" });
}

export async function bulkAddSurveys(
  hospitalCode: string,
  specialty: string,
  surveys: any[]
): Promise<void> {
  for (const s of surveys) {
    await submitSurvey(hospitalCode, specialty, s).catch(() => {});
  }
}

// ============ REGISTERED PATIENTS ============

export async function registerPatient(
  hospitalCode: string,
  specialty: string,
  patient: any
): Promise<{ success: boolean; duplicate?: boolean; patient?: any }> {
  try {
    return await request(`/api/patients/${hospitalCode}/${specialty}`, {
      method: "POST",
      body: JSON.stringify(patient),
    });
  } catch (err: any) {
    if (err.message?.includes("sudah terdaftar") || err.message?.includes("409")) {
      return { success: false, duplicate: true };
    }
    throw err;
  }
}

export async function getPatients(
  hospitalCode: string,
  specialty: string
): Promise<any[]> {
  const data = await request(`/api/patients/${hospitalCode}/${specialty}`);
  return data.patients || [];
}

export async function removePatient(
  hospitalCode: string,
  specialty: string,
  patientId: string
): Promise<void> {
  await request(`/api/patients/${hospitalCode}/${specialty}/${patientId}`, {
    method: "DELETE",
  });
}

// ============ DRAFTS ============

export async function saveDraft(
  type: "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string,
  draft: any
): Promise<void> {
  await request(`/api/drafts/${type}/${hospitalCode}/${specialty}`, {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export async function getDraft(
  type: "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string
): Promise<any | null> {
  const data = await request(`/api/drafts/${type}/${hospitalCode}/${specialty}`);
  return data.draft || null;
}
