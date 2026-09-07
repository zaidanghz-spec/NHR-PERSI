import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Building2, CheckCircle2, ClipboardCheck, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import * as api from "../utils/api";
import { useData } from "../context/DataContext";

const statusStyle: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-amber-100 text-amber-800",
};

export function ValidatorDashboardPage() {
  const { isValidator, adminUsername } = useData();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.getValidatorDashboard());
    } catch (err: any) {
      setError(err?.message || "Data penugasan validator belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isValidator) void load(); }, [isValidator, load]);

  if (!isValidator) return null;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-teal-600">Validator Workspace</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Penugasan Validasi</h1>
          <p className="mt-2 text-slate-600">{adminUsername || data?.validatorUsername || "Validator"} hanya dapat mengakses rumah sakit yang ditugaskan.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="font-bold">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh data
        </Button>
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-3 h-6 w-6 animate-spin" />Memuat penugasan...</div>
      ) : data?.hospitals?.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(220px,2fr)_minmax(130px,1fr)_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
            <span>Rumah Sakit</span><span>Status</span><span> </span>
          </div>
          {data.hospitals.map((hospital: any) => {
            const validation = hospital.validation;
            const finished = validation?.status === "completed";
            const summary = validation?.data?.summary;
            return (
              <div key={hospital.hospitalCode} className="grid grid-cols-1 gap-4 border-b border-slate-100 px-5 py-5 last:border-0 sm:grid-cols-[minmax(220px,2fr)_minmax(130px,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-3"><Building2 className="h-5 w-5 shrink-0 text-teal-600" /><div className="font-bold text-slate-950">{hospital.hospitalName}</div></div>
                  <p className="mt-1 pl-8 text-sm text-slate-500">{hospital.city || "-"}{hospital.province ? `, ${hospital.province}` : ""} · {hospital.hospitalCode}</p>
                  {summary && <p className="mt-2 pl-8 text-xs text-slate-500">Struktur {summary.structure.done}/{summary.structure.total} · Audit {summary.clinical.done}/{summary.clinical.total} · PREM/PROM {summary.premProm.status}</p>}
                </div>
                <div>
                  {validation ? <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusStyle[validation.status] || "bg-slate-100 text-slate-700"}`}>{finished ? "Selesai" : "Sedang divalidasi"}</span> : <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Belum dimulai</span>}
                </div>
                <Link to={`/validator/hospital/${encodeURIComponent(hospital.hospitalCode)}`} className="inline-flex">
                  <Button className="w-full bg-slate-950 font-bold hover:bg-slate-800 sm:w-auto">{finished ? "Lihat hasil" : validation ? "Lanjutkan" : "Mulai validasi"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><ClipboardCheck className="mx-auto mb-3 h-9 w-9 text-slate-400" /><h2 className="font-black text-slate-900">Belum ada penugasan</h2><p className="mt-2 text-sm text-slate-500">Hubungi admin PERSI untuk memastikan penugasan validator sudah tersedia.</p></div>
      )}
    </div>
  );
}
