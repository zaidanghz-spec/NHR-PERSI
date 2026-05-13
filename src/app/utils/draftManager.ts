import { saveHospitalDraft, getAllHospitalDrafts, deleteHospitalDraft as deleteCloudDraft } from "./api";
import { safeLocalStorageSet } from "./storage";

export interface DraftData {
  draftId: string;
  hospitalName: string;
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
  createDraft(hospitalName: string, picName: string, selectedSpecialties: string[]): DraftData {
    const draft: DraftData = {
      draftId: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hospitalName,
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
  async syncWithCloud(): Promise<void> {
    try {
      const cloudDrafts = await getAllHospitalDrafts();
      const deletedIds = this.getDeletedDraftIds();
      if (cloudDrafts.length > 0) {
        const localDrafts = this.getAllDrafts();
        
        // Deleted cloud drafts can resolve after a local delete. Tombstones prevent them from being merged back.
        const mergedDrafts = [...localDrafts];
        
        cloudDrafts.forEach(cd => {
          if (deletedIds.includes(cd.draftId)) {
            deleteCloudDraft(cd.draftId).catch(err => console.error("Cloud tombstone cleanup failed:", err));
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

        safeLocalStorageSet(DRAFTS_KEY, JSON.stringify(mergedDrafts));
      }
    } catch (err) {
      console.error("Manual cloud sync failed:", err);
    }
  }
};
