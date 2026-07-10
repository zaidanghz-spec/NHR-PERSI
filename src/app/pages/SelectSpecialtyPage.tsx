import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, Activity, Brain, ChevronRight, CheckCircle2, Clock, Trash2, Play, Plus, Users, Layout, MapPin, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { specialtyAuditData } from "../data/specialtyAuditData";
import { draftManager, DraftData } from "../utils/draftManager";
import { useData } from "../context/DataContext";

export function SelectSpecialtyPage() {
  const navigate = useNavigate();
  const { submissions, currentHospital, syncWithCloud } = useData();
  const [authData, setAuthData] = useState<{ hospitalName: string; picName: string; email?: string; hospitalCode?: string } | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [showNewAssessment, setShowNewAssessment] = useState(false);
  const normalize = (value?: string) => (value || "").trim().toLowerCase();
  const deriveHospitalCode = (email?: string) => {
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
  };
  const matchesHospitalDraft = (draft: DraftData, hospital: { hospitalName: string; email?: string; hospitalCode?: string }) => {
    const code = hospital.hospitalCode || deriveHospitalCode(hospital.email);
    const emailMatch = Boolean(hospital.email && draft.hospitalEmail && normalize(draft.hospitalEmail) === normalize(hospital.email));
    if (hospital.email && draft.hospitalEmail) return emailMatch;
    const codeMatch = Boolean(code && draft.hospitalCode && normalize(draft.hospitalCode) === normalize(code));
    if (code && draft.hospitalCode) return codeMatch;
    if (code || hospital.email || draft.hospitalCode || draft.hospitalEmail) return emailMatch || codeMatch;
    return normalize(draft.hospitalName) === normalize(hospital.hospitalName);
  };

  // Check authentication on mount
  useEffect(() => {
    let cancelled = false;
    const auth = sessionStorage.getItem("hospitalAuth");
    if (!auth) {
      navigate("/hospital-login");
      return;
    }
    const parsedAuth = JSON.parse(auth);
    setAuthData(parsedAuth);

    // Initial load from local
    const loadLocalDrafts = () => {
      const allDrafts = draftManager.getAllDrafts();
      const hospitalDrafts = allDrafts.filter(d => matchesHospitalDraft(d, parsedAuth));
      if (cancelled) return;
      setDrafts(hospitalDrafts);
    };
    
    loadLocalDrafts();

    // Sync with cloud and update state
    draftManager.syncWithCloud(parsedAuth).then(() => {
      loadLocalDrafts();
    });
    syncWithCloud().catch(console.error);

    // Restore selected specialties only when they still belong to the active draft.
    // Specialty-only session data was one of the causes of deleted draft state leaking into new drafts.
    const saved = sessionStorage.getItem("selectedSpecialties");
    const currentDraftId = draftManager.getCurrentDraftId();
    const currentDraft = currentDraftId ? draftManager.getDraftById(currentDraftId) : null;
    if (currentDraft && matchesHospitalDraft(currentDraft, parsedAuth)) {
      setSelectedSpecialties(currentDraft.selectedSpecialties);
    } else {
      sessionStorage.removeItem("selectedSpecialties");
      if (saved) setSelectedSpecialties([]);
    }

    return () => {
      cancelled = true;
    };
  }, [navigate, syncWithCloud]);

  const authHospitalName = authData?.hospitalName || currentHospital?.hospitalName || "";
  const authHospitalCode = authData?.hospitalCode || deriveHospitalCode(authData?.email || currentHospital?.email);
  const hospitalSubmissions = submissions.filter((submission: any) => {
    const submissionHospitalCode =
      submission.hospitalCode ||
      submission.details?.hospitalCode ||
      submission.details?.hospital?.hospitalCode ||
      "";
    return (
      normalize(submission.hospitalName) === normalize(authHospitalName) ||
      Boolean(authHospitalCode && submissionHospitalCode && authHospitalCode === submissionHospitalCode)
    );
  });
  const getSpecialtySubmission = (specialtyName: string) =>
    hospitalSubmissions.find(s => s.specialty === specialtyName);
  const lockedStatuses = ["Pending", "Approved"];
  const submittedSpecialties = hospitalSubmissions
    .filter(s => lockedStatuses.includes(s.status))
    .map(s => s.specialty);

  const toggleSpecialty = (id: string) => {
    // Prevent toggling locked/submitted specialties
    const spec = specialties.find(s => s.id === id);
    const submission = spec ? getSpecialtySubmission(spec.name) : null;
    if (submission?.status === "Revision Required") {
      navigate("/hospital/hasil-penilaian");
      return;
    }
    if (spec && submittedSpecialties.includes(spec.name)) {
      return;
    }

    setSelectedSpecialties((prev) => {
      if (prev.includes(id)) {
        return prev.filter((s) => s !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleStartAssessment = async () => {
    if (selectedSpecialties.length === 0) {
      alert("Pilih minimal 1 pelayanan untuk memulai assessment");
      return;
    }

    if (!authData) return;

    // Create new draft
    const draft = await draftManager.createDraftAndSync(
      authData.hospitalName,
      authData.picName,
      selectedSpecialties,
      authData.hospitalCode || deriveHospitalCode(authData.email),
      authData.email
    );

    draftManager.beginDraftSession(draft);
    
    // Navigate to first specialty's Hospital Structure
    navigate(`/siap-persi/rsbk/${selectedSpecialties[0]}`);
  };

  const handleStartSingleAssessment = async (specId: string) => {
    if (!authData) return;
    const spec = specialties.find(s => s.id === specId);
    const submission = spec ? getSpecialtySubmission(spec.name) : null;
    if (submission?.status === "Revision Required") {
      navigate("/hospital/hasil-penilaian");
      return;
    }
    if (submission && lockedStatuses.includes(submission.status)) {
      return;
    }

    // Ensure the specialty is selected
    let specs = [...selectedSpecialties];
    if (!specs.includes(specId)) {
      specs.push(specId);
      setSelectedSpecialties(specs);
    }

    // Create or reuse draft
    const existingDraftId = draftManager.getCurrentDraftId();
    const activeDraft = existingDraftId ? draftManager.getDraftById(existingDraftId) : null;
    const reusableDraft = [...draftManager.getAllDrafts()]
      .filter(d => matchesHospitalDraft(d, authData))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null;
    const existingDraft = activeDraft && matchesHospitalDraft(activeDraft, authData) ? activeDraft : reusableDraft;

    if (existingDraft && matchesHospitalDraft(existingDraft, authData)) {
      existingDraft.hospitalCode = existingDraft.hospitalCode || authData.hospitalCode || deriveHospitalCode(authData.email);
      existingDraft.hospitalEmail = existingDraft.hospitalEmail || authData.email;
      // Update existing draft with new specialties
      if (!existingDraft.selectedSpecialties.includes(specId)) {
        existingDraft.selectedSpecialties.push(specId);
        existingDraft.progress[specId] = {
          rsbk: { completed: false, data: {} },
          clinicalAudit: { completed: false, data: {} },
          patientReport: { completed: false, data: {} },
        };
        // BUGFIX: Persist the updated draft back to localStorage
      }
      const allDrafts = draftManager.getAllDrafts();
      const idx = allDrafts.findIndex(d => d.draftId === existingDraft.draftId);
      if (idx !== -1) {
        allDrafts[idx] = existingDraft;
        localStorage.setItem("siap_persi_drafts", JSON.stringify(allDrafts));
      }
      draftManager.beginDraftSession(existingDraft);
      await draftManager.syncWithCloud(authData);
    } else {
      // Create new draft
      const draft = await draftManager.createDraftAndSync(
        authData.hospitalName,
        authData.picName,
        specs,
        authData.hospitalCode || deriveHospitalCode(authData.email),
        authData.email
      );
      draftManager.beginDraftSession(draft);
    }

    navigate(`/siap-persi/rsbk/${specId}`);
  };

  const handleResumeDraft = (draft: DraftData) => {
    draftManager.beginDraftSession(draft);

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
      const wasCurrentDraft = draftManager.getCurrentDraftId() === draftId;
      draftManager.deleteDraft(draftId);
      setDrafts(prev => prev.filter(d => d.draftId !== draftId));
      if (wasCurrentDraft) {
        setSelectedSpecialties([]);
      }
    }
  };

  if (!authData) {
    return null; // Loading
  }

  const specialties = [
    {
      id: "cardiology",
      name: "Kardiologi",
      nameEn: "Cardiology",
      description:
        "Penilaian untuk layanan jantung dan pembuluh darah, mencakup pemeriksaan EKG, revaskularisasi, stratifikasi risiko, dan intervensi koroner",
      icon: <Heart className="w-12 h-12" />,
      color: "from-red-500 to-pink-500",
      bgLight: "bg-red-50",
      textColor: "text-red-600",
      borderColor: "border-red-500",
      stats: {
        doctors: `${specialtyAuditData.cardiology.rsbkItems.filter(i => i.category === "sdm").length} item SDM`,
        indicators: `${specialtyAuditData.cardiology.auditQuestions.length} kriteria audit klinis`,
        equipment: `${specialtyAuditData.cardiology.rsbkItems.filter(i => i.category === "alat").length} alat medis`,
      },
    },
    {
      id: "neurology",
      name: "Neurologi",
      nameEn: "Neurology",
      description:
        "Evaluasi layanan neurologi dan stroke, termasuk CT scan, pemberian trombolitik, pemeriksaan lab, dan antiplatelet/antikoagulan",
      icon: <Brain className="w-12 h-12" />,
      color: "from-blue-500 to-cyan-500",
      bgLight: "bg-blue-50",
      textColor: "text-blue-600",
      borderColor: "border-blue-500",
      stats: {
        doctors: `${specialtyAuditData.neurology.rsbkItems.filter(i => i.category === "sdm").length} item SDM`,
        indicators: `${specialtyAuditData.neurology.auditQuestions.length} kriteria audit klinis`,
        equipment: `${specialtyAuditData.neurology.rsbkItems.filter(i => i.category === "alat").length} alat medis`,
      },
    },
    {
      id: "oncology",
      name: "Onkologi",
      nameEn: "Oncology",
      description:
        "Asesmen layanan kanker komprehensif mencakup Kanker Payudara dan Kanker Serviks, dengan evaluasi SDM, sarana bertingkat (Dasar s/d Paripurna), dan audit klinis",
      icon: <Activity className="w-12 h-12" />,
      color: "from-purple-500 to-indigo-500",
      bgLight: "bg-purple-50",
      textColor: "text-purple-600",
      borderColor: "border-purple-500",
      stats: {
        doctors: `${specialtyAuditData.oncology.rsbkItems.filter(i => i.category === "sdm").length} item SDM`,
        indicators: `${specialtyAuditData.oncology.auditQuestions.length} kriteria audit klinis (2 penyakit)`,
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
            to="/submit"
            className="inline-flex items-center text-[#0F4C81] hover:underline mb-4"
          >
            ← Kembali ke Portal RS
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pilih Pelayanan
          </h1>
          <p className="text-gray-600 text-lg">
            Pilih satu atau lebih pelayanan yang akan dinilai untuk NHR PERSI Assessment
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

            {/* Info Banner - Premium Design */}
            <div className="relative bg-gradient-to-br from-[#0F4C81] via-[#0F4C81] to-[#14B8A6] rounded-[2.5rem] p-10 mb-12 text-white overflow-hidden shadow-2xl shadow-blue-900/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-400/10 rounded-full -ml-24 -mb-24 blur-3xl" />
              
              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                <div className="w-20 h-20 bg-white/15 backdrop-blur-xl rounded-[1.5rem] flex items-center justify-center flex-shrink-0 shadow-xl border border-white/20">
                  <Layout className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-white/10">
                    <CheckCircle2 className="w-3 h-3" />
                    Feature Highlight
                  </div>
                  <h3 className="font-black text-white mb-3 text-3xl tracking-tight">
                    Sistem Multi-Pelayanan Paralel
                  </h3>
                  <p className="text-white/80 leading-relaxed max-w-2xl text-lg font-medium">
                    Efisiensi tanpa batas. Pilih beberapa pelayanan sekaligus dan selesaikan seluruh assessment dalam satu alur kerja yang terintegrasi secara otomatis.
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-sm font-bold opacity-90">Bobot Hospital Structure: 15%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-teal-400" />
                      <span className="text-sm font-bold opacity-90">Bobot Audit: 60%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-pink-400" />
                      <span className="text-sm font-bold opacity-90">Patient Report: 25%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selection Counter - Floating Bar Style */}
            {selectedSpecialties.length > 0 && (
              <div className="sticky bottom-8 z-50 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="bg-[#0F4C81]/95 backdrop-blur-lg border border-white/20 rounded-[2rem] p-4 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 max-w-4xl mx-auto ring-1 ring-black/5">
                  <div className="flex items-center gap-4 md:gap-5 md:ml-4 w-full md:w-auto">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20 shrink-0">
                      <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-extrabold text-white text-base md:text-lg">
                        {selectedSpecialties.length} Pelayanan Siap Dinilai
                      </p>
                      <p className="text-white/70 text-xs md:text-sm font-medium line-clamp-1">
                        {selectedSpecialties.map(id => 
                          specialties.find(s => s.id === id)?.name
                        ).join(" • ")}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleStartAssessment}
                    className="h-14 md:h-16 px-8 md:px-10 w-full md:w-auto bg-white text-[#0F4C81] hover:bg-gray-50 rounded-[1.5rem] font-bold text-base md:text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 border-none"
                  >
                    Mulai Sekarang
                    <ArrowRight className="w-5 h-5 md:w-6 md:h-6 ml-2 md:ml-3 shrink-0" />
                  </Button>
                </div>
              </div>
            )}

            {/* Specialty Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch mb-12">
              {specialties.map((specialty) => (
                <SpecialtyCard
                  key={specialty.id}
                  specialty={specialty}
                  isSelected={selectedSpecialties.includes(specialty.id)}
                  isLocked={submittedSpecialties.includes(specialty.name)}
                  submissionStatus={getSpecialtySubmission(specialty.name)?.status}
                  onToggle={() => toggleSpecialty(specialty.id)}
                  onStartSingleAssessment={() => handleStartSingleAssessment(specialty.id)}
                />
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="text-center pb-12">
              {selectedSpecialties.length === 0 && (
                <div className="inline-flex items-center gap-3 py-3 px-6 bg-white border border-gray-100 rounded-full shadow-sm text-gray-500 text-sm font-medium">
                  <Layout className="w-4 h-4 text-[#0F4C81]" />
                  Pilih pelayanan di atas untuk memulai perjalanan assessment Anda
                </div>
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
  isLocked,
  submissionStatus,
}: {
  specialty: {
    id: string;
    name: string;
    nameEn: string;
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
  isLocked?: boolean;
  submissionStatus?: string;
}) {
  const isRevision = submissionStatus === "Revision Required";
  const statusText =
    submissionStatus === "Pending"
      ? "Menunggu Review"
      : submissionStatus === "Approved"
      ? "Sudah Publish"
      : isRevision
      ? "Perlu Revisi"
      : isSelected
      ? "Terpilih"
      : "Belum Dipilih";

  return (
    <button
      onClick={onToggle}
      disabled={isLocked}
      className={`group bg-white rounded-3xl border-2 overflow-hidden transition-all duration-300 text-left w-full relative flex flex-col h-full shadow-sm hover:shadow-2xl ${
        isLocked 
          ? "opacity-75 grayscale-[0.5] cursor-not-allowed border-gray-200"
          : isRevision
          ? "border-red-300 ring-4 ring-red-50 hover:border-red-400"
          : isSelected
          ? `${specialty.borderColor} shadow-blue-100 ring-4 ring-offset-2 ring-blue-50 -translate-y-2`
          : "border-gray-100 hover:border-gray-200"
      }`}
    >
      {/* Checkbox/Locked Indicator - Premium Style */}
      <div className="absolute top-5 right-5 z-20">
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 transform ${
            isLocked
              ? "bg-green-500 text-white shadow-lg"
              : isRevision
              ? "bg-red-500 text-white shadow-lg"
              : isSelected
              ? `bg-white text-[#0F4C81] scale-110 shadow-lg`
              : "bg-white/30 backdrop-blur-md border border-white/40 text-transparent scale-100"
          }`}
        >
          {isLocked || isRevision ? (
            <CheckCircle2 className="w-6 h-6 opacity-100" />
          ) : (
            <CheckCircle2 className={`w-6 h-6 ${isSelected ? "opacity-100" : "opacity-0"}`} />
          )}
        </div>
      </div>

      {/* Header with Visual Richness */}
      <div className={`relative w-full bg-gradient-to-br ${specialty.color} p-8 text-white overflow-hidden`}>
        {/* Abstract Background Shapes */}
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
        <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
        
        <div className="relative z-10 w-full text-left">
          <div className={`${specialty.bgLight} w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-inner backdrop-blur-sm`}>
            <div className={`${specialty.textColor} transform group-hover:scale-110 transition-transform w-8 h-8 [&>svg]:w-full [&>svg]:h-full`}>
              {specialty.icon}
            </div>
          </div>
          <h3 className="text-3xl font-extrabold mb-1 tracking-tight">{specialty.name}</h3>
          <p className="text-white/80 font-medium tracking-wide uppercase text-xs">{specialty.nameEn}</p>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-8 flex flex-col flex-1 bg-white">
        <p className="text-gray-600 text-sm leading-relaxed mb-6 opacity-90 group-hover:text-gray-900 transition-colors">
          {specialty.description}
        </p>

        <div className="mt-auto">
          {/* Dynamic Stats Grid */}
          <div className="space-y-4 mb-8">
            <StatItem 
              icon={<Users className="w-4 h-4" />} 
              label="Tenaga Medis" 
              value={specialty.stats.doctors} 
              themeColor={specialty.textColor}
            />
            <StatItem 
              icon={<Activity className="w-4 h-4" />} 
              label="Kriteria Audit Klinis"
              value={specialty.stats.indicators} 
              themeColor={specialty.textColor}
            />
            <StatItem 
              icon={<Plus className="w-4 h-4" />} 
              label="Alat Medis" 
              value={specialty.stats.equipment} 
              themeColor={specialty.textColor}
            />
          </div>

          {/* Footer Interaction */}
          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-widest ${
              isLocked ? "text-green-600" : isRevision ? "text-red-600" : isSelected ? specialty.textColor : "text-gray-400 group-hover:text-gray-600"
            } transition-colors`}>
              {statusText}
            </span>
            <div className={`p-2 rounded-xl transition-all ${
              isLocked ? "bg-green-50" : isRevision ? "bg-red-50" : isSelected ? specialty.bgLight : "bg-gray-50 group-hover:bg-gray-100"
            }`}>
               <ChevronRight className={`w-5 h-5 ${isLocked ? "text-green-600" : isRevision ? "text-red-600" : isSelected ? specialty.textColor : "text-gray-400"}`} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function StatItem({ icon, label, value, themeColor }: { icon: React.ReactNode; label: string; value: string; themeColor: string }) {
  return (
    <div className="flex items-center gap-4 group/item">
      <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center transition-colors group-hover/item:bg-white group-hover/item:shadow-sm`}>
        <div className="text-gray-400 group-hover:text-gray-600">{icon}</div>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-tight">{label}</span>
          <span className="text-sm font-bold text-gray-900">{value}</span>
        </div>
        <div className="w-full bg-gray-100 h-1 rounded-full mt-1 overflow-hidden">
          <div className="bg-gray-200 h-full w-2/3 group-hover:w-full transition-all duration-500" />
        </div>
      </div>
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

  const specialtyColors: Record<string, string> = {
    cardiology: "bg-red-500 border-red-500 text-white",
    neurology: "bg-blue-500 border-blue-500 text-white",
    oncology: "bg-purple-500 border-purple-500 text-white",
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

  const getStatusInfo = (filled: number, total: number) => {
    if (total > 0 && filled >= total) return { label: "Complete", className: "bg-green-100 text-green-700" };
    if (filled > 0) return { label: "In Progress", className: "bg-amber-100 text-amber-700" };
    return { label: "Not Started", className: "bg-gray-100 text-gray-600" };
  };

  const getClinicalCompleted = (spec: string, diseaseIndex: number) => {
    const specData = specialtyAuditData[spec as keyof typeof specialtyAuditData];
    const stage = draft.progress[spec]?.clinicalAudit;
    const data = stage?.data || {};
    const patientMeta = stage?.patientMeta || {};
    const makeKey = (patientNum: number, questionId: string) => `d${diseaseIndex}-${patientNum}-${questionId}`;
    const makePatientKey = (patientNum: number) => `d${diseaseIndex}-${patientNum}`;
    let count = 0;
    for (let patient = 1; patient <= 30; patient++) {
      const meta = patientMeta[makePatientKey(patient)] || { initials: "", code: "" };
      const complete = Boolean(meta.initials?.trim() && meta.code?.trim()) &&
        specData.diseases[diseaseIndex].questions.every(question => data[makeKey(patient, question.id)]);
      if (complete) count++;
    }
    return count;
  };

  const getPrmCompleted = (spec: string, diseaseIndex: number) => {
    const data = draft.progress[spec]?.patientReport?.data || {};
    const diseaseKey = `${spec}-d${diseaseIndex}`;
    const count = Number(
      data[`${diseaseKey}_patientCount`] ||
      (Number(data[`${diseaseKey}_qrPatientCount`] || 0) + Number(data[`${diseaseKey}_pdfPatientCount`] || 0)) ||
      0
    );
    return Number.isFinite(count) ? count : 0;
  };

  const renderProgressRow = (label: string, filled: number, total: number, tone: "blue" | "purple" | "teal") => {
    const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
    const status = getStatusInfo(filled, total);
    const colors = {
      blue: "bg-blue-500",
      purple: "bg-purple-500",
      teal: "bg-teal-500",
    };
    return (
      <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{label}</p>
            <p className="text-xs text-gray-500">{filled}/{total} terisi</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${status.className}`}>
            {status.label}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="group bg-white rounded-[2rem] border-2 border-gray-100 hover:border-[#0F4C81] hover:shadow-2xl transition-all duration-500 overflow-hidden">
      <div className="p-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex gap-5">
            <div className="w-16 h-16 bg-yellow-50 rounded-[1.5rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-2xl font-black text-gray-900">Draft Assessment</h3>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase tracking-widest rounded-full">In Progress</span>
              </div>
              <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Dibuat {formatDate(draft.updatedAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onDelete}
            className="w-12 h-12 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300"
          >
            <Trash2 className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-8">
          {/* Specialties List */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Pelayanan</p>
            <div className="flex flex-wrap gap-3">
              {draft.selectedSpecialties.map((spec) => (
                <div
                  key={spec}
                  className={`flex items-center gap-3 px-4 py-2 border shadow-sm rounded-xl text-sm font-bold transition-colors ${specialtyColors[spec] || "bg-gray-100 border-gray-200 text-gray-700"}`}
                >
                  <div>{specialtyIcons[spec]}</div>
                  <span>{specialtyNames[spec]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Detail Progress Assessment</p>
          {draft.selectedSpecialties.map((spec) => {
            const specData = specialtyAuditData[spec as keyof typeof specialtyAuditData];
            const rsbkData = draft.progress[spec]?.rsbk?.data || {};
            const rsbkTotal = specData.rsbkItems.length;
            const rsbkFilled = specData.rsbkItems.filter(item =>
              rsbkData[item.id] !== null && rsbkData[item.id] !== undefined && rsbkData[item.id] !== ""
            ).length;

            return (
              <div key={spec} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="text-[#0F4C81]">{specialtyIcons[spec]}</div>
                  <h4 className="font-black text-gray-900">{specialtyNames[spec]}</h4>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  {renderProgressRow("Hospital Structure", rsbkFilled, rsbkTotal, "blue")}
                  <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 lg:col-span-1">
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-purple-700">Clinical Audit per Penyakit</p>
                    <div className="space-y-2">
                      {specData.diseases.map((disease, index) =>
                        renderProgressRow(disease.diseaseName, getClinicalCompleted(spec, index), 30, "purple")
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 lg:col-span-1">
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-teal-700">PRM/PREMPROM per Penyakit</p>
                    <div className="space-y-2">
                      {specData.diseases.map((disease, index) =>
                        renderProgressRow(disease.diseaseName, getPrmCompleted(spec, index), 30, "teal")
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button
          onClick={onResume}
          className="w-full h-18 bg-gray-900 hover:bg-black text-white rounded-[1.25rem] font-black text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-[1.01] active:scale-95 border-none py-8"
        >
          <Play className="w-6 h-6 mr-3 fill-current" />
          LANJUTKAN ASSESSMENT
          <ChevronRight className="w-6 h-6 ml-auto" />
        </Button>
      </div>
    </div>
  );
}
