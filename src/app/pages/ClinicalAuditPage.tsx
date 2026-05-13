import { useState, useEffect } from "react"; // fix-v3-final
import { useParams, Link, useNavigate } from "react-router";
import { ChevronRight, Save, AlertCircle, ChevronLeft, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { specialtyAuditData } from "../data/specialtyAuditData";
import { SpecialtyProgressTracker } from "../components/SpecialtyProgressTracker";
import * as api from "../utils/api";
import { getHospitalCode } from "../utils/api";
import { draftManager } from "../utils/draftManager";

// Audit compliance options
const AUDIT_OPTIONS = [
  { value: "sesuai", label: "sesuai" },
  { value: "tidak-sesuai-pengecualian", label: "tidak sesuai dengan perkecualian klinis" },
  { value: "tidak-sesuai", label: "tidak sesuai" },
];

// Scoring: sesuai = 1, tidak-sesuai-pengecualian = 1, tidak-sesuai = 0
function getOptionScore(value: string): number {
  if (value === "sesuai") return 1;
  if (value === "tidak-sesuai-pengecualian") return 1;
  return 0;
}

// Range-based sample validity weight
function getSampleValidityWeight(count: number): number {
  if (count <= 0) return 0;
  if (count <= 5) return 0.80;
  if (count <= 10) return 0.85;
  if (count <= 20) return 0.92;
  return 1.0;
}

function getSampleLabel(count: number): string {
  if (count <= 0) return "";
  if (count <= 5) return "Sampel Minimal (80% bobot validitas)";
  if (count <= 10) return "Sampel Cukup (85% bobot validitas)";
  if (count <= 20) return "Sampel Baik (92% bobot validitas)";
  return "Sampel Lengkap (100% bobot validitas)";
}

function getDraftKey(specialty: string, hospitalCode: string) {
  return `clinical-audit-draft-${hospitalCode}-${specialty}`;
}

export function ClinicalAuditPage() {
  const { specialty } = useParams<{ specialty: string }>();
  const navigate = useNavigate();
  const specialtyInfo = specialtyAuditData[specialty as keyof typeof specialtyAuditData];

  const diseases = specialtyInfo.diseases;
  const [activeDiseaseIndex, setActiveDiseaseIndex] = useState(0);
  const activeDisease = diseases[activeDiseaseIndex];

  // formData key: `d{diseaseIndex}-{patientNum}-{questionId}` — per-disease, per-patient
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [patientMeta, setPatientMeta] = useState<Record<string, { initials: string; code: string }>>({});
  const [currentPatient, setCurrentPatient] = useState(1);
  const [draftSavedMsg, setDraftSavedMsg] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string>("");

  const authData = JSON.parse(sessionStorage.getItem("hospitalAuth") || "{}");
  const hospitalName = authData.hospitalName || "Unknown Hospital";
  const hospitalCode = authData.hospitalCode || getHospitalCode(authData.email || "");

  // Load draft on mount
  useEffect(() => {
    if (!specialty) return;
    let cancelled = false;
    const capturedDraftId = draftManager.getCurrentDraftId();
    setFormData({});
    setPatientMeta({});
    setCurrentPatient(1);
    setActiveDiseaseIndex(0);
    const isStillActiveDraft = () =>
      Boolean(!cancelled && capturedDraftId && draftManager.getCurrentDraftId() === capturedDraftId);
    const hydrateClinicalDraft = (draft: any) => {
      if (!isStillActiveDraft() || draft?.draftId !== capturedDraftId) return false;
      if (draft.formData) setFormData(draft.formData);
      if (draft.patientMeta) setPatientMeta(draft.patientMeta);
      if (draft.currentPatient) setCurrentPatient(draft.currentPatient);
      if (typeof draft.activeDiseaseIndex === "number") setActiveDiseaseIndex(draft.activeDiseaseIndex);
      return true;
    };
    async function loadDraft() {
      const currentDraftId = capturedDraftId;
      const currentDraft = currentDraftId ? draftManager.getDraftById(currentDraftId) : null;
      const currentClinical = currentDraft?.progress?.[specialty!]?.clinicalAudit;

      if (currentClinical?.data && Object.keys(currentClinical.data).length > 0) {
        if (!isStillActiveDraft()) return;
        setFormData(currentClinical.data);
        if (currentClinical.patientMeta) setPatientMeta(currentClinical.patientMeta);
        if (currentClinical.currentPatient) setCurrentPatient(currentClinical.currentPatient);
        if (typeof currentClinical.activeDiseaseIndex === "number") setActiveDiseaseIndex(currentClinical.activeDiseaseIndex);
        return;
      }

      try {
        const serverDraft = await api.getDraft("clinical-audit", hospitalCode, specialty!);
        if (serverDraft && serverDraft.formData && hydrateClinicalDraft(serverDraft)) {
          return;
        }
      } catch { /* fallback */ }
      try {
        const saved = localStorage.getItem(getDraftKey(specialty!, hospitalCode));
        if (saved) {
          const draft = JSON.parse(saved);
          hydrateClinicalDraft(draft);
        }
      } catch { /* ignore */ }
    }
    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [specialty, hospitalCode]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (draftSavedMsg) {
      timer = setTimeout(() => setDraftSavedMsg(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [draftSavedMsg]);

  // Key builder: disease-specific patient key
  const makeKey = (diseaseIdx: number, patientNum: number, questionId: string) =>
    `d${diseaseIdx}-${patientNum}-${questionId}`;
  const makePatientKey = (diseaseIdx: number, patientNum: number) =>
    `d${diseaseIdx}-${patientNum}`;

  // Get answer for current disease/patient


  const handleChange = (patientNum: number, questionId: string, value: string) => {
    const key = makeKey(activeDiseaseIndex, patientNum, questionId);
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Get answer for current disease/patient
  const getAnswer = (patientNum: number, questionId: string): string => {
    return formData[makeKey(activeDiseaseIndex, patientNum, questionId)] || "";
  };

  const getPatientMeta = (diseaseIdx: number, patientNum: number) =>
    patientMeta[makePatientKey(diseaseIdx, patientNum)] || { initials: "", code: "" };

  const handlePatientMetaChange = (field: "initials" | "code", value: string) => {
    const key = makePatientKey(activeDiseaseIndex, currentPatient);
    setPatientMeta(prev => ({
      ...prev,
      [key]: {
        ...getPatientMeta(activeDiseaseIndex, currentPatient),
        [field]: field === "initials" ? value.toUpperCase() : value.toUpperCase(),
      },
    }));
  };

  const currentQuestions = activeDisease.questions;

  // Is a patient complete FOR the current active disease?
  const isPatientComplete = (diseaseIdx: number, patientNum: number): boolean => {
    const qs = diseases[diseaseIdx].questions;
    const meta = getPatientMeta(diseaseIdx, patientNum);
    return Boolean(meta.initials.trim() && meta.code.trim()) &&
      qs.every(q => !!formData[makeKey(diseaseIdx, patientNum, q.id)]);
  };

  // Score for a single patient in a given disease (weighted by category)
  const calculatePatientScore = (diseaseIdx: number, patientNum: number): number | null => {
    const disease = diseases[diseaseIdx];
    if (!isPatientComplete(diseaseIdx, patientNum)) return null;

    let categories: Record<string, { total: number; count: number; weight: number }> = {};
    disease.questions.forEach(q => {
      const val = formData[makeKey(diseaseIdx, patientNum, q.id)] || "";
      const catName = q.category.replace(/\s*\(\d+%\)/, "");
      const weightMatch = q.category.match(/(\d+)%/);
      const w = weightMatch ? parseInt(weightMatch[1]) / 100 : 0.25;
      
      if (!categories[catName]) categories[catName] = { total: 0, count: 0, weight: w };
      categories[catName].total += getOptionScore(val);
      categories[catName].count++;
    });

    let rawWeighted = 0;
    Object.values(categories).forEach(cat => {
      if (cat.count > 0) rawWeighted += (cat.total / cat.count) * 100 * cat.weight;
    });

    return Number(rawWeighted.toFixed(1));
  };

  const getCompletedPatientsCount = (diseaseIdx: number): number => {
    let count = 0;
    for (let i = 1; i <= 30; i++) {
      if (isPatientComplete(diseaseIdx, i)) count++;
    }
    return count;
  };

  // Calculate score for one disease (weighted by category)
  const calculateDiseaseScore = (diseaseIdx: number): number => {
    const disease = diseases[diseaseIdx];
    let categories: Record<string, { total: number; count: number; weight: number }> = {};
    let patientsCompleted = 0;

    for (let p = 1; p <= 30; p++) {
      if (!isPatientComplete(diseaseIdx, p)) continue;
      patientsCompleted++;
      disease.questions.forEach(q => {
        const val = formData[makeKey(diseaseIdx, p, q.id)] || "";
        const catName = q.category.replace(/\s*\(\d+%\)/, "");
        const weightMatch = q.category.match(/(\d+)%/);
        const w = weightMatch ? parseInt(weightMatch[1]) / 100 : 0.25;
        if (!categories[catName]) categories[catName] = { total: 0, count: 0, weight: w };
        categories[catName].total += getOptionScore(val);
        categories[catName].count++;
      });
    }

    if (patientsCompleted === 0) return 0;
    let rawWeighted = 0;
    Object.values(categories).forEach(cat => {
      if (cat.count > 0) rawWeighted += (cat.total / cat.count) * 100 * cat.weight;
    });
    const validity = getSampleValidityWeight(patientsCompleted);
    return Number((rawWeighted * validity).toFixed(1));
  };

  // Grand total specialty audit score across ALL diseases
  const calculateSpecialtyAuditScore = (): number => {
    let finalScore = 0;
    diseases.forEach((disease, idx) => {
      const diseaseScore = calculateDiseaseScore(idx);
      const weightMatch = disease.weight.match(/(\d+)%/);
      const diseaseWeight = weightMatch ? parseInt(weightMatch[1]) / 100 : 1 / diseases.length;
      finalScore += diseaseScore * diseaseWeight;
    });
    return Number(finalScore.toFixed(1));
  };

  // Category breakdown for active disease (for the summary table)
  const calculateActiveDiseaseCategories = () => {
    const categories: Record<string, { total: number; count: number; weight: number }> = {};
    for (let p = 1; p <= 30; p++) {
      if (!isPatientComplete(activeDiseaseIndex, p)) continue;
      currentQuestions.forEach(q => {
        const val = formData[makeKey(activeDiseaseIndex, p, q.id)] || "";
        const catName = q.category.replace(/\s*\(\d+%\)/, "");
        const weightMatch = q.category.match(/(\d+)%/);
        const weight = weightMatch ? parseInt(weightMatch[1]) / 100 : 0.25;
        if (!categories[catName]) categories[catName] = { total: 0, count: 0, weight };
        categories[catName].total += getOptionScore(val);
        categories[catName].count++;
      });
    }
    return Object.entries(categories).map(([name, data]) => ({
      name,
      score: data.count > 0 ? Math.round((data.total / data.count) * 100) : 0,
      weight: data.weight,
      weightedScore: data.count > 0 ? Number(((data.total / data.count) * 100 * data.weight).toFixed(1)) : 0,
    }));
  };

  const buildAuditPatients = () => {
    const auditPatients: any[] = [];
    diseases.forEach((d, dIdx) => {
      for (let p = 1; p <= 30; p++) {
        const meta = getPatientMeta(dIdx, p);
        const answeredQuestions = d.questions.filter(q => formData[makeKey(dIdx, p, q.id)]);
        if (!meta.initials && !meta.code && answeredQuestions.length === 0) continue;

        const diagnosisQs = d.questions.filter(q => q.category.toLowerCase().includes("diagnosa") || q.category.toLowerCase().includes("diagnosis"));
        const treatmentQs = d.questions.filter(q => q.category.toLowerCase().includes("tatalaksana"));
        const outcomeQs = d.questions.filter(q => q.category.toLowerCase().includes("outcome"));

        const getCatScore = (qs: any[]) => {
          if (qs.length === 0) return 100;
          const answered = qs.filter(q => formData[makeKey(dIdx, p, q.id)]);
          if (answered.length === 0) return 0;
          const correct = answered.filter(q => formData[makeKey(dIdx, p, q.id)] !== "tidak-sesuai");
          return Math.round((correct.length / answered.length) * 100);
        };

        auditPatients.push({
          patientIndex: p,
          initials: meta.initials,
          code: meta.code,
          diseaseIndex: dIdx,
          diseaseName: d.diseaseName,
          diagnosisScore: getCatScore(diagnosisQs),
          treatmentScore: getCatScore(treatmentQs),
          outcomeScore: getCatScore(outcomeQs),
          score: calculatePatientScore(dIdx, p) || 0,
          isComplete: isPatientComplete(dIdx, p),
          answers: d.questions.map(q => ({
            id: q.id,
            question: q.question,
            category: q.category,
            answer: formData[makeKey(dIdx, p, q.id)] || "",
          })),
        });
      }
    });
    return auditPatients;
  };

  const handleSaveDraft = () => {
    if (!specialty) return;
    const activeDraftId = draftManager.getCurrentDraftId();
    if (!activeDraftId) return;
    const draft = {
      draftId: activeDraftId,
      formData,
      patientMeta,
      currentPatient,
      activeDiseaseIndex,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(getDraftKey(specialty, hospitalCode), JSON.stringify(draft));
    const score = calculateSpecialtyAuditScore();
    sessionStorage.setItem(`${specialty}_clinicalAuditScore`, score.toString());
    
    // Count total unique medical record numbers filled
    let totalPatientsCompleted = 0;
    diseases.forEach((_, dIdx) => {
      for (let p = 1; p <= 30; p++) {
        if (isPatientComplete(dIdx, p)) totalPatientsCompleted++;
      }
    });
    sessionStorage.setItem(`${specialty}_auditPatientCount`, totalPatientsCompleted.toString());

    // Build audit summary for admin compatibility (per question, avg across all patients)
    const summary: Record<string, string> = {};
    diseases.forEach((d, dIdx) => {
      d.questions.forEach(q => {
        let yes = 0, count = 0;
        for (let i = 1; i <= 30; i++) {
          const val = formData[makeKey(dIdx, i, q.id)];
          if (val) { count++; if (val !== "tidak-sesuai") yes++; }
        }
        summary[q.id] = (count > 0 && (yes / count) >= 0.5) ? "1" : "2";
      });
    });
    sessionStorage.setItem(`${specialty}_auditSummary`, JSON.stringify(summary));
    sessionStorage.setItem(`${specialty}_auditPatients`, JSON.stringify(buildAuditPatients()));

    api.saveDraft("clinical-audit", hospitalCode, specialty, draft).catch(err => {
      if (draftManager.getCurrentDraftId() !== activeDraftId) return;
      console.error("Failed to save draft to server:", err);
    });
    setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setAutosaveState("saved");
    setDraftSavedMsg(true);
  };

  const handleSubmit = () => {
    handleSaveDraft();
    const draftId = draftManager.getCurrentDraftId();
    if (draftId && specialty) {
      draftManager.updateDraft(draftId, specialty, "clinicalAudit", {
        data: formData,
        patientMeta,
        score: specialtyScore,
        currentPatient,
        activeDiseaseIndex,
        completed: allDiseasesHaveData,
        confirmed: true,
      });
    }
    navigate(`/siap-persi/patient-report/${specialty}`);
  };

  const activeCompletedPatients = getCompletedPatientsCount(activeDiseaseIndex);
  const activeProgress = (activeCompletedPatients / 30) * 100;
  const activeDiseaseScore = calculateDiseaseScore(activeDiseaseIndex);
  const specialtyScore = calculateSpecialtyAuditScore();
  const allDiseasesHaveData = diseases.every((_, idx) => getCompletedPatientsCount(idx) >= 1);

  // Advanced Auto-save: Persists state to local and cloud on every change via draftManager
  useEffect(() => {
    if (!specialty || Object.keys(formData).length === 0) return;
    
    const draftId = draftManager.getCurrentDraftId();
    if (!draftId) return;

    setAutosaveState("saving");
    const timer = setTimeout(() => {
      if (draftManager.getCurrentDraftId() !== draftId) return;
      draftManager.updateDraft(draftId, specialty, "clinicalAudit", {
        data: formData,
        patientMeta,
        score: specialtyScore,
        currentPatient,
        activeDiseaseIndex,
        completed: allDiseasesHaveData,
      });
      setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setAutosaveState("saved");
    }, 1000); // 1s debounce to prevent flooding

    return () => clearTimeout(timer);
  }, [formData, patientMeta, currentPatient, activeDiseaseIndex, specialty, specialtyScore, allDiseasesHaveData]);
  const activeCategoryScores = calculateActiveDiseaseCategories();
  const activeValidity = getSampleValidityWeight(activeCompletedPatients);
  const currentPatientScoreVal = calculatePatientScore(activeDiseaseIndex, currentPatient);
  const currentMeta = getPatientMeta(activeDiseaseIndex, currentPatient);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <SpecialtyProgressTracker currentSpecialty={specialty || ""} currentStage="clinical-audit" />

        {/* Draft Saved Toast */}
        {draftSavedMsg && (
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right">
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
            ← Kembali ke Pilih Pelayanan
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Audit Klinis — {specialtyInfo.name}
              </h1>
              <p className="text-gray-600">
                Audit <strong>{diseases.length} penyakit</strong> secara terpisah. Setiap penyakit memiliki 30 rekam medis sendiri.
              </p>
            </div>
            {/* Grand Total Score Badge */}
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 text-center min-w-[160px]">
              <p className="text-sm text-gray-600 mb-1">Skor Total Audit</p>
              <p className="text-xl font-bold text-[#0F4C81]">{specialtyScore}</p>
              <p className="text-xs text-gray-500 mt-1">Dinilai oleh reviewer</p>
            </div>
          </div>
        </div>

        {/* ===== DISEASE TABS — MANDATORY ===== */}
        <div className="bg-white rounded-xl border-2 border-[#0F4C81]/20 p-4 mb-6">
          <p className="text-sm font-bold text-[#0F4C81] mb-3 uppercase tracking-wide">
            Penyakit yang Diaudit ({diseases.length} Penyakit — Wajib Semua):
          </p>
          <div className="flex gap-3">
            {diseases.map((disease, index) => {
              const completed = getCompletedPatientsCount(index);
              const diseaseScoreVal = calculateDiseaseScore(index);
              const isActive = index === activeDiseaseIndex;
              return (
                <button
                  key={index}
                  onClick={() => {
                    setActiveDiseaseIndex(index);
                    setCurrentPatient(1);
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                    isActive
                      ? "bg-[#0F4C81] text-white shadow-md border-[#0F4C81]"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
                  }`}
                >
                  <div className="font-bold">{disease.diseaseName}</div>
                  <div className={`text-xs mt-1 flex items-center justify-center gap-2 ${isActive ? "text-white/80" : "text-gray-500"}`}>
                    <span>Bobot: {disease.weight}</span>
                    {completed > 0 && (
                      <>
                        <span>•</span>
                        <span className={`font-bold ${isActive ? "text-yellow-300" : "text-[#0F4C81]"}`}>
                          Skor: {diseaseScoreVal}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== Patient Selector ===== */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => { if (currentPatient > 1) setCurrentPatient(currentPatient - 1); }}
              disabled={currentPatient === 1}
              className="h-10"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Sebelumnya
            </Button>

            <div className="flex items-center gap-4">
              <span className="text-lg font-bold text-gray-900">
                {activeDisease.diseaseName} — Pasien #{currentPatient}
              </span>
              {currentPatientScoreVal !== null && (
                <div className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                  currentPatientScoreVal >= 80
                    ? "bg-green-50 text-green-700 border-green-200"
                    : currentPatientScoreVal >= 50
                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  Selesai — Skor: {currentPatientScoreVal}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => { if (currentPatient < 30) setCurrentPatient(currentPatient + 1); }}
              disabled={currentPatient === 30}
              className="h-10"
            >
              Selanjutnya
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-5 pt-5 border-t border-gray-200">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Inisial Pasien *
              </label>
              <input
                type="text"
                value={currentMeta.initials}
                onChange={(e) => handlePatientMetaChange("initials", e.target.value)}
                placeholder="Contoh: BS"
                maxLength={8}
                className="w-full h-11 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] font-bold uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Kode Pasien *
              </label>
              <input
                type="text"
                value={currentMeta.code}
                onChange={(e) => handlePatientMetaChange("code", e.target.value)}
                placeholder="Contoh: P-098"
                maxLength={24}
                className="w-full h-11 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0F4C81] font-mono font-bold uppercase"
              />
            </div>
          </div>

          {/* Quick Patient Navigation */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
              const complete = isPatientComplete(activeDiseaseIndex, num);
              const isCurrent = num === currentPatient;
              return (
                <button
                  key={num}
                  onClick={() => setCurrentPatient(num)}
                  className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                    isCurrent
                      ? "bg-[#0F4C81] text-white ring-2 ring-[#0F4C81] ring-offset-2"
                      : complete
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== Info Banner ===== */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Panduan Audit Klinis</h3>
              <p className="text-gray-700 text-sm leading-relaxed mb-3">
                Review rekam medis pasien secara retrospektif (minimal 1, optimal 30 per penyakit).
                Setiap penyakit memiliki <strong>pool pasien sendiri</strong> — pasien Penyakit A ≠ pasien Penyakit B.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap mt-0.5">sesuai</span>
                  <span className="text-gray-700">Dilaksanakan sesuai standar protokol klinis (1 poin)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap mt-0.5">tidak sesuai dengan perkecualian klinis</span>
                  <span className="text-gray-700">Tidak sesuai, namun memenuhi perkecualian klinis yang valid (tetap 1 poin)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap mt-0.5">tidak sesuai</span>
                  <span className="text-gray-700">Tidak sesuai dan tidak ada perkecualian klinis (0 poin)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Audit Questions ===== */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            Kriteria Audit Klinis — {activeDisease.diseaseName} — Pasien #{currentPatient}
          </h3>
          <div className="space-y-4">
            {currentQuestions.map((question, index) => (
              <AuditQuestion
                key={question.id}
                number={index + 1}
                question={question.question}
                category={question.category}
                value={getAnswer(currentPatient, question.id)}
                onChange={(value) => handleChange(currentPatient, question.id, value)}
              />
            ))}
          </div>
        </div>

        {/* ===== Multi-Disease Scoring Summary ===== */}
        <div className="bg-white rounded-xl border-2 border-[#0F4C81] p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-1">Ringkasan Skor Audit Klinis</h3>
          <p className="text-sm text-gray-500 mb-4">Skor per penyakit × bobot penyakit = skor total akhir</p>

          {/* Per-Disease Breakdown */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#0F4C81]">
                  <th className="text-left py-3 px-4 font-bold text-[#0F4C81]">Penyakit</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">RM Selesai</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">Bobot Validitas</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">Skor Penyakit</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">Bobot Penyakit</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">Kontribusi</th>
                </tr>
              </thead>
              <tbody>
                {diseases.map((disease, idx) => {
                  const completed = getCompletedPatientsCount(idx);
                  const validity = getSampleValidityWeight(completed);
                  const dScore = calculateDiseaseScore(idx);
                  const weightMatch = disease.weight.match(/(\d+)%/);
                  const dWeight = weightMatch ? parseInt(weightMatch[1]) / 100 : 1 / diseases.length;
                  const contribution = Number((dScore * dWeight).toFixed(1));
                  const isActive = idx === activeDiseaseIndex;
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-gray-200 cursor-pointer transition-colors ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      onClick={() => { setActiveDiseaseIndex(idx); setCurrentPatient(1); }}
                    >
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {isActive && <span className="text-[#0F4C81] mr-2">▶</span>}
                        {disease.diseaseName}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold ${completed >= 21 ? "text-green-600" : completed >= 11 ? "text-blue-600" : completed >= 1 ? "text-amber-600" : "text-gray-400"}`}>
                          {completed}/30
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">
                        {completed > 0 ? `${(validity * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#0F4C81]">
                        {completed > 0 ? dScore : "—"}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">{disease.weight}</td>
                      <td className="py-3 px-4 text-center font-bold text-purple-700">
                        {completed > 0 ? contribution : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#0F4C81]/10">
                  <td className="py-3 px-4 font-bold text-[#0F4C81] text-lg" colSpan={5}>Skor Total Audit Klinis</td>
                  <td className="py-3 px-4 text-center font-bold text-[#0F4C81] text-2xl">{specialtyScore}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <p><strong>Rumus:</strong> Skor Penyakit = (Kategori × Bobot%) dijumlahkan lalu × bobot validitas sampel</p>
            <p className="mt-1">Skor Total = Σ(Skor Penyakit × Bobot Penyakit)</p>
          </div>
        </div>

        {/* ===== Detail Kategori ===== */}
        {activeCategoryScores.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-[#0F4C81] p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Detail Kategori</h3>
            <p className="text-sm text-gray-500 mb-4">{activeDisease.diseaseName}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCategoryScores.map((cat, i) => {
                const colors = [
                  { bg: "bg-blue-50/50", border: "border-blue-100", text: "text-blue-700", num: "text-blue-900" },
                  { bg: "bg-teal-50/50", border: "border-teal-100", text: "text-teal-700", num: "text-teal-900" },
                  { bg: "bg-purple-50/50", border: "border-purple-100", text: "text-purple-700", num: "text-purple-900" }
                ];
                const color = colors[i % colors.length];
                return (
                  <div key={cat.name} className={`rounded-xl ${color.bg} ${color.border} border p-4`}>
                    <p className={`text-xs font-black uppercase tracking-widest ${color.text} mb-1`}>{cat.name}</p>
                    <div className="flex justify-between items-end mt-2">
                      <div>
                        <p className={`text-2xl font-black ${color.num}`}>{cat.score}</p>
                        <p className={`text-xs ${color.text} mt-1`}>Nilai</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${color.num}`}>{cat.weightedScore}</p>
                        <p className={`text-xs ${color.text} mt-1`}>Berbobot ({(cat.weight * 100).toFixed(0)}%)</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== Action Buttons ===== */}
        <div className="flex gap-4 mt-8">
          <Button
            onClick={handleSaveDraft}
            variant="outline"
            className="h-12 px-8 border-2 border-gray-300 font-semibold"
          >
            <Save className="w-5 h-5 mr-2" />
            Simpan Draft
          </Button>

          <Button
            onClick={() => {
              handleSaveDraft();
              navigate(`/siap-persi/patient-report/${specialty}`);
            }}
            variant="outline"
            className="h-12 px-8 border-2 border-yellow-400 text-yellow-700 hover:bg-yellow-50 font-semibold"
          >
            Isi Nanti (Lanjut ke Patient Report)
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={!allDiseasesHaveData}
            className="flex-1 h-12 bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!allDiseasesHaveData
              ? `Mohon isi minimal 1 RM untuk SETIAP penyakit`
              : `Lanjut ke Patient Report (Semua Penyakit Terisi, Skor: ${specialtyScore})`}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            <strong>Tips:</strong> Klik nama penyakit di tabel untuk berpindah antar penyakit. Setiap penyakit memiliki 30 slot pasien tersendiri.
            Data draft otomatis tersimpan saat Anda klik &quot;Simpan Draft&quot;.
          </p>
        </div>
      </div>
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

function AuditQuestion({
  number,
  question,
  category,
  value,
  onChange,
}: {
  number: number;
  question: string;
  category: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="p-5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
          {number}
        </div>
        <div className="flex-1">
          <div className="mb-3">
            <div className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded mb-2">
              {category}
            </div>
            <p className="font-medium text-gray-900 leading-relaxed">{question}</p>
          </div>
          <div className="space-y-2">
            {AUDIT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  value === option.value
                    ? option.value === "sesuai"
                      ? "border-green-500 bg-green-50"
                      : option.value === "tidak-sesuai-pengecualian"
                      ? "border-green-500 bg-green-50"
                      : "border-red-500 bg-red-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name={`audit-${number}-${question.slice(0, 20)}`}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    value === option.value
                      ? option.value === "tidak-sesuai"
                        ? "border-red-500 bg-red-500"
                        : "border-green-500 bg-green-500"
                      : "border-gray-300"
                  }`}
                >
                  {value === option.value && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <span className={`text-sm ${value === option.value ? "font-semibold" : ""} ${
                  option.value !== "tidak-sesuai" && value === option.value
                    ? "text-green-800"
                    : option.value === "tidak-sesuai" && value === option.value
                    ? "text-red-800"
                    : "text-gray-700"
                }`}>
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
