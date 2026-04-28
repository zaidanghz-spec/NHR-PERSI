import { handle } from "hono/vercel";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as kv from "./kv_store";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ============ HEALTH CHECK ============
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// ============ KEY HELPERS ============
function surveysKey(hospitalCode: string, specialty: string) {
  return `surveys:${hospitalCode}:${specialty}`;
}
function patientsKey(hospitalCode: string, specialty: string) {
  return `patients:${hospitalCode}:${specialty}`;
}
function draftKey(type: string, hospitalCode: string, specialty: string) {
  return `draft:${type}:${hospitalCode}:${specialty}`;
}

// ============ SURVEYS ============

// GET surveys
app.get("/api/surveys/:hospitalCode/:specialty", async (c) => {
  try {
    const { hospitalCode, specialty } = c.req.param();
    const key = surveysKey(hospitalCode, specialty);
    const surveys = await kv.get(key);
    return c.json({ surveys: surveys || [] });
  } catch (err: any) {
    console.log("Error getting surveys:", err.message);
    return c.json({ error: `Failed to get surveys: ${err.message}` }, 500);
  }
});

// POST submit a survey
app.post("/api/surveys/:hospitalCode/:specialty", async (c) => {
  try {
    const { hospitalCode, specialty } = c.req.param();
    const survey = await c.req.json();
    const key = surveysKey(hospitalCode, specialty);

    const existing = (await kv.get(key)) || [];

    // Check duplicate by medicalRecordNumber + patientName
    const isDuplicate = existing.some(
      (s: any) =>
        s.medicalRecordNumber === survey.medicalRecordNumber &&
        s.patientName === survey.patientName
    );
    if (isDuplicate) {
      return c.json({ error: "Pasien ini sudah mengisi survei.", success: false, duplicate: true }, 409);
    }

    existing.push(survey);
    await kv.set(key, existing);

    // Also update registered patient's surveyed status
    const pKey = patientsKey(hospitalCode, specialty);
    const patients = (await kv.get(pKey)) || [];
    const updatedPatients = patients.map((p: any) => {
      if (p.rm === survey.medicalRecordNumber && p.name === survey.patientName) {
        return { ...p, surveyed: true };
      }
      return p;
    });
    await kv.set(pKey, updatedPatients);

    return c.json({ success: true, surveyId: survey.id });
  } catch (err: any) {
    console.log("Error submitting survey:", err.message);
    return c.json({ error: `Failed to submit survey: ${err.message}` }, 500);
  }
});

// DELETE reset all surveys
app.delete("/api/surveys/:hospitalCode/:specialty", async (c) => {
  try {
    const { hospitalCode, specialty } = c.req.param();
    const key = surveysKey(hospitalCode, specialty);
    await kv.set(key, []);
    return c.json({ success: true });
  } catch (err: any) {
    console.log("Error resetting surveys:", err.message);
    return c.json({ error: `Failed to reset surveys: ${err.message}` }, 500);
  }
});

// POST bulk add surveys (for simulation)
app.post("/api/surveys-bulk/:hospitalCode/:specialty", async (c) => {
  try {
    const { hospitalCode, specialty } = c.req.param();
    const { surveys } = await c.req.json();
    const key = surveysKey(hospitalCode, specialty);

    const existing = (await kv.get(key)) || [];
    const merged = [...existing, ...surveys];
    await kv.set(key, merged);

    return c.json({ success: true, count: surveys.length });
  } catch (err: any) {
    console.log("Error bulk adding surveys:", err.message);
    return c.json({ error: `Failed to bulk add surveys: ${err.message}` }, 500);
  }
});

// ============ REGISTERED PATIENTS ============

// GET patients
app.get("/api/patients/:hospitalCode/:specialty", async (c) => {
  try {
    const { hospitalCode, specialty } = c.req.param();
    const key = patientsKey(hospitalCode, specialty);
    const patients = await kv.get(key);
    return c.json({ patients: patients || [] });
  } catch (err: any) {
    console.log("Error getting patients:", err.message);
    return c.json({ error: `Failed to get patients: ${err.message}` }, 500);
  }
});

// POST register patient
app.post("/api/patients/:hospitalCode/:specialty", async (c) => {
  try {
    const { hospitalCode, specialty } = c.req.param();
    const patient = await c.req.json();
    const key = patientsKey(hospitalCode, specialty);

    const existing = (await kv.get(key)) || [];

    // Check duplicate RM
    const isDuplicate = existing.some((p: any) => p.rm === patient.rm);
    if (isDuplicate) {
      return c.json({ error: "Nomor rekam medis sudah terdaftar.", success: false, duplicate: true }, 409);
    }

    existing.push(patient);
    await kv.set(key, existing);

    return c.json({ success: true });
  } catch (err: any) {
    console.log("Error registering patient:", err.message);
    return c.json({ error: `Failed to register patient: ${err.message}` }, 500);
  }
});

// DELETE remove patient
app.delete("/api/patients/:hospitalCode/:specialty/:patientId", async (c) => {
  try {
    const { hospitalCode, specialty, patientId } = c.req.param();
    const key = patientsKey(hospitalCode, specialty);

    const existing = (await kv.get(key)) || [];
    const filtered = existing.filter((p: any) => p.id !== patientId);
    await kv.set(key, filtered);

    return c.json({ success: true });
  } catch (err: any) {
    console.log("Error removing patient:", err.message);
    return c.json({ error: `Failed to remove patient: ${err.message}` }, 500);
  }
});

// ============ DRAFTS ============

// GET draft
app.get("/api/drafts/:type/:hospitalCode/:specialty", async (c) => {
  try {
    const { type, hospitalCode, specialty } = c.req.param();
    const key = draftKey(type, hospitalCode, specialty);
    const draft = await kv.get(key);
    return c.json({ draft: draft || null });
  } catch (err: any) {
    console.log("Error getting draft:", err.message);
    return c.json({ error: `Failed to get draft: ${err.message}` }, 500);
  }
});

// POST save draft
app.post("/api/drafts/:type/:hospitalCode/:specialty", async (c) => {
  try {
    const { type, hospitalCode, specialty } = c.req.param();
    const draft = await c.req.json();
    const key = draftKey(type, hospitalCode, specialty);

    draft.savedAt = new Date().toISOString();
    await kv.set(key, draft);

    return c.json({ success: true });
  } catch (err: any) {
    console.log("Error saving draft:", err.message);
    return c.json({ error: `Failed to save draft: ${err.message}` }, 500);
  }
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
