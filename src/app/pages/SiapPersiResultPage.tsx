import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { CheckCircle2, Clock, FileText, ChevronRight, ArrowRight, Stethoscope, Users, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { specialtyAuditData } from "../data/specialtyAuditData";
import { SpecialtyProgressTracker } from "../components/SpecialtyProgressTracker";
import { useData } from "../context/DataContext";
import { draftManager, stripLegacyToolVariationFields } from "../utils/draftManager";
import * as api from "../utils/api";

type PatientCountBreakdown = {
  diseaseName: string;
  count: number;
};

export function SiapPersiResultPage() {
  const { specialty } = useParams<{ specialty: string }>();
  const navigate = useNavigate();
  const { addSubmission } = useData();
  const specialtyInfo = specialtyAuditData[specialty as keyof typeof specialtyAuditData];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draftId = draftManager.getCurrentDraftId();
  const draft = draftId ? draftManager.getDraftById(draftId) : null;

  const calculateRsbkScoreFromData = (spec: string | undefined, data: Record<string, any> = {}) => {
    const info = specialtyAuditData[spec as keyof typeof specialtyAuditData];
    if (!info) return 0;
    const getActual = (id: string) => {
      const value = data[id];
      if (value === null || value === undefined || value === "") return 0;
      const parsed = typeof value === "number" ? value : parseFloat(String(value));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const calcPoints = (category: string) =>
      info.rsbkItems
        .filter(item => item.category === category)
        .reduce((sum, item) => sum + Math.min(getActual(item.id), item.target) * item.pointPerUnit, 0);
    const calcTargetPoints = (category: string) =>
      info.rsbkItems
        .filter(item => item.category === category)
        .reduce((sum, item) => sum + item.target * item.pointPerUnit, 0);

    const sdmTarget = calcTargetPoints("sdm");
    const saranaTarget = calcTargetPoints("sarana");
    const alatTarget = calcTargetPoints("alat");
    const sdm = sdmTarget > 0 ? (calcPoints("sdm") / sdmTarget) * 50 : 0;
    const sarana = saranaTarget > 0 ? (calcPoints("sarana") / saranaTarget) * 25 : 0;
    const alat = alatTarget > 0 ? (calcPoints("alat") / alatTarget) * 25 : 0;
    return Number((sdm + sarana + alat).toFixed(1));
  };

  const getStoredScore = (spec: string | undefined, stage: "rsbk" | "clinicalAudit" | "patientReport") => {
    if (!spec) return 0;
    const sessionKey =
      stage === "rsbk"
        ? `${spec}_rsbkScore`
        : stage === "clinicalAudit"
        ? `${spec}_clinicalAuditScore`
        : `${spec}_patientReportScore`;
    const sessionValue = parseFloat(sessionStorage.getItem(sessionKey) || "");
    if (Number.isFinite(sessionValue)) return sessionValue;

    const draftStage = draft?.progress?.[spec]?.[stage];
    if (typeof draftStage?.score === "number") return draftStage.score;
    if (stage === "rsbk") return calculateRsbkScoreFromData(spec, draftStage?.data || {});
    return 0;
  };

  // Get selected specialties
  const selectedSpecialtiesStr = sessionStorage.getItem("selectedSpecialties");
  const selectedSpecialties: string[] = selectedSpecialtiesStr
    ? JSON.parse(selectedSpecialtiesStr)
    : [specialty];
  
  const currentIndex = selectedSpecialties.indexOf(specialty || "");
  const isLastSpecialty = currentIndex === selectedSpecialties.length - 1;
  const nextSpecialty = !isLastSpecialty ? selectedSpecialties[currentIndex + 1] : null;

  // Get scores from session (Specialty Specific)
  const rsbkScore = getStoredScore(specialty, "rsbk");
  const clinicalAuditScore = getStoredScore(specialty, "clinicalAudit");
  const patientReportScore = getStoredScore(specialty, "patientReport");

  // Calculate weighted total: Hospital Structure 15%, Clinical Audit 60%, Patient Report 25%
  const rsbkWeighted = Number((rsbkScore * 0.15).toFixed(2));
  const auditWeighted = Number((clinicalAuditScore * 0.60).toFixed(2));
  const prmWeighted = Number((patientReportScore * 0.25).toFixed(2));
  const totalSiapScore = Number((rsbkWeighted + auditWeighted + prmWeighted).toFixed(2));

  const [auditPatientCount, setAuditPatientCount] = useState(sessionStorage.getItem(`${specialty}_auditPatientCount`) || "0");
  const [prmPatientCount, setPrmPatientCount] = useState(sessionStorage.getItem(`${specialty}_prmPatientCount`) || "0");
  const [auditPatientBreakdown, setAuditPatientBreakdown] = useState<PatientCountBreakdown[]>([]);
  const [prmPatientBreakdown, setPrmPatientBreakdown] = useState<PatientCountBreakdown[]>([]);
  const [showBackChoice, setShowBackChoice] = useState(false);

  const getStageStatus = (spec: string | undefined, stage: "rsbk" | "clinicalAudit" | "patientReport") => {
    if (!spec) return { complete: false, label: "Belum lengkap", detail: "Data belum tersedia" };
    const info = specialtyAuditData[spec as keyof typeof specialtyAuditData];
    const activeDraft = draftId ? draftManager.getDraftById(draftId) : null;
    const progress = activeDraft?.progress?.[spec];

    if (stage === "rsbk") {
      const total = info?.rsbkItems.length || 0;
      const data = progress?.rsbk?.data || {};
      const filled = info?.rsbkItems.filter(item => data[item.id] !== null && data[item.id] !== undefined && data[item.id] !== "").length || 0;
      return {
        complete: total > 0 && filled === total,
        label: total > 0 && filled === total ? "Lengkap" : "Belum lengkap",
        detail: `${filled}/${total} item terisi`,
      };
    }

    if (stage === "clinicalAudit") {
      const breakdown = spec === specialty ? auditPatientBreakdown : [];
      const diseaseCount = info?.diseases.length || 0;
      const completeFromBreakdown = breakdown.length >= diseaseCount && breakdown.every(item => item.count >= 1);
      const sessionCount = parseInt(sessionStorage.getItem(`${spec}_auditPatientCount`) || "0", 10);
      const complete = Boolean(progress?.clinicalAudit?.completed || completeFromBreakdown || (diseaseCount > 0 && sessionCount >= diseaseCount));
      return {
        complete,
        label: complete ? "Lengkap" : "Belum lengkap",
        detail: spec === specialty ? `${auditPatientCount} rekam medis terisi` : `${sessionCount} rekam medis terisi`,
      };
    }

    const breakdown = spec === specialty ? prmPatientBreakdown : [];
    const diseaseCount = info?.diseases.length || 0;
    const completeFromBreakdown = breakdown.length >= diseaseCount && breakdown.every(item => item.count >= 1);
    const sessionCount = parseInt(sessionStorage.getItem(`${spec}_prmPatientCount`) || "0", 10);
    const complete = Boolean(progress?.patientReport?.completed || completeFromBreakdown || (diseaseCount > 0 && sessionCount >= diseaseCount));
    return {
      complete,
      label: complete ? "Lengkap" : "Belum lengkap",
      detail: spec === specialty ? `${prmPatientCount} pasien terisi` : `${sessionCount} pasien terisi`,
    };
  };

  const currentStageStatuses = {
    rsbk: getStageStatus(specialty, "rsbk"),
    clinicalAudit: getStageStatus(specialty, "clinicalAudit"),
    patientReport: getStageStatus(specialty, "patientReport"),
  };

  const incompleteStages = selectedSpecialties.flatMap((spec) => {
    const statusMap = [
      { label: "Hospital Structure", status: getStageStatus(spec, "rsbk") },
      { label: "Clinical Audit", status: getStageStatus(spec, "clinicalAudit") },
      { label: "Patient Report", status: getStageStatus(spec, "patientReport") },
    ];
    const specName = specialtyAuditData[spec as keyof typeof specialtyAuditData]?.name || spec;
    return statusMap
      .filter(item => !item.status.complete)
      .map(item => `${specName} - ${item.label} (${item.status.detail})`);
  });

  const canSubmitAll = incompleteStages.length === 0;

  const StatusBadge = ({ complete }: { complete: boolean }) => (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
      complete ? "text-green-700" : "text-amber-700"
    }`}>
      {complete ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {complete ? "Lengkap" : "Belum Lengkap"}
    </span>
  );

  const renderPatientCount = (total: string, breakdown: PatientCountBreakdown[], unit: string) => {
    const totalTarget = Math.max(1, breakdown.length) * 30;
    return (
      <div className="space-y-1">
        <div className="text-xs text-gray-500">Total {total}/{totalTarget} {unit}</div>
        {breakdown.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {breakdown.map((item) => (
              <span
                key={item.diseaseName}
                className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600"
              >
                {item.diseaseName}: {item.count}/30
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    async function recoverCounts() {
      if (!specialty) return;
      const hospitalAuth = JSON.parse(sessionStorage.getItem("hospitalAuth") || "{}");
      const hCode = hospitalAuth.hospitalCode || hospitalAuth.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 12) || "RS001";

      // 1. Recover PRM Count
      let totalPRM = 0;
      const prmBreakdown: PatientCountBreakdown[] = [];
      if (specialtyInfo) {
        for (let i = 0; i < specialtyInfo.diseases.length; i++) {
          const dKey = `${specialty}-d${i}`;
          try {
            const surveys = await api.getSurveys(hCode, dKey);
            const customData = await api.getCustomSurveyMetadata(hCode, dKey);
            const count = surveys.length + (customData ? (customData.patientCount || 0) : 0);
            totalPRM += count;
            prmBreakdown.push({
              diseaseName: specialtyInfo.diseases[i]?.diseaseName || `Penyakit ${i + 1}`,
              count,
            });
          } catch {}
        }
      }
      setPrmPatientBreakdown(prmBreakdown);
      setPrmPatientCount(totalPRM.toString());
      sessionStorage.setItem(`${specialty}_prmPatientCount`, totalPRM.toString());

      // 2. Recover Audit Count (from Draft)
      let totalAudit = 0;
      const auditBreakdown: PatientCountBreakdown[] = [];
      if (specialtyInfo) {
        const currentDraft = draftId ? draftManager.getDraftById(draftId) : null;
        const progressAudit = currentDraft?.progress?.[specialty]?.clinicalAudit;
        let auditSource: any = progressAudit?.data && Object.keys(progressAudit.data).length > 0
          ? {
              formData: progressAudit.data,
              patientMeta: progressAudit.patientMeta || {},
            }
          : null;

        if (!auditSource) {
          try {
            const savedDraft = localStorage.getItem(`clinical-audit-draft-${hCode}-${specialty}`);
            if (savedDraft) auditSource = JSON.parse(savedDraft);
          } catch {}
        }

        if (auditSource?.formData || auditSource?.data) {
          const formData = auditSource.formData || auditSource.data || {};
          const patientMeta = auditSource.patientMeta || {};
          const makeKey = (diseaseIdx: number, patientNum: number, questionId: string) =>
            `d${diseaseIdx}-${patientNum}-${questionId}`;
          const makePatientKey = (diseaseIdx: number, patientNum: number) =>
            `d${diseaseIdx}-${patientNum}`;

          specialtyInfo.diseases.forEach((d, dIdx) => {
            let diseaseCount = 0;
            for (let p = 1; p <= 30; p++) {
              const meta = patientMeta[makePatientKey(dIdx, p)] || { initials: "", code: "" };
              const isComplete = Boolean(meta.initials?.trim() && meta.code?.trim()) &&
                d.questions.every(q => formData[makeKey(dIdx, p, q.id)]);
              if (isComplete) diseaseCount++;
            }
            totalAudit += diseaseCount;
            auditBreakdown.push({ diseaseName: d.diseaseName, count: diseaseCount });
          });
        } else {
          try {
            const auditPatients = JSON.parse(sessionStorage.getItem(`${specialty}_auditPatients`) || "[]");
            specialtyInfo.diseases.forEach((d, dIdx) => {
              const diseaseCount = auditPatients.filter((patient: any) =>
                patient.diseaseIndex === dIdx && patient.isComplete
              ).length;
              totalAudit += diseaseCount;
              auditBreakdown.push({ diseaseName: d.diseaseName, count: diseaseCount });
            });
          } catch {
            specialtyInfo.diseases.forEach((d) => auditBreakdown.push({ diseaseName: d.diseaseName, count: 0 }));
          }
        }
      }
      setAuditPatientBreakdown(auditBreakdown);
      setAuditPatientCount(totalAudit.toString());
      sessionStorage.setItem(`${specialty}_auditPatientCount`, totalAudit.toString());
    }
    recoverCounts();
  }, [specialty, specialtyInfo, draftId]);

  const handleContinueToNext = () => {
    if (nextSpecialty) {
      navigate(`/siap-persi/rsbk/${nextSpecialty}`);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!canSubmitAll) {
      alert(`Submission belum bisa dikirim. Lengkapi dulu:\n- ${incompleteStages.join("\n- ")}`);
      return;
    }
    setIsSubmitting(true);
    const hospitalAuth = JSON.parse(sessionStorage.getItem("hospitalAuth") || "{}");
    const hCode = hospitalAuth.hospitalCode || hospitalAuth.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 12) || "RS001";
    try {
      // Loop through all selected specialties and create a submission for each
      for (const spec of selectedSpecialties) {
        const info = specialtyAuditData[spec as keyof typeof specialtyAuditData];
        if (!info) continue;

        const rsbk = getStoredScore(spec, "rsbk");
        const audit = getStoredScore(spec, "clinicalAudit");
        const report = getStoredScore(spec, "patientReport");
        const final = Number(((rsbk * 0.15) + (audit * 0.60) + (report * 0.25)).toFixed(2));

      // Get real raw data from draft
      const specProgress = draft?.progress[spec];
      
      // Load summaries prepared by ClinicalAuditPage and PatientReportPage
      const auditSummaryStr = sessionStorage.getItem(`${spec}_auditSummary`);
      const prmSummaryStr = sessionStorage.getItem(`${spec}_prmSummary`);
      const auditSummary = auditSummaryStr ? JSON.parse(auditSummaryStr) : {};
      const prmSummary = prmSummaryStr ? JSON.parse(prmSummaryStr) : {};

      // EXPANDED DATA FOR ADMIN: Detailed per-patient clinical audit breakdown
      let auditDetails: any[] = [];
      const auditPatientsStr = sessionStorage.getItem(`${spec}_auditPatients`);
      if (auditPatientsStr) {
        try {
          auditDetails = JSON.parse(auditPatientsStr);
        } catch {
          auditDetails = [];
        }
      }

      if (auditDetails.length === 0) {
        const auditDraftKey = `clinical-audit-draft-${hCode}-${spec}`;
        const auditDraftRaw = localStorage.getItem(auditDraftKey);
        if (auditDraftRaw) {
          try {
            const parsed = JSON.parse(auditDraftRaw);
            const formData = parsed.formData || {};
            const patientMeta = parsed.patientMeta || {};
            const makeKey = (diseaseIdx: number, patientNum: number, questionId: string) =>
              `d${diseaseIdx}-${patientNum}-${questionId}`;
            const makePatientKey = (diseaseIdx: number, patientNum: number) =>
              `d${diseaseIdx}-${patientNum}`;

            info.diseases.forEach((d, dIdx) => {
              for (let p = 1; p <= 30; p++) {
                const meta = patientMeta[makePatientKey(dIdx, p)] || { initials: "", code: "" };
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

                auditDetails.push({
                  patientIndex: p,
                  initials: meta.initials,
                  code: meta.code,
                  diseaseIndex: dIdx,
                  diseaseName: d.diseaseName,
                  diagnosisScore: getCatScore(diagnosisQs),
                  treatmentScore: getCatScore(treatmentQs),
                  outcomeScore: getCatScore(outcomeQs),
                  isComplete: Boolean(meta.initials && meta.code) && d.questions.every(q => formData[makeKey(dIdx, p, q.id)]),
                  answers: d.questions.map(q => ({
                    id: q.id,
                    question: q.question,
                    category: q.category,
                    answer: formData[makeKey(dIdx, p, q.id)] || "",
                  })),
                });
              }
            });
          } catch {}
        }
      }

      // EXPANDED DATA FOR ADMIN: Detailed PRM patient list
      const prmDetails: any[] = [];
      try {
        for (let dIdx = 0; dIdx < info.diseases.length; dIdx++) {
          const dKey = `${spec}-d${dIdx}`;
          const patients = await api.getPatients(hCode, dKey);

          for (const p of patients) {
            const response = await api.getSurveyByPatient(hCode, dKey, p.rm);
            prmDetails.push({
              rm: p.rm,
              name: p.name,
              specialty: p.specialty || spec,
              diseaseIndex: dIdx,
              diseaseKey: dKey,
              diseaseName: info.diseases[dIdx]?.diseaseName || "",
              hasResponse: !!response,
              premScore: response?.premScore || 0,
              promScore: response?.promScore || 0,
              overallScore: response?.overallScore || 0,
              answers: response?.answers || {},
              submittedAt: response?.submittedAt,
            });
          }
        }
      } catch {}

        await addSubmission({
        hospitalName: hospitalAuth.hospitalName || "Unknown Hospital",
        hospitalCode: hCode || "RS001",
        picName: hospitalAuth.picName || "Unknown PIC",
        specialty: info.name,
        disease: info.disease,
        submittedDate: new Date().toISOString().split("T")[0],
        status: "Pending",
        scores: {
          rsbk,
          clinicalAudit: audit,
          patientReport: report,
          final,
        },
        details: { 
          hospitalCode: hCode || "RS001",
          hospitalName: hospitalAuth.hospitalName || "Unknown Hospital",
          specialties: [{ specialty: info.name, disease: info.disease }],
          rsbkData: stripLegacyToolVariationFields(specProgress?.rsbk.data || {}),
          auditData: auditSummary,
          prmData: prmSummary,
          auditPatients: auditDetails,
          prmPatients: prmDetails,
          rawProgress: specProgress,
        },
        });

      // Cleanup specialty-specific scores
      sessionStorage.removeItem(`${spec}_rsbkScore`);
      sessionStorage.removeItem(`${spec}_clinicalAuditScore`);
      sessionStorage.removeItem(`${spec}_auditSummary`);
      sessionStorage.removeItem(`${spec}_auditPatients`);
      sessionStorage.removeItem(`${spec}_patientReportScore`);
      sessionStorage.removeItem(`${spec}_prmSummary`);
      }

      // Save submitted specialties before cleanup so SubmissionSuccessPage can display them
      sessionStorage.setItem("lastSubmittedSpecialties", JSON.stringify(selectedSpecialties));

      // Cleanup draft only after the server accepts the submission.
      if (draftId) {
        draftManager.deleteDraft(draftId);
        draftManager.clearCurrentDraftId();
      }

      // General cleanup
      sessionStorage.removeItem("currentSpecialty");
      sessionStorage.removeItem("selectedSpecialties");

      navigate("/siap-persi/submission-success");
    } catch (err: any) {
      alert(`Submission gagal dikirim ke server: ${err?.message || "Unknown error"}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Multi-Specialty Progress */}
        <SpecialtyProgressTracker currentSpecialty={specialty || ""} currentStage="result" />

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-[#0F4C81]" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              Review Data Submission
            </h1>
            <p className="text-gray-600 text-lg">
              {specialtyInfo.name} - {specialtyInfo.disease}
            </p>
            {selectedSpecialties.length > 1 && (
              <p className="text-sm text-gray-500 mt-2">
                Pelayanan {currentIndex + 1} dari {selectedSpecialties.length}
              </p>
            )}
          </div>
        </div>

        {/* Score Recapitulation */}
        <div className="bg-white rounded-2xl border-2 border-[#0F4C81] p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Rekapitulasi Nilai</h2>
            <div className="bg-[#0F4C81] text-white px-5 py-2 rounded-xl">
              <span className="text-sm">Total Sementara</span>
              <span className="text-3xl font-bold ml-3">{totalSiapScore}</span>
            </div>
          </div>
          
          {/* Weighted Score Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#0F4C81]">
                  <th className="text-left py-3 px-4 font-bold text-[#0F4C81]">Komponen Penilaian</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">Nilai</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">Bobot</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">Nilai Berbobot</th>
                  <th className="text-center py-3 px-4 font-bold text-[#0F4C81]">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 bg-blue-50/50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">Hospital Structure Form</div>
                    <div className="text-xs text-gray-500">Tenaga medis & sarana prasarana</div>
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-blue-700">Review</td>
                  <td className="py-4 px-4 text-center text-gray-600">15%</td>
                  <td className="py-4 px-4 text-center font-bold text-blue-700">Menunggu</td>
                  <td className="py-4 px-4 text-center">
                    <StatusBadge complete={currentStageStatuses.rsbk.complete} />
                  </td>
                </tr>
                <tr className="border-b border-gray-200 bg-purple-50/50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">Clinical Audit</div>
                    {renderPatientCount(auditPatientCount, auditPatientBreakdown, "rekam medis pasien")}
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-purple-700">{clinicalAuditScore}</td>
                  <td className="py-4 px-4 text-center text-gray-600">60%</td>
                  <td className="py-4 px-4 text-center font-bold text-purple-700">{auditWeighted}</td>
                  <td className="py-4 px-4 text-center">
                    <StatusBadge complete={currentStageStatuses.clinicalAudit.complete} />
                  </td>
                </tr>
                <tr className="border-b border-gray-200 bg-teal-50/50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">Patient Report (PREM & PROM)</div>
                    {renderPatientCount(prmPatientCount, prmPatientBreakdown, "pasien")}
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-teal-700">{patientReportScore}</td>
                  <td className="py-4 px-4 text-center text-gray-600">25%</td>
                  <td className="py-4 px-4 text-center font-bold text-teal-700">{prmWeighted}</td>
                  <td className="py-4 px-4 text-center">
                    <StatusBadge complete={currentStageStatuses.patientReport.complete} />
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-[#0F4C81]/10">
                  <td className="py-4 px-4 font-bold text-[#0F4C81] text-lg" colSpan={3}>
                    Total Skor Sementara
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-[#0F4C81] text-3xl">
                    {totalSiapScore}
                  </td>
                  <td className="py-4 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <p><strong>Catatan:</strong> Nilai Hospital Structure menunggu review PERSI. Total sementara memakai data tersimpan untuk kebutuhan submit dan akan difinalkan reviewer.</p>
          </div>


        </div>

        {/* Ringkasan Submission */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Ringkasan Submission</h2>
          
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => navigate(`/siap-persi/rsbk/${specialty}`)}
              className={`w-full text-left flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md ${
                currentStageStatuses.rsbk.complete ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-3">
                {currentStageStatuses.rsbk.complete ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-amber-600" />}
                <div>
                  <p className="font-semibold text-gray-900">Hospital Structure Form</p>
                  <p className="text-sm text-gray-600">{currentStageStatuses.rsbk.detail}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`${currentStageStatuses.rsbk.complete ? "text-green-700" : "text-amber-700"} font-semibold block`}>
                  {currentStageStatuses.rsbk.complete ? "Lengkap" : "Lanjutkan"}
                </span>
                <span className="text-sm text-gray-500">Klik untuk review/isi</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/siap-persi/clinical-audit/${specialty}`)}
              className={`w-full text-left flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md ${
                currentStageStatuses.clinicalAudit.complete ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-3">
                {currentStageStatuses.clinicalAudit.complete ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-amber-600" />}
                <div>
                  <p className="font-semibold text-gray-900">Clinical Audit</p>
                  {renderPatientCount(auditPatientCount, auditPatientBreakdown, "rekam medis pasien")}
                </div>
              </div>
              <div className="text-right">
                <span className={`${currentStageStatuses.clinicalAudit.complete ? "text-green-700" : "text-amber-700"} font-semibold block`}>
                  {currentStageStatuses.clinicalAudit.complete ? "Lengkap" : "Lanjutkan"}
                </span>
                <span className="text-sm text-gray-500">Klik untuk review/isi</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/siap-persi/patient-report/${specialty}`)}
              className={`w-full text-left flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md ${
                currentStageStatuses.patientReport.complete ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-3">
                {currentStageStatuses.patientReport.complete ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-amber-600" />}
                <div>
                  <p className="font-semibold text-gray-900">Patient Report (PREM & PROM)</p>
                  {renderPatientCount(prmPatientCount, prmPatientBreakdown, "pasien")}
                </div>
              </div>
              <div className="text-right">
                <span className={`${currentStageStatuses.patientReport.complete ? "text-green-700" : "text-amber-700"} font-semibold block`}>
                  {currentStageStatuses.patientReport.complete ? "Lengkap" : "Lanjutkan"}
                </span>
                <span className="text-sm text-gray-500">Klik untuk review/isi</span>
              </div>
            </button>
          </div>

          <div className="mt-8 overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Bagian</th>
                  <th className="px-4 py-3 text-left font-bold">Detail</th>
                  <th className="px-4 py-3 text-center font-bold">Progress</th>
                  <th className="px-4 py-3 text-center font-bold">Status</th>
                  <th className="px-4 py-3 text-center font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3 font-semibold text-gray-900">Hospital Structure</td>
                  <td className="px-4 py-3 text-gray-600">Semua item struktur layanan</td>
                  <td className="px-4 py-3 text-center text-gray-700">{currentStageStatuses.rsbk.detail}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge complete={currentStageStatuses.rsbk.complete} /></td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/siap-persi/rsbk/${specialty}`)}>Buka</Button>
                  </td>
                </tr>
                {auditPatientBreakdown.map((item) => {
                  const complete = item.count >= 1;
                  return (
                    <tr key={`audit-${item.diseaseName}`} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-semibold text-gray-900">Clinical Audit</td>
                      <td className="px-4 py-3 text-gray-600">{item.diseaseName}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{item.count}/30 rekam medis ({Math.min(100, Math.round((item.count / 30) * 100))}%)</td>
                      <td className="px-4 py-3 text-center"><StatusBadge complete={complete} /></td>
                      <td className="px-4 py-3 text-center">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/siap-persi/clinical-audit/${specialty}`)}>Buka</Button>
                      </td>
                    </tr>
                  );
                })}
                {prmPatientBreakdown.map((item) => {
                  const complete = item.count >= 1;
                  return (
                    <tr key={`prm-${item.diseaseName}`} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-semibold text-gray-900">PRM/PREMPROM</td>
                      <td className="px-4 py-3 text-gray-600">{item.diseaseName}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{item.count}/30 pasien ({Math.min(100, Math.round((item.count / 30) * 100))}%)</td>
                      <td className="px-4 py-3 text-center"><StatusBadge complete={complete} /></td>
                      <td className="px-4 py-3 text-center">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/siap-persi/patient-report/${specialty}`)}>Buka</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Next Specialty Banner */}
        {!isLastSpecialty && nextSpecialty && (
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-8 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">
                  Lanjut ke Pelayanan Berikutnya
                </h3>
                <p className="text-white/90 mb-4">
                  Anda masih memiliki {selectedSpecialties.length - currentIndex - 1} pelayanan lagi yang perlu diisi
                </p>
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2 inline-flex">
                  <ArrowRight className="w-5 h-5" />
                  <span className="font-semibold">
                    Berikutnya: {specialtyAuditData[nextSpecialty as keyof typeof specialtyAuditData].name}
                  </span>
                </div>
              </div>
              <Button
                onClick={handleContinueToNext}
                className="h-14 px-8 bg-white text-purple-600 hover:bg-white/90 font-semibold text-lg"
              >
                Lanjut Mengisi
                <ChevronRight className="w-6 h-6 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Important Notice - Only show on last specialty */}
        {isLastSpecialty && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8 mb-6">
            <div className="flex gap-4">
              <Clock className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Proses Review oleh Tim PERSI
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Setelah Anda submit, data dari <strong>{selectedSpecialties.length} pelayanan</strong> akan 
                  direview oleh tim ahli PERSI untuk verifikasi dan validasi. Proses ini memastikan 
                  kualitas dan kredibilitas penilaian.
                </p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">1.</span>
                    <span>Tim reviewer akan memverifikasi kelengkapan dan keakuratan data</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">2.</span>
                    <span>Perhitungan skor dilakukan sesuai metodologi NHR PERSI</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">3.</span>
                    <span>Anda akan menerima notifikasi email setelah review selesai (5-7 hari kerja)</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">4.</span>
                    <span>Skor dan sertifikasi akan tersedia setelah approval</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setShowBackChoice(true)}
            className="h-12 px-8 border-2 border-gray-300 font-semibold"
          >
            Kembali
          </Button>
          
          {!isLastSpecialty ? (
            <Button
              onClick={handleContinueToNext}
              className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 font-semibold"
            >
              Lanjut ke {specialtyAuditData[nextSpecialty as keyof typeof specialtyAuditData].name}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmitAll}
              className="flex-1 h-12 bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] hover:from-[#0d3d66] hover:to-[#0d9488] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "Mengirim ke server..."
                : canSubmitAll
                ? `Submit Semua untuk Review (${selectedSpecialties.length} Pelayanan)`
                : `Lengkapi ${incompleteStages.length} bagian sebelum submit`}
            </Button>
          )}
        </div>

        {showBackChoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Kembali ke mana?</h3>
              <p className="text-sm text-gray-600 mb-6">
                Pilih tujuan setelah review data submission ini.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate("/siap-persi/select-specialty")}
                  className="w-full h-12 bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold"
                >
                  Ke Halaman Pengisian Data
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/submit")}
                  className="w-full h-12 border-2 border-gray-300 font-semibold"
                >
                  Ke Home Portal Rumah Sakit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowBackChoice(false)}
                  className="w-full h-11 font-semibold"
                >
                  Batal
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
