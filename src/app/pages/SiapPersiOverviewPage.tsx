import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  Activity,
  FileText,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Building2,
  Brain,
  Stethoscope,
  ArrowRight,
  PlayCircle,
  PlusCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { draftManager, DraftData } from "../utils/draftManager";
import { specialtyAuditData } from "../data/specialtyAuditData";

const SPECIALTY_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; text: string }> = {
  cardiology: {
    icon: <Activity className="w-5 h-5" />,
    color: "from-red-500 to-pink-500",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-600",
  },
  neurology: {
    icon: <Brain className="w-5 h-5" />,
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
  },
  oncology: {
    icon: <Stethoscope className="w-5 h-5" />,
    color: "from-purple-500 to-indigo-500",
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-600",
  },
};

const STAGE_LABELS: Record<string, string> = {
  rsbk: "Hospital Structure Form",
  clinicalAudit: "Clinical Audit",
  patientReport: "Patient Report",
};

export function SiapPersiOverviewPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [authData, setAuthData] = useState<any>(null);

  useEffect(() => {
    // Load auth
    const auth = sessionStorage.getItem("hospitalAuth");
    if (auth) {
      try { setAuthData(JSON.parse(auth)); } catch {}
    }

    // Sync drafts from draftManager
    const load = async () => {
      await draftManager.syncWithCloud().catch(() => {});
      setDrafts(draftManager.getAllDrafts());
    };
    load();
  }, []);

  const getTier = (score: number) => {
    if (score >= 90) return { grade: "Tier 1", name: "Platinum", colorClass: "text-purple-700", bgClass: "bg-purple-100" };
    if (score >= 80) return { grade: "Tier 2", name: "Outstanding", colorClass: "text-blue-700", bgClass: "bg-blue-100" };
    if (score >= 70) return { grade: "Tier 3", name: "Excellent", colorClass: "text-emerald-700", bgClass: "bg-emerald-100" };
    if (score >= 60) return { grade: "Tier 4", name: "Commendable", colorClass: "text-amber-700", bgClass: "bg-amber-100" };
    return { grade: "Tier 5", name: "Developing", colorClass: "text-slate-600", bgClass: "bg-gray-100" };
  };

  const handleResumeDraft = (draft: DraftData) => {
    draftManager.setCurrentDraftId(draft.draftId);
    sessionStorage.setItem("selectedSpecialties", JSON.stringify(draft.selectedSpecialties));
    const nextStage = draftManager.getNextStage(draft);
    if (nextStage) {
      if (nextStage.stage === "rsbk") navigate(`/siap-persi/rsbk/${nextStage.specialty}`);
      else if (nextStage.stage === "clinicalAudit") navigate(`/siap-persi/clinical-audit/${nextStage.specialty}`);
      else navigate(`/siap-persi/patient-report/${nextStage.specialty}`);
    } else {
      const lastSpec = draft.selectedSpecialties[draft.selectedSpecialties.length - 1];
      navigate(`/siap-persi/result/${lastSpec}`);
    }
  };

  // Compute total weighted score from sessionStorage if available (for completed-in-session drafts)
  const getSpecScore = (spec: string) => {
    const rsbk = parseFloat(sessionStorage.getItem(`${spec}_rsbkScore`) || "0");
    const audit = parseFloat(sessionStorage.getItem(`${spec}_clinicalAuditScore`) || "0");
    const report = parseFloat(sessionStorage.getItem(`${spec}_patientReportScore`) || "0");
    const hasSome = rsbk > 0 || audit > 0 || report > 0;
    if (!hasSome) return null;
    return {
      rsbk,
      audit,
      report,
      final: Number(((rsbk * 0.15) + (audit * 0.60) + (report * 0.25)).toFixed(1)),
    };
  };

  // All drafts have scores from their progress
  const getDraftScore = (draft: DraftData, spec: string) => {
    const prog = draft.progress[spec];
    if (!prog) return { rsbk: 0, audit: 0, report: 0, final: 0 };
    const rsbk = prog.rsbk.score || 0;
    const audit = prog.clinicalAudit.score || 0;
    const report = 0; // patientReport score not stored in local draft
    return {
      rsbk,
      audit,
      report,
      final: Number(((rsbk * 0.15) + (audit * 0.60) + (report * 0.25)).toFixed(1)),
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">NHR PERSI Assessment</h1>
            <p className="text-gray-600">
              {authData?.hospitalName
                ? `Selamat datang, ${authData.hospitalName}`
                : "National Hospital Ranking PERSI — evaluasi kualitas layanan rumah sakit"}
            </p>
          </div>
          <Link to="/siap-persi/select-specialty">
            <Button className="h-12 px-6 bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Assessment Baru
            </Button>
          </Link>
        </div>

        {/* Draft List */}
        {drafts.length === 0 ? (
          /* No Drafts — CTA */
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center mb-8">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-[#0F4C81]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Belum Ada Assessment</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Mulai assessment pertama Anda untuk mendaftarkan rumah sakit ke National Hospital Ranking PERSI.
            </p>
            <Link to="/siap-persi/select-specialty">
              <Button className="h-12 px-8 bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold text-lg">
                Mulai Assessment Sekarang
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {drafts.map((draft) => {
              const progressInfo = draftManager.calculateDraftProgress(draft);
              const nextStage = draftManager.getNextStage(draft);
              const isAllCompleted = nextStage === null;
              const nextStageLabel = nextStage ? STAGE_LABELS[nextStage.stage] : "Semua selesai";
              const nextSpecInfo = nextStage
                ? specialtyAuditData[nextStage.specialty as keyof typeof specialtyAuditData]
                : null;

              return (
                <div key={draft.draftId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Draft Header */}
                  <div className="bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-2xl font-bold">Draft Assessment</span>
                          {isAllCompleted ? (
                            <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">SELESAI</span>
                          ) : (
                            <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">IN PROGRESS</span>
                          )}
                        </div>
                        <p className="text-white/70 text-sm">
                          Dibuat {new Date(draft.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric", month: "long", year: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-bold">{progressInfo.percentage}%</p>
                        <p className="text-white/70 text-sm">{progressInfo.completedStages} / {progressInfo.totalStages} tahap selesai</p>
                      </div>
                    </div>

                    {/* Overall progress bar */}
                    <div className="mt-4 bg-white/20 rounded-full h-2">
                      <div
                        className="bg-white rounded-full h-2 transition-all duration-700"
                        style={{ width: `${progressInfo.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Specialty Cards */}
                  <div className="p-6">
                    {/* Specialty Breakdown */}
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Pelayanan yang Dinilai</p>
                      <div className="flex flex-wrap gap-3">
                        {draft.selectedSpecialties.map((spec) => {
                          const specMeta = SPECIALTY_META[spec] || SPECIALTY_META["cardiology"];
                          const specInfo = specialtyAuditData[spec as keyof typeof specialtyAuditData];
                          const prog = draft.progress[spec];
                          const stages = prog ? [
                            { key: "rsbk", done: prog.rsbk.completed },
                            { key: "clinicalAudit", done: prog.clinicalAudit.completed },
                            { key: "patientReport", done: prog.patientReport.completed },
                          ] : [];
                          const completedCount = stages.filter(s => s.done).length;

                          return (
                            <div key={spec} className={`flex-1 min-w-[200px] rounded-xl p-4 border ${specMeta.border} ${specMeta.bg}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <span className={specMeta.text}>{specMeta.icon}</span>
                                <p className={`font-bold ${specMeta.text}`}>{specInfo?.name || spec}</p>
                              </div>
                              {/* Stage dots */}
                              <div className="flex gap-2">
                                {stages.map((stage, idx) => (
                                  <div key={stage.key} className="flex-1">
                                    <div className={`h-1.5 rounded-full ${stage.done ? "bg-green-500" : "bg-gray-200"}`} />
                                    <p className="text-[9px] text-gray-400 mt-1 text-center">{STAGE_LABELS[stage.key]?.split(" ")[0]}</p>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs font-semibold text-gray-600 mt-2">{completedCount}/3 tahap</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Score Preview (if any stage completed) */}
                    {draft.selectedSpecialties.some(spec => {
                      const prog = draft.progress[spec];
                      return prog?.rsbk.score || prog?.clinicalAudit.score;
                    }) && (
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        {draft.selectedSpecialties.map((spec) => {
                          const prog = draft.progress[spec];
                          if (!prog?.rsbk.score && !prog?.clinicalAudit.score) return null;
                          const specInfo = specialtyAuditData[spec as keyof typeof specialtyAuditData];
                          const scores = getDraftScore(draft, spec);
                          const tier = getTier(scores.final);
                          return (
                            <div key={spec} className="bg-gray-50 rounded-xl p-4">
                              <p className="text-xs font-bold text-gray-500 mb-2">{specInfo?.name}</p>
                              <div className="space-y-1">
                                {scores.rsbk > 0 && <p className="text-xs text-gray-600">Hospital Structure: <span className="font-bold">{scores.rsbk}</span></p>}
                                {scores.audit > 0 && <p className="text-xs text-gray-600">Clinical Audit: <span className="font-bold">{scores.audit}</span></p>}
                                {scores.final > 0 && (
                                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2">
                                    <span className="text-lg font-black text-gray-900">{scores.final}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.bgClass} ${tier.colorClass}`}>{tier.grade}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }).filter(Boolean)}
                      </div>
                    )}

                    {/* Next Step + CTA Row */}
                    <div className="flex items-center justify-between">
                      {!isAllCompleted && nextStage ? (
                        <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-full bg-[#0F4C81] flex items-center justify-center">
                            <ChevronRight className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Langkah berikutnya</p>
                            <p className="font-semibold text-gray-900">
                              {nextSpecInfo?.name} — {nextStageLabel}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-semibold text-sm">Semua tahap telah selesai</span>
                        </div>
                      )}

                      <Button
                        onClick={() => handleResumeDraft(draft)}
                        className="h-10 px-6 bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold flex items-center gap-2"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {isAllCompleted ? "Lihat Hasil" : "Lanjutkan Assessment"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Box at Bottom */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#0F4C81]" />
            Komponen Penilaian NHR PERSI
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Hospital Structure", weight: "15%", desc: "SDM, Sarana & Prasarana, Alat Medis", icon: <Building2 className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Clinical Audit", weight: "60%", desc: "30 rekam medis per penyakit per Pelayanan", icon: <FileText className="w-5 h-5" />, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Patient Report", weight: "25%", desc: "PREM & PROM, 30 pasien target per penyakit", icon: <Users className="w-5 h-5" />, color: "text-teal-600", bg: "bg-teal-50" },
            ].map((item) => (
              <div key={item.label} className={`${item.bg} rounded-xl p-4`}>
                <div className={`${item.color} mb-2`}>{item.icon}</div>
                <p className="font-bold text-gray-900">{item.label}</p>
                <p className={`text-2xl font-black ${item.color} my-1`}>{item.weight}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}