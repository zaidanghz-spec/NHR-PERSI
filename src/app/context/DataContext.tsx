import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { 
  getAllSubmissions, 
  addSubmission as addSubmissionToDb, 
  updateSubmissionStatus as updateStatusInDb,
  updateSubmissionReview as updateReviewInDb,
  getAllHospitalAccounts,
  addHospitalAccount as addAccountToDb,
  updateAccountStatus as updateAccountStatusInDb,
  publishRankingToDb,
  unpublishRankingFromDb,
  getAllRankingsFromDb,
  addNewsToDb,
  deleteNewsFromDb,
  getAllNews,
  addEventToDb,
  deleteEventFromDb,
  getAllEvents
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
  password: string;
  hospitalName: string;
  picName: string;
  province: string;
  city: string;
  registeredAt: string;
  status: "pending_activation" | "activated" | "rejected";
  suratTugasFileName?: string;
  suratTugasData?: string; // base64 data URL
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
}

// ============ DEFAULT DATA ============
const defaultNews: NewsItem[] = [
  {
    id: "news-1",
    title: "PERSI Luncurkan Platform Ranking Rumah Sakit Nasional Berbasis Data",
    excerpt: "Platform NHR PERSI resmi diluncurkan sebagai standar penilaian kualitas rumah sakit di Indonesia menggunakan metodologi berbasis evidence.",
    content: "Perhimpunan Rumah Sakit Seluruh Indonesia (PERSI) resmi meluncurkan platform ranking rumah sakit nasional yang menggunakan sistem penilaian NHR PERSI (National Hospital Ranking PERSI). Platform ini dirancang untuk memberikan transparansi kualitas layanan rumah sakit kepada masyarakat Indonesia.\n\nSistem penilaian berbasis tiga pilar utama: RSBK (Rumah Sakit Berstandar Kemampuan), Clinical Audit, dan Patient Report yang mencakup PREM dan PROM. Setiap rumah sakit yang berpartisipasi akan dinilai secara komprehensif oleh tim reviewer PERSI.\n\nDr. Kuntjoro Adi Purjanto, Ketua Umum PERSI, menyatakan bahwa platform ini merupakan langkah maju dalam meningkatkan akuntabilitas dan transparansi layanan kesehatan di Indonesia.",
    category: "berita",
    imageUrl: "https://images.unsplash.com/photo-1650946706426-99f46fe7106a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBob3NwaXRhbCUyMGJ1aWxkaW5nJTIwSW5kb25lc2lhfGVufDF8fHx8MTc3MzM2NjU2MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    author: "Tim Redaksi PERSI",
    publishedAt: "2026-03-10",
    featured: true,
  },
  {
    id: "news-2",
    title: "Kemenkes Dorong Digitalisasi Penilaian Mutu Rumah Sakit di Seluruh Indonesia",
    excerpt: "Kementerian Kesehatan mendukung inisiatif digitalisasi penilaian mutu melalui platform terintegrasi untuk meningkatkan standar layanan.",
    content: "Kementerian Kesehatan RI menyambut baik inisiatif PERSI dalam mengembangkan platform digital untuk penilaian mutu rumah sakit. Digitalisasi ini diharapkan dapat mempercepat proses evaluasi dan memberikan data real-time tentang kualitas layanan kesehatan di Indonesia.",
    category: "regulasi",
    imageUrl: "https://images.unsplash.com/photo-1758691462848-ba1e929da259?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGhjYXJlJTIwdGVjaG5vbG9neSUyMGRpZ2l0YWwlMjBpbm5vdmF0aW9ufGVufDF8fHx8MTc3MzM2NjU2MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    author: "Tim Redaksi PERSI",
    publishedAt: "2026-03-08",
    featured: false,
  },
  {
    id: "news-3",
    title: "Clinical Audit: Standar Baru Evaluasi Mutu Layanan Spesialistik RS",
    excerpt: "Metode clinical audit berbasis 30 rekam medis menjadi standar baru dalam menilai kepatuhan protokol klinis rumah sakit di Indonesia.",
    content: "PERSI memperkenalkan metode clinical audit sebagai komponen utama dalam sistem penilaian NHR PERSI. Metode ini menggunakan sampel 30 rekam medis per pelayanan untuk mengevaluasi kepatuhan rumah sakit terhadap protokol klinis yang telah ditetapkan.",
    category: "publikasi",
    imageUrl: "https://images.unsplash.com/photo-1758691462743-f9fc9e430d39?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3NwaXRhbCUyMGRvY3RvcnMlMjBtZWV0aW5nJTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc3MzM2NjU2MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    author: "Dr. Andi Wijaya, MPH",
    publishedAt: "2026-03-05",
    featured: false,
  },
  {
    id: "news-4",
    title: "Implementasi PREM dan PROM Sebagai Indikator Patient-Centered Care",
    excerpt: "Patient Reported Experience Measures dan Patient Reported Outcome Measures menjadi bagian integral dari penilaian kualitas rumah sakit.",
    content: "Dalam upaya meningkatkan pendekatan patient-centered care, PERSI mengintegrasikan PREM (Patient Reported Experience Measures) dan PROM (Patient Reported Outcome Measures) sebagai salah satu pilar penilaian dalam NHR PERSI Assessment.",
    category: "inovasi",
    imageUrl: "https://images.unsplash.com/photo-1660795308754-4c6422baf2f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwY29uZmVyZW5jZSUyMHNlbWluYXIlMjBoZWFsdGhjYXJlfGVufDF8fHx8MTc3MzM2NjU2MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    author: "Tim Riset PERSI",
    publishedAt: "2026-03-01",
    featured: false,
  },
];

const defaultEvents: EventItem[] = [
  {
    id: "event-1",
    title: "Hospital Expo & Forum (HEF) 2026",
    description: "Pameran dan forum terbesar bagi industri rumah sakit di Indonesia. Menampilkan inovasi terkini dalam teknologi kesehatan, manajemen RS, dan layanan pasien.",
    date: "2026-10-21",
    endDate: "2026-10-24",
    location: "Jakarta Convention Center (JCC)",
    type: "congress",
    imageUrl: "https://images.unsplash.com/photo-1660795308754-4c6422baf2f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwY29uZmVyZW5jZSUyMHNlbWluYXIlMjBoZWFsdGhjYXJlfGVufDF8fHx8MTc3MzM2NjU2MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    registrationUrl: "#",
    featured: true,
  },
  {
    id: "event-2",
    title: "Workshop NHR PERSI Assessment untuk Rumah Sakit",
    description: "Pelatihan teknis cara mengisi dan mempersiapkan data untuk NHR PERSI Assessment. Terbuka untuk semua rumah sakit anggota PERSI.",
    date: "2026-04-15",
    location: "Online (Zoom Webinar)",
    type: "workshop",
    imageUrl: "https://images.unsplash.com/photo-1758691462743-f9fc9e430d39?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3NwaXRhbCUyMGRvY3RvcnMlMjBtZWV0aW5nJTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc3MzM2NjU2MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    registrationUrl: "#",
    featured: true,
  },
  {
    id: "event-3",
    title: "Seminar Nasional: Transformasi Mutu RS di Era Digital",
    description: "Pembicara kunci dari Kemenkes RI, WHO Indonesia, dan praktisi RS terkemuka membahas strategi peningkatan mutu berbasis data dan teknologi.",
    date: "2026-05-20",
    location: "Hotel Mulia Senayan, Jakarta",
    type: "seminar",
    imageUrl: "https://images.unsplash.com/photo-1650946706426-99f46fe7106a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBob3NwaXRhbCUyMGJ1aWxkaW5nJTIwSW5kb25lc2lhfGVufDF8fHx8MTc3MzM2NjU2MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    registrationUrl: "#",
    featured: false,
  },
  {
    id: "event-4",
    title: "Webinar: Best Practices Clinical Audit di Rumah Sakit",
    description: "Panduan praktis melaksanakan clinical audit yang efektif dan efisien, termasuk cara mengumpulkan dan menganalisis 30 rekam medis sesuai standar NHR PERSI.",
    date: "2026-04-28",
    location: "Online (Zoom Webinar)",
    type: "webinar",
    imageUrl: "https://images.unsplash.com/photo-1758691462848-ba1e929da259?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGhjYXJlJTIwdGVjaG5vbG9neSUyMGRpZ2l0YWwlMjBpbm5vdmF0aW9ufGVufDF8fHx8MTc3MzM2NjU2MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    registrationUrl: "#",
    featured: false,
  },
];

// ============ CONTEXT ============
interface DataContextType {
  // News
  news: NewsItem[];
  addNews: (item: Omit<NewsItem, "id">) => void;
  updateNews: (id: string, item: Partial<NewsItem>) => void;
  deleteNews: (id: string) => void;

  // Events
  events: EventItem[];
  addEvent: (item: Omit<EventItem, "id">) => void;
  updateEvent: (id: string, item: Partial<EventItem>) => void;
  deleteEvent: (id: string) => void;

  // Hospital Accounts
  hospitalAccounts: HospitalAccount[];
  registerHospitalFull: (email: string, password: string, hospitalName: string, picName: string, suratTugasFileName: string, suratTugasData: string, province?: string, city?: string) => Promise<boolean>;
  loginHospital: (email: string, password: string) => HospitalAccount | null;
  activateHospital: (email: string) => void;
  rejectHospital: (email: string) => void;

  // Admin Auth
  isAdmin: boolean;
  adminLogin: (email: string, password: string) => boolean;
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
  const [news, setNews] = useState<NewsItem[]>(() => loadFromStorage("persi_news", defaultNews));
  const [events, setEvents] = useState<EventItem[]>(() => loadFromStorage("persi_events", defaultEvents));
  const [hospitalAccounts, setHospitalAccounts] = useState<HospitalAccount[]>(() => loadFromStorage("persi_hospital_accounts", []));
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("persi_admin") === "true");
  const [currentHospital, setCurrentHospital] = useState<HospitalAccount | null>(() => {
    const stored = sessionStorage.getItem("persi_hospital_session");
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  });
  const [approvedRankings, setApprovedRankings] = useState<ApprovedRanking[]>(() => loadFromStorage("persi_rankings", []));
  const [submissions, setSubmissions] = useState<SubmissionType[]>(() => loadFromStorage("persi_submissions", []));
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Initial cloud sync
  useEffect(() => {
    async function syncSubmissions() {
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
    
    // Sync Hospital Accounts
    async function syncAccounts() {
      try {
        const dbAccs = await getAllHospitalAccounts();
        if (dbAccs !== null) {
          setHospitalAccounts(dbAccs);
          safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(dbAccs));
        }
      } catch (err) {
        console.error("Failed to sync accounts:", err);
      }
    }
    syncAccounts();
    draftManager.syncWithCloud();

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
        const dbNews = await getAllNews();
        if (dbNews !== null) {
          setNews(dbNews);
          safeLocalStorageSet("persi_news", JSON.stringify(dbNews));
        }
        
        const dbEvents = await getAllEvents();
        if (dbEvents !== null) {
          setEvents(dbEvents);
          safeLocalStorageSet("persi_events", JSON.stringify(dbEvents));
        }
      } catch (err) {
        console.error("Failed to sync news/events:", err);
      }
    }
    syncNewsAndEvents();
  }, []);

  const forcePushToCloud = useCallback(async () => {
    try {
      // Pushes all local accounts and submissions to the cloud if they are missing
      for (const account of hospitalAccounts) {
        await addAccountToDb(account).catch(() => {});
      }
      for (const sub of submissions) {
        await addSubmissionToDb(sub).catch(() => {});
      }
      return true;
    } catch (err) {
      console.error("Force push failed:", err);
      return false;
    }
  }, [hospitalAccounts, submissions]);

  const syncWithCloud = useCallback(async () => {
    try {
      const [dbSubs, dbAccs, dbRankings, dbNews, dbEvents] = await Promise.all([
        getAllSubmissions(),
        getAllHospitalAccounts(),
        getAllRankingsFromDb(),
        getAllNews(),
        getAllEvents()
      ]);

      // SAFETY MERGE: Never overwrite local data with nothing if local has contents.
      // This solves the "tiba-tiba hilang" issue if cloud returns an empty or partial set.
      
      if (dbSubs !== null) {
        setSubmissions(prev => {
          const merged = [...dbSubs];
          // Keep local submissions that haven't hit the cloud yet
          prev.forEach(p => {
            if (!merged.find(m => m.id === p.id)) merged.push(p);
          });
          return merged;
        });
      }
      
      if (dbAccs !== null) {
        setHospitalAccounts(prev => {
          const merged = [...dbAccs];
          // Keep local accounts that haven't hit the cloud yet
          prev.forEach(p => {
            if (!merged.find(m => m.email.toLowerCase() === p.email.toLowerCase())) merged.push(p);
          });
          return merged;
        });
      }

      if (dbRankings !== null) { setApprovedRankings(dbRankings); }
      if (dbNews !== null) { setNews(dbNews); }
      if (dbEvents !== null) { setEvents(dbEvents); }
      
      draftManager.syncWithCloud();
    } catch (err) {
      console.error("Manual sync failed:", err);
    }
  }, []);

  useEffect(() => {
    // Polling for updates (every 30 seconds)
    const interval = setInterval(() => {
      syncWithCloud();
    }, 30000);
    return () => clearInterval(interval);
  }, [syncWithCloud]);

  // Persist to localStorage
  useEffect(() => { safeLocalStorageSet("persi_news", JSON.stringify(news)); }, [news]);
  useEffect(() => { safeLocalStorageSet("persi_events", JSON.stringify(events)); }, [events]);
  useEffect(() => { safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(hospitalAccounts)); }, [hospitalAccounts]);
  useEffect(() => { safeLocalStorageSet("persi_rankings", JSON.stringify(approvedRankings)); }, [approvedRankings]);
  useEffect(() => { safeLocalStorageSet("persi_submissions", JSON.stringify(submissions)); }, [submissions]);

  // News
  const addNews = useCallback((item: Omit<NewsItem, "id">) => {
    const newItem = { ...item, id: `news-${Date.now()}` };
    setNews((prev) => {
      const updated = [newItem, ...prev];
      safeLocalStorageSet("persi_news", JSON.stringify(updated));
      return updated;
    });
    addNewsToDb(newItem).catch(console.error);
  }, []);

  const updateNews = useCallback((id: string, item: Partial<NewsItem>) => {
    setNews(prev => prev.map(n => n.id === id ? { ...n, ...item } : n));
  }, []);

  const deleteNews = useCallback((id: string) => {
    setNews((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      safeLocalStorageSet("persi_news", JSON.stringify(updated));
      return updated;
    });
    deleteNewsFromDb(id).catch(console.error);
  }, []);

  // Events
  const addEvent = useCallback((item: Omit<EventItem, "id">) => {
    const newItem = { ...item, id: `event-${Date.now()}` };
    setEvents((prev) => {
      const updated = [newItem, ...prev];
      safeLocalStorageSet("persi_events", JSON.stringify(updated));
      return updated;
    });
    addEventToDb(newItem).catch(console.error);
  }, []);

  const updateEvent = useCallback((id: string, item: Partial<EventItem>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...item } : e));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      safeLocalStorageSet("persi_events", JSON.stringify(updated));
      return updated;
    });
    deleteEventFromDb(id).catch(console.error);
  }, []);

  // Hospital Registration (open registration, activation by admin)
  const registerHospitalFull = useCallback(async (
    email: string, password: string, hospitalName: string, picName: string,
    suratTugasFileName: string, suratTugasData: string,
    province?: string, city?: string
  ): Promise<boolean> => {
    let currentAccounts: HospitalAccount[] = hospitalAccounts;
    try {
      const storedAcc = localStorage.getItem("persi_hospital_accounts");
      if (storedAcc) currentAccounts = JSON.parse(storedAcc);
    } catch {}

    // Check if email already registered
    if (currentAccounts.find(a => a.email.toLowerCase() === email.toLowerCase())) return false;

    const account: HospitalAccount = {
      email: email.toLowerCase(),
      password,
      hospitalName,
      picName,
      province: province || "",
      city: city || "",
      registeredAt: new Date().toISOString(),
      status: "pending_activation",
      suratTugasFileName,
      suratTugasData,
    };
    
    try {
      await addAccountToDb(account);
      const updatedAccounts = [...currentAccounts, account];
      setHospitalAccounts(updatedAccounts);
      safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(updatedAccounts));
      return true;
    } catch (err) {
      console.error("Cloud account push failed:", err);
      throw err;
    }
  }, [hospitalAccounts]);

  const loginHospital = useCallback((email: string, password: string): HospitalAccount | null => {
    let accounts = hospitalAccounts;
    try {
      const stored = localStorage.getItem("persi_hospital_accounts");
      if (stored) accounts = JSON.parse(stored);
    } catch {}

    const account = accounts.find(
      a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );
    if (account) {
      if (account.status === "activated") {
        setCurrentHospital(account);
        // Also store email in session so hospitalCode can be derived consistently
        sessionStorage.setItem("persi_hospital_session", JSON.stringify(account));
      }
      return account;
    }
    return null;
  }, [hospitalAccounts]);

  const activateHospital = useCallback((email: string) => {
    setHospitalAccounts(prev => {
      const updated = prev.map(a =>
        a.email.toLowerCase() === email.toLowerCase()
          ? { ...a, status: "activated" as const }
          : a
      );
      safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(updated));
      return updated;
    });
    updateAccountStatusInDb(email, "activated").catch(err => console.error("Cloud activation failed:", err));
  }, []);

  const rejectHospital = useCallback((email: string) => {
    setHospitalAccounts(prev => {
      const updated = prev.map(a =>
        a.email.toLowerCase() === email.toLowerCase()
          ? { ...a, status: "rejected" as const }
          : a
      );
      safeLocalStorageSet("persi_hospital_accounts", JSON.stringify(updated));
      return updated;
    });
    updateAccountStatusInDb(email, "rejected").catch(err => console.error("Cloud rejection failed:", err));
  }, []);

  const hospitalLogout = useCallback(() => {
    setCurrentHospital(null);
    sessionStorage.removeItem("persi_hospital_session");
    sessionStorage.removeItem("hospitalAuth");
  }, []);

  // Admin Auth
  const adminLogin = useCallback((email: string, password: string): boolean => {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    
    if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
      setIsAdmin(true);
      sessionStorage.setItem("persi_admin", "true");
      return true;
    }
    return false;
  }, []);

  const adminLogout = useCallback(() => {
    setIsAdmin(false);
    sessionStorage.removeItem("persi_admin");
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
        
        // Push to cloud background
        publishRankingToDb(finalRanking).catch(console.error);
        return updated;
      }
      
      finalRanking.id = `rank-${Date.now()}`;
      
      // Push to cloud background
      publishRankingToDb(finalRanking).catch(console.error);
      
      return [...prev, finalRanking as ApprovedRanking].sort((a, b) => b.finalScore - a.finalScore);
    });
  }, []);

  const unpublishRanking = useCallback((submissionId: string) => {
    setApprovedRankings(prev => prev.filter(r => r.submissionId !== submissionId));
    // Remove from cloud background
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
    } catch (err) {
      console.error("Cloud push failed:", err);
      throw err;
    }
  }, []);

  const updateSubmissionStatus = useCallback(async (id: string, status: SubmissionType["status"], notes?: string, revisionTargets?: any, revisionNotes?: any) => {
    let updatedDetailsJson: any = null;
    
    setSubmissions(prev => prev.map(s => {
      if (s.id === id) {
        // Embed reviewer notes directly into details for database mapping
        const newDetails = { 
          ...(s.details || {}), 
          reviewerNotes: notes !== undefined ? notes : s.details?.reviewerNotes,
          revisionTargets: revisionTargets || s.details?.revisionTargets,
          revisionNotes: revisionNotes || s.details?.revisionNotes,
          revisionRequestedAt: status === "Revision Required" ? new Date().toISOString() : s.details?.revisionRequestedAt,
        };
        updatedDetailsJson = newDetails;
        
        return { 
          ...s, 
          status, 
          details: newDetails,
          reviewerNotes: notes !== undefined ? notes : s.reviewerNotes // keep flat for UI compat
        };
      }
      return s;
    }));

    // Sync to cloud
    try {
      if (updatedDetailsJson) {
        await updateReviewInDb(id, status, updatedDetailsJson);
      } else {
        await updateStatusInDb(id, status);
      }
    } catch (err) {
      console.error("Cloud status update failed:", err);
    }

    // Auto-takedown: if changing to Revision Required, remove from rankings
    if (status === "Revision Required") {
      unpublishRanking(id);
    }
  }, [unpublishRanking]);

  return (
    <DataContext.Provider value={{
      news, addNews, updateNews, deleteNews,
      events, addEvent, updateEvent, deleteEvent,
      hospitalAccounts, registerHospitalFull, loginHospital, activateHospital, rejectHospital,
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
