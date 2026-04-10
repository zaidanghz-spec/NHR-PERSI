import { useState } from "react";
import { useParams, Link } from "react-router";
import {
  CheckCircle2,
  XCircle,
  Building2,
  Trophy,
  ArrowLeft,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";

export function SiapAdminReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [comment, setComment] = useState("");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | "">("");

  // Submission data will be loaded from server based on submission ID
  // Empty placeholder for production launch
  const submissionData = {
    id: id || "—",
    hospitalName: "Menunggu data dari server...",
    specialty: "—",
    submittedDate: "—",
    picName: "—",
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

  const radarData = [
    { category: "Hospital Structure", value: submissionData.scores.rsbk },
    { category: "Clinical Audit", value: submissionData.scores.clinicalAudit },
    { category: "Patient Report", value: submissionData.scores.patientReport },
  ];

  const getGrade = (score: number) => {
    if (score >= 90) return { grade: "Platinum", color: "text-purple-700", bg: "bg-purple-50" };
    if (score >= 80) return { grade: "Outstanding", color: "text-green-700", bg: "bg-green-50" };
    if (score >= 70) return { grade: "Excellent", color: "text-blue-700", bg: "bg-blue-50" };
    if (score >= 60) return { grade: "Commendable", color: "text-teal-700", bg: "bg-teal-50" };
    return { grade: "Developing", color: "text-amber-700", bg: "bg-amber-50" };
  };

  const gradeInfo = getGrade(submissionData.scores.final);

  const handleAction = (actionType: "approve" | "reject") => {
    setAction(actionType);
    setShowApprovalDialog(true);
  };

  const confirmAction = () => {
    // Handle approval/rejection logic
    console.log(`${action} submission with comment:`, comment);
    setShowApprovalDialog(false);
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
                <div className={`${gradeInfo.bg} rounded-xl px-4 py-2`}>
                  <span className={`text-3xl font-bold ${gradeInfo.color}`}>
                    {gradeInfo.grade}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
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

        {/* RSBK Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            Detail RSBK Assessment
          </h3>

          {/* Medical Staff */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-4">Tenaga Medis</h4>
            <div className="space-y-2">
              {submissionData.rsbkDetails.medicalStaff.map((item, index) => (
                <ParameterRow key={index} item={item} />
              ))}
            </div>
          </div>

          {/* Facilities */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Fasilitas</h4>
            <div className="space-y-2">
              {submissionData.rsbkDetails.facilities.map((item, index) => (
                <ParameterRow key={index} item={item} />
              ))}
            </div>
          </div>
        </div>

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