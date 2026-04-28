import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Shield,
  Users,
  Newspaper,
  Calendar,
  Plus,
  Trash2,
  Building2,
  CheckCircle2,
  X,
  BarChart3,
  Eye,
  Clock,
  FileText,
  UserCheck,
  XCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useData } from "../context/DataContext";
import type { HospitalAccount } from "../context/DataContext";

type Tab = "overview" | "accounts" | "news" | "events";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const {
    isAdmin,
    news,
    addNews,
    deleteNews,
    events,
    addEvent,
    deleteEvent,
    approvedRankings,
    hospitalAccounts,
    syncWithCloud,
    forcePushToCloud,
    submissions,
  } = useData();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    await syncWithCloud();
    setTimeout(() => setSyncing(false), 800);
  };

  const handleForcePush = async () => {
    if (window.confirm("Ini akan mencoba mengirim data lokal yang belum ada di cloud. Lanjutkan?")) {
      setPushing(true);
      await forcePushToCloud();
      await syncWithCloud();
      setPushing(false);
      alert("Proses sinkronisasi paksa selesai.");
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-[700] text-gray-900 mb-2">
            Akses Ditolak
          </h2>
          <p className="text-gray-500 mb-4">
            Anda harus login sebagai admin untuk mengakses halaman ini.
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

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "accounts", label: "Akun RS", icon: <Users className="w-4 h-4" /> },
    { key: "news", label: "Kelola Berita", icon: <Newspaper className="w-4 h-4" /> },
    { key: "events", label: "Kelola Events", icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-[700] text-gray-900 mb-1">
              Admin Dashboard
            </h1>
            <p className="text-gray-500">
              Pusat Kendali NHR PERSI
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={syncing}
              className="h-10 px-4 border-gray-200 text-gray-600 bg-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Refresh Data"}
            </Button>
            <Link to="/siap-persi/admin/dashboard">
              <Button className="bg-[#0D9488] hover:bg-[#0b7f75] font-[600]">
                <Eye className="w-4 h-4 mr-2" />
                Review Submissions
              </Button>
            </Link>
          </div>
        </div>

        {/* Data Recovery Rescue Banner */}
        {(hospitalAccounts.length > 10 || submissions.length > 5) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-[600] text-amber-900">Data Rescue Mode</h4>
                <p className="text-sm text-amber-800">
                  Terdeteksi {hospitalAccounts.length} akun dan {submissions.length} submission di device ini. 
                  Jika di device lain datanya lebih sedikit, klik tombol di kanan untuk memaksa kirim data lokal ke Cloud.
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={handleForcePush}
              disabled={pushing}
              className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap"
            >
              {pushing ? "Pushing..." : "Push Local Data to Cloud"}
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-8 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-[500] transition-colors ${
                activeTab === tab.key
                  ? "bg-[#1E3A8A] text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "overview" && (
          <OverviewTab
            stats={{
              totalRS: hospitalAccounts.length,
              rankings: approvedRankings.length,
              newsCount: news.length,
              eventsCount: events.length,
            }}
          />
        )}
        {activeTab === "accounts" && (
          <AccountsTab accounts={hospitalAccounts} />
        )}
        {activeTab === "news" && (
          <NewsTab news={news} onAdd={addNews} onDelete={deleteNews} />
        )}
        {activeTab === "events" && (
          <EventsTab
            events={events}
            onAdd={addEvent}
            onDelete={deleteEvent}
          />
        )}
      </div>
    </div>
  );
}

function OverviewTab({
  stats,
}: {
  stats: {
    totalRS: number;
    rankings: number;
    newsCount: number;
    eventsCount: number;
  };
}) {
  return (
    <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard
        title="RS Terdaftar"
        value={stats.totalRS}
        icon={<Building2 className="w-5 h-5" />}
        color="blue"
      />
      <StatCard
        title="Di Ranking"
        value={stats.rankings}
        icon={<BarChart3 className="w-5 h-5" />}
        color="amber"
      />
      <StatCard
        title="Berita"
        value={stats.newsCount}
        icon={<Newspaper className="w-5 h-5" />}
        color="purple"
      />
      <StatCard
        title="Events"
        value={stats.eventsCount}
        icon={<Calendar className="w-5 h-5" />}
        color="green"
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
      </div>
      <div className="text-3xl font-[700] text-gray-900">{value}</div>
    </div>
  );
}

function AccountsTab({
  accounts,
}: {
  accounts: Array<HospitalAccount>;
}) {
  const { activateHospital, rejectHospital } = useData();
  const [viewPdfUrl, setViewPdfUrl] = useState<string | null>(null);
  const [viewPdfName, setViewPdfName] = useState("");

  const pendingCount = accounts.filter(a => a.status === "pending_activation").length;
  const activatedCount = accounts.filter(a => a.status === "activated").length;
  const rejectedCount = accounts.filter(a => a.status === "rejected").length;

  const statusLabel = (status: string) => {
    if (status === "pending_activation") return { text: "Menunggu Aktivasi", cls: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3" /> };
    if (status === "activated") return { text: "Aktif", cls: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> };
    if (status === "rejected") return { text: "Ditolak", cls: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> };
    return { text: status, cls: "bg-gray-100 text-gray-700", icon: null };
  };

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <Clock className="w-6 h-6 text-amber-600 mx-auto mb-1" />
          <p className="text-2xl font-[700] text-amber-700">{pendingCount}</p>
          <p className="text-xs text-amber-600">Menunggu Aktivasi</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-[700] text-green-700">{activatedCount}</p>
          <p className="text-xs text-green-600">Aktif</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-[700] text-red-600">{rejectedCount}</p>
          <p className="text-xs text-red-500">Ditolak</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">Rumah Sakit</th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">PIC</th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">Email</th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">Status</th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">Surat Tugas</th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">Terdaftar</th>
              <th className="px-5 py-3 text-right text-xs font-[600] text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map((acc) => {
              const st = statusLabel(acc.status);
              return (
                <tr key={acc.email} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-[600] text-gray-900">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      {acc.hospitalName}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700">{acc.picName}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{acc.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-[600] ${st.cls}`}>
                      {st.icon} {st.text}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {acc.suratTugasFileName ? (
                      <button
                        onClick={() => {
                          setViewPdfUrl(acc.suratTugasData || null);
                          setViewPdfName(acc.suratTugasFileName || "");
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-[600] text-[#1E3A8A] hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Lihat PDF
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Tidak ada</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 text-xs">
                    {new Date(acc.registeredAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {acc.status === "pending_activation" && (
                        <>
                          <button
                            onClick={() => activateHospital(acc.email)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-[600] rounded-lg hover:bg-green-700 transition-colors"
                            title="Aktivasi Akun"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Aktivasi
                          </button>
                          <button
                            onClick={() => rejectHospital(acc.email)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-[600] rounded-lg hover:bg-red-600 transition-colors"
                            title="Tolak Akun"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                        </>
                      )}
                      {acc.status === "activated" && (
                        <span className="text-xs text-green-600 font-[600]">Sudah aktif</span>
                      )}
                      {acc.status === "rejected" && (
                        <button
                          onClick={() => activateHospital(acc.email)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-[600] rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Aktivasi Ulang
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {accounts.length === 0 && (
          <div className="py-10 text-center text-gray-400">
            Belum ada akun rumah sakit terdaftar
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {viewPdfUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setViewPdfUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#1E3A8A]" />
                <div>
                  <h3 className="font-[700] text-gray-900">Surat Tugas</h3>
                  <p className="text-xs text-gray-500">{viewPdfName}</p>
                </div>
              </div>
              <button onClick={() => setViewPdfUrl(null)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 p-2">
              <iframe
                src={viewPdfUrl}
                className="w-full h-full rounded-lg border border-gray-200"
                title="Surat Tugas PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewsTab({
  news,
  onAdd,
  onDelete,
}: {
  news: Array<{
    id: string;
    title: string;
    category: string;
    publishedAt: string;
    author: string;
  }>;
  onAdd: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "berita" as const,
    imageUrl: "",
    author: "Tim Redaksi PERSI",
    publishedAt: new Date().toISOString().split("T")[0],
    featured: false,
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...form,
      imageUrl:
        form.imageUrl ||
        "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Crect x='340' y='240' width='120' height='120' rx='24' fill='%231E3A8A'/%3E%3Csvg x='364' y='264' width='72' height='72' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z'/%3E%3Cpath d='M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2'/%3E%3Cpath d='M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2'/%3E%3Cpath d='M10 6h4'/%3E%3Cpath d='M10 10h4'/%3E%3Cpath d='M10 14h4'/%3E%3Cpath d='M10 18h4'/%3E%3C/svg%3E%3C/svg%3E",
    });
    setForm({
      title: "",
      excerpt: "",
      content: "",
      category: "berita",
      imageUrl: "",
      author: "Tim Redaksi PERSI",
      publishedAt: new Date().toISOString().split("T")[0],
      featured: false,
    });
    setShowForm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-[700] text-gray-900">Kelola Berita</h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#1E3A8A] hover:bg-[#1a3278] font-[600]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Berita
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-[600]">Judul *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Judul berita"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-[600]">Kategori</Label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as any })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
                >
                  <option value="berita">Berita</option>
                  <option value="publikasi">Publikasi</option>
                  <option value="regulasi">Regulasi</option>
                  <option value="inovasi">Inovasi</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-[600]">Tanggal</Label>
                <Input
                  type="date"
                  value={form.publishedAt}
                  onChange={(e) =>
                    setForm({ ...form, publishedAt: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-[600]">Ringkasan *</Label>
            <Input
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Ringkasan singkat berita"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-[600]">Konten *</Label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Isi lengkap berita..."
              className="w-full h-32 px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-[600]">Gambar Berita (opsional)</Label>
            <div className="flex flex-col gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">ATAU URL:</span>
                <Input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            {form.imageUrl && form.imageUrl.startsWith("data:image") && (
              <p className="text-xs text-green-600 font-medium">Gambar dari device siap diunggah.</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-[#0D9488] hover:bg-[#0b7f75] font-[600]"
            >
              Simpan Berita
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Batal
            </Button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">
                Judul
              </th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">
                Kategori
              </th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">
                Penulis
              </th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">
                Tanggal
              </th>
              <th className="px-5 py-3 text-right text-xs font-[600] text-gray-500 uppercase">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {news.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-sm font-[500] text-gray-900 max-w-[300px] truncate">
                  {item.title}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs font-[600] px-2 py-0.5 rounded uppercase ${
                      item.category === "berita"
                        ? "bg-blue-100 text-blue-700"
                        : item.category === "publikasi"
                        ? "bg-green-100 text-green-700"
                        : item.category === "regulasi"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {item.category}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {item.author}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {item.publishedAt}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => onDelete(item.id)}
                    className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function EventsTab({
  events,
  onAdd,
  onDelete,
}: {
  events: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
    location: string;
  }>;
  onAdd: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    endDate: "",
    location: "",
    type: "seminar" as const,
    imageUrl: "",
    registrationUrl: "#",
    featured: false,
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...form,
      imageUrl:
        form.imageUrl ||
        "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Crect x='340' y='240' width='120' height='120' rx='24' fill='%231E3A8A'/%3E%3Csvg x='364' y='264' width='72' height='72' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z'/%3E%3Cpath d='M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2'/%3E%3Cpath d='M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2'/%3E%3Cpath d='M10 6h4'/%3E%3Cpath d='M10 10h4'/%3E%3Cpath d='M10 14h4'/%3E%3Cpath d='M10 18h4'/%3E%3C/svg%3E%3C/svg%3E",
    });
    setForm({
      title: "",
      description: "",
      date: "",
      endDate: "",
      location: "",
      type: "seminar",
      imageUrl: "",
      registrationUrl: "#",
      featured: false,
    });
    setShowForm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-[700] text-gray-900">Kelola Events</h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#1E3A8A] hover:bg-[#1a3278] font-[600]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Event
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-[600]">Judul Event *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Nama event"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-[600]">Tipe</Label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as any })
                }
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
              >
                <option value="seminar">Seminar</option>
                <option value="workshop">Workshop</option>
                <option value="congress">Congress</option>
                <option value="webinar">Webinar</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-[600]">Deskripsi *</Label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Deskripsi event..."
              className="w-full h-24 px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
              required
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-[600]">Tanggal Mulai *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-[600]">
                Tanggal Selesai (opsional)
              </Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-[600]">Lokasi *</Label>
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="Jakarta / Online"
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label className="text-sm font-[600]">Gambar Event (opsional)</Label>
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">ATAU URL:</span>
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              {form.imageUrl && form.imageUrl.startsWith("data:image") && (
                <p className="text-xs text-green-600 font-medium">Gambar dari device siap diunggah.</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-[#0D9488] hover:bg-[#0b7f75] font-[600]"
            >
              Simpan Event
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Batal
            </Button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">
                Judul
              </th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">
                Tipe
              </th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">
                Tanggal
              </th>
              <th className="px-5 py-3 text-left text-xs font-[600] text-gray-500 uppercase">
                Lokasi
              </th>
              <th className="px-5 py-3 text-right text-xs font-[600] text-gray-500 uppercase">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-sm font-[500] text-gray-900 max-w-[300px] truncate">
                  {item.title}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs font-[600] px-2 py-0.5 rounded ${
                      item.type === "congress"
                        ? "bg-[#1E3A8A] text-white"
                        : item.type === "workshop"
                        ? "bg-[#0D9488] text-white"
                        : item.type === "seminar"
                        ? "bg-[#D97706] text-white"
                        : "bg-purple-600 text-white"
                    }`}
                  >
                    {item.type}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {item.date}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {item.location}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => onDelete(item.id)}
                    className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}