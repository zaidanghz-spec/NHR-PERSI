import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  MessageSquare,
  Heart,
  ChevronRight,
  Save,
  QrCode,
  X,
  Download,
  Copy,
  RefreshCw,
  UserPlus,
  Users,
  Trash2,
  Eye,
  CheckCircle2,
  Loader2,
  FileUp,
  UploadCloud,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { QRCodeDisplay } from "../components/QRCodeGenerator";
import { specialtyAuditData } from "../data/specialtyAuditData";
import { SpecialtyProgressTracker } from "../components/SpecialtyProgressTracker";
import type { PatientSurveyResponse } from "./PatientPremPromPage";
import * as api from "../utils/api";
import { getHospitalCode } from "../utils/api";
import { safeLocalStorageSet } from "../utils/storage";
import { draftManager } from "../utils/draftManager";

interface RegisteredPatient {
  id: string;
  name: string;
  rm: string;
  registeredAt: string;
  surveyed: boolean;
  diseaseIndex?: number;
  diseaseKey?: string;
  diseaseName?: string;
}

const normalizePatientCode = (value?: string) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizePatientName = (value?: string) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const getSurveyIdentity = (response: any) => {
  const code = normalizePatientCode(response?.medicalRecordNumber || response?.patientRm || response?.qRm || response?.rm);
  if (code) return `rm:${code}`;
  const name = normalizePatientName(response?.patientName || response?.qName || response?.name);
  return name ? `name:${name}` : `id:${response?.id || JSON.stringify(response || {})}`;
};

const getUniqueSurveyResponses = (responses: PatientSurveyResponse[]) => {
  const byPatient = new Map<string, PatientSurveyResponse>();
  responses.forEach((response) => {
    const key = getSurveyIdentity(response);
    const existing = byPatient.get(key);
    const existingTime = existing ? new Date(existing.submittedAt || (existing as any).timestamp || 0).getTime() : 0;
    const incomingTime = new Date(response.submittedAt || (response as any).timestamp || 0).getTime();
    if (!existing || incomingTime >= existingTime) byPatient.set(key, response);
  });
  return Array.from(byPatient.values());
};

export function PatientReportPage() {
  const { specialty } = useParams<{ specialty: string }>();
  const navigate = useNavigate();
  const specData = specialty ? specialtyAuditData[specialty as keyof typeof specialtyAuditData] : null;
  const diseases = specData?.diseases || [];

  // Get hospital code — must match Turso's hospital_code column (derived from email, the Turso PK)
  const authData = JSON.parse(sessionStorage.getItem("hospitalAuth") || "{}");
  const hasHospitalAuth = Boolean(authData.hospitalName && (authData.hospitalCode || authData.email));
  const hospitalName = hasHospitalAuth ? authData.hospitalName : "";
  const hospitalCode = hasHospitalAuth ? authData.hospitalCode || getHospitalCode(authData.email || "") : "";

  const [activeDiseaseIndex, setActiveDiseaseIndex] = useState(0);
  const activeDisease = diseases[activeDiseaseIndex];

  // Use disease-specific key suffix for API calls
  const diseaseSpecialtyKey = `${specialty}-d${activeDiseaseIndex}`;

  const [surveyResponses, setSurveyResponses] = useState<PatientSurveyResponse[]>([]);
  const [registeredPatients, setRegisteredPatients] = useState<RegisteredPatient[]>([]);
  const [allDiseaseScores, setAllDiseaseScores] = useState<Record<number, {
    avgPremScore: number; avgPromScore: number; overallScore: number;
    qrPatientCount: number; pdfPatientCount: number; patientCount: number;
    qrValidityWeight: number; adjustedOverallScore: number; diseaseName: string;
  }>>({});
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showQRModal, setShowQRModal] = useState<RegisteredPatient | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<PatientSurveyResponse | null>(null);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientRM, setNewPatientRM] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [draftSavedMsg, setDraftSavedMsg] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  // Custom hospital survey upload
  const [customSurveyFile, setCustomSurveyFile] = useState<File | null>(null);
  const [customSurveyUploaded, setCustomSurveyUploaded] = useState(false);
  const [customSurveyFileName, setCustomSurveyFileName] = useState<string>("");
  const [customSurveyPatientCount, setCustomSurveyPatientCount] = useState<number>(0);
  const [diseaseCompletion, setDiseaseCompletion] = useState<Record<number, number>>({});
  const refreshInFlightRef = useRef(false);
  const lastFullProgressRefreshRef = useRef(0);
  // NOTE: PREM/PROM scores for PDF uploads are set ONLY by admin, not by the hospital

  const getDiseaseIndexFromKey = (key?: string) => {
    const parsed = Number(String(key || "").match(/-d(\d+)$/)?.[1] ?? NaN);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const getPatientDiseaseIndex = (patient?: RegisteredPatient | null) => {
    if (!patient) return activeDiseaseIndex;
    if (typeof patient.diseaseIndex === "number" && Number.isFinite(patient.diseaseIndex)) return patient.diseaseIndex;
    return getDiseaseIndexFromKey(patient.diseaseKey || "") ?? activeDiseaseIndex;
  };

  const getPatientDiseaseKey = (patient?: RegisteredPatient | null) => {
    const diseaseIndex = getPatientDiseaseIndex(patient);
    return patient?.diseaseKey || `${specialty}-d${diseaseIndex}`;
  };

  const getPatientDiseaseName = (patient?: RegisteredPatient | null) => {
    const diseaseIndex = getPatientDiseaseIndex(patient);
    return diseases[diseaseIndex]?.diseaseName || patient?.diseaseName || activeDisease?.diseaseName || "";
  };

  useEffect(() => {
    if (!hasHospitalAuth) {
      navigate("/hospital-login");
    }
  }, [hasHospitalAuth, navigate]);

  // Load existing custom survey upload from API on mount & disease change
  useEffect(() => {
    const checkCustomSurvey = async () => {
      if (!hasHospitalAuth || !hospitalCode || !specialty) return;
      const data = await api.getCustomSurveyMetadata(hospitalCode, diseaseSpecialtyKey);
      if (data) {
        setCustomSurveyUploaded(true);
        setCustomSurveyFileName(data.fileName);
        setCustomSurveyPatientCount(data.patientCount);
      } else {
        setCustomSurveyUploaded(false);
        setCustomSurveyFileName("");
        setCustomSurveyPatientCount(0);
      }
    };
    checkCustomSurvey();
  }, [hasHospitalAuth, hospitalCode, diseaseSpecialtyKey, specialty]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasHospitalAuth || !hospitalCode) {
      navigate("/hospital-login");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran file maksimal 2MB. Vercel LocalStorage memiliki kuota yang terbatas.");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Hanya format PDF yang diperbolehkan");
      return;
    }

    const countStr = prompt("Berapa jumlah pasien yang disurvei dalam dokumen PDF ini?\n(Kosongkan atau isi 0 jika tidak tahu/ingin menggunakan kombinasi dengan QR Code)", "0");
    if (countStr === null) return;
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count < 0) {
      alert("Jumlah pasien tidak valid.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const doc = {
        fileName: file.name,
        base64,
        patientCount: Math.min(count, 30),
        uploadedAt: new Date().toISOString(),
        hospitalCode,
        hospitalName,
        specialty,
        diseaseName: activeDisease?.diseaseName || "",
        // premScore & promScore will be set by admin only
        premScore: null,
        promScore: null,
      };
      
      try {
        setAutosaveState("saving");
        await api.saveCustomSurveyMetadata(hospitalCode, diseaseSpecialtyKey, doc);
        setCustomSurveyFileName(file.name);
        setCustomSurveyPatientCount(doc.patientCount);
        setCustomSurveyUploaded(true);
        setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setAutosaveState("saved");
        alert(`Dokumen survei PREM/PROM untuk ${activeDisease?.diseaseName} berhasil diunggah! Tim admin PERSI akan meninjau dan memberikan penilaian.`);
      } catch (err: any) {
        console.error("Upload error:", err);
        setAutosaveState("idle");
        alert(`Gagal mengunggah status ke server: ${err.message || "silakan coba PDF yang lebih kecil."}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = async () => {
    if (!hasHospitalAuth || !hospitalCode) {
      navigate("/hospital-login");
      return;
    }

    try {
      setAutosaveState("saving");
      await api.deleteCustomSurveyMetadata(hospitalCode, diseaseSpecialtyKey);
      setCustomSurveyFileName("");
      setCustomSurveyPatientCount(0);
      setCustomSurveyUploaded(false);
      setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setAutosaveState("saved");
    } catch (err) {
      console.error("Failed to remove file:", err);
      setAutosaveState("idle");
    }
  };

  const targetPatientCount = 30;
  // Range-based validity weight (fair scoring)
  // 1-5  patients = 80% validity,  6-10 = 85%, 11-20 = 92%, 21-30 = 100%
  const getSampleValidityWeight = (count: number): number => {
    if (count <= 0) return 0;
    if (count <= 5) return 0.80;
    if (count <= 10) return 0.85;
    if (count <= 20) return 0.92;
    return 1.0;
  };
  const getSampleLabel = (count: number): string => {
    if (count <= 0) return "Belum ada pasien";
    if (count <= 5) return "Sampel Minimal (80%)";
    if (count <= 10) return "Sampel Cukup (85%)";
    if (count <= 20) return "Sampel Baik (92%)";
    return "Sampel Lengkap (100%)";
  };

  // Load registered patients from server
  const loadRegisteredPatients = useCallback(async () => {
    if (!hasHospitalAuth || !hospitalCode || !specialty) return;
    try {
      const patients = await api.getPatients(hospitalCode, diseaseSpecialtyKey);
      setRegisteredPatients(patients.map((patient: any) => {
        const diseaseIndex =
          typeof patient.diseaseIndex === "number"
            ? patient.diseaseIndex
            : getDiseaseIndexFromKey(patient.diseaseKey || patient.specialty) ?? activeDiseaseIndex;
        return {
          ...patient,
          diseaseIndex,
          diseaseKey: patient.diseaseKey || patient.specialty || `${specialty}-d${diseaseIndex}`,
          diseaseName: diseases[diseaseIndex]?.diseaseName || activeDisease?.diseaseName || "",
        };
      }));
    } catch (err) {
      console.error("Failed to load patients:", err);
    }
  }, [hasHospitalAuth, hospitalCode, diseaseSpecialtyKey, specialty, activeDiseaseIndex, activeDisease?.diseaseName, diseases]);

  // Load survey responses from server
  const loadResponses = useCallback(async () => {
    if (!hasHospitalAuth || !hospitalCode || !specialty) return;
    try {
      const surveys = getUniqueSurveyResponses(await api.getSurveys(hospitalCode, diseaseSpecialtyKey));
      setSurveyResponses(surveys);
      
      // Update completion map for ACTIVE disease
      const count = surveys.length + (customSurveyUploaded ? customSurveyPatientCount : 0);
      setDiseaseCompletion(prev => ({ ...prev, [activeDiseaseIndex]: count }));
    } catch (err) {
      console.error("Failed to load surveys:", err);
    }
  }, [hasHospitalAuth, hospitalCode, diseaseSpecialtyKey, specialty, activeDiseaseIndex, customSurveyUploaded, customSurveyPatientCount]);

  // Check progress for ALL diseases (background)
  const checkAllDiseasesProgress = useCallback(async () => {
    if (!hasHospitalAuth || !hospitalCode || !specData) return;
    
    const progress: Record<number, number> = {};
    for (let i = 0; i < diseases.length; i++) {
      const dKey = `${specialty}-d${i}`;
      const surveys = getUniqueSurveyResponses(await api.getSurveys(hospitalCode, dKey));
      
      // Check for PDF upload via API
      const customData = await api.getCustomSurveyMetadata(hospitalCode, dKey);
      const customCount = customData ? customData.patientCount : 0;
      
      progress[i] = surveys.length + customCount;
    }
    setDiseaseCompletion(progress);
  }, [hasHospitalAuth, hospitalCode, specialty, diseases.length, specData]);

  const loadAllDiseaseScores = useCallback(async () => {
    if (!hasHospitalAuth || !hospitalCode || !specData) return;
    const scores: typeof allDiseaseScores = {};
    for (let i = 0; i < diseases.length; i++) {
      const dKey = `${specialty}-d${i}`;
      const surveys = getUniqueSurveyResponses(await api.getSurveys(hospitalCode, dKey));
      const customData = await api.getCustomSurveyMetadata(hospitalCode, dKey);
      const qrCount = surveys.length;
      const pdfCount = customData ? (customData.patientCount || 0) : 0;
      const total = qrCount + pdfCount;
      const avgPrem = qrCount > 0 ? Math.round(surveys.reduce((s, r) => s + r.premScore, 0) / qrCount) : 0;
      const avgProm = qrCount > 0 ? Math.round(surveys.reduce((s, r) => s + r.promScore, 0) / qrCount) : 0;
      const overall = qrCount > 0 ? Math.round(surveys.reduce((s, r) => s + r.overallScore, 0) / qrCount) : 0;
      const w = getSampleValidityWeight(qrCount);
      scores[i] = {
        avgPremScore: avgPrem, avgPromScore: avgProm, overallScore: overall,
        qrPatientCount: qrCount, pdfPatientCount: pdfCount, patientCount: total,
        qrValidityWeight: w, adjustedOverallScore: Number((overall * w).toFixed(1)),
        diseaseName: diseases[i].diseaseName,
      };
    }
    setAllDiseaseScores(scores);
  }, [hasHospitalAuth, hospitalCode, specialty, diseases, specData]);

  const refreshPatientReportData = useCallback(async (options: { fullProgress?: boolean } = {}) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      await Promise.all([loadRegisteredPatients(), loadResponses()]);

      const shouldRefreshAllDiseases =
        options.fullProgress || Date.now() - lastFullProgressRefreshRef.current > 60_000;
      if (shouldRefreshAllDiseases) {
        await Promise.all([checkAllDiseasesProgress(), loadAllDiseaseScores()]);
        lastFullProgressRefreshRef.current = Date.now();
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [loadRegisteredPatients, loadResponses, checkAllDiseasesProgress, loadAllDiseaseScores]);

  // Initial load and on disease tab change
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      await refreshPatientReportData({ fullProgress: true });
      if (!cancelled) setLoading(false);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [refreshPatientReportData]);

  // Auto-refresh is intentionally conservative because every PRM page can fan out into multiple Turso calls.
  // Skip hidden tabs and overlapping requests so national simulation traffic does not pile up serverless invocations.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      refreshPatientReportData();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshPatientReportData]);

  // Mark registered patients that already have surveys
  const getPatientResponse = (patient: RegisteredPatient) => {
    const patientCode = normalizePatientCode(patient.rm);
    const patientName = normalizePatientName(patient.name);

    return surveyResponses.find((response: any) => {
      const responseCode = normalizePatientCode(
        response.medicalRecordNumber || response.patientRm || response.qRm || response.rm
      );
      if (patientCode && responseCode && patientCode === responseCode) return true;

      const responseName = normalizePatientName(response.patientName || response.qName || response.name);
      return Boolean(patientName && responseName && patientName === responseName);
    });
  };

  const patientsWithStatus = registeredPatients.map(p => {
    const response = getPatientResponse(p);
    return {
      ...p,
      surveyed: !!response,
      surveyResponse: response || null,
    };
  });

  // Calculate aggregated scores for QR/non-PDF responses. PDF scores are reviewed by admin.
  // The dashboard count follows completed registered patients, not only the raw response row count,
  // because older retries/backups can temporarily create stale or duplicate response rows.
  const uniqueSurveyResponses = getUniqueSurveyResponses(surveyResponses);
  const completedRegisteredPatientCount = patientsWithStatus.filter((patient) => patient.surveyed).length;
  const qrPatientCount = Math.min(targetPatientCount, Math.max(uniqueSurveyResponses.length, completedRegisteredPatientCount));
  const pdfPatientCount = customSurveyUploaded ? customSurveyPatientCount : 0;
  const patientCount = qrPatientCount + pdfPatientCount;
  const scorePatientCount = uniqueSurveyResponses.length;
  const avgPremScore = scorePatientCount > 0
    ? Math.round(uniqueSurveyResponses.reduce((s, r) => s + r.premScore, 0) / scorePatientCount)
    : 0;
  const avgPromScore = scorePatientCount > 0
    ? Math.round(uniqueSurveyResponses.reduce((s, r) => s + r.promScore, 0) / scorePatientCount)
    : 0;
  const overallScore = scorePatientCount > 0
    ? Math.round(uniqueSurveyResponses.reduce((s, r) => s + r.overallScore, 0) / scorePatientCount)
    : 0;
  const sampleValidityWeight = getSampleValidityWeight(patientCount);
  const qrValidityWeight = getSampleValidityWeight(qrPatientCount);
  const adjustedOverallScore = Number((overallScore * qrValidityWeight).toFixed(1));

  const progress = Math.min((patientCount / targetPatientCount) * 100, 100);
  const isQRLocked = customSurveyUploaded && customSurveyPatientCount >= 30;

  // Build personalized survey URL with disease index
  const buildSurveyUrl = (patient: RegisteredPatient) => {
    const patientDiseaseIndex = getPatientDiseaseIndex(patient);
    const patientDiseaseKey = getPatientDiseaseKey(patient);
    const params = new URLSearchParams({
      name: patient.name,
      rm: patient.rm,
      disease: String(patientDiseaseIndex),
      diseaseKey: patientDiseaseKey,
    });
    return `${window.location.origin}/patient-survey/${hospitalCode}/${specialty}?${params.toString()}`;
  };

  // Register new patient
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");

    if (!hasHospitalAuth || !hospitalCode) {
      navigate("/hospital-login");
      return;
    }

    if (!newPatientName.trim() || !newPatientRM.trim()) {
      setRegisterError("Nama dan nomor rekam medis wajib diisi.");
      return;
    }

    const newPatient: RegisteredPatient = {
      id: `pat-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: newPatientName.trim(),
      rm: newPatientRM.trim(),
      registeredAt: new Date().toISOString(),
      surveyed: false,
      diseaseIndex: activeDiseaseIndex,
      diseaseKey: diseaseSpecialtyKey,
      diseaseName: activeDisease?.diseaseName || "",
    };

    try {
      setAutosaveState("saving");
      const result = await api.registerPatient(hospitalCode, diseaseSpecialtyKey, newPatient);
      if (!result.success && result.error) {
        setAutosaveState("idle");
        setRegisterError(result.error);
        return;
      }
      if (result.duplicate) {
        setAutosaveState("idle");
        setRegisterError("Nomor rekam medis sudah terdaftar.");
        return;
      }
      setNewPatientName("");
      setNewPatientRM("");
      setShowRegisterForm(false);
      
      // Fast UI update for the button validation
      setDiseaseCompletion(prev => ({ ...prev, [activeDiseaseIndex]: (prev[activeDiseaseIndex] || 0) + 1 }));
      
      await loadRegisteredPatients();
      setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setAutosaveState("saved");
    } catch (err: any) {
      setAutosaveState("idle");
      setRegisterError(err.message || "Gagal mendaftarkan pasien.");
    }
  };

  // Remove registered patient
  const handleRemovePatient = async (patient: RegisteredPatient & { surveyed?: boolean }) => {
    if (!hasHospitalAuth || !hospitalCode) {
      navigate("/hospital-login");
      return;
    }
    const warning = patient.surveyed
      ? `Hapus pasien ${patient.name} (${patient.rm}) beserta jawaban surveinya? Data ini tidak akan dihitung lagi.`
      : `Hapus pasien ${patient.name} (${patient.rm}) dari daftar?`;
    if (!window.confirm(warning)) return;

    try {
      setAutosaveState("saving");
      await api.removePatient(hospitalCode, getPatientDiseaseKey(patient), patient.id);
      await loadRegisteredPatients();
      await loadResponses();
      setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setAutosaveState("saved");
    } catch (err) {
      console.error("Failed to remove patient:", err);
      setAutosaveState("idle");
    }
  };

  const handleCopyLink = (patient: RegisteredPatient) => {
    if (!hasHospitalAuth || !hospitalCode) {
      navigate("/hospital-login");
      return;
    }

    navigator.clipboard.writeText(buildSurveyUrl(patient));
    alert(`Link survei untuk ${patient.name} telah disalin!`);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (draftSavedMsg) {
      timer = setTimeout(() => setDraftSavedMsg(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [draftSavedMsg]);

  // Save draft
  const handleSaveDraft = async () => {
    if (!hasHospitalAuth || !hospitalCode || !specialty) return;
    try {
      setAutosaveState("saving");
      await api.saveDraft("patient-report", hospitalCode, specialty, {
        registeredPatients,
      });
      setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setAutosaveState("saved");
      setDraftSavedMsg(true);
    } catch (err) {
      console.error("Failed to save draft:", err);
      setAutosaveState("idle");
    }
  };

  const handleContinue = async () => {
    if (!hasHospitalAuth || !hospitalCode) {
      navigate("/hospital-login");
      return;
    }

    const activeDraftId = draftManager.getCurrentDraftId();
    await handleSaveDraft();
    if (activeDraftId && draftManager.getCurrentDraftId() !== activeDraftId) return;
    
    // Calculate final score across ALL diseases for this specialty
    let finalScore = 0;
    let prmSummary: Record<string, string> = {};
    
    try {
      for (let i = 0; i < diseases.length; i++) {
        const dKey = `${specialty}-d${i}`;  // Must match diseaseSpecialtyKey format
        const diseaseSurveys = getUniqueSurveyResponses(await api.getSurveys(hospitalCode, dKey));
        
        const customDoc = await api.getCustomSurveyMetadata(hospitalCode, dKey);
        const qrCount = diseaseSurveys.length;
        const pdfCount = customDoc ? (customDoc.patientCount || 0) : 0;
        const qrAvg = qrCount > 0
          ? diseaseSurveys.reduce((s, r) => s + (r.overallScore || 0), 0) / qrCount
          : 0;
        const adminPrem = typeof customDoc?.adminPremScore === "number" ? customDoc.adminPremScore : null;
        const adminProm = typeof customDoc?.adminPromScore === "number" ? customDoc.adminPromScore : null;
        const pdfHasScore = adminPrem !== null && adminProm !== null;
        const pdfAvg = pdfHasScore ? (adminPrem * 0.6 + adminProm * 0.4) : 0;
        const scoredPatientCount = qrCount + (pdfHasScore ? pdfCount : 0);
        const diseasePatientCount = qrCount + pdfCount;
        const diseaseAvg = scoredPatientCount > 0
          ? Number((((qrAvg * qrCount) + (pdfAvg * (pdfHasScore ? pdfCount : 0))) / scoredPatientCount).toFixed(1))
          : 0;

        if (customDoc) {
          prmSummary[`${dKey}_pdfPatientCount`] = pdfCount.toString();
          prmSummary[`${dKey}_source`] = pdfHasScore ? "mixed_admin_scored" : "mixed_pending_admin";
          if (pdfHasScore) {
            prmSummary[`${dKey}_pdfPrem`] = String(adminPrem);
            prmSummary[`${dKey}_pdfProm`] = String(adminProm);
          }
        }
        if (diseaseSurveys.length > 0) {
          prmSummary[`${dKey}_qrScore`] = Math.round(qrAvg).toString();
          prmSummary[`${dKey}_qrPatientCount`] = qrCount.toString();

          // Build summary for admin dashboard — use questions array (premQuestions/promQuestions may not exist)
          const allQuestions = [
            ...(diseases[i].premQuestions || []),
            ...(diseases[i].promQuestions || []),
            ...(diseases[i].questions || [])
          ].filter((q, idx, arr) => arr.findIndex(x => x.id === q.id) === idx); // dedupe
          
          allQuestions.forEach(q => {
            let sum = 0, count = 0;
            diseaseSurveys.forEach(survey => {
               if (survey.answers && survey.answers[q.id]) {
                 count++;
                 sum += parseInt(survey.answers[q.id]);
               }
            });
            prmSummary[q.id] = count > 0 ? Math.round(sum / count).toString() : "0";
          });
        }
        
        const weightMatch = diseases[i].weight.match(/(\d+)%/);
        const weight = weightMatch ? parseInt(weightMatch[1]) / 100 : 1;
        const validity = getSampleValidityWeight(scoredPatientCount);
        const adjustedDiseaseScore = Number((diseaseAvg * validity).toFixed(1));

        prmSummary[`${dKey}_rawScore`] = diseaseAvg.toString();
        prmSummary[`${dKey}_patientCount`] = diseasePatientCount.toString();
        prmSummary[`${dKey}_scoredPatientCount`] = scoredPatientCount.toString();
        prmSummary[`${dKey}_validity`] = Math.round(validity * 100).toString();
        prmSummary[`${dKey}_adjustedScore`] = adjustedDiseaseScore.toString();
        prmSummary[`${dKey}_diseaseWeight`] = Math.round(weight * 100).toString();

        finalScore += adjustedDiseaseScore * weight;
      }
    } catch (e) {
      console.error("Failed to fetch all disease surveys for accurate final score:", e);
      finalScore = adjustedOverallScore;
    }

    let totalPRMPatients = 0;
    let allDiseasesHavePRM = diseases.length > 0;
    try {
      for (let i = 0; i < diseases.length; i++) {
        const dKey = `${specialty}-d${i}`;
        const diseaseSurveys = getUniqueSurveyResponses(await api.getSurveys(hospitalCode, dKey));
        const customData = await api.getCustomSurveyMetadata(hospitalCode, dKey);
        const diseaseCount = diseaseSurveys.length + (customData ? (customData.patientCount || 0) : 0);
        totalPRMPatients += diseaseCount;
        if (diseaseCount < 1) allDiseasesHavePRM = false;
      }
    } catch {}
    if (activeDraftId && draftManager.getCurrentDraftId() !== activeDraftId) return;

    sessionStorage.setItem(`${specialty}_prmPatientCount`, totalPRMPatients.toString());

    sessionStorage.setItem(`${specialty}_prmSummary`, JSON.stringify(prmSummary));
    sessionStorage.setItem(`${specialty}_patientReportScore`, Math.round(finalScore).toString());
    const draftId = draftManager.getCurrentDraftId();
    if (draftId && specialty && (!activeDraftId || draftId === activeDraftId)) {
      draftManager.updateDraft(draftId, specialty, "patientReport", {
        data: prmSummary,
        score: Math.round(finalScore),
        patientCount: totalPRMPatients,
        completed: allDiseasesHavePRM,
        confirmed: true,
      });
    }
    navigate(`/siap-persi/result/${specialty}`);
  };

  if (loading) {
    if (!hasHospitalAuth) {
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#0F4C81] animate-spin mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Multi-Specialty Progress */}
        <SpecialtyProgressTracker currentSpecialty={specialty || ""} currentStage="patient-report" />

        {/* Draft Saved Toast */}
        {draftSavedMsg && (
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Draft berhasil disimpan!</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <Link
            to="/siap-persi/select-specialty"
            className="inline-flex items-center text-[#0F4C81] hover:underline mb-4"
          >
            &larr; Kembali ke Pilih Pelayanan
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Patient Reported Measurement
          </h1>
          <p className="text-gray-600">
            Daftarkan pasien per penyakit, generate QR code personal, dan kumpulkan data PREM & PROM hingga mencapai target {targetPatientCount} pasien per penyakit - {specData?.name}
          </p>
          <div className="mt-3">
            <AutosaveIndicator state={autosaveState} timestamp={lastAutosavedAt} />
          </div>
        </div>

        {/* Disease Tabs */}
        {diseases.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <p className="text-sm font-semibold text-gray-600 mb-3">Pilih Penyakit untuk Survei Pasien:</p>
            <div className="flex gap-3">
              {diseases.map((disease, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setActiveDiseaseIndex(index);
                    setShowRegisterForm(false);
                    setShowQRModal(null);
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    index === activeDiseaseIndex
                      ? "bg-[#0F4C81] text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <div>{disease.diseaseName}</div>
                  <div className={`text-xs mt-1 ${index === activeDiseaseIndex ? "text-white/80" : "text-gray-500"}`}>
                    Bobot: {disease.weight}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Score Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#0F4C81] to-[#14B8A6] rounded-2xl p-6 text-white col-span-1 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold mb-1">Survei Terkumpul</h2>
                <p className="text-white/80 text-sm">{activeDisease?.diseaseName} | Target: {targetPatientCount} pasien</p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold">{patientCount}</div>
                <div className="text-white/70 text-sm">/ {targetPatientCount}</div>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-white h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-white/60">
              <span>{qrPatientCount} QR/non-PDF + {pdfPatientCount} PDF</span>
              <span>{patientCount} survei masuk</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 w-fit mx-auto mb-2">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500 mb-1">Skor PREM</p>
            <p className="text-3xl font-bold text-[#0F4C81]">{avgPremScore}</p>
            <p className="text-xs text-gray-400">QR/non-PDF sementara</p>
            {customSurveyUploaded && (
              <p className="text-[10px] font-bold text-amber-600 mt-2">PDF dinilai admin</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <div className="p-2 rounded-lg bg-teal-100 text-teal-600 w-fit mx-auto mb-2">
              <Heart className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500 mb-1">Skor PROM</p>
            <p className="text-3xl font-bold text-[#14B8A6]">{avgPromScore}</p>
            <p className="text-xs text-gray-400">QR/non-PDF sementara</p>
            {customSurveyUploaded && (
              <p className="text-[10px] font-bold text-amber-600 mt-2">PDF dinilai admin</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">Rekap Sumber Data PRM - {activeDisease?.diseaseName}</h3>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-blue-700 mb-1">QR / Non-PDF</p>
              <p className="text-2xl font-black text-blue-900">{qrPatientCount} pasien</p>
              <p className="text-xs text-blue-700 mt-1">Skor rata-rata: {overallScore || 0}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-1">PDF Internal</p>
              <p className="text-2xl font-black text-amber-900">{pdfPatientCount} pasien</p>
              <p className="text-xs text-amber-700 mt-1">{customSurveyUploaded ? "Menunggu nilai manual admin" : "Belum ada PDF"}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-1">Total Sampel</p>
              <p className="text-2xl font-black text-emerald-900">{patientCount} pasien</p>
              <p className="text-xs text-emerald-700 mt-1">Validitas sampel total: {(sampleValidityWeight * 100).toFixed(0)}%</p>
            </div>
          </div>
          {customSurveyUploaded && qrPatientCount > 0 && (
            <p className="mt-3 text-xs text-gray-600">
              Nilai akhir akan digabung oleh admin: skor QR/non-PDF + skor manual PDF, dihitung proporsional berdasarkan jumlah pasien per sumber data.
            </p>
          )}
        </div>

        {/* Scoring Range Info for Patient Report */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Bobot Validitas Berdasarkan Jumlah Survei</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { range: "1–5 Pasien", pct: "80%", color: patientCount >= 1 && patientCount <= 5 ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 border border-amber-200" },
              { range: "6–10 Pasien", pct: "85%", color: patientCount >= 6 && patientCount <= 10 ? "bg-yellow-500 text-white" : "bg-yellow-50 text-yellow-700 border border-yellow-200" },
              { range: "11–20 Pasien", pct: "92%", color: patientCount >= 11 && patientCount <= 20 ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-700 border border-blue-200" },
              { range: "21–30 Pasien", pct: "100%", color: patientCount >= 21 ? "bg-green-500 text-white" : "bg-green-50 text-green-700 border border-green-200" },
            ].map((tier) => (
              <div key={tier.range} className={`rounded-lg px-3 py-2.5 text-center transition-all ${tier.color}`}>
                <p className="font-bold text-sm">{tier.pct}</p>
                <p className="text-xs mt-0.5">{tier.range}</p>
              </div>
            ))}
          </div>
          {patientCount > 0 && (
            <p className="text-xs text-center text-gray-500 mt-3">
              ✓ Bobot validitas saat ini: <strong>{(getSampleValidityWeight(patientCount) * 100).toFixed(0)}%</strong> — {getSampleLabel(patientCount)}
            </p>
          )}
        </div>

        {/* ========== PATIENT REGISTRATION SECTION ========== */}
        {!isQRLocked ? (
          <div className="bg-white rounded-2xl border-2 border-[#0F4C81] p-6 md:p-8 mb-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#0F4C81] rounded-xl flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Daftarkan Pasien - {activeDisease?.diseaseName}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Isi data pasien (nama & no. RM), lalu generate QR code personal. Pasien scan QR untuk mengisi survei PREM & PROM khusus penyakit ini.
                    {customSurveyUploaded && customSurveyPatientCount < 30 && (
                      <span className="block mt-1 text-teal-600 font-semibold">Anda mengunggah PDF dengan {customSurveyPatientCount} pasien. Anda bisa menambah data lewat QR di sini hingga mencapai 30 pasien.</span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => { setShowRegisterForm(!showRegisterForm); setRegisterError(""); }}
                className="bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold shrink-0"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Tambah Pasien
              </Button>
            </div>

          {/* Registration Form */}
          {showRegisterForm && (
            <form onSubmit={handleRegisterPatient} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
              <h4 className="font-bold text-gray-900 mb-4">Data Pasien Baru - {activeDisease?.diseaseName}</h4>
              {registerError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
                  {registerError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Inisial Pasien <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="Contoh: B.S"
                    className="w-full h-11 px-4 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-[#0F4C81]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Kode Pasien <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newPatientRM}
                    onChange={(e) => setNewPatientRM(e.target.value)}
                    placeholder="Contoh: P-001"
                    className="w-full h-11 px-4 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-[#0F4C81] font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold">
                  <QrCode className="w-4 h-4 mr-2" />
                  Daftar & Generate QR
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowRegisterForm(false)}>
                  Batal
                </Button>
              </div>
            </form>
          )}

          {/* How it works */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-900 mb-2 text-sm">Cara Penggunaan:</h4>
            <ol className="space-y-1.5 text-xs text-gray-700">
              <li className="flex gap-2">
                <span className="font-bold text-[#0F4C81] shrink-0">1.</span>
                <span>Pilih tab penyakit yang ingin disurvei, lalu klik &quot;Tambah Pasien&quot;</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#0F4C81] shrink-0">2.</span>
                <span>QR Code personal akan otomatis di-generate dengan pertanyaan PREM/PROM sesuai penyakit</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#0F4C81] shrink-0">3.</span>
                <span>Target optimal 30 pasien per penyakit. Minimal 1 pasien sudah dapat lanjut dengan bobot 80%.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#0F4C81] shrink-0">4.</span>
                <span>Pasien mengisi survei skala 1-5, jawaban otomatis masuk ke scoring</span>
              </li>
            </ol>
          </div>

          {/* Registered Patients List */}
          {patientsWithStatus.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-2 text-gray-600 font-semibold">#</th>
                    <th className="text-left py-3 px-2 text-gray-600 font-semibold">Inisial</th>
                    <th className="text-left py-3 px-2 text-gray-600 font-semibold">Kode Pasien</th>
                    <th className="text-center py-3 px-2 text-gray-600 font-semibold">Status</th>
                    <th className="text-center py-3 px-2 text-gray-600 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {patientsWithStatus.map((p, i) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-2 text-gray-500">{i + 1}</td>
                      <td className="py-2.5 px-2 font-medium text-gray-900">{p.name}</td>
                      <td className="py-2.5 px-2 text-gray-600 font-mono">{p.rm}</td>
                      <td className="py-2.5 px-2 text-center">
                        {p.surveyed ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                            Menunggu
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center justify-center gap-1">
                          {p.surveyed ? (
                            <button
                              onClick={() => {
                                const response = getPatientResponse(p);
                                if (response) setShowReviewModal(response);
                              }}
                              className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                              title="Lihat Hasil Survei"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowQRModal(p)}
                              className="p-2 rounded-lg hover:bg-blue-50 text-[#0F4C81] transition-colors"
                              title="Lihat QR Code"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleCopyLink(p)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                            title="Salin Link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemovePatient(p)}
                            className={`p-2 rounded-lg hover:bg-red-50 transition-colors ${
                              p.surveyed ? "text-red-600" : "text-red-400"
                            }`}
                            title={p.surveyed ? "Hapus pasien dan jawaban survei" : "Hapus pasien"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium text-gray-500">Belum ada pasien terdaftar untuk {activeDisease?.diseaseName}</p>
              <p className="text-xs mt-1">Klik &quot;Tambah Pasien&quot; untuk memulai</p>
            </div>
          )}
        </div>
      ) : (
          <div className="bg-gray-100 rounded-2xl border-2 border-gray-300 p-6 md:p-8 mb-6 opacity-80">
            <div className="flex flex-col items-center justify-center text-center py-6">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <QrCode className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Survei Digital (QR Code) Dinonaktifkan
              </h3>
              <p className="text-gray-600 max-w-lg leading-relaxed">
                Fitur pendaftaran otomatis dikunci karena Anda telah mengisi {customSurveyPatientCount} pasien via <strong>Upload PDF</strong> (Target 30 telah terpenuhi).
              </p>
              <Button 
                onClick={handleRemoveFile}
                variant="outline"
                className="mt-5 border-gray-300 bg-white"
              >
                Hapus File PDF untuk Membuka QR Code
              </Button>
            </div>
          </div>
        )}

        {/* ========== CUSTOM SURVEY UPLOAD SECTION ========== */}
        <div className="bg-white rounded-2xl border-2 border-[#14B8A6]/30 p-6 md:p-8 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileUp className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                Upload Hasil Survei Internal (Opsional)
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Jika rumah sakit Anda sudah memiliki hasil laporan PDF survei PREM/PROM internal khusus <strong>{activeDisease?.diseaseName}</strong>, Anda dapat mengunggahnya setelah atau tanpa generate QR. Maksimal 2MB.
              </p>
            </div>
          </div>

          <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-5">
            {customSurveyUploaded ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-teal-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 shadow-sm bg-teal-100 rounded-lg">
                      <FileText className="w-5 h-5 text-teal-700" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{customSurveyFileName}</h4>
                      <p className="text-xs text-green-600 font-medium tracking-wide">✓ Tersimpan — {customSurveyPatientCount} pasien — {activeDisease?.diseaseName}</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleRemoveFile}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Hapus File
                  </Button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">Menunggu Penilaian Admin PERSI</p>
                    <p className="text-amber-700 text-xs mt-1">
                      Dokumen survei Anda telah diunggah. Tim reviewer PERSI akan meninjau PDF dan memberikan skor PREM &amp; PROM secara manual.
                      Pastikan dokumen sudah lengkap sebelum melakukan submit.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-teal-300 rounded-xl p-8 bg-white transition-colors hover:bg-teal-50/60">
                <UploadCloud className="w-10 h-10 text-teal-500 mb-3" />
                <p className="font-semibold text-gray-700 mb-1">Pilih file PDF laporan survei Anda</p>
                <p className="text-xs text-gray-500 mb-4 font-mono">Format: .pdf (Maksimal 2MB)</p>
                <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                  <FileUp className="w-4 h-4 mr-2" />
                  Browse File PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Response Table (always shown if there are QR code responses) */}
        {surveyResponses.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">
                Hasil Survei - {activeDisease?.diseaseName} ({surveyResponses.length})
              </h3>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Live dari server
                </span>
                <Button
                  onClick={loadResponses}
                  variant="outline"
                  size="sm"
                  className="border-gray-300"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refresh
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-2 text-gray-600 font-semibold">#</th>
                    <th className="text-left py-3 px-2 text-gray-600 font-semibold">Nama</th>
                    <th className="text-left py-3 px-2 text-gray-600 font-semibold">No. RM</th>
                    <th className="text-center py-3 px-2 text-gray-600 font-semibold">PREM</th>
                    <th className="text-center py-3 px-2 text-gray-600 font-semibold">PROM</th>
                    <th className="text-center py-3 px-2 text-gray-600 font-semibold">Total</th>
                    <th className="text-left py-3 px-2 text-gray-600 font-semibold">Waktu</th>
                    <th className="text-center py-3 px-2 text-gray-600 font-semibold">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {surveyResponses.map((r, i) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-2 text-gray-500">{i + 1}</td>
                      <td className="py-2.5 px-2 font-medium text-gray-900">{r.patientName}</td>
                      <td className="py-2.5 px-2 text-gray-600 font-mono">{r.medicalRecordNumber}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          r.premScore >= 75 ? "bg-green-100 text-green-700" :
                          r.premScore >= 50 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>{r.premScore}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          r.promScore >= 75 ? "bg-green-100 text-green-700" :
                          r.promScore >= 50 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>{r.promScore}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">{r.overallScore}</span>
                      </td>
                      <td className="py-2.5 px-2 text-gray-500 text-xs">
                        {new Date(r.submittedAt).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => setShowReviewModal(r)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-[#0F4C81] transition-colors"
                          title="Lihat Detail Jawaban"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Average Row */}
            <div className="mt-4 bg-gray-50 rounded-lg p-4 flex items-center justify-between">
              <span className="font-bold text-gray-700">Rata-rata Skor:</span>
              <div className="flex gap-6 text-sm">
                <span>PREM: <strong className="text-[#0F4C81]">{avgPremScore}</strong></span>
                <span>PROM: <strong className="text-[#14B8A6]">{avgPromScore}</strong></span>
                <span>Total: <strong className="text-gray-900 text-lg">{overallScore}</strong>/100</span>
              </div>
            </div>
          </div>
        )}

        {/* Demo Section */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">Demo: Simulasi Data Pasien - {activeDisease?.diseaseName}</h3>
          <p className="text-gray-700 text-sm mb-4">
            Untuk demo, klik tombol di bawah untuk menambahkan data survei simulasi ke server.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={async () => {
                const surveys = generateSimulationSurveys(specialty || "", activeDiseaseIndex, 5);
                await api.bulkAddSurveys(hospitalCode, diseaseSpecialtyKey, surveys);
                loadResponses();
              }}
              variant="outline"
              className="border-yellow-400 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
            >
              + 5 Pasien Simulasi
            </Button>
            <Button
              onClick={async () => {
                const surveys = generateSimulationSurveys(specialty || "", activeDiseaseIndex, 30);
                await api.bulkAddSurveys(hospitalCode, diseaseSpecialtyKey, surveys);
                loadResponses();
              }}
              variant="outline"
              className="border-yellow-400 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
            >
              + 30 Pasien Simulasi
            </Button>
            <Button
              onClick={async () => {
                await api.resetSurveys(hospitalCode, diseaseSpecialtyKey);
                loadResponses();
              }}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              Reset Data Penyakit Ini
            </Button>
          </div>
        </div>

        {/* Weighted Score Summary Table */}
        <div className="bg-white rounded-xl border-2 border-[#0F4C81] p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Ringkasan Skor PRM (Berbobot)</h3>
          
          <div className="space-y-6">
            {diseases.map((d, i) => {
              const scoreData = allDiseaseScores[i];
              if (!scoreData) return null;
              const hasPdf = scoreData.pdfPatientCount > 0;
              return (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                  <h4 className="text-lg font-bold text-[#0F4C81] mb-4 border-b border-gray-200 pb-2">{d.diseaseName}</h4>
                  
                  {hasPdf && scoreData.qrPatientCount === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                      <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                      <p className="font-bold text-amber-800 mb-1">Menunggu Penilaian Admin</p>
                      <p className="text-amber-700 text-sm">
                        Dokumen survei ({scoreData.pdfPatientCount} pasien) telah diunggah.
                        Skor PREM &amp; PROM akan diberikan oleh tim reviewer PERSI.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">PREM (60%)</p>
                          <p className="text-xl font-bold text-blue-700">{scoreData.avgPremScore}</p>
                        </div>
                        <div className="bg-teal-50/50 border border-teal-100 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">PROM (40%)</p>
                          <p className="text-xl font-bold text-teal-700">{scoreData.avgPromScore}</p>
                        </div>
                        <div className="bg-[#0F4C81]/10 border border-[#0F4C81]/20 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Total PRM</p>
                          <p className="text-xl font-bold text-[#0F4C81]">{scoreData.overallScore}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Bobot Sampel ({scoreData.qrPatientCount} Pasien QR)</p>
                          <p className="text-xl font-bold text-amber-700">{(scoreData.qrValidityWeight * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex justify-between items-center">
                        <span className="font-bold text-green-800">Skor PRM Setelah Validitas</span>
                        <span className="text-2xl font-black text-green-700">{scoreData.adjustedOverallScore}</span>
                      </div>
                      {hasPdf && (
                        <p className="mt-2 text-xs text-amber-700 text-center">
                          Catatan: Ada {scoreData.pdfPatientCount} pasien PDF yang akan digabung ke skor akhir oleh admin.
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-700 mt-6 border border-blue-200">
            <p><strong>Total Skor PRM Pelayanan:</strong> Penjumlahan skor tiap penyakit yang dikalikan dengan bobot masing-masing penyakit.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleSaveDraft}
            variant="outline"
            className="h-12 px-8 border-2 border-gray-300 font-semibold"
          >
            <Save className="w-5 h-5 mr-2" />
            Simpan Draft
          </Button>

          <Button
            onClick={async () => {
              await handleSaveDraft();
              navigate(`/siap-persi/result/${specialty}`);
            }}
            variant="outline"
            className="h-12 px-8 border-2 border-yellow-400 text-yellow-700 hover:bg-yellow-50 font-semibold"
          >
            Isi Nanti (Lanjut ke Review)
          </Button>

          <Button
            onClick={handleContinue}
            disabled={Object.values(diseaseCompletion).length < diseases.length || Object.values(diseaseCompletion).some(count => count < 1)}
            className="flex-1 h-12 bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {Object.values(diseaseCompletion).length < diseases.length || Object.values(diseaseCompletion).some(count => count < 1)
              ? `Mohon isi minimal 1 pasien untuk SETIAP penyakit`
              : `Lanjut ke Hasil Akhir (Skor Total: ${diseases.reduce((total, d, i) => total + ((allDiseaseScores[i]?.adjustedOverallScore || 0) * (d.weight.match(/(\d+)%/) ? parseInt(d.weight.match(/(\d+)%/)![1]) / 100 : 1 / diseases.length)), 0).toFixed(1)})`}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            <strong>Info:</strong> Data tersimpan di server dan auto-refresh setiap 3 detik. Setiap penyakit memiliki daftar pasien terpisah (masing-masing 30 pasien).
            Klik ikon <Eye className="w-3.5 h-3.5 inline" /> untuk review jawaban (read-only).
          </p>
        </div>
      </div>

      {/* QR Code Modal for specific patient */}
      {showQRModal && (
        <PatientQRModal
          patient={showQRModal}
          surveyUrl={buildSurveyUrl(showQRModal)}
          hospitalName={hospitalName}
          specialtyName={specData?.name || ""}
          diseaseName={getPatientDiseaseName(showQRModal)}
          diseaseKey={getPatientDiseaseKey(showQRModal)}
          onClose={() => setShowQRModal(null)}
        />
      )}

      {/* Review Survey Response Modal (read-only) */}
      {showReviewModal && (
        <SurveyReviewModal
          response={showReviewModal}
          specialty={specialty || ""}
          diseaseIndex={getDiseaseIndexFromKey((showReviewModal as any).specialty) ?? activeDiseaseIndex}
          onClose={() => setShowReviewModal(null)}
        />
      )}
    </div>
  );
}

function AutosaveIndicator({ state, timestamp }: { state: "idle" | "saving" | "saved"; timestamp: string }) {
  if (state === "idle") return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
      state === "saving" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
    }`}>
      {state === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
      {state === "saving" ? "Menyimpan..." : `Tersimpan otomatis${timestamp ? ` ${timestamp}` : ""}`}
    </span>
  );
}

// ===== Survey Review Modal (Read-Only) =====
function SurveyReviewModal({
  response,
  specialty,
  diseaseIndex,
  onClose,
}: {
  response: PatientSurveyResponse;
  specialty: string;
  diseaseIndex: number;
  onClose: () => void;
}) {
  const specData = specialtyAuditData[specialty as keyof typeof specialtyAuditData];
  const disease = specData?.diseases[diseaseIndex];
  const premQuestions = disease?.premQuestions || [];
  const promQuestions = disease?.promQuestions || [];

  const getLabelColor = (value: string) => {
    const normalized = String(value || "").trim().toLowerCase();
    const legacyMap: Record<string, string> = { puas: "5", cukup: "3", kurang: "1" };
    const numericValue = legacyMap[normalized] || normalized;
    const scoreMap: Record<string, { label: string; score: number; bg: string; text: string; border: string }> = {
      "5": { label: "Sangat Setuju", score: 100, bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
      "4": { label: "Setuju", score: 75, bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300" },
      "3": { label: "Netral", score: 50, bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300" },
      "2": { label: "Tidak Setuju", score: 25, bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
      "1": { label: "Sangat Tidak Setuju", score: 0, bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
    };
    return scoreMap[numericValue] || { label: value || "-", score: 0, bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" };
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl z-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#0F4C81] rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Review Hasil Survei</h2>
              <p className="text-xs text-gray-500">{disease?.diseaseName} - Data bersifat read-only</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{response.patientName}</p>
              <p className="text-xs text-gray-500 font-mono">RM: {response.medicalRecordNumber}</p>
            </div>
            <div className="ml-auto flex gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">PREM</p>
                <p className={`text-lg font-bold ${response.premScore >= 75 ? "text-green-600" : response.premScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                  {response.premScore}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">PROM</p>
                <p className={`text-lg font-bold ${response.promScore >= 75 ? "text-green-600" : response.promScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                  {response.promScore}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold text-[#0F4C81]">{response.overallScore}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              PREM - Pengalaman Pasien
            </h3>
            <div className="space-y-2">
              {premQuestions.map((q, i) => {
                const answer = response.answers[q.id];
                const style = answer ? getLabelColor(answer) : null;
                return (
                  <div key={q.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{q.question}</p>
                    </div>
                    {style ? (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text} border ${style.border} flex-shrink-0`}>
                        <span className="font-black">{style.score}</span>
                        <span className="text-[10px] opacity-80">/100</span>
                        <span className="hidden sm:inline">- {style.label}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Tidak dijawab</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-teal-600" />
              PROM - Hasil Kesehatan Pasien
            </h3>
            <div className="space-y-2">
              {promQuestions.map((q, i) => {
                const answer = response.answers[q.id];
                const style = answer ? getLabelColor(answer) : null;
                return (
                  <div key={q.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="w-6 h-6 bg-teal-100 text-teal-700 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{q.question}</p>
                    </div>
                    {style ? (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text} border ${style.border} flex-shrink-0`}>
                        <span className="font-black">{style.score}</span>
                        <span className="text-[10px] opacity-80">/100</span>
                        <span className="hidden sm:inline">- {style.label}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Tidak dijawab</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center text-xs text-gray-400 pt-2 border-t border-gray-100">
            Diisi pada: {new Date(response.submittedAt).toLocaleString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== QR Code Modal for a specific patient =====
function PatientQRModal({
  patient,
  surveyUrl,
  hospitalName,
  specialtyName,
  diseaseName,
  diseaseKey,
  onClose,
}: {
  patient: RegisteredPatient;
  surveyUrl: string;
  hospitalName: string;
  specialtyName: string;
  diseaseName: string;
  diseaseKey: string;
  onClose: () => void;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(surveyUrl);
    alert("Link survei telah disalin ke clipboard!");
  };

  const handleDownload = () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(surveyUrl)}&color=0F4C81&bgcolor=ffffff&margin=20&format=png`;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      canvas.width = 600;
      canvas.height = 920;
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 600, 920);

      ctx.fillStyle = "#0F4C81";
      ctx.fillRect(0, 0, 600, 70);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Survei Kepuasan Pasien", 300, 45);

      ctx.drawImage(img, 100, 100, 400, 400);

      ctx.fillStyle = "#0F4C81";
      ctx.font = "bold 20px Arial";
      ctx.fillText(patient.name, 300, 560);

      ctx.fillStyle = "#666666";
      ctx.font = "16px Arial";
      ctx.fillText("Kode Pasien: " + patient.rm, 300, 590);

      ctx.fillStyle = "#333333";
      ctx.font = "18px Arial";
      ctx.fillText(hospitalName, 300, 640);

      ctx.fillStyle = "#14B8A6";
      ctx.font = "16px Arial";
      ctx.fillText(specialtyName + " - " + diseaseName, 300, 670);

      ctx.fillStyle = "#888888";
      ctx.font = "14px Arial";
      ctx.fillText("Scan QR Code di atas untuk mengisi survei", 300, 720);
      ctx.fillText("Skala: 5=Sangat Setuju sampai 1=Sangat Tidak Setuju", 300, 745);

      ctx.fillStyle = "#0F4C81";
      ctx.fillRect(0, 850, 600, 70);
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.fillText("PERSI National Hospital Ranking Indonesia", 300, 880);
      ctx.fillText("NHR PERSI Assessment", 300, 900);

      const link = document.createElement("a");
      link.download = `QR-${patient.name}-${patient.rm}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = qrUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 md:p-10 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-6 h-6 text-gray-500" />
        </button>

        <div className="flex flex-col items-center gap-1 mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-50 border-2 border-blue-200 rounded-full px-5 py-2 mb-2 shadow-sm">
            <span className="font-bold text-gray-900 text-sm">{patient.name}</span>
            <span className="text-gray-300">|</span>
            <span className="text-[#0F4C81] text-sm font-mono font-semibold">{patient.rm}</span>
          </div>
          <p className="text-gray-500 font-medium text-sm">{hospitalName}</p>
          <p className="text-xs text-teal-600 font-bold uppercase tracking-wider">{specialtyName} - {diseaseName}</p>
          <p className="text-[11px] text-gray-400 font-mono">{diseaseKey}</p>
        </div>

        <div className="inline-block bg-white rounded-3xl border-4 border-[#0F4C81] p-6 mb-6 shadow-md">
          <QRCodeDisplay value={surveyUrl} size={260} fgColor="#0F4C81" />
        </div>

        <p className="text-gray-500 text-xs mb-4 max-w-sm mx-auto break-all leading-relaxed">
          {surveyUrl}
        </p>

        <div className="flex items-center justify-center gap-3 text-sm mb-6">
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">5 = 100</span>
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-semibold">3 = 50</span>
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">1 = 0</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleDownload}
            className="h-11 bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PNG
          </Button>
          <Button
            onClick={handleCopy}
            variant="outline"
            className="h-11 border-2 border-[#0F4C81] text-[#0F4C81] font-semibold"
          >
            <Copy className="w-4 h-4 mr-2" />
            Salin Link
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-5">
          QR Code ini khusus untuk <strong>{patient.name}</strong> - {diseaseName}
        </p>
      </div>
    </div>
  );
}

// ===== Simulation Helper =====
function generateSimulationSurveys(specialty: string, diseaseIndex: number, count: number): PatientSurveyResponse[] {
  const scoreMap: Record<string, number> = { puas: 100, cukup: 50, kurang: 0 };

  const firstNames = ["Budi", "Siti", "Agus", "Dewi", "Andi", "Rina", "Joko", "Sri", "Heru", "Yuni", "Dimas", "Putri", "Wahyu", "Lina", "Rudi"];
  const lastNames = ["Santoso", "Wibowo", "Kusuma", "Hartono", "Sari", "Purnama", "Wijaya", "Rahayu", "Pratama", "Andini", "Hidayat", "Utami"];

  const specData = specialtyAuditData[specialty as keyof typeof specialtyAuditData];
  const disease = specData?.diseases[diseaseIndex];
  const premQIds = disease?.premQuestions?.map(q => q.id) || ["prem-1", "prem-2", "prem-3", "prem-4"];
  const promQIds = disease?.promQuestions?.map(q => q.id) || ["prom-1", "prom-2", "prom-3"];

  const surveys: PatientSurveyResponse[] = [];

  for (let i = 0; i < count; i++) {
    const answers: Record<string, string> = {};

    const weightedRandom = () => {
      const r = Math.random();
      if (r < 0.5) return "puas";
      if (r < 0.8) return "cukup";
      return "kurang";
    };

    premQIds.forEach(id => { answers[id] = weightedRandom(); });
    promQIds.forEach(id => { answers[id] = weightedRandom(); });

    const premScores = premQIds.map(id => scoreMap[answers[id]]);
    const promScores = promQIds.map(id => scoreMap[answers[id]]);
    const premAvg = Math.round(premScores.reduce((a, b) => a + b, 0) / premScores.length);
    const promAvg = Math.round(promScores.reduce((a, b) => a + b, 0) / promScores.length);
    const overall = Math.round(premAvg * 0.6 + promAvg * 0.4);

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    surveys.push({
      id: "sim-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
      patientName: firstName + " " + lastName,
      medicalRecordNumber: "RM-" + String(i + 1).padStart(6, "0"),
      specialty,
      answers,
      premScore: premAvg,
      promScore: promAvg,
      overallScore: overall,
      submittedAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
    });
  }

  return surveys;
}
