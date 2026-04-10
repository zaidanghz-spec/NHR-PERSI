import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, Activity, Brain, ChevronRight, CheckCircle2, Clock, Trash2, Play, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { specialtyAuditData } from "../data/specialtyAuditData";
import { draftManager, DraftData } from "../utils/draftManager";

export function SelectSpecialtyPage() {
  const navigate = useNavigate();
  const [authData, setAuthData] = useState<{ hospitalName: string; picName: string } | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [showNewAssessment, setShowNewAssessment] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const auth = sessionStorage.getItem("hospitalAuth");
    if (!auth) {
      navigate("/hospital-login");
      return;
    }
    const parsedAuth = JSON.parse(auth);
    setAuthData(parsedAuth);

    // Load drafts
    const allDrafts = draftManager.getAllDrafts();
    // Filter drafts for this hospital
    const hospitalDrafts = allDrafts.filter(d => d.hospitalName === parsedAuth.hospitalName);
    setDrafts(hospitalDrafts);

    // Load previously selected specialties if any
    const saved = sessionStorage.getItem("selectedSpecialties");
    if (saved) {
      setSelectedSpecialties(JSON.parse(saved));
    }
  }, [navigate]);

  const toggleSpecialty = (id: string) => {
    setSelectedSpecialties((prev) => {
      if (prev.includes(id)) {
        return prev.filter((s) => s !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleStartAssessment = () => {
    if (selectedSpecialties.length === 0) {
      alert("Pilih minimal 1 spesialisasi untuk memulai assessment");
      return;
    }

    if (!authData) return;

    // Create new draft
    const draft = draftManager.createDraft(
      authData.hospitalName,
      authData.picName,
      selectedSpecialties
    );

    // Save to session
    sessionStorage.setItem("selectedSpecialties", JSON.stringify(selectedSpecialties));
    draftManager.setCurrentDraftId(draft.draftId);
    
    // Navigate to first specialty's RSBK
    navigate(`/siap-persi/rsbk/${selectedSpecialties[0]}`);
  };

  const handleStartSingleAssessment = (specId: string) => {
    if (!authData) return;

    // Ensure the specialty is selected
    let specs = [...selectedSpecialties];
    if (!specs.includes(specId)) {
      specs.push(specId);
      setSelectedSpecialties(specs);
    }

    // Create or reuse draft
    const existingDraftId = draftManager.getCurrentDraftId();
    const existingDraft = existingDraftId ? draftManager.getDraftById(existingDraftId) : null;

    if (existingDraft && existingDraft.hospitalName === authData.hospitalName) {
      // Update existing draft with new specialties
      if (!existingDraft.selectedSpecialties.includes(specId)) {
        existingDraft.selectedSpecialties.push(specId);
        existingDraft.progress[specId] = {
          rsbk: { completed: false, data: {} },
          clinicalAudit: { completed: false, data: {} },
          patientReport: { completed: false, data: {} },
        };
      }
      sessionStorage.setItem("selectedSpecialties", JSON.stringify(existingDraft.selectedSpecialties));
    } else {
      // Create new draft
      const draft = draftManager.createDraft(
        authData.hospitalName,
        authData.picName,
        specs
      );
      sessionStorage.setItem("selectedSpecialties", JSON.stringify(specs));
      draftManager.setCurrentDraftId(draft.draftId);
    }

    navigate(`/siap-persi/rsbk/${specId}`);
  };

  const handleResumeDraft = (draft: DraftData) => {
    // Set draft as current
    draftManager.setCurrentDraftId(draft.draftId);
    sessionStorage.setItem("selectedSpecialties", JSON.stringify(draft.selectedSpecialties));

    // Find next incomplete stage
    const nextStage = draftManager.getNextStage(draft);
    
    if (nextStage) {
      // Navigate to next incomplete stage
      if (nextStage.stage === "rsbk") {
        navigate(`/siap-persi/rsbk/${nextStage.specialty}`);
      } else if (nextStage.stage === "clinicalAudit") {
        navigate(`/siap-persi/clinical-audit/${nextStage.specialty}`);
      } else {
        navigate(`/siap-persi/patient-report/${nextStage.specialty}`);
      }
    } else {
      // All completed, go to result page
      const lastSpecialty = draft.selectedSpecialties[draft.selectedSpecialties.length - 1];
      navigate(`/siap-persi/result/${lastSpecialty}`);
    }
  };

  const handleDeleteDraft = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Apakah Anda yakin ingin menghapus draft ini?")) {
      draftManager.deleteDraft(draftId);
      setDrafts(drafts.filter(d => d.draftId !== draftId));
    }
  };

  if (!authData) {
    return null; // Loading
  }

  const specialties = [
    {
      id: "cardiology",
      name: "Cardiology",
      nameId: "Kardiologi",
      description:
        "Penilaian untuk layanan jantung dan pembuluh darah, mencakup pemeriksaan EKG, revaskularisasi, stratifikasi risiko, dan intervensi koroner",
      icon: <Heart className="w-12 h-12" />,
      color: "from-red-500 to-pink-500",
      bgLight: "bg-red-50",
      textColor: "text-red-600",
      borderColor: "border-red-500",
      stats: {
        doctors: `${specialtyAuditData.cardiology.rsbkItems.filter(i => i.category === "sdm").length} item SDM`,
        indicators: `${specialtyAuditData.cardiology.auditQuestions.length} indikator audit`,
        equipment: `${specialtyAuditData.cardiology.rsbkItems.filter(i => i.category === "alat").length} alat medis`,
      },
    },
    {
      id: "neurology",
      name: "Neurology",
      nameId: "Neurologi",
      description:
        "Evaluasi layanan neurologi dan stroke, termasuk CT scan, pemberian trombolitik, pemeriksaan lab, dan antiplatelet/antikoagulan",
      icon: <Brain className="w-12 h-12" />,
      color: "from-blue-500 to-cyan-500",
      bgLight: "bg-blue-50",
      textColor: "text-blue-600",
      borderColor: "border-blue-500",
      stats: {
        doctors: `${specialtyAuditData.neurology.rsbkItems.filter(i => i.category === "sdm").length} item SDM`,
        indicators: `${specialtyAuditData.neurology.auditQuestions.length} indikator audit`,
        equipment: `${specialtyAuditData.neurology.rsbkItems.filter(i => i.category === "alat").length} alat medis`,
      },
    },
    {
      id: "oncology",
      name: "Oncology",
      nameId: "Onkologi",
      description:
        "Asesmen layanan kanker komprehensif mencakup Kanker Payudara dan Kanker Serviks, dengan evaluasi SDM, sarana bertingkat (Dasar s/d Paripurna), dan audit klinis",
      icon: <Activity className="w-12 h-12" />,
      color: "from-purple-500 to-indigo-500",
      bgLight: "bg-purple-50",
      textColor: "text-purple-600",
      borderColor: "border-purple-500",
      stats: {
        doctors: `${specialtyAuditData.oncology.rsbkItems.filter(i => i.category === "sdm").length} item SDM`,
        indicators: `${specialtyAuditData.oncology.auditQuestions.length} indikator audit (2 penyakit)`,
        equipment: `${specialtyAuditData.oncology.rsbkItems.filter(i => i.category === "alat").length} alat medis`,
      },
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/siap-persi/overview"
            className="inline-flex items-center text-[#0F4C81] hover:underline mb-4"
          >
            ← Kembali ke Overview
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pilih Spesialisasi
          </h1>
          <p className="text-gray-600 text-lg">
            Pilih satu atau lebih spesialisasi yang akan dinilai untuk NHR PERSI Assessment
          </p>
        </div>

        {/* Draft List Section */}
        {drafts.length > 0 && !showNewAssessment && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Draft Tersimpan</h2>
                <p className="text-gray-600">Lanjutkan assessment yang belum selesai</p>
              </div>
              <Button
                onClick={() => setShowNewAssessment(true)}
                className="bg-[#0F4C81] hover:bg-[#0d3d66]"
              >
                <Plus className="w-5 h-5 mr-2" />
                Buat Assessment Baru
              </Button>
            </div>

            <div className="space-y-4">
              {drafts.map((draft) => (
                <DraftCard
                  key={draft.draftId}
                  draft={draft}
                  onResume={() => handleResumeDraft(draft)}
                  onDelete={(e) => handleDeleteDraft(draft.draftId, e)}
                />
              ))}
            </div>
          </div>
        )}

        {/* New Assessment Section */}
        {(drafts.length === 0 || showNewAssessment) && (
          <>
            {showNewAssessment && (
              <div className="mb-6">
                <Button
                  onClick={() => setShowNewAssessment(false)}
                  variant="outline"
                  className="border-2"
                >
                  ← Kembali ke Draft
                </Button>
              </div>
            )}

            {/* Info Banner - Updated */}
            <div className="bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl p-6 mb-8 text-white">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-2 text-xl">
                    ✨ Sistem Multi-Spesialisasi Paralel
                  </h3>
                  <p className="text-white/90 leading-relaxed mb-3">
                    Anda dapat memilih <strong>beberapa spesialisasi sekaligus</strong> dan mengisinya dalam satu sesi. 
                    Misalnya: checklist Kardiologi + Onkologi, lalu sistem akan memandu Anda mengisi kedua spesialisasi 
                    tersebut secara berurutan tanpa harus kembali ke halaman ini.
                  </p>
                  <div className="bg-white/10 rounded-lg p-4 text-sm">
                    <p className="font-semibold mb-2">Setiap spesialisasi dinilai berdasarkan:</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>📋 <strong>RSBK (15%)</strong> - Kemampuan Layanan</div>
                      <div>🔍 <strong>Clinical Audit (60%)</strong> - 30 Rekam Medis</div>
                      <div>😊 <strong>Patient Report (25%)</strong> - PREM & PROM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selection Counter */}
            {selectedSpecialties.length > 0 && (
              <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">
                      {selectedSpecialties.length} Spesialisasi Dipilih
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedSpecialties.map(id => 
                        specialties.find(s => s.id === id)?.nameId
                      ).join(", ")}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleStartAssessment}
                  className="h-12 px-8 bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] hover:from-[#0d3d66] hover:to-[#0d9488] font-semibold"
                >
                  Mulai Assessment
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}

            {/* Specialty Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {specialties.map((specialty) => (
                <SpecialtyCard
                  key={specialty.id}
                  specialty={specialty}
                  isSelected={selectedSpecialties.includes(specialty.id)}
                  onToggle={() => toggleSpecialty(specialty.id)}
                  onStartSingleAssessment={() => handleStartSingleAssessment(specialty.id)}
                />
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="mt-8 text-center">
              {selectedSpecialties.length === 0 && (
                <p className="text-gray-500 text-sm">
                  Klik pada card spesialisasi untuk memilih, atau langsung klik "Mulai Assessment" pada card
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SpecialtyCard({
  specialty,
  isSelected,
  onToggle,
  onStartSingleAssessment,
}: {
  specialty: {
    id: string;
    name: string;
    nameId: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    bgLight: string;
    textColor: string;
    borderColor: string;
    stats: {
      doctors: string;
      indicators: string;
      equipment: string;
    };
  };
  isSelected: boolean;
  onToggle: () => void;
  onStartSingleAssessment: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`bg-white rounded-xl border-2 overflow-hidden hover:shadow-xl transition-all text-left w-full relative flex flex-col h-full ${
        isSelected
          ? `${specialty.borderColor} shadow-lg scale-105`
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* Checkbox Indicator */}
      <div className="absolute top-4 right-4 z-10">
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected
              ? `${specialty.borderColor} bg-gradient-to-br ${specialty.color}`
              : "border-gray-300 bg-white"
          }`}
        >
          {isSelected && <CheckCircle2 className="w-5 h-5 text-white" />}
        </div>
      </div>

      {/* Header with Icon */}
      <div className={`bg-gradient-to-br ${specialty.color} p-8 text-white relative`}>
        <div className="absolute top-4 right-16 opacity-20">
          {specialty.icon}
        </div>
        <div className={`${specialty.bgLight} w-16 h-16 rounded-xl flex items-center justify-center mb-4`}>
          <div className={specialty.textColor}>{specialty.icon}</div>
        </div>
        <h3 className="text-2xl font-bold mb-1">{specialty.nameId}</h3>
        <p className="text-white/90 text-sm">{specialty.name}</p>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <p className="text-gray-700 text-sm leading-relaxed mb-6">
          {specialty.description}
        </p>

        {/* Stats */}
        <div className="space-y-3 flex-1">
          <StatItem label="Tenaga Medis" value={specialty.stats.doctors} />
          <StatItem label="Indikator Audit" value={specialty.stats.indicators} />
          <StatItem label="Alat Medis" value={specialty.stats.equipment} />
        </div>

        {/* Selection Status */}
        {isSelected && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-sm font-semibold text-green-700">
              ✓ Dipilih untuk Assessment
            </p>
          </div>
        )}

        {/* Start Single Assessment Button */}
        <div className="mt-4">
          <Button
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onStartSingleAssessment();
            }}
            className="w-full h-10 bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] hover:from-[#0d3d66] hover:to-[#0d9488] font-semibold text-sm"
          >
            Mulai Assessment Spesialisasi Ini
          </Button>
        </div>
      </div>
    </button>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function DraftCard({
  draft,
  onResume,
  onDelete,
}: {
  draft: DraftData;
  onResume: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const specialtyIcons: Record<string, React.ReactNode> = {
    cardiology: <Heart className="w-5 h-5" />,
    neurology: <Brain className="w-5 h-5" />,
    oncology: <Activity className="w-5 h-5" />,
  };

  const specialtyNames: Record<string, string> = {
    cardiology: "Kardiologi",
    neurology: "Neurologi",
    oncology: "Onkologi",
  };

  const progress = draftManager.calculateDraftProgress(draft);
  const nextStage = draftManager.getNextStage(draft);

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 hover:border-[#0F4C81] hover:shadow-lg transition-all p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Draft Assessment</h3>
              <p className="text-sm text-gray-500">
                Terakhir diubah: {formatDate(draft.updatedAt)}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress Overall</span>
          <span className="text-sm font-bold text-[#0F4C81]">{progress.percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {progress.completedStages} dari {progress.totalStages} tahapan selesai
        </p>
      </div>

      {/* Specialties */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Spesialisasi:</p>
        <div className="flex flex-wrap gap-2">
          {draft.selectedSpecialties.map((spec) => (
            <div
              key={spec}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm"
            >
              {specialtyIcons[spec]}
              <span className="font-medium text-gray-800">{specialtyNames[spec]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Progress per Specialty */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">Progress Detail:</p>
        <div className="space-y-2">
          {draft.selectedSpecialties.map((spec) => {
            const specProgress = draft.progress[spec];
            if (!specProgress) return null;

            return (
              <div key={spec} className="text-xs">
                <p className="font-semibold text-gray-700 mb-1">{specialtyNames[spec]}</p>
                <div className="grid grid-cols-3 gap-2 pl-3">
                  <div className={`${specProgress.rsbk.completed ? "text-green-600" : "text-gray-400"}`}>
                    {specProgress.rsbk.completed ? "✓" : "○"} RSBK
                  </div>
                  <div className={`${specProgress.clinicalAudit.completed ? "text-green-600" : "text-gray-400"}`}>
                    {specProgress.clinicalAudit.completed ? "✓" : "○"} Audit
                  </div>
                  <div className={`${specProgress.patientReport.completed ? "text-green-600" : "text-gray-400"}`}>
                    {specProgress.patientReport.completed ? "✓" : "○"} Report
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Stage Info */}
      {nextStage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-700">
            <strong className="text-blue-700">Selanjutnya:</strong>{" "}
            {specialtyNames[nextStage.specialty]} -{" "}
            {nextStage.stage === "rsbk"
              ? "Hospital Structure Form"
              : nextStage.stage === "clinicalAudit"
              ? "Clinical Audit"
              : "Patient Report"}
          </p>
        </div>
      )}

      {/* Actions */}
      <Button
        onClick={onResume}
        className="w-full h-12 bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] hover:from-[#0d3d66] hover:to-[#0d9488] font-semibold"
      >
        <Play className="w-5 h-5 mr-2" />
        Lanjutkan Assessment
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}