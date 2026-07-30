import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import {
  getAllSubmissions,
  addSubmission as addSubmissionToDb,
  updateSubmissionStatus as updateStatusInDb,
  updateSubmissionReview as updateReviewInDb,
  getAllHospitalAccounts,
  addHospitalAccount as addAccountToDb,
  updateAccountStatus as updateAccountStatusInDb,
  deleteHospitalAccount as deleteHospitalAccountInDb,
  resetHospitalPassword as resetHospitalPasswordInDb,
  publishRankingToDb,
  unpublishRankingFromDb,
  getAllRankingsFromDb,
  addNewsToDb,
  updateNewsInDb,
  deleteNewsFromDb,
  getAllNews,
  addEventToDb,
  updateEventInDb,
  deleteEventFromDb,
  getAllEvents,
  loginHospital as apiLoginHospital,
  loginAdmin as apiLoginAdmin,
  getHospitalCode,
  deleteDraft as deleteDraftApi,
} from "../utils/api";
import { draftManager } from "../utils/draftManager";

// ============ TYPES ============
export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: "berita" | "publikasi" | "regulasi" | "inovasi";
  imageUrl: string;
  author: string;
  publishedAt: string;
  featured: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  location: string;
  type: "seminar" | "workshop" | "congress" | "webinar";
  imageUrl: string;
  registrationUrl?: string;
  featured: boolean;
}

export interface HospitalAccount {
  email: string;
  hospitalCode?: string;
  hospitalName: string;
  picName: string;
  province: string;
  city: string;
  registeredAt: string;
  status: "pending_activation" | "activated" | "rejected";
  suratTugasFileName?: string;
}

export interface ApprovedRanking {
  id: string;
  hospitalName: string;
  city: string;
  province: string;
  specialty: string;
  finalScore: number;
  rsbkScore: number;
  clinicalAuditScore: number;
  patientReportScore: number;
  grade: string;
  approvedAt: string;
  submissionId: string;
}

export interface SubmissionType {
  id: string;
  hospitalName: string;
  hospitalCode?: string;
  picName: string;
  specialty: string;
  disease: string;
  submittedDate: string;
  status: "Pending" | "Approved" | "Revision Required";
  scores: {
    rsbk: number;
    clinicalAudit: number;
    patientReport: number;
    final: number;
  };
  details: any;
  reviewerNotes?: string;
  updatedAt?: string | null;
}

// ============ UTILITIES ============
const normalizeAccountStatus = (status: string = ""): HospitalAccount["status"] => {
  const normalized = status.trim().toLowerCase();
  if (["activated", "active", "aktif"].includes(normalized)) return "activated";
  if (["rejected", "ditolak"].includes(normalized)) return "rejected";
  return "pending_activation";
};

const normalizeAccount = (account: HospitalAccount): HospitalAccount => ({
  ...account,
  status: normalizeAccountStatus(account.status),
});

const mergeHospitalAccounts = (primary: HospitalAccount[] = [], secondary: HospitalAccount[] = []) => {
  const merged = new Map<string, HospitalAccount>();
  [...secondary, ...primary].forEach((account) => {
    const key = account.email.trim().toLowerCase();
    if (!key) return;
    const existing = merged.get(key);
    merged.set(key, normalizeAccount({ ...existing, ...account }));
  });
  return Array.from(merged.values()).sort((a, b) =>
    new Date(b.registeredAt || 0).getTime() - new Date(a.registeredAt || 0).getTime()
  );
};

// ============ CONTEXT ============
interface DataContextType {
  // News
  news: NewsItem[];
  addNews: (item: Omit<NewsItem, "id">) => Promise<void>;
  updateNews: (id: string, item: Partial<NewsItem>) => Promise<void>;
  deleteNews: (id: string) => Promise<void>;

  // Events
  events: EventItem[];
  addEvent: (item: Omit<EventItem, "id">) => Promise<void>;
  updateEvent: (id: string, item: Partial<EventItem>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;

  // Hospital Accounts
  hospitalAccounts: HospitalAccount[];
  registerHospitalFull: (email: string, password: string, hospitalName: string, picName: string, suratTugasFileName: string, suratTugasData: string, province?: string, city?: string) => Promise<boolean>;
  loginHospital: (email: string, password: string) => Promise<HospitalAccount | null>;
  activateHospital: (email: string) => void;
  rejectHospital: (email: string) => void;
  deleteHospitalAccount: (email: string) => Promise<void>;
  resetHospitalPassword: (email: string, password: string) => Promise<void>;

  // Admin Auth
  isAdmin: boolean;
  adminLogin: (username: string, password: string) => Promise<boolean>;
  adminLogout: () => void;

  // Hospital Auth
  currentHospital: HospitalAccount | null;
  hospitalLogout: () => void;

  // Rankings
  approvedRankings: ApprovedRanking[];
  publishRanking: (ranking: Omit<ApprovedRanking, "id">) => void;

  submissions: SubmissionType[];
  addSubmission: (sub: Omit<SubmissionType, "id">) => Promise<void>;
  updateSubmissionStatus: (id: string, status: SubmissionType["status"], notes?: string, revisionTargets?: any, revisionNotes?: any) => Promise<void>;
  unpublishRanking: (submissionId: string) => void;
  syncWithCloud: () => Promise<void>;
  forcePushToCloud: () => Promise<boolean>;
}

import { safeLocalStorageSet, loadFromStorage } from "../utils/storage";

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [hospitalAccounts, setHospitalAccounts] = useState<HospitalAccount[]>([]);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("persi_admin") === "true");
  const [currentHospital, setCurrentHospital] = useState<HospitalAccount | null>(() => {
    const stored = sessionStorage.getItem("persi_hospital_session");
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const [approvedRankings, setApprovedRankings] = useState<ApprovedRanking[]>(() => loadFromStorage("persi_rankings", []));
  const [submissions, setSubmissions] = useState<SubmissionType[]>(() => loadFromStorage("persi_submissions", []));
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const cloudSyncInFlightRef = useRef<Promise<void> | null>(null);

  // Initial cloud sync
  useEffect(() => {
    async function syncSubmissions() {
      if (!isAdmin) return;
      setIsCloudSyncing(true);
      try {
        const dbSubs = await getAllSubmissions();
        if (dbSubs !== null) {
          setSubmissions(dbSubs);
          safeLocalStorageSet("persi_submissions", JSON.stringify(dbSubs));
        }
      } catch (err) {
        console.error("Failed to sync from cloud:", err);
      } finally {
        setIsCloudSyncing(false);
      }
    }
    syncSubmissions();

    async function syncAccounts() {
      if (!isAdmin) return;
      try {
        const dbAccs = await getAllHospitalAccounts();
        if (dbAccs !== null) {
          const cloudAccounts = mergeHospitalAccounts(dbAccs, []);
          setHospitalAccounts(cloudAccounts);
          safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(cloudAccounts));
        }
      } catch (err) {
        console.error("Failed to sync accounts:", err);
      }
    }
    syncAccounts();
    if (currentHospital) draftManager.syncWithCloud(currentHospital);

    async function syncRankings() {
      try {
        const dbRankings = await getAllRankingsFromDb();
        if (dbRankings !== null) {
          setApprovedRankings(dbRankings);
          safeLocalStorageSet("persi_rankings", JSON.stringify(dbRankings));
        }
      } catch (err) {
        console.error("Failed to sync rankings:", err);
      }
    }
    syncRankings();

    async function syncNewsAndEvents() {
      try {
        localStorage.removeItem("persi_news");
        localStorage.removeItem("persi_events");
        const dbNews = await getAllNews();
        if (dbNews !== null) {
          setNews(dbNews);
        }
        const dbEvents = await getAllEvents();
        if (dbEvents !== null) {
          setEvents(dbEvents);
        }
      } catch (err) {
        console.error("Failed to sync news/events:", err);
      }
    }
    syncNewsAndEvents();
  }, [currentHospital, isAdmin]);

  const forcePushToCloud = useCallback(async () => {
    try {
      for (const account of hospitalAccounts) {
        await addAccountToDb(account).catch(() => { });
      }
      for (const sub of submissions) {
        await addSubmissionToDb(sub).catch(() => { });
      }
      return true;
    } catch (err) {
      console.error("Force push failed:", err);
      return false;
    }
  }, [hospitalAccounts, submissions]);

  const syncWithCloud = useCallback(() => {
    // Several pages can ask for a refresh at once (the admin poller, the
    // 30-second provider poller, and route entry effects). Reuse the same
    // promise so a slow request cannot create an ever-growing request pile.
    if (cloudSyncInFlightRef.current) return cloudSyncInFlightRef.current;

    let syncPromise: Promise<void>;
    syncPromise = (async () => {
      try {
        const [dbSubs, dbAccs, dbRankings, dbNews, dbEvents] = await Promise.all([
          isAdmin ? getAllSubmissions() : Promise.resolve(null),
          isAdmin ? getAllHospitalAccounts() : Promise.resolve(null),
          getAllRankingsFromDb(),
          getAllNews(),
          getAllEvents()
        ]);

      if (dbSubs !== null) {
        setSubmissions(prev => {
          const merged = [...dbSubs];
          prev.forEach(p => { if (!merged.find(m => m.id === p.id)) merged.push(p); });
          return merged;
        });
      }
      if (dbAccs !== null) {
        const cloudAccounts = mergeHospitalAccounts(dbAccs, []);
        setHospitalAccounts(cloudAccounts);
        safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(cloudAccounts));
      }
      if (dbRankings !== null) setApprovedRankings(dbRankings);
      localStorage.removeItem("persi_news");
      localStorage.removeItem("persi_events");
      if (dbNews !== null) setNews(dbNews);
      if (dbEvents !== null) setEvents(dbEvents);

        if (currentHospital) await draftManager.syncWithCloud(currentHospital);
      } catch (err) {
        console.error("Manual sync failed:", err);
      }
    })().finally(() => {
      if (cloudSyncInFlightRef.current === syncPromise) cloudSyncInFlightRef.current = null;
    });
    cloudSyncInFlightRef.current = syncPromise;
    return syncPromise;
  }, [currentHospital, isAdmin]);

  useEffect(() => {
    const interval = setInterval(() => { syncWithCloud(); }, 30000);
    return () => clearInterval(interval);
  }, [syncWithCloud]);

  // Persist operational data to localStorage. News/events intentionally stay Turso-only,
  // so stale content from another device/browser cannot appear when Turso is empty.
  useEffect(() => { safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(hospitalAccounts)); }, [hospitalAccounts]);
  useEffect(() => { safeLocalStorageSet("persi_rankings", JSON.stringify(approvedRankings)); }, [approvedRankings]);
  useEffect(() => { safeLocalStorageSet("persi_submissions", JSON.stringify(submissions)); }, [submissions]);

  // News
  const refreshNews = useCallback(async () => {
    const dbNews = await getAllNews();
    setNews(dbNews || []);
    localStorage.removeItem("persi_news");
  }, []);

  const refreshEvents = useCallback(async () => {
    const dbEvents = await getAllEvents();
    setEvents(dbEvents || []);
    localStorage.removeItem("persi_events");
  }, []);

  const addNews = useCallback(async (item: Omit<NewsItem, "id">) => {
    const newItem = { ...item, id: `news-${Date.now()}` };
    await addNewsToDb(newItem);
    await refreshNews();
  }, [refreshNews]);

  const updateNews = useCallback(async (id: string, item: Partial<NewsItem>) => {
    const current = news.find(n => n.id === id);
    if (!current) return;
    await updateNewsInDb(id, { ...current, ...item });
    await refreshNews();
  }, [news, refreshNews]);

  const deleteNews = useCallback(async (id: string) => {
    await deleteNewsFromDb(id);
    await refreshNews();
  }, [refreshNews]);

  // Events
  const addEvent = useCallback(async (item: Omit<EventItem, "id">) => {
    const newItem = { ...item, id: `event-${Date.now()}` };
    await addEventToDb(newItem);
    await refreshEvents();
  }, [refreshEvents]);

  const updateEvent = useCallback(async (id: string, item: Partial<EventItem>) => {
    const current = events.find(e => e.id === id);
    if (!current) return;
    await updateEventInDb(id, { ...current, ...item });
    await refreshEvents();
  }, [events, refreshEvents]);

  const deleteEvent = useCallback(async (id: string) => {
    await deleteEventFromDb(id);
    await refreshEvents();
  }, [refreshEvents]);

  // Hospital Registration
  const registerHospitalFull = useCallback(async (
    email: string, password: string, hospitalName: string, picName: string,
    suratTugasFileName: string, suratTugasData: string,
    province?: string, city?: string
  ): Promise<boolean> => {
    const account: HospitalAccount = {
      email: email.toLowerCase(),
      hospitalName,
      picName,
      province: province || "",
      city: city || "",
      registeredAt: new Date().toISOString(),
      status: "pending_activation",
      suratTugasFileName,
    };

    try {
      // Send password to server for hashing — never store it locally
      await addAccountToDb({ ...account, password, suratTugasData });
      setHospitalAccounts(prev => {
        const updatedAccounts = mergeHospitalAccounts([account], prev);
        safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(updatedAccounts));
        return updatedAccounts;
      });
      return true;
    } catch (err) {
      console.error("Cloud account push failed:", err);
      throw err;
    }
  }, [hospitalAccounts]);

  const loginHospital = useCallback(async (email: string, password: string): Promise<HospitalAccount | null> => {
    const result = await apiLoginHospital(email.trim().toLowerCase(), password.trim());

    if (!result.success) {
      if (result.error === "pending_activation") throw new Error("pending_activation");
      if (result.error === "rejected") throw new Error("rejected");
      return null;
    }

    if (result.token) {
      localStorage.setItem("hospitalToken", result.token);
      sessionStorage.setItem("hospitalToken", result.token);
    }

    const account = normalizeAccount(result.account as HospitalAccount);
    // Preserve assessment local copies until the migration below has uploaded
    // them. Runtime/session keys are still cleared to avoid binding the new
    // login to the previous draft session.
    draftManager.clearDraftRuntimeState(undefined, { preserveLocalAssessment: true });
    setCurrentHospital(account);
    sessionStorage.setItem("persi_hospital_session", JSON.stringify(account));

    const hospitalCode = account.hospitalCode || getHospitalCode(account.email);
    sessionStorage.setItem("hospitalAuth", JSON.stringify({
      hospitalName: account.hospitalName,
      picName: account.picName,
      hospitalCode,
      email: account.email,
      authenticated: true,
    }));
    draftManager.pruneDraftsForHospital({ ...account, hospitalCode });

    // Authentication must not be blocked by draft recovery. A stale local
    // queue, a deleted draft, or a busy server can fail this best-effort sync;
    // surfacing that failure as a login error made valid RS credentials look
    // invalid. The sync remains scoped to this hospital and can retry later.
    try {
      await draftManager.migrateLocalAssessmentDataToCloud({ ...account, hospitalCode });
      await draftManager.syncWithCloud({ ...account, hospitalCode });
    } catch (syncError) {
      console.warn("Hospital login succeeded; draft sync will retry later:", syncError);
    }

    setHospitalAccounts(prev => {
      const merged = mergeHospitalAccounts([account], prev);
      safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(merged));
      return merged;
    });

    return account;
  }, []);

  const activateHospital = useCallback((email: string) => {
    setHospitalAccounts(prev => {
      const updated = prev.map(a =>
        a.email.toLowerCase() === email.toLowerCase() ? { ...a, status: "activated" as const } : a
      );
      safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(updated));
      return updated;
    });
    updateAccountStatusInDb(email, "activated").catch(err => console.error("Cloud activation failed:", err));
  }, []);

  const rejectHospital = useCallback((email: string) => {
    setHospitalAccounts(prev => {
      const updated = prev.map(a =>
        a.email.toLowerCase() === email.toLowerCase() ? { ...a, status: "rejected" as const } : a
      );
      safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(updated));
      return updated;
    });
    updateAccountStatusInDb(email, "rejected").catch(err => console.error("Cloud rejection failed:", err));
  }, []);

  const deleteHospitalAccount = useCallback(async (email: string) => {
    try {
      await deleteHospitalAccountInDb(email);
    } catch (err: any) {
      if (err?.statusCode === 401 || /\(401\)/.test(err?.message || "")) throw err;
      console.warn("Cloud account delete skipped; removing local account only:", err);
    }
    setHospitalAccounts(prev => {
      const updated = prev.filter(a => a.email.toLowerCase() !== email.toLowerCase());
      safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(updated));
      return updated;
    });
    setCurrentHospital(prev => (
      prev?.email?.toLowerCase() === email.toLowerCase() ? null : prev
    ));
  }, []);

  const resetHospitalPassword = useCallback(async (email: string, password: string) => {
    await resetHospitalPasswordInDb(email, password);
  }, []);

  const hospitalLogout = useCallback(() => {
    // Do not erase local assessment copies on logout. The next authenticated
    // login must get a chance to migrate them to the server first.
    draftManager.clearDraftRuntimeState(undefined, { preserveLocalAssessment: true });
    setCurrentHospital(null);
    localStorage.removeItem("hospitalToken");
    sessionStorage.removeItem("hospitalToken");
    sessionStorage.removeItem("persi_hospital_session");
    sessionStorage.removeItem("hospitalAuth");
  }, []);

  // Admin Auth
  const adminLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
    const result = await apiLoginAdmin(username.trim(), password.trim());
    if (!result.success) return false;
    if (result.token) {
      sessionStorage.setItem("auth_token", result.token);
      localStorage.setItem("auth_token", result.token);
    }
    setIsAdmin(true);
    sessionStorage.setItem("persi_admin", "true");
    return true;
  }, []);

  const adminLogout = useCallback(() => {
    setIsAdmin(false);
    sessionStorage.removeItem("persi_admin");
    sessionStorage.removeItem("auth_token");
    localStorage.removeItem("auth_token");
  }, []);

  // Rankings
  const publishRanking = useCallback((ranking: Omit<ApprovedRanking, "id">) => {
    setApprovedRankings(prev => {
      let finalRanking = { ...ranking, id: "" };
      const existing = prev.findIndex(r => r.submissionId === ranking.submissionId);
      if (existing >= 0) {
        finalRanking.id = prev[existing].id;
        const updated = [...prev];
        updated[existing] = finalRanking as ApprovedRanking;
        publishRankingToDb(finalRanking).catch(console.error);
        return updated;
      }
      finalRanking.id = `rank-${Date.now()}`;
      publishRankingToDb(finalRanking).catch(console.error);
      return [...prev, finalRanking as ApprovedRanking].sort((a, b) => b.finalScore - a.finalScore);
    });
  }, []);

  const unpublishRanking = useCallback((submissionId: string) => {
    setApprovedRankings(prev => prev.filter(r => r.submissionId !== submissionId));
    unpublishRankingFromDb(submissionId).catch(console.error);
  }, []);

  const addSubmission = useCallback(async (sub: Omit<SubmissionType, "id">) => {
    const newId = `SUB-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
    const fullSub = { ...sub, id: newId };

    setSubmissions(prev => {
      const updated = [fullSub, ...prev];
      safeLocalStorageSet("persi_submissions", JSON.stringify(updated));
      return updated;
    });

    try {
      await addSubmissionToDb(fullSub);
      await Promise.allSettled([
        deleteDraftApi("clinical-audit", fullSub.hospitalCode || "", fullSub.specialty),
        deleteDraftApi("patient-report", fullSub.hospitalCode || "", fullSub.specialty),
        deleteDraftApi("rsbk", fullSub.hospitalCode || "", fullSub.specialty),
      ]);
    } catch (err) {
      console.error("Cloud push failed:", err);
      throw err;
    }
  }, []);

  const updateSubmissionStatus = useCallback(async (id: string, status: SubmissionType["status"], notes?: string, revisionTargets?: any, revisionNotes?: any) => {
    let updatedDetailsJson: any = null;
    let currentUpdatedAt: string | null = null;

    setSubmissions(prev => prev.map(s => {
      if (s.id === id) {
        currentUpdatedAt = s.updatedAt ?? null;
        const newDetails = {
          ...(s.details || {}),
          reviewerNotes: notes !== undefined ? notes : s.details?.reviewerNotes,
          revisionTargets: revisionTargets || s.details?.revisionTargets,
          revisionNotes: revisionNotes || s.details?.revisionNotes,
          revisionRequestedAt: status === "Revision Required" ? new Date().toISOString() : s.details?.revisionRequestedAt,
        };
        updatedDetailsJson = newDetails;
        return { ...s, status, details: newDetails, reviewerNotes: notes !== undefined ? notes : s.reviewerNotes };
      }
      return s;
    }));

    try {
      if (updatedDetailsJson) {
        await updateReviewInDb(id, status, updatedDetailsJson);
      } else {
        await updateStatusInDb(id, status, currentUpdatedAt);
      }
    } catch (err: any) {
      console.error("Cloud status update failed:", err);
      if (err?.statusCode === 409 || /\(409\)/.test(err?.message || "")) {
        throw err;
      }
    }

    if (status === "Revision Required") {
      unpublishRanking(id);
    }
  }, [unpublishRanking]);

  return (
    <DataContext.Provider value={{
      news, addNews, updateNews, deleteNews,
      events, addEvent, updateEvent, deleteEvent,
      hospitalAccounts, registerHospitalFull, loginHospital, activateHospital, rejectHospital, deleteHospitalAccount, resetHospitalPassword,
      isAdmin, adminLogin, adminLogout,
      currentHospital, hospitalLogout,
      approvedRankings, publishRanking, unpublishRanking,
      submissions, addSubmission, updateSubmissionStatus,
      syncWithCloud, forcePushToCloud,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
