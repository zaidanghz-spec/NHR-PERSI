import {
  saveHospitalDraft,
  getAllHospitalDrafts,
  getHospitalModuleDrafts,
  deleteHospitalDraft as deleteCloudDraft,
} from "./api";
import { safeLocalStorageSet } from "./storage";

export interface DraftData {
  draftId: string;
  hospitalName: string;
  hospitalCode?: string;
  hospitalEmail?: string;
  picName: string;
  createdAt: string;
  updatedAt: string;
  selectedSpecialties: string[];
  progress: {
    [specialty: string]: {
      rsbk: {
        completed: boolean;
        confirmed?: boolean;
        data: Record<string, string>;
        score?: number;
      };
      clinicalAudit: {
        completed: boolean;
        confirmed?: boolean;
        data: Record<string, string>;
        patientMeta?: Record<string, { initials: string; code: string }>;
        activeDiseaseIndex?: number;
        currentPatient?: number;
        score?: number;
      };
      patientReport: {
        completed: boolean;
        confirmed?: boolean;
        data: Record<string, any>;
        score?: number;
        patientCount?: number;
      };
    };
  };
}

const DRAFTS_KEY = "siap_persi_drafts";
const DELETED_DRAFTS_KEY = "siap_persi_deleted_draft_ids";
const DRAFT_SCOPED_SESSION_SUFFIXES = [
  "_rsbkScore",
  "_clinicalAuditScore",
  "_auditPatientCount",
  "_auditSummary",
  "_auditPatients",
  "_patientReportScore",
  "_prmPatientCount",
  "_prmSummary",
];

const normalize = (value?: string) => (value || "").trim().toLowerCase();

function deriveHospitalCode(email?: string) {
  if (!email) return "";
  const cleanEmail = email.trim().toLowerCase();
  const local = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 8);
  let hash = 0;
  for (let i = 0; i < cleanEmail.length; i++) {
    hash = (hash << 5) - hash + cleanEmail.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36).toUpperCase().substring(0, 4);
  return local + hashStr;
}

function getDraftHospitalCode(draft: DraftData) {
  return draft.hospitalCode || deriveHospitalCode(draft.hospitalEmail);
}

function matchesHospitalDraft(draft: DraftData, hospital?: { hospitalName?: string; email?: string; hospitalCode?: string }) {
  if (!hospital) return true;
  const code = hospital.hospitalCode || deriveHospitalCode(hospital.email);
  const draftCode = getDraftHospitalCode(draft);
  const nameMatch = Boolean(
    hospital.hospitalName &&
    draft.hospitalName &&
    normalize(draft.hospitalName) === normalize(hospital.hospitalName)
  );
  if (hospital.hospitalName && draft.hospitalName && !nameMatch) return false;
  const emailMatch = Boolean(hospital.email && draft.hospitalEmail && normalize(draft.hospitalEmail) === normalize(hospital.email));
  const codeMatch = Boolean(code && draftCode && normalize(draftCode) === normalize(code));

  // Hospital names are not unique enough for draft ownership. If either side has
  // account identity, only email/code matches may bind the draft to this session.
  if (hospital.email && draft.hospitalEmail) {
    return emailMatch;
  }

  if (code && draftCode) {
    return codeMatch;
  }

  if (code || hospital.email || draftCode || draft.hospitalEmail) {
    return emailMatch || codeMatch;
  }

  return normalize(draft.hospitalName) === normalize(hospital.hospitalName);
}

function stageFromModuleType(type: string): "rsbk" | "clinicalAudit" | "patientReport" | null {
  if (type === "rsbk") return "rsbk";
  if (type === "clinical-audit") return "clinicalAudit";
  if (type === "patient-report") return "patientReport";
  return null;
}

function normalizeModuleData(moduleDraft: any) {
  const data = moduleDraft?.data || {};
  if (moduleDraft?.type === "rsbk") {
    return {
      data: stripLegacyToolVariationFields(data.formData || data.data || {}),
      score: data.score,
      completed: Boolean(data.completed),
    };
  }
  if (moduleDraft?.type === "clinical-audit") {
    return {
      data: data.formData || data.data || {},
      patientMeta: data.patientMeta,
      currentPatient: data.currentPatient,
      activeDiseaseIndex: data.activeDiseaseIndex,
      score: data.score,
      completed: Boolean(data.completed),
    };
  }
  if (moduleDraft?.type === "patient-report") {
    const patients = Array.isArray(data.registeredPatients) ? data.registeredPatients : [];
    return {
      data: data.data || { registeredPatients: patients },
      patientCount: data.patientCount ?? patients.length,
      score: data.score,
      completed: Boolean(data.completed),
    };
  }
  return { data };
}

function mergeModuleDraftsIntoAssessments(
  assessments: DraftData[],
  moduleDrafts: any[],
  hospital?: { hospitalName?: string; picName?: string; email?: string; hospitalCode?: string }
) {
  const modulesByHospital = new Map<string, any[]>();
  moduleDrafts.forEach((moduleDraft) => {
    const code = moduleDraft.hospitalCode || hospital?.hospitalCode || deriveHospitalCode(hospital?.email);
    if (!code || !moduleDraft.specialty) return;
    // Defense in depth for old rows whose hospital_code was overwritten while
    // their ID still belongs to another RS. Such rows must never add services
    // or assessment data to the active hospital draft.
    const canonicalId = `${moduleDraft.type}-${code}-${moduleDraft.specialty}`;
    if (moduleDraft.id && moduleDraft.id !== canonicalId) return;
    const key = normalize(code);
    modulesByHospital.set(key, [...(modulesByHospital.get(key) || []), moduleDraft]);
  });

  modulesByHospital.forEach((modules, normalizedCode) => {
    const code = modules[0]?.hospitalCode || hospital?.hospitalCode || deriveHospitalCode(hospital?.email);
    let draft = assessments
      .filter((item) => matchesHospitalDraft(item, { ...hospital, hospitalCode: code }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

    if (!draft) {
      draft = {
        draftId: `draft_recovered_${code || normalizedCode}`,
        hospitalName: hospital?.hospitalName || "Rumah Sakit",
        hospitalCode: code,
        hospitalEmail: hospital?.email,
        picName: hospital?.picName || "",
        createdAt: modules.reduce((oldest, item) => {
          const stamp = item.updatedAt || new Date().toISOString();
          return new Date(stamp) < new Date(oldest) ? stamp : oldest;
        }, modules[0]?.updatedAt || new Date().toISOString()),
        updatedAt: modules[0]?.updatedAt || new Date().toISOString(),
        selectedSpecialties: [],
        progress: {},
      };
      assessments.push(draft);
    }

    draft.hospitalCode = draft.hospitalCode || code;
    draft.hospitalEmail = draft.hospitalEmail || hospital?.email;
    draft.hospitalName = draft.hospitalName || hospital?.hospitalName || "Rumah Sakit";
    draft.picName = draft.picName || hospital?.picName || "";

    modules.forEach((moduleDraft) => {
      const stage = stageFromModuleType(moduleDraft.type);
      const specialty = moduleDraft.specialty;
      if (!stage || !specialty) return;
      if (!draft.selectedSpecialties.includes(specialty)) draft.selectedSpecialties.push(specialty);
      if (!draft.progress[specialty]) {
        draft.progress[specialty] = {
          rsbk: { completed: false, data: {} },
          clinicalAudit: { completed: false, data: {} },
          patientReport: { completed: false, data: {} },
        };
      }
      const moduleUpdatedAt = moduleDraft.updatedAt ? new Date(moduleDraft.updatedAt).getTime() : 0;
      const draftUpdatedAt = draft.updatedAt ? new Date(draft.updatedAt).getTime() : 0;
      const stageData = normalizeModuleData(moduleDraft);
      const existingStage = draft.progress[specialty][stage];
      const existingHasData = existingStage?.data && Object.keys(existingStage.data).length > 0;
      if (!existingHasData || moduleUpdatedAt >= draftUpdatedAt) {
        draft.progress[specialty][stage] = { ...existingStage, ...stageData };
      }
      if (moduleUpdatedAt > draftUpdatedAt) draft.updatedAt = moduleDraft.updatedAt;
    });
  });

  return assessments;
}

export function stripLegacyToolVariationFields<T extends Record<string, any>>(data: T = {} as T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !normalized.includes("variasi") && !normalized.includes("variation");
    })
  ) as T;
}

export const draftManager = {
  // Get all drafts
  getAllDrafts(): DraftData[] {
    const draftsStr = localStorage.getItem(DRAFTS_KEY);
    const drafts = draftsStr ? JSON.parse(draftsStr) : [];
    const deletedIds = this.getDeletedDraftIds();
    return drafts.filter((draft: DraftData) => !deletedIds.includes(draft.draftId));
  },

  getDeletedDraftIds(): string[] {
    try {
      return JSON.parse(localStorage.getItem(DELETED_DRAFTS_KEY) || "[]");
    } catch {
      return [];
    }
  },

  rememberDeletedDraft(draftId: string): void {
    const deletedIds = this.getDeletedDraftIds();
    if (!deletedIds.includes(draftId)) {
      safeLocalStorageSet(DELETED_DRAFTS_KEY, JSON.stringify([...deletedIds, draftId]));
    }
  },

  clearDraftRuntimeState(draft?: DraftData | null): void {
    const specialties = new Set<string>(draft?.selectedSpecialties || []);
    try {
      const selected = JSON.parse(sessionStorage.getItem("selectedSpecialties") || "[]");
      if (Array.isArray(selected)) selected.forEach((spec) => specialties.add(spec));
    } catch {}

    specialties.forEach((spec) => {
      DRAFT_SCOPED_SESSION_SUFFIXES.forEach((suffix) => sessionStorage.removeItem(`${spec}${suffix}`));
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith("clinical-audit-draft-") && key.endsWith(`-${spec}`)) {
          localStorage.removeItem(key);
        }
      }
    });

    sessionStorage.removeItem("currentDraftId");
    sessionStorage.removeItem("selectedSpecialties");
    sessionStorage.removeItem("currentSpecialty");
    sessionStorage.removeItem("activeRevisionContext");
  },

  pruneDraftsForHospital(hospital: { hospitalName?: string; email?: string; hospitalCode?: string }): void {
    const drafts = this.getAllDrafts().filter((draft) => matchesHospitalDraft(draft, hospital));
    safeLocalStorageSet(DRAFTS_KEY, JSON.stringify(drafts));
  },

  beginDraftSession(draft: DraftData): void {
    // Root cause guard: old specialty-scoped session/local caches were shared across drafts.
    // Resetting them before binding the new draft prevents stale autosave/result data from hydrating into it.
    this.clearDraftRuntimeState(draft);
    this.setCurrentDraftId(draft.draftId);
    sessionStorage.setItem("selectedSpecialties", JSON.stringify(draft.selectedSpecialties));
  },

  // Get draft by ID
  getDraftById(draftId: string): DraftData | null {
    const drafts = this.getAllDrafts();
    return drafts.find((d) => d.draftId === draftId) || null;
  },

  // Create new draft
  createDraft(
    hospitalName: string,
    picName: string,
    selectedSpecialties: string[],
    hospitalCode?: string,
    hospitalEmail?: string
  ): DraftData {
    const draft: DraftData = {
      draftId: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hospitalName,
      hospitalCode,
      hospitalEmail,
      picName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedSpecialties,
      progress: {},
    };

    // Initialize progress for each specialty
    selectedSpecialties.forEach((specialty) => {
      draft.progress[specialty] = {
        rsbk: { completed: false, data: {} },
        clinicalAudit: { completed: false, data: {} },
        patientReport: { completed: false, data: {} },
      };
    });

    const drafts = this.getAllDrafts();
    drafts.push(draft);
    safeLocalStorageSet(DRAFTS_KEY, JSON.stringify(drafts));

    // Async push to cloud
    saveHospitalDraft(draft).catch(err => console.error("Cloud draft sync failed:", err));

    return draft;
  },

  async createDraftAndSync(
    hospitalName: string,
    picName: string,
    selectedSpecialties: string[],
    hospitalCode?: string,
    hospitalEmail?: string
  ): Promise<DraftData> {
    const draft = this.createDraft(hospitalName, picName, selectedSpecialties, hospitalCode, hospitalEmail);
    await saveHospitalDraft(draft);
    return draft;
  },

  // Update draft
  updateDraft(
    draftId: string,
    specialty: string,
    stage: "rsbk" | "clinicalAudit" | "patientReport",
    data: {
      completed?: boolean;
      confirmed?: boolean;
      data?: Record<string, any>;
      score?: number;
      patientMeta?: Record<string, { initials: string; code: string }>;
      activeDiseaseIndex?: number;
      currentPatient?: number;
      patientCount?: number;
    }
  ): void {
    const drafts = this.getAllDrafts();
    const draftIndex = drafts.findIndex((d) => d.draftId === draftId);

    if (draftIndex === -1) return;

    const draft = drafts[draftIndex];

    // Initialize specialty progress if not exists
    if (!draft.progress[specialty]) {
      draft.progress[specialty] = {
        rsbk: { completed: false, data: {} },
        clinicalAudit: { completed: false, data: {} },
        patientReport: { completed: false, data: {} },
      };
    }

    // Update the specific stage
    const normalizedData = stage === "rsbk" && data.data
      ? { ...data, data: stripLegacyToolVariationFields(data.data) }
      : data;
    draft.progress[specialty][stage] = {
      ...draft.progress[specialty][stage],
      ...normalizedData,
    };

    draft.updatedAt = new Date().toISOString();

    drafts[draftIndex] = draft;
    safeLocalStorageSet(DRAFTS_KEY, JSON.stringify(drafts));

    // Async push to cloud
    saveHospitalDraft(draft).catch(err => console.error("Cloud draft update failed:", err));
  },

  async updateDraftAndSync(
    draftId: string,
    specialty: string,
    stage: "rsbk" | "clinicalAudit" | "patientReport",
    data: Parameters<typeof this.updateDraft>[3]
  ): Promise<void> {
    this.updateDraft(draftId, specialty, stage, data);
    const draft = this.getDraftById(draftId);
    if (draft) await saveHospitalDraft(draft);
  },

  // Delete draft
  deleteDraft(draftId: string): void {
    const draft = this.getDraftById(draftId);
    this.rememberDeletedDraft(draftId);
    const drafts = this.getAllDrafts();
    const filtered = drafts.filter((d) => d.draftId !== draftId);
    safeLocalStorageSet(DRAFTS_KEY, JSON.stringify(filtered));

    if (this.getCurrentDraftId() === draftId) {
      this.clearDraftRuntimeState(draft);
    }

    // Async delete from cloud
    deleteCloudDraft(draftId).catch(err => console.error("Cloud draft deletion failed:", err));
  },

  // Get current draft ID from session
  getCurrentDraftId(): string | null {
    return sessionStorage.getItem("currentDraftId");
  },

  // Set current draft ID to session
  setCurrentDraftId(draftId: string): void {
    sessionStorage.setItem("currentDraftId", draftId);
  },

  // Clear current draft ID
  clearCurrentDraftId(): void {
    sessionStorage.removeItem("currentDraftId");
  },

  // Calculate overall progress for a draft
  calculateDraftProgress(draft: DraftData): {
    totalStages: number;
    completedStages: number;
    percentage: number;
  } {
    let totalStages = 0;
    let completedStages = 0;

    draft.selectedSpecialties.forEach((specialty) => {
      const progress = draft.progress[specialty];
      if (progress) {
        totalStages += 3; // rsbk, clinicalAudit, patientReport
        if (progress.rsbk.completed) completedStages++;
        if (progress.clinicalAudit.completed) completedStages++;
        if (progress.patientReport.completed) completedStages++;
      }
    });

    return {
      totalStages,
      completedStages,
      percentage: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
    };
  },

  // Get next incomplete stage for a draft
  getNextStage(draft: DraftData): {
    specialty: string;
    stage: "rsbk" | "clinicalAudit" | "patientReport";
  } | null {
    for (const specialty of draft.selectedSpecialties) {
      const progress = draft.progress[specialty];
      if (!progress) {
        return { specialty, stage: "rsbk" };
      }

      if (!progress.rsbk.completed) {
        return { specialty, stage: "rsbk" };
      }
      if (!progress.clinicalAudit.completed) {
        return { specialty, stage: "clinicalAudit" };
      }
      if (!progress.patientReport.completed) {
        return { specialty, stage: "patientReport" };
      }
    }

    // All completed, go to result of last specialty
    return null;
  },

  // Manual cloud sync reconciliation
  async syncWithCloud(hospital?: { hospitalName?: string; picName?: string; email?: string; hospitalCode?: string }): Promise<void> {
    try {
      if (!hospital?.email && !hospital?.hospitalCode) {
        return;
      }

      const cloudDrafts = await getAllHospitalDrafts();
      const hospitalCode = hospital?.hospitalCode || deriveHospitalCode(hospital?.email);
      const moduleDrafts = hospitalCode ? await getHospitalModuleDrafts(hospitalCode) : [];
      const deletedIds = this.getDeletedDraftIds();
      const localDrafts = this.getAllDrafts();
      
      // Deleted cloud drafts can resolve after a local delete. Tombstones prevent them from being merged back.
      // Keep tombstones local-only: a stale browser/device must not delete a valid cloud draft for the hospital.
      const mergedDrafts = [...localDrafts];
      
      cloudDrafts.forEach(cd => {
        if (deletedIds.includes(cd.draftId)) {
          return;
        }
        const index = mergedDrafts.findIndex(ld => ld.draftId === cd.draftId);
        if (index === -1) {
          mergedDrafts.push(cd);
        } else {
          // Compare updatedAt
          if (new Date(cd.updatedAt) > new Date(mergedDrafts[index].updatedAt)) {
            mergedDrafts[index] = cd;
          }
        }
      });

      // Recovery path: old/local-only failures could leave module drafts in cloud without a parent assessment draft.
      // Rebuilding the parent draft makes progress visible again on any device after login.
      const recoveredDrafts = mergeModuleDraftsIntoAssessments(mergedDrafts, moduleDrafts, hospital);
      // Clean up local storage by keeping only drafts that belong to the current hospital
      const cleanedDrafts = hospital 
        ? recoveredDrafts.filter(draft => matchesHospitalDraft(draft, hospital)) 
        : recoveredDrafts;
      safeLocalStorageSet(DRAFTS_KEY, JSON.stringify(cleanedDrafts));

      const currentHospitalDrafts = cleanedDrafts;
      const syncResults = await Promise.allSettled(
        currentHospitalDrafts.map((draft) => saveHospitalDraft(draft))
      );
      const tombstonedDraftIds = new Set(
        syncResults.flatMap((result, index) =>
          result.status === "rejected" && /telah dihapus.*cache lama/i.test(result.reason?.message || "")
            ? [currentHospitalDrafts[index].draftId]
            : []
        )
      );
      if (tombstonedDraftIds.size > 0) {
        const survivingDrafts = currentHospitalDrafts.filter(
          (draft) => !tombstonedDraftIds.has(draft.draftId)
        );
        safeLocalStorageSet(DRAFTS_KEY, JSON.stringify(survivingDrafts));
        const currentDraftId = this.getCurrentDraftId();
        if (currentDraftId && tombstonedDraftIds.has(currentDraftId)) {
          this.clearDraftRuntimeState(null);
        }
      }
    } catch (err) {
      console.error("Manual cloud sync failed:", err);
    }
  }
};
