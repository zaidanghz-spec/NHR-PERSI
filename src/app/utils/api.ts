// Use environment variables for Netlify deployment, with fallback values for Figma Make dev
const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "duwultxmuxqmdtkwcqqu";
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1d3VsdHhtdXhxbWR0a3djcXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNzcyNzMsImV4cCI6MjA4ODg1MzI3M30.dMDnvoGJwF5RH5kGqgxFQaK7RIyOSYD_W2wamDf4gQI";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5e1d66c4`;

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();

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
    return await request(`/surveys/${hospitalCode}/${specialty}`, {
      method: "POST",
      body: JSON.stringify(survey),
    });
  } catch (err: any) {
    if (err.message?.includes("sudah mengisi")) {
      return { success: false, duplicate: true };
    }
    throw err;
  }
}

export async function getSurveys(
  hospitalCode: string,
  specialty: string
): Promise<any[]> {
  const data = await request(`/surveys/${hospitalCode}/${specialty}`);
  return data.surveys || [];
}

export async function resetSurveys(
  hospitalCode: string,
  specialty: string
): Promise<void> {
  await request(`/surveys/${hospitalCode}/${specialty}`, { method: "DELETE" });
}

export async function bulkAddSurveys(
  hospitalCode: string,
  specialty: string,
  surveys: any[]
): Promise<void> {
  await request(`/surveys-bulk/${hospitalCode}/${specialty}`, {
    method: "POST",
    body: JSON.stringify({ surveys }),
  });
}

// ============ REGISTERED PATIENTS ============

export async function registerPatient(
  hospitalCode: string,
  specialty: string,
  patient: any
): Promise<{ success: boolean; duplicate?: boolean }> {
  try {
    return await request(`/patients/${hospitalCode}/${specialty}`, {
      method: "POST",
      body: JSON.stringify(patient),
    });
  } catch (err: any) {
    if (err.message?.includes("sudah terdaftar")) {
      return { success: false, duplicate: true };
    }
    throw err;
  }
}

export async function getPatients(
  hospitalCode: string,
  specialty: string
): Promise<any[]> {
  const data = await request(`/patients/${hospitalCode}/${specialty}`);
  return data.patients || [];
}

export async function removePatient(
  hospitalCode: string,
  specialty: string,
  patientId: string
): Promise<void> {
  await request(`/patients/${hospitalCode}/${specialty}/${patientId}`, {
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
  await request(`/drafts/${type}/${hospitalCode}/${specialty}`, {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export async function getDraft(
  type: "clinical-audit" | "patient-report",
  hospitalCode: string,
  specialty: string
): Promise<any | null> {
  const data = await request(`/drafts/${type}/${hospitalCode}/${specialty}`);
  return data.draft || null;
}