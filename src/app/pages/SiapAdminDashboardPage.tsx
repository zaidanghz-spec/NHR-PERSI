import { useState, useEffect } from "react";
import { Download, ExternalLink } from "lucide-react";

interface CustomSurveyDoc {
  fileName: string;
  base64: string;
  uploadedAt: string;
  hospitalCode: string;
  hospitalName: string;
  specialty: string;
  diseaseName: string;
}
import { Link } from "react-router";
import {
  FileText,
  Search,
  Eye,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SimpleSelect } from "../components/SimpleSelect";
import { useData } from "../context/DataContext";

// Submissions will be loaded from server in production
const mockSubmissions: {
  id: string;
  hospitalName: string;
  specialty: string;
  submittedDate: string;
  status: string;
  finalScore: number;
}[] = [];

const scoreDistribution = [
  { range: "85-100 — A (Excellent)", count: 0, color: "bg-green-500" },
  { range: "70-84 — B (Good)", count: 0, color: "bg-blue-500" },
  { range: "55-69 — C (Average)", count: 0, color: "bg-yellow-500" },
  { range: "0-54 — D (Below Standard)", count: 0, color: "bg-red-500" },
];

const statusDistribution = [
  { name: "Pending", value: 0, color: "#F59E0B" },
  { name: "Approved", value: 0, color: "#10B981" },
  { name: "Revision Required", value: 0, color: "#EF4444" },
];

export function SiapAdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const { submissions } = useData();

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      submission.hospitalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || submission.status === statusFilter;
    const matchesSpecialty =
      specialtyFilter === "all" || submission.specialty === specialtyFilter;
    return matchesSearch && matchesStatus && matchesSpecialty;
  });

  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === "Pending").length,
    approved: submissions.filter(s => s.status === "Approved").length,
    revision: submissions.filter(s => s.status === "Revision Required").length,
    averageScore: submissions.length > 0 
      ? submissions.reduce((acc, s) => acc + s.scores.final, 0) / submissions.length 
      : 0,
  };

  const dynamicScoreDistribution = [
    { range: "85-100 — A (Excellent)", count: submissions.filter(s => s.scores.final >= 85).length, color: "bg-green-500" },
    { range: "70-84 — B (Good)", count: submissions.filter(s => s.scores.final >= 70 && s.scores.final < 85).length, color: "bg-blue-500" },
    { range: "55-69 — C (Average)", count: submissions.filter(s => s.scores.final >= 55 && s.scores.final < 70).length, color: "bg-yellow-500" },
    { range: "0-54 — D (Below Standard)", count: submissions.filter(s => s.scores.final < 55).length, color: "bg-red-500" },
  ];

  const dynamicStatusDistribution = [
    { name: "Pending", value: stats.pending, color: "#F59E0B" },
    { name: "Approved", value: stats.approved, color: "#10B981" },
    { name: "Revision Required", value: stats.revision, color: "#EF4444" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Admin Review Dashboard
          </h1>
          <p className="text-gray-600">
            Kelola dan review submission NHR PERSI Assessment dari rumah sakit
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="Total Submissions"
            value={stats.total}
            icon={<FileText className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title="Pending Review"
            value={stats.pending}
            icon={<Clock className="w-6 h-6" />}
            color="yellow"
          />
          <StatCard
            title="Approved"
            value={stats.approved}
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="Revision Required"
            value={stats.revision}
            icon={<AlertCircle className="w-6 h-6" />}
            color="red"
          />
          <StatCard
            title="Average Score"
            value={stats.averageScore}
            icon={<TrendingUp className="w-6 h-6" />}
            color="purple"
            isDecimal
          />
        </div>



        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Score Distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Distribusi Skor
            </h3>
            <div className="space-y-4">
              {dynamicScoreDistribution.map((item) => (
                <div key={item.range}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{item.range}</span>
                    <span className="text-sm font-bold text-gray-900">{item.count} RS</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`${item.color} h-3 rounded-full transition-all duration-500`}
                      style={{ width: stats.total > 0 && item.count > 0 ? `${(item.count / stats.total) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Status Submission
            </h3>
            <div className="space-y-4">
              {dynamicStatusDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-4">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      <span className="text-sm font-bold text-gray-900">{item.value}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          backgroundColor: item.color,
                          width: stats.total > 0 && item.value > 0 ? `${(item.value / stats.total) * 100}%` : "0%",
                          opacity: item.value > 0 ? 1 : 0.3,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Cari berdasarkan nama RS atau ID submission..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-11"
              />
            </div>
            <SimpleSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Filter Status"
              options={[
                { value: "all", label: "Semua Status" },
                { value: "pending", label: "Pending Review" },
                { value: "approved", label: "Approved" },
                { value: "revision", label: "Revision Required" },
              ]}
            />
            <SimpleSelect
              value={specialtyFilter}
              onChange={setSpecialtyFilter}
              placeholder="Filter Specialty"
              options={[
                { value: "all", label: "Semua Specialty" },
                { value: "Cardiology", label: "Cardiology" },
                { value: "Oncology", label: "Oncology" },
                { value: "Neurology", label: "Neurology" },
              ]}
            />
          </div>
        </div>

        {/* Submissions Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Submission ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Nama Rumah Sakit
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Specialty
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tanggal Submit
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Final Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                          <FileText className="w-10 h-10 text-gray-300" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-500 text-lg mb-1">Belum ada submission</p>
                          <p className="text-sm text-gray-400 max-w-md">
                            Submission dari rumah sakit akan muncul di sini setelah mereka menyelesaikan dan mengirimkan NHR PERSI Assessment.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                          <span className="text-sm text-blue-700 font-medium">Platform siap menerima submission</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm text-gray-900">{submission.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{submission.hospitalName}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{submission.specialty}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {new Date(submission.submittedDate).toLocaleDateString("id-ID")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-[#0F4C81]">{submission.scores?.final?.toFixed(1) || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={submission.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link to={`/siap-persi/admin/review/${submission.id}`}>
                          <Button size="sm" className="bg-[#0F4C81] hover:bg-[#0d3d66]">
                            <Eye className="w-4 h-4 mr-2" />
                            Review
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  isDecimal = false,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  isDecimal?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">
        {isDecimal ? value.toFixed(1) : value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: {
      label: "Pending Review",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: <Clock className="w-4 h-4" />,
    },
    approved: {
      label: "Approved",
      color: "bg-green-100 text-green-700 border-green-200",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    revision: {
      label: "Revision Required",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: <AlertCircle className="w-4 h-4" />,
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${config.color}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}