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
        data: Record<string, string>;
        score?: number;
      };
      clinicalAudit: {
        completed: boolean;
        data: Record<string, string>;
        currentPatient?: number;
        score?: number;
      };
      patientReport: {
        completed: boolean;
        data: Record<string, any>;
        patientCount?: number;
      };
    };
  };
}

const DRAFTS_KEY = "siap_persi_drafts";

export const draftManager = {
  // Get all drafts
  getAllDrafts(): DraftData[] {
    const draftsStr = localStorage.getItem(DRAFTS_KEY);
    return draftsStr ? JSON.parse(draftsStr) : [];
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
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));

    return draft;
  },

  // Update draft
  updateDraft(
    draftId: string,
    specialty: string,
    stage: "rsbk" | "clinicalAudit" | "patientReport",
    data: {
      completed?: boolean;
      data?: Record<string, any>;
      score?: number;
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
    draft.progress[specialty][stage] = {
      ...draft.progress[specialty][stage],
      ...data,
    };

    draft.updatedAt = new Date().toISOString();

    drafts[draftIndex] = draft;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  },

  // Delete draft
  deleteDraft(draftId: string): void {
    const drafts = this.getAllDrafts();
    const filtered = drafts.filter((d) => d.draftId !== draftId);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered));
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
};
