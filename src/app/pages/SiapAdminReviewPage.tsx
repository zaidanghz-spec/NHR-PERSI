import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  CheckCircle2,
  XCircle,
  Building2,
  Trophy,
  ArrowLeft,
  FileText,
  ExternalLink,
  Clock,
  Edit3,
  Save,
  RotateCcw,
  Info,
  Star,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useData } from "../context/DataContext";
import { specialtyAuditData } from "../data/specialtyAuditData";

interface CustomSurveyDoc {
  fileName: string;
  base64: string;
  uploadedAt: string;
  hospitalCode: string;
  hospitalName: string;
  specialty: string;
  diseaseName: string;
  patientCount?: number;
}

// ============ EDITABLE SCORE TABLE ============
interface EditableScores {
  rsbk: number;
  clinicalAudit: number;
  patientReport: number;
}

function calcFinal(scores: EditableScores): number {
  return Number((scores.rsbk * 0.15 + scores.clinicalAudit * 0.6 + scores.patientReport * 0.25).toFixed(1));
}

export function SiapAdminReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | "">("");
  const [revisionTargets, setRevisionTargets] = useState({ rsbk: false, clinicalAudit: false, patientReport: false });
  const [customSurveyDocs, setCustomSurveyDocs] = useState<CustomSurveyDoc[]>([]);
  const [activeTab, setActiveTab] = useState<"summary" | "rsbk" | "audit" | "prm">("summary");
  const [selectedAuditPatient, setSelectedAuditPatient] = useState<number | null>(null);
  const [selectedPrmPatient, setSelectedPrmPatient] = useState<string | null>(null);

  // Admin editable scores
  const [editingScores, setEditingScores] = useState(false);
  const [adminScores, setAdminScores] = useState<EditableScores | null>(null);
  const [adminScoreNotes, setAdminScoreNotes] = useState<Record<string, string>>({});
  const [scoreSaved, setScoreSaved] = useState(false);

  const { isAdmin, submissions, updateSubmissionStatus, publishRanking, hospitalAccounts } = useData();
  const actualSubmission = submissions.find(s => s.id === id);

  // Load custom survey PDFs — filtered to THIS submission's hospital only
  useEffect(() => {
    if (!actualSubmission) return;
    const docs: CustomSurveyDoc[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("custom-survey-")) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as CustomSurveyDoc;
            // Only include docs belonging to this submission's hospital
            if (parsed.hospitalName === actualSubmission.hospitalName) {
              docs.push(parsed);
            }
          }
        } catch {}
      }
    }
    setCustomSurveyDocs(docs);
  }, [actualSubmission]);

  const getSpecialtyKey = (name: string) =>
    Object.keys(specialtyAuditData).find(key => specialtyAuditData[key].name === name) || "cardiology";

  const submissionData = actualSubmission ? {
    ...actualSubmission,
    specialtyKey: getSpecialtyKey(actualSubmission.specialty),
  } : {
    id: id || "—",
    hospitalName: "Memuat...",
    specialty: "—",
    specialtyKey: "cardiology",
    submittedDate: "—",
    picName: "—",
    status: "Pending",
    scores: { rsbk: 0, clinicalAudit: 0, patientReport: 0, final: 0 },
    details: {}
  };

  // Initialize admin scores from submission
  useEffect(() => {
    if (actualSubmission && !adminScores) {
      // Try to load saved admin override from localStorage
      const savedOverride = localStorage.getItem(`admin-score-override-${id}`);
      if (savedOverride) {
        try {
          const parsed = JSON.parse(savedOverride);
          setAdminScores(parsed.scores);
          setAdminScoreNotes(parsed.notes || {});
          return;
        } catch {}
      }
      setAdminScores({
        rsbk: actualSubmission.scores.rsbk,
        clinicalAudit: actualSubmission.scores.clinicalAudit,
        patientReport: actualSubmission.scores.patientReport,
      });
    }
  }, [actualSubmission, adminScores, id]);

  const effectiveScores = adminScores || submissionData.scores;
  const effectiveFinal = calcFinal(effectiveScores);

  const filteredDocs = customSurveyDocs.filter(d =>
    d.hospitalName === submissionData.hospitalName &&
    (submissionData.specialty === "Multiple" || d.specialty === submissionData.specialty)
  );

  const getTier = (score: number) => {
    if (score >= 90) return { grade: "Tier 1", name: "Platinum", color: "text-purple-700", bg: "bg-purple-100" };
    if (score >= 80) return { grade: "Tier 2", name: "Outstanding", color: "text-blue-700", bg: "bg-blue-100" };
    if (score >= 70) return { grade: "Tier 3", name: "Excellent", color: "text-emerald-700", bg: "bg-emerald-100" };
    if (score >= 60) return { grade: "Tier 4", name: "Commendable", color: "text-amber-700", bg: "bg-amber-100" };
    return { grade: "Tier 5", name: "Developing", color: "text-slate-600", bg: "bg-gray-100" };
  };

  const gradeInfo = getTier(effectiveFinal);
  const clampPercent = (value: any) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const getPrmPatientKey = (patient: any) => `${patient.diseaseKey || patient.specialty || "prm"}:${patient.rm}`;
  const auditPatientsForReview = ((submissionData as any).details?.auditPatients || []) as any[];
  const prmPatientsForReview = ((submissionData as any).details?.prmPatients || []) as any[];
  const selectedAuditDetail = selectedAuditPatient !== null ? auditPatientsForReview[selectedAuditPatient] : null;
  const selectedPrmDetail = selectedPrmPatient
    ? prmPatientsForReview.find((patient: any) => getPrmPatientKey(patient) === selectedPrmPatient || patient.rm === selectedPrmPatient)
    : null;

  const getPrmQuestionGroups = (patient: any) => {
    const specData = specialtyAuditData[(submissionData as any).specialtyKey] || specialtyAuditData.cardiology;
    const disease = specData.diseases?.[patient?.diseaseIndex || 0];
    return {
      premQuestions: disease?.premQuestions || specData.premQuestions || [],
      promQuestions: disease?.promQuestions || specData.promQuestions || [],
    };
  };

  const getAuditAnswerLabel = (answer: string) => {
    if (answer === "sesuai") return "Sesuai";
    if (answer === "tidak-sesuai-pengecualian") return "Tidak sesuai dengan perkecualian klinis";
    if (answer === "tidak-sesuai") return "Tidak sesuai";
    return "Belum diisi";
  };

  const getRatingAnswerLabel = (answer: string) => {
    const labels: Record<string, string> = {
      "5": "Sangat Setuju",
      "4": "Setuju",
      "3": "Netral",
      "2": "Tidak Setuju",
      "1": "Sangat Tidak Setuju",
    };
    return labels[answer] || "Belum diisi";
  };

  const handleSaveScoreOverride = () => {
    if (!adminScores) return;
    localStorage.setItem(`admin-score-override-${id}`, JSON.stringify({
      scores: adminScores,
      notes: adminScoreNotes,
      savedAt: new Date().toISOString(),
    }));

    // Back-propagate PRM scores to custom survey docs so the hospital can read them
    filteredDocs.forEach(doc => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("custom-survey-")) {
           try {
             const raw = localStorage.getItem(key);
             if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.hospitalName === doc.hospitalName && parsed.specialty === doc.specialty && parsed.diseaseName === doc.diseaseName) {
                   parsed.adminPremScore = adminScores.patientReport;
                   parsed.adminPromScore = adminScores.patientReport;
                   localStorage.setItem(key, JSON.stringify(parsed));
                   break;
                }
             }
           } catch { /* ignore */ }
        }
      }
    });

    setScoreSaved(true);
    setEditingScores(false);
    setTimeout(() => setScoreSaved(false), 3000);
  };

  const handleResetScores = () => {
    if (!actualSubmission) return;
    setAdminScores({
      rsbk: actualSubmission.scores.rsbk,
      clinicalAudit: actualSubmission.scores.clinicalAudit,
      patientReport: actualSubmission.scores.patientReport,
    });
    setAdminScoreNotes({});
    localStorage.removeItem(`admin-score-override-${id}`);
    setEditingScores(false);
  };

  const handleAction = (actionType: "approve" | "reject") => {
    setAction(actionType);
    setShowApprovalDialog(true);
  };

  const confirmAction = () => {
    const finalScoreToUse = effectiveFinal;
    const scoresToUse = effectiveScores;

    if (action === "approve") {
      // Save admin override to submission details before approval
      updateSubmissionStatus(submissionData.id, "Approved", comment);

      const hospitalAccount = hospitalAccounts.find(a => a.hospitalName === submissionData.hospitalName);
      const province = hospitalAccount?.province || "—";
      const city = hospitalAccount?.city || "—";

      publishRanking({
        hospitalName: submissionData.hospitalName,
        city,
        province,
        specialty: submissionData.specialty === "—" ? "Cardiology" : submissionData.specialty,
        finalScore: finalScoreToUse,
        rsbkScore: scoresToUse.rsbk,
        clinicalAuditScore: scoresToUse.clinicalAudit,
        patientReportScore: scoresToUse.patientReport,
        grade: gradeInfo.name,
        approvedAt: new Date().toISOString(),
        submissionId: submissionData.id,
      });
    } else if (action === "reject") {
      updateSubmissionStatus(submissionData.id, "Revision Required", comment, revisionTargets);
    }
    setShowApprovalDialog(false);
    setTimeout(() => navigate("/siap-persi/admin/dashboard"), 500);
  };

  const handleUnpublish = () => {
    if (!submissionData) return;
    unpublishRanking(submissionData.id);
    updateSubmissionStatus(submissionData.id, "Pending", "Ranking ditarik untuk peninjauan ulang oleh Admin Pusat.");
    setTimeout(() => navigate("/siap-persi/admin/dashboard"), 500);
  };

  const hasAdminOverride = adminScores && actualSubmission &&
    (adminScores.rsbk !== actualSubmission.scores.rsbk ||
     adminScores.clinicalAudit !== actualSubmission.scores.clinicalAudit ||
     adminScores.patientReport !== actualSubmission.scores.patientReport);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-[700] text-gray-900 mb-2">
            Akses Ditolak
          </h2>
          <p className="text-gray-500 mb-4">
            Anda harus login sebagai admin untuk mengakses halaman review.
          </p>
          <Link to="/admin/login">
            <Button className="bg-[#1E3A8A] hover:bg-[#1a3278]">
              Login Admin
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Score Saved Toast */}
        {scoreSaved && (
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Override skor berhasil disimpan!</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <Link
            to="/siap-persi/admin/dashboard"
            className="inline-flex items-center text-[#0F4C81] hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Review Submission</h1>
          <p className="text-gray-600">Detail assessment dan data yang disubmit oleh rumah sakit</p>
        </div>

        {/* Hospital Info + Score Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{submissionData.hospitalName}</h2>
                  <p className="text-gray-600">{submissionData.specialty}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Submission ID</span>
                  <span className="font-semibold font-mono text-gray-900">{submissionData.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Penanggung Jawab</span>
                  <span className="font-semibold text-gray-900">{submissionData.picName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal Submit</span>
                  <span className="font-semibold text-gray-900">{submissionData.submittedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                    submissionData.status === "Approved" ? "bg-green-100 text-green-700" :
                    submissionData.status === "Revision Required" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>{submissionData.status}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#0F4C81] to-[#14B8A6] rounded-xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6" />
                <h3 className="text-xl font-bold">Final Score</h3>
                {hasAdminOverride && (
                  <span className="ml-auto text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-bold">
                    Admin Override
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-bold">{effectiveFinal}</span>
                <div className={`${gradeInfo.bg} rounded-xl px-4 py-2 text-center`}>
                  <div className={`text-3xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</div>
                  <div className={`text-xs font-semibold ${gradeInfo.color} uppercase tracking-wider`}>{gradeInfo.name}</div>
                </div>
              </div>
              <p className="text-white/60 text-xs mt-3">
                RSBK×15% + Audit×60% + PRM×25%
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-white p-1.5 rounded-xl border border-gray-200 mb-8 overflow-x-auto w-full mx-auto shadow-sm gap-1">
          {[
            { key: "summary", label: "Ringkasan Penilaian" },
            { key: "rsbk", label: "Hospital Structure" },
            { key: "audit", label: "Clinical Audit" },
            { key: "prm", label: "Patient Report (PRM)" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.key ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========== TAB: SUMMARY ========== */}
        {activeTab === "summary" && (
          <div className="space-y-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ====== ADMIN EDITABLE SCORING TABLE ====== */}
            <div className="bg-white rounded-xl border-2 border-indigo-300 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Star className="w-5 h-5 text-indigo-600" />
                    Tabel Penilaian Admin
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Admin dapat mengubah skor dan menambahkan catatan per komponen sebelum approval
                  </p>
                </div>
                <div className="flex gap-2">
                  {editingScores ? (
                    <>
                      <Button
                        onClick={handleResetScores}
                        variant="outline"
                        className="border-gray-300 text-gray-600 font-semibold"
                        size="sm"
                      >
                        <RotateCcw className="w-4 h-4 mr-1.5" />
                        Reset
                      </Button>
                      <Button
                        onClick={handleSaveScoreOverride}
                        className="bg-indigo-600 hover:bg-indigo-700 font-semibold"
                        size="sm"
                      >
                        <Save className="w-4 h-4 mr-1.5" />
                        Simpan Penilaian
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setEditingScores(true)}
                      variant="outline"
                      className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold"
                      size="sm"
                    >
                      <Edit3 className="w-4 h-4 mr-1.5" />
                      Edit Penilaian
                    </Button>
                  )}
                </div>
              </div>

              {hasAdminOverride && !editingScores && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-start gap-2 text-sm">
                  <Info className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <span className="text-yellow-800">
                    Skor sudah di-override oleh admin. Nilai yang digunakan saat approval adalah skor admin.
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-indigo-200">
                      <th className="text-left py-3 px-4 font-bold text-indigo-800">Komponen</th>
                      <th className="text-center py-3 px-4 font-bold text-indigo-800">Bobot</th>
                      <th className="text-center py-3 px-4 font-bold text-indigo-800">Skor</th>
                      <th className="text-center py-3 px-4 font-bold text-indigo-800">Nilai Berbobot</th>
                      <th className="text-left py-3 px-4 font-bold text-indigo-800">Catatan Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "rsbk" as const, label: "Hospital Structure", weight: 0.15, color: "blue", editable: false },
                      { key: "clinicalAudit" as const, label: "Clinical Audit", weight: 0.60, color: "purple", editable: false },
                      { key: "patientReport" as const, label: "Patient Report (PRM)", weight: 0.25, color: "teal", editable: true },
                    ].map(component => {
                      const systemScore = (submissionData.scores as any)[component.key] || 0;
                      const adminVal = adminScores ? adminScores[component.key] : systemScore;
                      const weighted = Number((adminVal * component.weight).toFixed(1));
                      const isOverridden = adminScores && adminScores[component.key] !== systemScore;
                      const colorMap: Record<string, string> = {
                        blue: "text-blue-700 bg-blue-50",
                        purple: "text-purple-700 bg-purple-50",
                        teal: "text-teal-700 bg-teal-50",
                      };

                      return (
                        <tr key={component.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="py-4 px-4">
                            <p className="font-semibold text-gray-900">{component.label}</p>
                            {isOverridden && (
                              <p className="text-xs text-amber-600 font-medium mt-0.5">● Override aktif</p>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center text-gray-600 font-semibold">
                            {(component.weight * 100).toFixed(0)}%
                          </td>
                          <td className="py-4 px-4 text-center">
                            {editingScores && component.editable ? (
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={adminVal}
                                  onChange={e => {
                                    const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                    setAdminScores(prev => prev ? { ...prev, [component.key]: val } : null);
                                  }}
                                  className="w-20 text-center font-bold text-lg border-2 border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="text-gray-400 text-sm">/ 100</span>
                              </div>
                            ) : (
                              <span className={`text-3xl font-bold ${isOverridden ? "text-amber-600" : "text-gray-900"}`}>
                                {adminVal}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className={`inline-block px-3 py-1.5 rounded-lg ${colorMap[component.color]}`}>
                              <span className="text-xl font-bold">{weighted}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {editingScores && component.editable ? (
                              <input
                                type="text"
                                placeholder="Catatan untuk komponen ini..."
                                value={adminScoreNotes[component.key] || ""}
                                onChange={e => setAdminScoreNotes(prev => ({ ...prev, [component.key]: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                            ) : (
                              <p className="text-sm text-gray-600 italic">
                                {adminScoreNotes[component.key] || "—"}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50 font-bold">
                      <td className="py-4 px-4 text-indigo-900 text-lg font-bold" colSpan={3}>Skor Final</td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-3xl font-bold text-indigo-700">{effectiveFinal}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeInfo.bg} ${gradeInfo.color}`}>
                          {gradeInfo.grade} — {gradeInfo.name}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Score bars visualization */}
              <div className="mt-6 space-y-3">
                {[
                  { label: "Hospital Structure", val: effectiveScores.rsbk, color: "bg-blue-500" },
                  { label: "Clinical Audit", val: effectiveScores.clinicalAudit, color: "bg-purple-500" },
                  { label: "Patient Report", val: effectiveScores.patientReport, color: "bg-teal-500" },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      <span className="text-sm font-bold text-gray-900">{item.val}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`${item.color} h-2.5 rounded-full transition-all duration-500`}
                        style={{ width: `${item.val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== TAB: HOSPITAL STRUCTURE ========== */}
        {activeTab === "rsbk" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tight">
              Hospital Structure Detail
            </h3>
            <div className="space-y-8">
              {["sdm", "sarana", "alat"].map((category) => {
                const labels: Record<string, string> = {
                  sdm: "Sumber Daya Manusia (SDM)",
                  sarana: "Sarana & Prasarana",
                  alat: "Alat Medis",
                };
                const colors: Record<string, string> = {
                  sdm: "text-[#0F4C81] bg-blue-500",
                  sarana: "text-[#14B8A6] bg-teal-500",
                  alat: "text-purple-600 bg-purple-500",
                };
                const specData = specialtyAuditData[(submissionData as any).specialtyKey] || specialtyAuditData.cardiology;
                const items = specData.rsbkItems.filter(i => i.category === category);
                const data = (submissionData as any).details?.rsbkData || {};

                return (
                  <div key={category}>
                    <h4 className={`font-extrabold ${colors[category].split(" ")[0]} mb-5 flex items-center gap-3 text-lg`}>
                      <div className={`w-3 h-3 rounded-full ${colors[category].split(" ")[1]} shadow-lg`} />
                      {labels[category]}
                    </h4>
                    <div className="grid gap-3">
                      {Object.keys(data).length === 0 ? (
                        <p className="text-amber-600 text-sm italic">Data detail input kuesioner tidak ditemukan untuk submission ini.</p>
                      ) : (
                        items.map(item => {
                          const val = data[item.id] || "0";
                          const pts = parseInt(val) * item.pointPerUnit;
                          return (
                            <ParameterRow
                              key={item.id}
                              item={{
                                name: item.name,
                                value: parseInt(val) > 0 ? "1" : "2",
                                score: pts,
                                detail: `${val} ${item.inputUnit || "unit"} (${pts} poin)`,
                              }}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== TAB: CLINICAL AUDIT ========== */}
        {activeTab === "audit" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Detail Audit Klinis</h3>
            <p className="text-gray-500 text-sm mb-6 font-medium">Hasil evaluasi kepatuhan protokol klinis per pasien.</p>

            {(() => {
              const auditPatients = (submissionData as any).details?.auditPatients || [];
              const auditData = (submissionData as any).details?.auditData || {};
              
              if (auditPatients.length === 0) {
                return (
                  <div className="bg-amber-50 rounded-xl p-8 border border-amber-200 text-center">
                    <p className="text-amber-800 font-medium">Data rincian pasien audit klinis tidak tersedia.</p>
                    <p className="text-amber-600 text-sm mt-1 italic">(Mungkin data lama sebelum fitur detail pasien diaktifkan)</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0F4C81] text-white">
                        <tr>
                          <th className="py-4 px-4 text-left font-bold uppercase tracking-widest text-[10px]">Pasien</th>
                          <th className="py-4 px-4 text-left font-bold uppercase tracking-widest text-[10px]">Penyakit</th>
                          <th className="py-4 px-4 text-center font-bold uppercase tracking-widest text-[10px]">Diagnosis</th>
                          <th className="py-4 px-4 text-center font-bold uppercase tracking-widest text-[10px]">Tatalaksana</th>
                          <th className="py-4 px-4 text-center font-bold uppercase tracking-widest text-[10px]">Outcome</th>
                          <th className="py-4 px-4 text-center font-bold uppercase tracking-widest text-[10px]">Status</th>
                          <th className="py-4 px-4 text-center font-bold uppercase tracking-widest text-[10px]">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditPatients.map((p: any, idx: number) => (
                          <tr 
                            key={idx} 
                            className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                            onClick={() => setSelectedAuditPatient(idx)}
                          >
                            <td className="py-4 px-4">
                              <div className="font-black text-gray-800">{p.initials || `Pasien ${p.patientIndex}`}</div>
                              <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Kode: {p.code || "-"}</div>
                            </td>
                            <td className="py-4 px-4 text-gray-600">{p.diseaseName}</td>
                            <td className="py-4 px-4 text-center">
                              <span className={`font-bold ${p.diagnosisScore >= 80 ? "text-green-600" : p.diagnosisScore >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                {p.diagnosisScore}%
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={`font-bold ${p.treatmentScore >= 80 ? "text-green-600" : p.treatmentScore >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                {p.treatmentScore}%
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={`font-bold ${p.outcomeScore >= 80 ? "text-green-600" : p.outcomeScore >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                {p.outcomeScore}%
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {p.isComplete ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-black uppercase tracking-widest rounded-full">Lengkap</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest rounded-full">Parsial</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-[10px] font-black uppercase tracking-widest"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedAuditPatient(idx);
                                }}
                              >
                                Lihat
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                       <Info className="w-5 h-5 text-[#0F4C81]" />
                       Catatan Metodologi Skor
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Persentase di atas dihitung berdasarkan kepatuhan pada setiap indikator medis dalam kategori tersebut (Diagnosa, Tatalaksana, Outcome). Pasien yang tidak lengkap datanya (Parsial) tetap diperhitungkan skornya berdasarkan pertanyaan yang sudah diisi.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ========== TAB: PATIENT REPORT (PRM) ========== */}
        {activeTab === "prm" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-8">
            {/* Custom Survey PDFs — with admin scoring */}
            {filteredDocs.length > 0 && (
              <div className="bg-white rounded-xl border-2 border-amber-200 p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Dokumen Survei Mandiri RS</h3>
                    <p className="text-sm text-gray-500">Survei PREM/PROM internal yang diupload RS — admin wajib menilai</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-2 text-sm">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-800">
                    RS menggunakan survei internal — skor PRM perlu dinilai manual oleh admin melalui <strong>Tabel Penilaian Admin</strong> di tab Ringkasan.
                  </span>
                </div>

                <div className="space-y-4">
                  {filteredDocs.map((doc, i) => (
                    <div key={i} className="flex items-start gap-4 p-5 border border-amber-100 rounded-xl bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{doc.fileName}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            <Building2 className="w-3 h-3" />
                            {doc.hospitalName || doc.hospitalCode}
                          </span>
                          {doc.diseaseName && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              {doc.diseaseName}
                            </span>
                          )}
                          {doc.patientCount && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              {doc.patientCount} pasien
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Upload: {new Date(doc.uploadedAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                      <a
                        href={doc.base64}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Buka PDF
                      </a>
                    </div>
                  ))}
                </div>

                 <div className="mt-8 p-6 bg-indigo-50 border border-indigo-200 rounded-2xl">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                     <div className="flex-1">
                       <h4 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
                         <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                         Input Skor Survei Mandiri (PDF)
                       </h4>
                       <p className="text-sm text-indigo-700 leading-relaxed mb-4">
                         Setelah mereview dokumen PDF di atas, masukkan skor evaluasi untuk Patient Report (PRM) di sini. Skor ini akan otomatis mengupdate <strong>Ringkasan Penilaian</strong>.
                       </p>
                       <div className="flex items-center gap-3">
                         <div className="relative">
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={adminScores?.patientReport || 0}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                setAdminScores(prev => prev ? { ...prev, patientReport: val } : null);
                              }}
                              className="w-32 h-14 bg-white border-2 border-indigo-300 rounded-xl text-center text-2xl font-black text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-200 transition-all"
                            />
                            <span className="absolute -top-2.5 left-4 bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Score 0-100</span>
                         </div>
                         <div className="text-indigo-400 font-bold">PTS</div>
                         <Button
                           onClick={handleSaveScoreOverride}
                           className="h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-200 transition-all flex items-center gap-2"
                         >
                           <Save className="w-5 h-5" />
                           Update Ringkasan
                         </Button>
                       </div>
                     </div>
                     <div className="md:w-64 bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-indigo-100 italic text-[11px] text-indigo-600 leading-tight">
                       "Nilai ini akan memberikan bobot 25% pada skor akhir rumah sakit. Pastikan kualitas data pada kuesioner mandiri sudah sesuai standar."
                     </div>
                   </div>
                 </div>
               </div>
             )}

            {/* PREM & PROM from QR surveys */}
            <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
              <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Pasien Patient Reported Measures (PRM)</h3>
              <p className="text-gray-500 text-sm mb-8 font-medium">Laporan feedback kuesioner pengalaman dan hasil klinis per pasien individual.</p>

              {(() => {
                const prmPatients = (submissionData as any).details?.prmPatients || [];
                
                if (prmPatients.length === 0) {
                  return (
                    <div className="bg-amber-50 rounded-xl p-8 border border-amber-200 text-center">
                      <p className="text-amber-800 font-medium font-bold">Data survei PRM via QR tidak ditemukan di database cloud.</p>
                      <p className="text-amber-600 text-sm mt-1 italic">Kemungkinan rumah sakit hanya menggunakan upload dokumen PDF mandiri.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {prmPatients.map((p: any, idx: number) => {
                      const premScore = clampPercent(p.premScore);
                      const promScore = clampPercent(p.promScore);

                      return (
                        <div
                          key={idx}
                          className="group bg-gray-50 hover:bg-white p-5 rounded-2xl border-2 border-transparent hover:border-blue-200 hover:shadow-xl transition-all duration-300"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-inner group-hover:scale-110 transition-transform">
                              {p.name?.substring(0, 2).toUpperCase() || "PX"}
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${p.hasResponse ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                              {p.hasResponse ? "Survey Selesai" : "Terdaftar"}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-gray-900 mb-1 truncate">{p.name}</h4>
                          <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Kode: {p.rm}</p>
                          {p.diseaseName && (
                            <p className="text-[10px] text-gray-500 font-bold mt-1 mb-4 truncate">{p.diseaseName}</p>
                          )}

                          {p.hasResponse ? (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-gray-500 font-bold uppercase tracking-tight">PREM (Experience)</span>
                                <span className="text-blue-600 font-black">{premScore}%</span>
                              </div>
                              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${premScore}%` }} />
                              </div>

                              <div className="flex justify-between items-center text-[10px] mt-3">
                                <span className="text-gray-500 font-bold uppercase tracking-tight">PROM (Outcome)</span>
                                <span className="text-emerald-600 font-black">{promScore}%</span>
                              </div>
                              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${promScore}%` }} />
                              </div>

                              <p className="text-[9px] text-gray-400 mt-4 flex items-center gap-1 font-bold">
                                <Clock className="w-3 h-3" />
                                SUBMITTED: {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString("id-ID") : "—"}
                              </p>
                            </div>
                          ) : (
                            <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Belum ada respon</span>
                            </div>
                          )}

                          <Button
                            variant="outline"
                            className="w-full mt-5 border-gray-200 text-gray-600 group-hover:bg-[#0F4C81] group-hover:text-white group-hover:border-transparent transition-all h-9 text-xs font-bold uppercase tracking-widest rounded-xl"
                            onClick={() => setSelectedPrmPatient(getPrmPatientKey(p))}
                            disabled={!p.hasResponse}
                          >
                            Lihat Detail Pasien
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ===== Admin Review Comment ===== */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Admin Review & Comments</h3>
          <Textarea
            placeholder="Masukkan catatan review atau komentar untuk rumah sakit..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-32 mb-4"
          />
          <p className="text-sm text-gray-600">
            Catatan ini akan dikirimkan ke rumah sakit bersama dengan keputusan approval.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          {submissionData.status === "Approved" ? (
             <Button
               onClick={handleUnpublish}
               variant="outline"
               className="h-12 px-8 border-2 border-amber-500 text-amber-600 hover:bg-amber-50 font-bold flex items-center gap-2"
             >
               <RotateCcw className="w-5 h-5" />
               Tarik Kembali dari Ranking (Unpublish)
             </Button>
          ) : (
            <>
              <Button
                onClick={() => handleAction("reject")}
                variant="outline"
                className="h-12 px-8 border-2 border-red-300 text-red-600 hover:bg-red-50 font-semibold"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Request Revision
              </Button>
              <Button
                onClick={() => handleAction("approve")}
                className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Approve & Publish ({effectiveFinal} pts — {gradeInfo.grade})
              </Button>
            </>
          )}
        </div>

        {/* Clinical Audit Patient Detail */}
        {selectedAuditDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[86vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">Clinical Audit</p>
                  <h3 className="text-2xl font-black text-gray-900">{selectedAuditDetail.initials || `Pasien ${selectedAuditDetail.patientIndex}`}</h3>
                  <p className="text-sm text-gray-500 font-semibold mt-1">
                    Kode: {selectedAuditDetail.code || "-"} • {selectedAuditDetail.diseaseName || "-"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedAuditPatient(null)} className="rounded-full h-10 w-10 p-0">
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="grid sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Diagnosis", value: selectedAuditDetail.diagnosisScore },
                    { label: "Tatalaksana", value: selectedAuditDetail.treatmentScore },
                    { label: "Outcome", value: selectedAuditDetail.outcomeScore },
                    { label: "Total", value: selectedAuditDetail.score },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-2xl font-black text-gray-900">{clampPercent(item.value)}%</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {(selectedAuditDetail.answers || []).map((answer: any, idx: number) => (
                    <div key={`${answer.id}-${idx}`} className="rounded-xl border border-gray-100 p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{answer.category}</p>
                          <p className="text-sm font-bold text-gray-800 leading-relaxed">{answer.question}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
                          answer.answer === "tidak-sesuai"
                            ? "bg-red-100 text-red-700"
                            : answer.answer
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                        }`}>
                          {getAuditAnswerLabel(answer.answer)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRM Patient Detail */}
        {selectedPrmDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[86vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Patient Reported Measures</p>
                  <h3 className="text-2xl font-black text-gray-900">{selectedPrmDetail.name || "Pasien"}</h3>
                  <p className="text-sm text-gray-500 font-semibold mt-1">
                    Kode: {selectedPrmDetail.rm || "-"} • {selectedPrmDetail.diseaseName || "-"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedPrmPatient(null)} className="rounded-full h-10 w-10 p-0">
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="grid sm:grid-cols-3 gap-3 mb-6">
                  {[
                    { label: "PREM", value: selectedPrmDetail.premScore, color: "text-blue-700" },
                    { label: "PROM", value: selectedPrmDetail.promScore, color: "text-emerald-700" },
                    { label: "Overall", value: selectedPrmDetail.overallScore, color: "text-gray-900" },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{item.label}</p>
                      <p className={`text-2xl font-black ${item.color}`}>{clampPercent(item.value)}%</p>
                    </div>
                  ))}
                </div>

                {(() => {
                  const { premQuestions, promQuestions } = getPrmQuestionGroups(selectedPrmDetail);
                  const rows = [
                    ...premQuestions.map((q: any) => ({ ...q, group: "PREM" })),
                    ...promQuestions.map((q: any) => ({ ...q, group: "PROM" })),
                  ];

                  if (!selectedPrmDetail.answers || Object.keys(selectedPrmDetail.answers).length === 0) {
                    return (
                      <div className="bg-amber-50 rounded-xl p-6 border border-amber-200 text-center">
                        <p className="text-amber-800 font-bold">Detail jawaban tidak tersedia untuk submission lama.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {rows.map((question: any, idx: number) => {
                        const value = selectedPrmDetail.answers?.[question.id] || "";
                        return (
                          <div key={`${question.id}-${idx}`} className="rounded-xl border border-gray-100 p-4">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                                  {question.group}{question.subCategory ? ` • ${question.subCategory}` : ""}
                                </p>
                                <p className="text-sm font-bold text-gray-800 leading-relaxed">{question.question}</p>
                              </div>
                              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap bg-blue-100 text-blue-700">
                                {getRatingAnswerLabel(value)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Approval Dialog */}
        {showApprovalDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {action === "approve" ? "Approve Submission?" : "Request Revision?"}
              </h3>
              <p className="text-gray-600 mb-6">
                {action === "approve"
                  ? `Assessment ini akan dipublikasikan dengan skor final ${effectiveFinal} (${gradeInfo.grade} — ${gradeInfo.name}).`
                  : "Rumah sakit akan diminta untuk melakukan revisi berdasarkan catatan yang Anda berikan."}
              </p>

              {action === "reject" && (
                <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Pilih Bagian yang Perlu Direvisi:</h4>
                  <div className="space-y-2">
                    {[
                      { key: "rsbk", label: "Hospital Structure" },
                      { key: "clinicalAudit", label: "Clinical Audit" },
                      { key: "patientReport", label: "Patient Report" },
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(revisionTargets as any)[item.key]}
                          onChange={e => setRevisionTargets(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-[#0F4C81] focus:ring-[#0F4C81]"
                        />
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowApprovalDialog(false)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  onClick={confirmAction}
                  className={`flex-1 ${action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                >
                  Konfirmasi
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ParameterRow({
  item,
}: {
  item: { name: string; value: string; score: number; detail?: string };
}) {
  const getValueLabel = (value: string) => {
    if (value === "1") return { label: "Tersedia / Patuh", color: "bg-emerald-100 text-emerald-700" };
    if (value === "2") return { label: "Tidak Tersedia / Tidak Patuh", color: "bg-rose-100 text-rose-700" };
    return { label: "Sebagian", color: "bg-amber-100 text-amber-700" };
  };

  const valueInfo = getValueLabel(item.value);

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 rounded-xl transition-all group/row">
      <div className="flex flex-col gap-1 flex-1 mr-4">
        <span className="text-sm font-bold text-gray-800 group-hover/row:text-[#0F4C81] transition-colors leading-relaxed">{item.name}</span>
        {item.detail && (
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover/row:text-gray-500">
            {item.detail}
          </span>
        )}
      </div>
      <div className="flex items-center gap-6 flex-shrink-0">
        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${valueInfo.color}`}>
          {valueInfo.label}
        </span>
        <div className="text-right min-w-[60px]">
          <span className="text-lg font-black text-gray-900">{item.score}</span>
          <span className="text-[8px] block font-black text-gray-400 -mt-1 uppercase">Points</span>
        </div>
      </div>
    </div>
  );
}
