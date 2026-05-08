import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { Users, Building2, Stethoscope, ChevronRight, Save, BedDouble, DoorOpen, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { specialtyAuditData, RsbkItem } from "../data/specialtyAuditData";
import { SpecialtyProgressTracker } from "../components/SpecialtyProgressTracker";
import { draftManager, stripLegacyToolVariationFields } from "../utils/draftManager";

export function RsbkFormPage() {
  const { specialty } = useParams<{ specialty: string }>();
  const navigate = useNavigate();
  const specialtyInfo = specialtyAuditData[specialty as keyof typeof specialtyAuditData];

  const [formData, setFormData] = useState<Record<string, number | null>>({});

  useEffect(() => {
    setFormData({});
    const draftId = draftManager.getCurrentDraftId();
    if (draftId && specialty) {
      const draft = draftManager.getDraftById(draftId);
      if (draft && draft.progress[specialty]?.rsbk?.data) {
        const raw = stripLegacyToolVariationFields(draft.progress[specialty].rsbk.data);
        const converted: Record<string, number | null> = {};
        Object.entries(raw).forEach(([k, v]) => {
          if (v === null || v === undefined || v === "") {
            converted[k] = null;
          } else {
            converted[k] = typeof v === "number" ? v : parseInt(v as string);
            if (isNaN(converted[k] as number)) converted[k] = null;
          }
        });
        setFormData(converted);
      }
    }
  }, [specialty]);

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

  // Auto-save: Persists state whenever formData or scores change
  useEffect(() => {
    if (!specialty || Object.keys(formData).length === 0) return;
    
    const draftId = draftManager.getCurrentDraftId();
    if (!draftId) return;

    setAutosaveState("saving");
    const timer = setTimeout(() => {
      if (draftManager.getCurrentDraftId() !== draftId) return;
      draftManager.updateDraft(draftId, specialty, "rsbk", {
        data: formData,
        score: totalRsbkScore,
        completed: filledItems === totalItems,
      });
      setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setAutosaveState("saved");
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [formData, specialty, totalRsbkScore, filledItems, totalItems]);

  const handleSaveDraft = () => {
    const draftId = draftManager.getCurrentDraftId();
    if (!draftId || !specialty) return;
    const cleanFormData = stripLegacyToolVariationFields(formData);
    draftManager.updateDraft(draftId, specialty, "rsbk", {
      data: cleanFormData,
      score: totalRsbkScore,
      completed: filledItems === totalItems,
    });
    setLastAutosavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setAutosaveState("saved");
    setDraftSavedMsg(true);
  };

  const handleSubmit = () => {
    const draftId = draftManager.getCurrentDraftId();
    if (!draftId || !specialty) return;
    if (filledItems < totalItems) return;
    const cleanFormData = stripLegacyToolVariationFields(formData);
    draftManager.updateDraft(draftId, specialty, "rsbk", {
      data: cleanFormData,
      score: totalRsbkScore,
      completed: filledItems === totalItems,
    });
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
            <span className="text-sm font-semibold text-gray-700">Progress Pengisian</span>
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
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-blue-700 mb-1">SDM</p>
              <p className="text-2xl font-black text-blue-900">{sdmItems.filter(item => formData[item.id] !== null && formData[item.id] !== undefined).length}</p>
              <p className="text-xs text-blue-700 mt-1">item terisi</p>
            </div>
            <div className="rounded-xl bg-teal-50 border border-teal-100 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-teal-700 mb-1">Sarana & Prasarana</p>
              <p className="text-2xl font-black text-teal-900">{saranaItems.filter(item => formData[item.id] !== null && formData[item.id] !== undefined).length}</p>
              <p className="text-xs text-teal-700 mt-1">item terisi</p>
            </div>
            <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-purple-700 mb-1">Alat Medis</p>
              <p className="text-2xl font-black text-purple-900">{alatItems.filter(item => formData[item.id] !== null && formData[item.id] !== undefined).length}</p>
              <p className="text-xs text-purple-700 mt-1">item terisi</p>
            </div>
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
    const parsed = parseInt(raw);
    if (!isNaN(parsed) && parsed >= 0) onChange(item.id, parsed);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="font-medium text-gray-900">{item.name}</label>
          <p className="text-xs text-gray-500 mt-1">Isi jumlah aktual yang tersedia dan berfungsi.</p>
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
