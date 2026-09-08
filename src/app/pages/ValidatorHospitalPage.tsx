import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileCheck2, Loader2, Save, Send, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { specialtyAuditData } from "../data/specialtyAuditData";
import * as api from "../utils/api";
import { useData } from "../context/DataContext";

const AUDIT_OPTIONS = [
  { value: "sesuai", label: "Sesuai" },
  { value: "tidak-sesuai-pengecualian", label: "Tidak sesuai dengan pengecualian klinis" },
  { value: "tidak-sesuai", label: "Tidak sesuai" },
];

type Row = Record<string, any>;

function formatAnswer(value: string) {
  return AUDIT_OPTIONS.find((option) => option.value === value)?.label || "Belum diisi";
}

function buildStructureRows(modules: any[]): Row[] {
  const rows: Row[] = [];
  modules.filter((module) => module.type === "rsbk").sort((a, b) => String(a.specialty).localeCompare(String(b.specialty))).forEach((module) => {
    const specialty = String(module.specialty || "");
    const spec = (specialtyAuditData as any)[specialty];
    const formData = module.data?.formData || {};
    (spec?.rsbkItems || []).forEach((item: any) => {
      const reportedValue = formData[item.id];
      if (reportedValue === null || reportedValue === undefined || reportedValue === "") return;
      rows.push({ key: `${specialty}:${item.id}`, specialty, label: item.name, unit: item.inputUnit || "unit", reportedValue: Number(reportedValue) || 0 });
    });
  });
  return rows.slice(0, 10);
}

function buildClinicalRows(modules: any[]): Row[] {
  const rows: Row[] = [];
  modules.filter((module) => module.type === "clinical-audit").sort((a, b) => String(a.specialty).localeCompare(String(b.specialty))).forEach((module) => {
    const specialty = String(module.specialty || "");
    const spec = (specialtyAuditData as any)[specialty];
    const formData = module.data?.formData || {};
    const patientMeta = module.data?.patientMeta || {};
    (spec?.diseases || []).forEach((disease: any, diseaseIndex: number) => {
      const sampledPatients: number[] = [];
      for (let patientNum = 1; patientNum <= 30; patientNum++) {
        const meta = patientMeta[`d${diseaseIndex}-${patientNum}`];
        const complete = Boolean(meta?.initials && meta?.code) && disease.questions.every((question: any) => Boolean(formData[`d${diseaseIndex}-${patientNum}-${question.id}`]));
        if (complete) sampledPatients.push(patientNum);
        if (sampledPatients.length === 5) break;
      }
      sampledPatients.forEach((patientNum) => {
        const meta = patientMeta[`d${diseaseIndex}-${patientNum}`];
        disease.questions.forEach((question: any) => rows.push({
          key: `${specialty}:d${diseaseIndex}:${patientNum}:${question.id}`,
          specialty,
          diseaseName: disease.diseaseName,
          patientInitials: meta.initials,
          patientCode: meta.code,
          question: question.question,
          hospitalAnswer: formData[`d${diseaseIndex}-${patientNum}-${question.id}`],
        }));
      });
    });
  });
  return rows;
}

export function ValidatorHospitalPage() {
  const { hospitalCode = "" } = useParams<{ hospitalCode: string }>();
  const navigate = useNavigate();
  const { isValidator } = useData();
  const [result, setResult] = useState<any>(null);
  const [stage, setStage] = useState(0);
  const [structureValues, setStructureValues] = useState<Record<string, { validatorValue: string; notes: string }>>({});
  const [clinicalValues, setClinicalValues] = useState<Record<string, { validatorAnswer: string; exceptionEvidence: string; notes: string }>>({});
  const [premProm, setPremProm] = useState({ evidenceSent: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const structureRows = useMemo(() => buildStructureRows(result?.modules || []), [result]);
  const clinicalRows = useMemo(() => buildClinicalRows(result?.modules || []), [result]);
  const locked = result?.validation?.status === "completed";

  const hydrate = useCallback((payload: any) => {
    setResult(payload);
    const stored = payload?.validation?.data || {};
    setStructureValues(Object.fromEntries((stored.structure || []).map((row: any) => [row.key, { validatorValue: row.validatorValue ?? "", notes: row.notes || "" }])));
    setClinicalValues(Object.fromEntries((stored.clinical || []).map((row: any) => [row.key, { validatorAnswer: row.validatorAnswer || "", exceptionEvidence: row.exceptionEvidence || "", notes: row.notes || "" }])));
    setPremProm({ evidenceSent: stored.premProm?.evidenceSent || "", notes: stored.premProm?.notes || "" });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { hydrate(await api.getValidatorHospital(hospitalCode)); }
    catch (err: any) { setError(err?.message || "Data rumah sakit tidak dapat dimuat."); }
    finally { setLoading(false); }
  }, [hospitalCode, hydrate]);

  useEffect(() => { if (isValidator && hospitalCode) void load(); }, [isValidator, hospitalCode, load]);

  const payload = useMemo(() => ({
    structure: structureRows.map((row) => ({ ...row, validatorValue: structureValues[row.key]?.validatorValue ?? "", notes: structureValues[row.key]?.notes || "" })),
    clinical: clinicalRows.map((row) => ({ ...row, validatorAnswer: clinicalValues[row.key]?.validatorAnswer || "", exceptionEvidence: clinicalValues[row.key]?.exceptionEvidence || "", notes: clinicalValues[row.key]?.notes || "" })),
    premProm,
  }), [structureRows, structureValues, clinicalRows, clinicalValues, premProm]);

  const structureDone = structureRows.filter((row) => structureValues[row.key]?.validatorValue !== undefined && structureValues[row.key]?.validatorValue !== "").length;
  const clinicalDone = clinicalRows.filter((row) => Boolean(clinicalValues[row.key]?.validatorAnswer)).length;

  const save = async (): Promise<boolean> => {
    setSaving(true); setError(""); setSavedMessage("");
    try {
      const saved = await api.saveValidatorValidation(hospitalCode, payload);
      setResult((previous: any) => ({ ...previous, validation: saved }));
      setSavedMessage("Draft validasi tersimpan di server.");
      return true;
    } catch (err: any) {
      setError(err?.message || "Draft validasi gagal disimpan.");
      return false;
    }
    finally { setSaving(false); }
  };

  const next = async () => {
    if (stage === 0 && structureDone !== structureRows.length) { setError("Lengkapi seluruh item Hospital Structure yang ditampilkan sebelum melanjutkan."); return; }
    if (stage === 1 && clinicalDone !== clinicalRows.length) { setError("Lengkapi seluruh sampel Clinical Audit sebelum melanjutkan."); return; }
    if (stage === 2 && !premProm.evidenceSent) { setError("Pilih status bukti pengiriman PREM/PROM sebelum melanjutkan."); return; }
    const didSave = await save();
    if (!didSave) return;
    setStage((value) => Math.min(3, value + 1));
  };

  const submit = async () => {
    setSaving(true); setError("");
    try {
      const saved = await api.submitValidatorValidation(hospitalCode, payload);
      setResult((previous: any) => ({ ...previous, validation: saved }));
      setSavedMessage("Validasi telah dikirim ke admin dan sekarang terkunci.");
    } catch (err: any) { setError(err?.message || "Validasi belum dapat dikirim."); }
    finally { setSaving(false); }
  };

  if (!isValidator) return null;
  if (loading) return <div className="flex min-h-96 items-center justify-center text-slate-500"><Loader2 className="mr-3 h-6 w-6 animate-spin" />Memuat data validasi...</div>;
  if (!result) return <div className="p-8 text-red-700">{error || "Data tidak tersedia."}</div>;

  const stages = ["Hospital Structure", "Clinical Audit", "PREM/PROM", "Review & Kirim"];
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <Link to="/validator/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800"><ArrowLeft className="h-4 w-4" />Kembali ke penugasan</Link>
      <div className="mb-7 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-widest text-teal-600">Validasi Rumah Sakit</p><h1 className="mt-1 text-2xl font-black text-slate-950">{result.hospital.hospitalName}</h1><p className="mt-1 text-sm text-slate-500">{result.hospital.hospitalCode} · {result.hospital.province || "Provinsi belum tercatat"}</p></div>
        {locked ? <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800"><CheckCircle2 className="h-4 w-4" />Validasi terkirim</span> : <span className="inline-flex w-fit rounded-full bg-amber-100 px-4 py-2 text-sm font-black text-amber-800">Draft validasi</span>}
      </div>

      <div className="mb-7 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 md:grid-cols-4">
        {stages.map((label, index) => <button key={label} onClick={() => setStage(index)} className={`rounded-lg px-3 py-3 text-sm font-black ${stage === index ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>{index + 1}. {label}</button>)}
      </div>
      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {savedMessage && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{savedMessage}</div>}

      {stage === 0 && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-6"><h2 className="text-xl font-black text-slate-950">Hospital Structure</h2><p className="mt-1 text-sm text-slate-600">Validasi 10 indikator yang dipilih dari data RS. Nilai validator yang sama atau lebih besar dari angka RS dinilai sesuai.</p></div>{structureRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-sm"><thead className="border-b bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="p-3">Indikator</th><th className="p-3 text-center">Data RS</th><th className="p-3">Nilai Validator</th><th className="p-3">Status</th><th className="p-3">Catatan Validator</th></tr></thead><tbody>{structureRows.map((row) => { const value = structureValues[row.key]?.validatorValue ?? ""; const status = value === "" ? "Belum dinilai" : Number(value) >= row.reportedValue ? "Sesuai" : "Tidak Sesuai"; return <tr key={row.key} className="border-b border-slate-100 align-top"><td className="p-3 font-semibold text-slate-900"><div>{row.label}</div><div className="mt-1 text-xs font-normal text-slate-500">{(specialtyAuditData as any)[row.specialty]?.name || row.specialty}</div></td><td className="p-3 text-center font-black">{row.reportedValue} {row.unit}</td><td className="p-3"><input disabled={locked} type="number" min="0" value={value} onChange={(event) => setStructureValues((previous) => ({ ...previous, [row.key]: { ...previous[row.key], validatorValue: event.target.value } }))} className="h-10 w-28 rounded-lg border border-slate-300 px-3 font-bold disabled:bg-slate-100" /></td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${status === "Sesuai" ? "bg-emerald-100 text-emerald-800" : status === "Tidak Sesuai" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>{status}</span></td><td className="p-3"><textarea disabled={locked} value={structureValues[row.key]?.notes || ""} onChange={(event) => setStructureValues((previous) => ({ ...previous, [row.key]: { ...previous[row.key], notes: event.target.value } }))} rows={2} className="w-64 rounded-lg border border-slate-300 p-2 text-xs disabled:bg-slate-100" placeholder="Catatan bila diperlukan" /></td></tr>; })}</tbody></table></div> : <EmptyData label="Belum ada data Hospital Structure yang dapat divalidasi." />}</section>}

      {stage === 1 && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-6"><h2 className="text-xl font-black text-slate-950">Clinical Audit</h2><p className="mt-1 text-sm text-slate-600">Sampel diambil otomatis: maksimal 5 pasien lengkap per penyakit. Pilih temuan validator untuk setiap kriteria audit.</p></div>{clinicalRows.length ? <div className="space-y-5">{clinicalRows.map((row) => { const value = clinicalValues[row.key] || { validatorAnswer: "", exceptionEvidence: "", notes: "" }; return <article key={row.key} className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><span className="font-black text-slate-950">{row.patientInitials}</span><span className="ml-2 text-xs font-bold text-blue-700">Kode: {row.patientCode}</span><p className="mt-1 text-xs text-slate-500">{row.diseaseName}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Jawaban RS: {formatAnswer(row.hospitalAnswer)}</span></div><p className="mb-4 font-semibold text-slate-800">{row.question}</p><div className="grid gap-2 lg:grid-cols-3">{AUDIT_OPTIONS.map((option) => <label key={option.value} className={`cursor-pointer rounded-lg border p-3 text-sm font-bold ${value.validatorAnswer === option.value ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-600"}`}><input disabled={locked} type="radio" className="mr-2" checked={value.validatorAnswer === option.value} onChange={() => setClinicalValues((previous) => ({ ...previous, [row.key]: { ...value, validatorAnswer: option.value } }))} />{option.label}</label>)}</div>{row.hospitalAnswer === "tidak-sesuai-pengecualian" && <div className="mt-3 flex flex-wrap gap-3 text-sm"><span className="font-bold text-slate-700">Bukti pengecualian klinis:</span>{[["ada", "Ada"], ["tidak-ada", "Tidak ada"]].map(([key, label]) => <label key={key}><input disabled={locked} type="radio" className="mr-1.5" checked={value.exceptionEvidence === key} onChange={() => setClinicalValues((previous) => ({ ...previous, [row.key]: { ...value, exceptionEvidence: key } }))} />{label}</label>)}</div>}<textarea disabled={locked} value={value.notes} onChange={(event) => setClinicalValues((previous) => ({ ...previous, [row.key]: { ...value, notes: event.target.value } }))} rows={2} className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100" placeholder="Catatan validator" /></article>; })}</div> : <EmptyData label="Belum ada pasien Clinical Audit lengkap yang dapat dijadikan sampel." />}</section>}

      {stage === 2 && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-black text-slate-950">PREM/PROM</h2><p className="mt-1 text-sm text-slate-600">Validasi hanya memastikan RS memiliki bukti pengiriman tautan survei kepada pasien. Nilai PRM tidak diubah oleh validator.</p><div className="mt-6 rounded-xl border border-teal-100 bg-teal-50 p-5"><p className="font-black text-slate-900">Apakah RS dapat menunjukkan bukti riwayat pengiriman link PREM/PROM kepada pasien?</p><div className="mt-4 flex flex-wrap gap-3">{[["ada", "Ada bukti"], ["tidak-ada", "Tidak ada bukti"]].map(([value, label]) => <label key={value} className={`cursor-pointer rounded-lg border px-4 py-3 font-bold ${premProm.evidenceSent === value ? "border-teal-600 bg-white text-teal-800" : "border-transparent bg-white/60 text-slate-600"}`}><input disabled={locked} type="radio" className="mr-2" checked={premProm.evidenceSent === value} onChange={() => setPremProm((previous) => ({ ...previous, evidenceSent: value }))} />{label}</label>)}</div><textarea disabled={locked} value={premProm.notes} onChange={(event) => setPremProm((previous) => ({ ...previous, notes: event.target.value }))} rows={4} className="mt-4 w-full rounded-lg border border-teal-200 bg-white p-3 text-sm disabled:bg-slate-100" placeholder="Catatan validator, misalnya jenis bukti yang diperlihatkan RS." /></div></section>}

      {stage === 3 && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-indigo-600" /><div><h2 className="text-xl font-black text-slate-950">Review Validasi</h2><p className="text-sm text-slate-600">Periksa ringkasan sebelum mengirim. Setelah dikirim, hanya admin yang dapat membuka ulang.</p></div></div><div className="mt-6 grid gap-4 md:grid-cols-3"><SummaryCard label="Hospital Structure" value={`${structureDone}/${structureRows.length}`} /><SummaryCard label="Clinical Audit" value={`${clinicalDone}/${clinicalRows.length}`} /><SummaryCard label="Bukti PREM/PROM" value={premProm.evidenceSent === "ada" ? "Ada bukti" : premProm.evidenceSent === "tidak-ada" ? "Tidak ada bukti" : "Belum dinilai"} /></div></section>}

      <div className="mt-7 flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row"><Button variant="outline" disabled={stage === 0} onClick={() => setStage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-2 h-4 w-4" />Sebelumnya</Button><div className="flex flex-wrap gap-3">{!locked && <Button variant="outline" disabled={saving} onClick={save}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Simpan Draft</Button>}{stage < 3 ? <Button disabled={locked || saving} onClick={next}>Lanjutkan<ChevronRight className="ml-2 h-4 w-4" /></Button> : !locked && <Button disabled={saving} onClick={submit} className="bg-emerald-700 hover:bg-emerald-800">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Kirim ke Admin</Button>}</div></div>
    </div>
  );
}

function EmptyData({ label }: { label: string }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">{label}</div>; }
function SummaryCard({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p></div>; }
