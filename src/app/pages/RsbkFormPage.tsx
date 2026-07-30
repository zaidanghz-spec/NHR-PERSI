import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { Users, Building2, Stethoscope, ChevronRight, Save, BedDouble, DoorOpen, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { specialtyAuditData, RsbkItem } from "../data/specialtyAuditData";
import { SpecialtyProgressTracker } from "../components/SpecialtyProgressTracker";
import { draftManager, selectMostCompleteDraftSnapshot, stripLegacyToolVariationFields } from "../utils/draftManager";
import * as api from "../utils/api";
import { getHospitalCode } from "../utils/api";

function toNumericRsbkData(raw: Record<string, any> = {}) {
  const converted: Record<string, number | null> = {};
  Object.entries(stripLegacyToolVariationFields(raw)).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") {
      converted[k] = null;
      return;
    }
    converted[k] = typeof v === "number" ? v : parseInt(v as string);
    if (isNaN(converted[k] as number)) converted[k] = null;
  });
  return converted;
}

const normalize = (value?: string) => (value || "").trim().toLowerCase();

export function RsbkFormPage() {
  const { specialty } = useParams<{ specialty: string }>();
  const navigate = useNavigate();
  const specialtyInfo = specialtyAuditData[specialty as keyof typeof specialtyAuditData];

  const [formData, setFormData] = useState<Record<string, number | null>>({});
  const authData = JSON.parse(sessionStorage.getItem("hospitalAuth") || "{}");
  const hospitalCode = authData.hospitalCode || getHospitalCode(authData.email || "");

  const matchesCurrentHospitalDraft = (draft: any) => {
    const emailMatch = Boolean(authData.email && draft?.hospitalEmail && normalize(draft.hospitalEmail) === normalize(authData.email));
    if (authData.email && draft?.hospitalEmail) return emailMatch;
    const codeMatch = Boolean(hospitalCode && draft?.hospitalCode && normalize(draft.hospitalCode) === normalize(hospitalCode));
    if (hospitalCode && draft?.hospitalCode) return codeMatch;
    if (hospitalCode || authData.email || draft?.hospitalCode || draft?.hospitalEmail) {
      return emailMatch || codeMatch;
    }
    return normalize(draft?.hospitalName) === normalize(authData.hospitalName);
  };

  const ensureRsbkDraftSession = () => {
    if (!specialty || !authData.hospitalName) return null;

    const activeDraftId = draftManager.getCurrentDraftId();
    const activeDraft = activeDraftId ? draftManager.getDraftById(activeDraftId) : null;
    if (activeDraft && matchesCurrentHospitalDraft(activeDraft)) return activeDraftId;

    const reusableDraft = [...draftManager.getAllDrafts()]
      .filter(matchesCurrentHospitalDraft)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null;

    if (reusableDraft) {
      if (!reusableDraft.selectedSpecialties.includes(specialty)) {
        reusableDraft.selectedSpecialties.push(specialty);
      }
      if (!reusableDraft.progress[specialty]) {
        reusableDraft.progress[specialty] = {
          rsbk: { completed: false, data: {} },
          clinicalAudit: { completed: false, data: {} },
          patientReport: { completed: false, data: {} },
        };
      }
      reusableDraft.hospitalCode = reusableDraft.hospitalCode || hospitalCode;
      reusableDraft.hospitalEmail = reusableDraft.hospitalEmail || authData.email;
      draftManager.beginDraftSession(reusableDraft);
      return reusableDraft.draftId;
    }

    const draft = draftManager.createDraft(
      authData.hospitalName,
      authData.picName || "",
      [specialty],
      hospitalCode,
      authData.email
    );
    draftManager.beginDraftSession(draft);
    return draft.draftId;
  };

  useEffect(() => {
    const auth = sessionStorage.getItem("hospitalAuth");
    if (!auth) { navigate("/hospital-login"); return; }
  }, [navigate]);
  
  useEffect(() => {
    setFormData({});
    if (!specialty || !hospitalCode) return;
    const activeSpecialty = specialty;
    let cancelled = false;
    const capturedDraftId = draftManager.getCurrentDraftId();
    const canHydrate = () => !cancelled && (!capturedDraftId || draftManager.getCurrentDraftId() === capturedDraftId);
    const hydrate = (raw: Record<string, any>) => {
      if (!canHydrate()) return false;
      setFormData(toNumericRsbkData(raw));
      return true;
    };

    async function loadRsbkDraft() {
      const draftId = capturedDraftId;
      const draft = draftId ? draftManager.getDraftById(draftId) : null;

      try {
        const serverDraft = await api.getDraft("rsbk", hospitalCode, activeSpecialty);
        const serverData = serverDraft?.formData || serverDraft?.data;
        const parentStage = draft?.progress?.[activeSpecialty]?.rsbk;
        const preferred = selectMostCompleteDraftSnapshot([
          serverData && { snapshot: { ...serverDraft, data: serverData }, updatedAt: serverDraft?.savedAt },
          parentStage && { snapshot: { ...parentStage, data: parentStage.data }, updatedAt: draft?.updatedAt },
        ].filter(Boolean) as Array<{ snapshot: any; updatedAt?: string }>);
        if (preferred?.data && Object.keys(preferred.data).length > 0 && hydrate(preferred.data)) {
          return;
        }
      } catch { /* fallback */ }

      if (draft && matchesCurrentHospitalDraft(draft) && draft.progress[activeSpecialty]?.rsbk?.data) {
        hydrate(draft.progress[activeSpecialty].rsbk.data);
        return;
      }

      // New assessment data is server-first. Legacy local copies are migrated
      // during authenticated login and are intentionally not hydrated here.
    }

    loadRsbkDraft();
    return () => {
      cancelled = true;
    };
  }, [specialty, hospitalCode]);

  const handleChange = (id: string, value: number | null) => {
    setFormData({ ...formData, [id]: value });
  };

  const rsbkItems = specialtyInfo.rsbkItems;
  const sdmItems = rsbkItems.filter(i => i.category === "sdm");
  const saranaItems = rsbkItems.filter(i => i.category === "sarana");
  const alatItems = rsbkItems.filter(i => i.category === "alat");

  const groupBySubCategory = (items: RsbkItem[]) => {
    const groups: Record<string, RsbkItem[]> = {};
    items.forEach(item => {
      const key = item.subCategory || "Umum";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  };

  const sdmMedicalItems = sdmItems.filter(i => i.subCategory !== "Keperawatan");
  const sdmNursingItems = sdmItems.filter(i => i.subCategory === "Keperawatan");

  const sdmMedicalGroups = groupBySubCategory(sdmMedicalItems);
  const sdmNursingGroups = groupBySubCategory(sdmNursingItems);
  const saranaGroups = groupBySubCategory(saranaItems);

  const totalItems = rsbkItems.length;
  const filledItems = rsbkItems.filter(item => formData[item.id] !== null && formData[item.id] !== undefined).length;
  const progress = totalItems > 0 ? (filledItems / totalItems) * 100 : 0;

  // === SCORING: SDM (50 poin) + Sarpras (50 poin) = 100 ===
  const getActual = (id: string) => {
    const v = formData[id];
    return (v !== null && v !== undefined) ? v : 0;
  };

  // Points = min(actual, target) × pointPerUnit
  const calcPoints = (items: RsbkItem[]) =>
    items.reduce((sum, item) => sum + Math.min(getActual(item.id), item.target) * item.pointPerUnit, 0);
  const calcTargetPoints = (items: RsbkItem[]) =>
    items.reduce((sum, item) => sum + item.target * item.pointPerUnit, 0);

  const sdmPoints = calcPoints(sdmItems);
  const sdmTargetPoints = calcTargetPoints(sdmItems);

  const bedItems = saranaItems.filter(i => i.pointPerUnit === 1);
  const roomItems = saranaItems.filter(i => i.pointPerUnit === 5);

  const saranaPoints = calcPoints(saranaItems);
  const saranaTargetPoints = calcTargetPoints(saranaItems);
  
  const alatPoints = calcPoints(alatItems);
  const alatTargetPoints = calcTargetPoints(alatItems);

  const sdmSubScore = sdmTargetPoints > 0 ? Number(((sdmPoints / sdmTargetPoints) * 50).toFixed(1)) : 0;
  const saranaSubScore = saranaTargetPoints > 0 ? Number(((saranaPoints / saranaTargetPoints) * 25).toFixed(1)) : 0;
  const alatSubScore = alatTargetPoints > 0 ? Number(((alatPoints / alatTargetPoints) * 25).toFixed(1)) : 0;
  const totalRsbkScore = Number((sdmSubScore + saranaSubScore + alatSubScore).toFixed(1));

  const [draftSavedMsg, setDraftSavedMsg] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string>("");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (draftSavedMsg) {
      timer = setTimeout(() => setDraftSavedMsg(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [draftSavedMsg]);

  const persistRsbkDraft = async () => {
    if (!specialty || !hospitalCode) return null;
    const draftId = ensureRsbkDraftSession();
    const cleanFormData = stripLegacyToolVariationFields(formData);

    const draftPayload = {
      draftId,
      formData: cleanFormData,
      score: totalRsbkScore,
      completed: filledItems === totalItems,
      savedAt: new Date().toISOString(),
    };
    await api.saveDraft("rsbk", hospitalCode, specialty, draftPayload);
    return draftId;
  };

  // Auto-save: Persists Hospital Structure by hospital code + specialty, so logout/login does not lose it.
  useEffect(() => {
    if (!specialty || Object.keys(formData).length === 0) return;

    let cancelled = false;
    setAutosaveState("saving");
    const timer = setTimeout(async () => {
      try {
        await persistRsbkDraft();
        if (cancelled) return;
        setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setAutosaveState("saved");
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to autosave RSBK draft:", err);
          setAutosaveState("idle");
        }
      }
    }, 1500); // 1.5s debounce

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData, specialty, totalRsbkScore, filledItems, totalItems]);

  const handleSaveDraft = async () => {
    try {
      setAutosaveState("saving");
      await persistRsbkDraft();
      setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setAutosaveState("saved");
      setDraftSavedMsg(true);
    } catch (err) {
      console.error("Failed to save RSBK draft:", err);
      setAutosaveState("idle");
      alert("Draft gagal disimpan ke server. Coba lagi sebentar.");
    }
  };

  const handleSubmit = async () => {
    if (!specialty) return;
    if (filledItems < totalItems) return;
    const cleanFormData = stripLegacyToolVariationFields(formData);
    const draftId = await persistRsbkDraft();
    if (!draftId) return;
    sessionStorage.setItem(`${specialty}_rsbkScore`, totalRsbkScore.toString());
    sessionStorage.setItem("currentSpecialty", specialty || "");
    navigate(`/siap-persi/clinical-audit/${specialty}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <SpecialtyProgressTracker currentSpecialty={specialty || ""} currentStage="rsbk" />

        {/* Draft Saved Toast */}
        {draftSavedMsg && (
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Draft berhasil disimpan!</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <Link to="/siap-persi/select-specialty" className="inline-flex items-center text-[#0F4C81] hover:underline mb-4">
            &larr; Kembali ke Pilih Pelayanan
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Hospital Structure Form - {specialtyInfo.name}</h1>
              <p className="text-gray-600">Rumah Sakit Berstandar Kemampuan — Input SDM, Kapasitas Bed, Ruangan & Alat Medis</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 text-center min-w-[160px]">
              <p className="text-sm text-gray-600 mb-1">Hospital Structure</p>
              <p className="text-xl font-bold text-[#0F4C81]">Menunggu Review</p>
              <p className="text-xs text-gray-500 mt-1">Dinilai oleh reviewer</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-bold text-gray-700">Progress Pengisian</span>
            <div className="flex items-center gap-3">
              <AutosaveIndicator state={autosaveState} timestamp={lastAutosavedAt} />
              <span className="text-sm text-gray-600">{filledItems} / {totalItems} item ({progress.toFixed(0)}%)</span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>


        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-2">Panduan Pengisian Hospital Structure</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>&bull; Isi jumlah aktual SDM, sarana, prasarana, dan alat yang tersedia serta berfungsi.</p>
            <p>&bull; Nilai Hospital Structure tidak ditampilkan otomatis ke RS dan akan ditetapkan setelah review/verifikasi PERSI.</p>
            <p>&bull; Sistem menggunakan data alat apa adanya berdasarkan jumlah aktual yang tersedia dan berfungsi.</p>
          </div>
        </div>

        {/* Section 1: SDM Medis */}
        <FormSection title="Tenaga Medis Spesialis (SDM)" icon={<Stethoscope className="w-6 h-6" />} color="blue"
          subtitle={`${sdmMedicalItems.length} item`}>
          {Object.entries(sdmMedicalGroups).map(([group, items]) => (
            <div key={group} className="mb-6 last:mb-0">
              <h4 className="text-sm font-semibold text-blue-700 bg-blue-50 px-4 py-2 rounded-lg mb-3">{group}</h4>
              <div className="space-y-3">
                {items.map((item) => (
                  <QuantityInput key={item.id} item={item} value={formData[item.id] ?? null} onChange={handleChange} />
                ))}
              </div>
            </div>
          ))}
        </FormSection>

        {/* Section 1.5: Keperawatan */}
        <FormSection title="Tenaga Keperawatan" icon={<Users className="w-6 h-6" />} color="purple"
          subtitle={`${sdmNursingItems.length} item`}>
          {Object.entries(sdmNursingGroups).map(([group, items]) => (
            <div key={group} className="mb-6 last:mb-0">
              <h4 className="text-sm font-semibold text-purple-700 bg-purple-50 px-4 py-2 rounded-lg mb-3">{group}</h4>
              <div className="space-y-3">
                {items.map((item) => (
                  <QuantityInput key={item.id} item={item} value={formData[item.id] ?? null} onChange={handleChange} />
                ))}
              </div>
            </div>
          ))}
        </FormSection>

        {/* Section 2: Sarana & Prasarana */}
        <FormSection title="Sarana & Prasarana" icon={<Building2 className="w-6 h-6" />} color="teal"
          subtitle="Kapasitas bed dan ruangan pendukung pelayanan">
          
          {/* Kapasitas Bed */}
          {saranaGroups["Kapasitas Bed"] && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <BedDouble className="w-5 h-5 text-teal-600" />
                <h4 className="text-sm font-semibold text-teal-700 bg-teal-50 px-4 py-2 rounded-lg flex-1">
                  Kapasitas Bed
                </h4>
              </div>
              <div className="space-y-3">
                {saranaGroups["Kapasitas Bed"].map((item) => (
                  <QuantityInput key={item.id} item={item} value={formData[item.id] ?? null} onChange={handleChange} />
                ))}
              </div>
            </div>
          )}

          {/* Ruangan Khusus */}
          {saranaGroups["Ruangan Khusus"] && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <DoorOpen className="w-5 h-5 text-indigo-600" />
                <h4 className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg flex-1">
                  Ruangan Khusus
                </h4>
              </div>
              <div className="space-y-3">
                {saranaGroups["Ruangan Khusus"].map((item) => (
                  <QuantityInput key={item.id} item={item} value={formData[item.id] ?? null} onChange={handleChange} />
                ))}
              </div>
            </div>
          )}

        </FormSection>

        {/* Section 3: Alat Medis */}
        <FormSection
          title="Alat Medis yang Memenuhi Syarat dan Regulasi serta Berfungsi Penuh"
          icon={<Stethoscope className="w-6 h-6" />}
          color="purple"
          subtitle="Isi alat yang tersedia dan berfungsi."
        >
          <div className="space-y-3">
            {alatItems.map((item) => (
              <QuantityInput
                key={item.id}
                item={item}
                value={formData[item.id] ?? null}
                onChange={handleChange}
              />
            ))}
          </div>
        </FormSection>

        <div className="bg-white rounded-xl border-2 border-[#0F4C81] p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ringkasan Hospital Structure</h3>
          <p className="text-sm text-gray-600 mb-5">
            Data sudah direkap untuk proses review. Skor RSBK tidak ditampilkan otomatis kepada rumah sakit untuk menghindari miskonsepsi penilaian.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
          {[
            { label: "SDM", items: sdmItems, bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-700", num: "text-blue-900" },
            { label: "Sarana & Prasarana", items: saranaItems, bg: "bg-teal-50", border: "border-teal-100", text: "text-teal-700", num: "text-teal-900" },
            { label: "Alat Medis", items: alatItems, bg: "bg-purple-50", border: "border-purple-100", text: "text-purple-700", num: "text-purple-900" },
          ].map(({ label, items, bg, border, text, num }) => {
            const filled = items.filter(item => formData[item.id] !== null && formData[item.id] !== undefined).length;
            const total = items.length;
            const complete = filled === total && total > 0;
            return (
              <div key={label} className={`rounded-xl ${bg} ${border} border p-4`}>
                <p className={`text-xs font-black uppercase tracking-widest ${text} mb-1`}>{label}</p>
                {complete ? (
                  <>
                    <CheckCircle2 className={`w-8 h-8 ${text} mb-1`} />
                    <p className={`text-xs ${text} mt-1`}>semua sudah terisi</p>
                  </>
                ) : (
                  <>
                    <p className={`text-2xl font-black ${num}`}>{filled}/{total}</p>
                    <p className={`text-xs ${text} mt-1`}>item terisi</p>
                  </>
                )}
              </div>
            );
          })}
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 mt-4">
            <strong>Status nilai:</strong> Menunggu review dan validasi PERSI.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <Button onClick={handleSaveDraft} variant="outline" className="h-12 px-8 border-2 border-gray-300 font-semibold">
            <Save className="w-5 h-5 mr-2" /> Simpan Draft
          </Button>
          <Button onClick={() => navigate(`/siap-persi/clinical-audit/${specialty}`)} variant="outline"
            className="h-12 px-8 border-2 border-yellow-400 text-yellow-700 hover:bg-yellow-50 font-semibold">
            Isi Nanti (Lanjut ke Clinical Audit)
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={filledItems < totalItems}
            className="flex-1 h-12 bg-[#0F4C81] hover:bg-[#0d3d66] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {filledItems < totalItems 
              ? `Lengkapi semua data (${filledItems}/${totalItems}) untuk lanjut` 
              : "Lanjut ke Clinical Audit"}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            <strong>Tips:</strong> Anda dapat mengklik <strong>"Isi Nanti"</strong> untuk melanjutkan ke bagian berikutnya, kemudian kembali melengkapi Hospital Structure Form sebelum submit final.
          </p>
        </div>
      </div>
    </div>
  );
}

function AutosaveIndicator({ state, timestamp }: { state: "idle" | "saving" | "saved"; timestamp: string }) {
  if (state === "idle") return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
      state === "saving" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
    }`}>
      {state === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
      {state === "saving" ? "Menyimpan..." : `Tersimpan otomatis${timestamp ? ` ${timestamp}` : ""}`}
    </span>
  );
}

function FormSection({ title, icon, color, subtitle, children }: {
  title: string; icon: React.ReactNode; color: string; subtitle?: string; children: React.ReactNode;
}) {
  const colorClasses: Record<string, string> = { blue: "bg-blue-50 text-blue-600", teal: "bg-teal-50 text-teal-600", purple: "bg-purple-50 text-purple-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>{icon}</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function QuantityInput({ item, value, onChange }: {
  item: RsbkItem;
  value: number | null;
  onChange: (id: string, value: number | null) => void;
}) {
  const isFilled = value !== null;
  const actualValue = value ?? 0;
  const unit = item.inputUnit || "unit";

  const handleDecrement = () => {
    if (!isFilled) return;
    if (actualValue <= 0) onChange(item.id, null);
    else onChange(item.id, actualValue - 1);
  };
  const handleIncrement = () => {
    if (!isFilled) onChange(item.id, 0);
    else onChange(item.id, actualValue + 1);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || raw === "-") { onChange(item.id, null); return; }
    const stripped = raw.startsWith("-") ? raw.slice(1) : raw;
    if (stripped === "") { onChange(item.id, null); return; }
    const parsed = parseInt(stripped);
    if (!isNaN(parsed) && parsed >= 0) onChange(item.id, parsed);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="font-medium text-gray-900">{item.name}</label>
          <p className="text-xs text-gray-500 mt-1">
            {item.category === "sdm"
              ? "Isi jumlah tenaga yang tersedia dan bertugas"
              : item.category === "sarana"
              ? "Isi jumlah ruangan yang tersedia dan berfungsi"
              : "Isi jumlah aktual yang tersedia dan berfungsi."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleDecrement}
            className="w-9 h-9 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700 transition-colors">-</button>
          <input type="text" value={isFilled ? actualValue : "-"} onChange={handleInputChange}
            className={`w-20 h-9 text-center border-2 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-[#0F4C81] ${
              isFilled ? "border-gray-300 text-gray-900" : "border-gray-300 text-gray-400"
            }`} />
          <button type="button" onClick={handleIncrement}
            className="w-9 h-9 rounded-lg bg-[#0F4C81] hover:bg-[#0d3d66] flex items-center justify-center font-bold text-white transition-colors">+</button>
          <span className="text-sm text-gray-500 w-16">{unit}</span>
        </div>
      </div>
    </div>
  );
}
