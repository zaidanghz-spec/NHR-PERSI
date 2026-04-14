import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  CheckCircle2,
  XCircle,
  Building2,
  Trophy,
  ArrowLeft,
  FileText,
  Download,
  ExternalLink,
  Clock,
  AlertCircle
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useData } from "../context/DataContext";

// Type for uploaded custom survey document
interface CustomSurveyDoc {
  fileName: string;
  base64: string;
  uploadedAt: string;
  hospitalCode: string;
  hospitalName: string;
  specialty: string;
  diseaseName: string;
}

export function SiapAdminReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | "">("");
  const [customSurveyDocs, setCustomSurveyDocs] = useState<CustomSurveyDoc[]>([]);
  const [activeTab, setActiveTab] = useState<"summary" | "rsbk" | "audit" | "prm">("summary");

  // Load all custom survey PDFs from localStorage (all hospitals, all specialties)
  useEffect(() => {
    const docs: CustomSurveyDoc[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("custom-survey-")) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as CustomSurveyDoc;
            docs.push(parsed);
          }
        } catch {}
      }
    }
    setCustomSurveyDocs(docs);
  }, []);

  const { submissions, updateSubmissionStatus, publishRanking } = useData();

  // Submission data will be loaded from server based on submission ID
  const actualSubmission = submissions.find(s => s.id === id);

  const submissionData = actualSubmission ? {
    id: actualSubmission.id,
    hospitalName: actualSubmission.hospitalName,
    specialty: actualSubmission.specialty,
    submittedDate: actualSubmission.submittedDate,
    picName: actualSubmission.picName,
    scores: actualSubmission.scores,
    status: actualSubmission.status,
    rsbkDetails: { medicalStaff: [], facilities: [] }
  } : {
    id: id || "—",
    hospitalName: "Menunggu data dari server...",
    specialty: "—",
    submittedDate: "—",
    picName: "—",
    status: "Pending",
    scores: {
      rsbk: 0,
      clinicalAudit: 0,
      patientReport: 0,
      final: 0,
    },
    rsbkDetails: {
      medicalStaff: [] as { name: string; value: string; score: number }[],
      facilities: [] as { name: string; value: string; score: number }[],
    },
  };

  const filteredDocs = customSurveyDocs.filter(d => 
    d.hospitalName === submissionData.hospitalName && 
    (submissionData.specialty === "Multiple" || d.specialty === submissionData.specialty)
  );

  const radarData = [
    { category: "Hospital Structure", value: submissionData.scores.rsbk },
    { category: "Clinical Audit", value: submissionData.scores.clinicalAudit },
    { category: "Patient Report", value: submissionData.scores.patientReport },
  ];

  const getGrade = (score: number) => {
    if (score >= 85) return { grade: "A", name: "Excellent", color: "text-green-700", bg: "bg-green-50" };
    if (score >= 70) return { grade: "B", name: "Good", color: "text-blue-700", bg: "bg-blue-50" };
    if (score >= 55) return { grade: "C", name: "Average", color: "text-yellow-700", bg: "bg-yellow-50" };
    return { grade: "D", name: "Below Standard", color: "text-red-700", bg: "bg-red-50" };
  };

  const gradeInfo = getGrade(submissionData.scores.final);

  const handleAction = (actionType: "approve" | "reject") => {
    setAction(actionType);
    setShowApprovalDialog(true);
  };

  const confirmAction = () => {
    if (action === "approve") {
      updateSubmissionStatus(submissionData.id, "Approved", comment);
      
      publishRanking({
        hospitalName: submissionData.hospitalName,
        city: "Jakarta Pusat", // Dummy
        province: "DKI Jakarta", // Dummy
        specialty: submissionData.specialty === "—" ? "Cardiology" : submissionData.specialty,
        finalScore: submissionData.scores.final,
        rsbkScore: submissionData.scores.rsbk,
        clinicalAuditScore: submissionData.scores.clinicalAudit,
        patientReportScore: submissionData.scores.patientReport,
        grade: gradeInfo.grade,
        approvedAt: new Date().toISOString(),
        submissionId: submissionData.id,
      });
    } else if (action === "reject") {
      updateSubmissionStatus(submissionData.id, "Revision Required", comment);
    }
    console.log(`${action} submission with comment:`, comment);
    setShowApprovalDialog(false);
    
    // Success feedback and navigate back
    setTimeout(() => {
      navigate("/siap-persi/admin/dashboard");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/siap-persi/admin/dashboard"
            className="inline-flex items-center text-[#0F4C81] hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Review Submission
          </h1>
          <p className="text-gray-600">
            Detail assessment dan data yang disubmit oleh rumah sakit
          </p>
        </div>

        {/* Hospital Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {submissionData.hospitalName}
                  </h2>
                  <p className="text-gray-600">{submissionData.specialty}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Submission ID</span>
                  <span className="font-semibold font-mono text-gray-900">
                    {submissionData.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Penanggung Jawab</span>
                  <span className="font-semibold text-gray-900">
                    {submissionData.picName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal Submit</span>
                  <span className="font-semibold text-gray-900">
                    {submissionData.submittedDate}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#0F4C81] to-[#14B8A6] rounded-xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6" />
                <h3 className="text-xl font-bold">Final Score</h3>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-bold">{submissionData.scores.final}</span>
                <div className={`${gradeInfo.bg} rounded-xl px-4 py-2 text-center`}>
                  <div className={`text-3xl font-bold ${gradeInfo.color}`}>
                    {gradeInfo.grade}
                  </div>
                  <div className={`text-xs font-semibold ${gradeInfo.color} uppercase tracking-wider`}>
                    {gradeInfo.name}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-white p-1.5 rounded-xl border border-gray-200 mb-8 overflow-x-auto w-full mx-auto shadow-sm gap-1">
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-6 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "summary" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Ringkasan Penilaian
          </button>
          <button
            onClick={() => setActiveTab("rsbk")}
            className={`px-6 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "rsbk" ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Hospital Structure (RSBK)
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-6 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "audit" ? "bg-teal-50 text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Clinical Audit
          </button>
          <button
            onClick={() => setActiveTab("prm")}
            className={`px-6 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "prm" ? "bg-purple-50 text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Patient Report (PRM)
          </button>
        </div>

        {/* --- TAB CONTENT: SUMMARY --- */}
        {activeTab === "summary" && (
          <div className="grid md:grid-cols-2 gap-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Component Scores */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Component Scores
              </h3>
              <div className="space-y-4">
                <ScoreRow
                  label="Hospital Structure"
                  score={submissionData.scores.rsbk}
                  weight="15%"
                  weighted={(submissionData.scores.rsbk * 0.15).toFixed(1)}
                  color="blue"
                />
                <ScoreRow
                  label="Clinical Audit"
                  score={submissionData.scores.clinicalAudit}
                  weight="60%"
                  weighted={(submissionData.scores.clinicalAudit * 0.6).toFixed(1)}
                  color="purple"
                />
                <ScoreRow
                  label="Patient Report"
                  score={submissionData.scores.patientReport}
                  weight="25%"
                  weighted={(submissionData.scores.patientReport * 0.25).toFixed(1)}
                  color="teal"
                />
              </div>
            </div>

            {/* Radar Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Visualisasi Komponen
              </h3>
              <div className="space-y-4">
                {radarData.map((item) => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{item.category}</span>
                      <span className="text-sm font-bold text-gray-900">{item.value}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-[#14B8A6] h-3 rounded-full transition-all duration-500"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: HOSPITAL STRUCTURE (RSBK) --- */}
        {activeTab === "rsbk" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Detail Hospital Structure (RSBK)
            </h3>
            
            {/* Medical Staff */}
            <div className="mb-8">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                Tenaga Medis
              </h4>
              <div className="space-y-2">
                {submissionData.rsbkDetails.medicalStaff.length > 0 ? (
                  submissionData.rsbkDetails.medicalStaff.map((item, index) => (
                    <ParameterRow key={index} item={item} />
                  ))
                ) : (
                  <p className="text-gray-500 italic text-sm">Tidak ada rincian data tenaga medis untuk disajikan.</p>
                )}
              </div>
            </div>

            {/* Facilities */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                Fasilitas & Alat Medis
              </h4>
              <div className="space-y-2">
                {submissionData.rsbkDetails.facilities.length > 0 ? (
                  submissionData.rsbkDetails.facilities.map((item, index) => (
                    <ParameterRow key={index} item={item} />
                  ))
                ) : (
                  <p className="text-gray-500 italic text-sm">Tidak ada rincian data fasilitas untuk disajikan.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: CLINICAL AUDIT --- */}
        {activeTab === "audit" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Detail Audit Klinis</h3>
            <p className="text-gray-500 text-sm mb-6">Hasil evaluasi kepatuhan protokol klinis berdasarkan sampel rekam medis.</p>
            
            <div className="space-y-3">
              <ParameterRow item={{ name: "Kesesuaian Diagnosis dengan ICD-10", value: "1", score: 100 }} />
              <ParameterRow item={{ name: "Pemberian Terapi Sesuai Protokol", value: "1", score: 95 }} />
              <ParameterRow item={{ name: "Kepatuhan Clinical Pathway", value: "3", score: submissionData.scores.clinicalAudit }} />
              <ParameterRow item={{ name: "Triage & Golden Period Response", value: "1", score: 92 }} />
              
              <div className="mt-6 p-5 bg-teal-50 border border-teal-100 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-teal-600" />
                  <h4 className="font-semibold text-teal-900">Catatan Auditor Sistem</h4>
                </div>
                <p className="text-teal-800 text-sm leading-relaxed">
                  Secara umum kepatuhan clinical pathway sudah sangat baik. Namun ditemukan sebagian kecil rekam medis (3 sampel) dengan dokumentasi respon Triage yang sedikit terlambat dari golden period yang ditetapkan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: PATIENT REPORT (PRM) --- */}
        {activeTab === "prm" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Detail Patient Report (PREM & PROM)</h3>
              <p className="text-gray-500 text-sm mb-6">Evaluasi berdasarkan laporan pengalaman dan outcomes pasien.</p>
              
              <div className="space-y-3">
                <ParameterRow item={{ name: "Patient Experience Score (PREM)", value: "1", score: 92 }} />
                <ParameterRow item={{ name: "Clinical Outcome Score (PROM)", value: "1", score: 88 }} />
                <ParameterRow item={{ name: "Response Rate Survei Harian", value: "3", score: 75 }} />
                <ParameterRow item={{ name: "Sistem Komplain dan Resolusi", value: "1", score: 100 }} />
              </div>
            </div>

            {/* Custom Survey PDF Documents */}
            <div className="bg-white rounded-xl border-2 border-indigo-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Dokumen Survei Mandiri</h3>
                  <p className="text-sm text-gray-500">Bukti survei PREM/PROM internal yang diupload oleh pihak rumah sakit</p>
                </div>
              </div>

              {customSurveyDocs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 border-2 border-dashed border-indigo-100 rounded-xl bg-indigo-50/30">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                    <FileText className="w-7 h-7 text-indigo-300" />
                  </div>
                  <p className="font-semibold text-gray-400">Belum ada dokumen survei yang diupload</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customSurveyDocs.map((doc, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 border border-indigo-100 rounded-xl bg-indigo-50/20 hover:bg-indigo-50/40 transition-colors">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{doc.fileName}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            <Building2 className="w-3 h-3" />
                            {doc.hospitalName || doc.hospitalCode}
                          </span>
                          {doc.specialty && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              {doc.specialty}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Upload: {new Date(doc.uploadedAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <a href={doc.base64} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors">
                          <ExternalLink className="w-4 h-4" />
                          Buka
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === ALWAYS VISIBLE BELOW TABS === */}
        {/* Admin Review Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            Admin Review & Comments
          </h3>
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
            Approve & Publish
          </Button>
        </div>

        {/* Approval Dialog */}
        {showApprovalDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {action === "approve" ? "Approve Submission?" : "Request Revision?"}
              </h3>
              <p className="text-gray-600 mb-6">
                {action === "approve"
                  ? "Assessment ini akan dipublikasikan dan rumah sakit akan menerima notifikasi approval."
                  : "Rumah sakit akan diminta untuk melakukan revisi berdasarkan catatan yang Anda berikan."}
              </p>
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
                  className={`flex-1 ${
                    action === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
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

function ScoreRow({
  label,
  score,
  weight,
  weighted,
  color,
}: {
  label: string;
  score: number;
  weight: string;
  weighted: string;
  color: string;
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    teal: "bg-teal-50 text-teal-600",
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div>
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">Bobot: {weight}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{score}</p>
          <p className="text-xs text-gray-500">Raw Score</p>
        </div>
        <div
          className={`${
            colorClasses[color as keyof typeof colorClasses]
          } px-4 py-2 rounded-lg`}
        >
          <p className="text-xl font-bold">{weighted}</p>
          <p className="text-xs opacity-75">Weighted</p>
        </div>
      </div>
    </div>
  );
}

function ParameterRow({
  item,
}: {
  item: { name: string; value: string; score: number };
}) {
  const getValueLabel = (value: string) => {
    if (value === "1") return { label: "Tersedia", color: "bg-green-100 text-green-700" };
    if (value === "2") return { label: "Tidak Tersedia", color: "bg-red-100 text-red-700" };
    return { label: "Sebagian", color: "bg-yellow-100 text-yellow-700" };
  };

  const valueInfo = getValueLabel(item.value);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
      <span className="text-gray-900">{item.name}</span>
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${valueInfo.color}`}>
          {valueInfo.label}
        </span>
        <span className="font-bold text-gray-900 w-12 text-right">{item.score}</span>
      </div>
    </div>
  );
}