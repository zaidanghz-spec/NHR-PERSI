// ============ TYPES ============
export interface RsbkItem {
  id: string;
  name: string;
  category: "sdm" | "sarana" | "alat";
  subCategory?: string; // grouping (e.g., "DPJP Inti", "Kapasitas Bed", "Ruangan Khusus")
  target: number; // ideal/good quantity for scoring (in raw units: orang/bed/ruangan/unit)
  pointPerUnit: number; // 1 for sdm/bed/alat, 5 for ruangan
  inputUnit?: "orang" | "bed" | "bed/chair" | "ruangan" | "unit"; // display unit
}

export interface AuditQuestion {
  id: string;
  question: string;
  category: string; // e.g., "Diagnosa (25%)", "Tatalaksana (25%)", "Outcome (50%)"
  weight?: string;
}

export interface PremPromQuestion {
  id: string;
  question: string;
  type: "prem" | "prom";
  subCategory?: string;
}

export interface DiseaseAudit {
  diseaseName: string;
  weight: string; // e.g., "50%"
  questions: AuditQuestion[];
  premQuestions: PremPromQuestion[];
  promQuestions: PremPromQuestion[];
}

export interface SpecialtyData {
  name: string;
  nameEn: string;
  disease: string; // primary disease name (for backward compat)
  diseases: DiseaseAudit[]; // supports multiple diseases
  medicalStaff: { code: string; name: string }[];
  rsbkItems: RsbkItem[];
  auditQuestions: AuditQuestion[]; // flattened from all diseases (backward compat)
  premQuestions: PremPromQuestion[]; // flattened from all diseases (backward compat)
  promQuestions: PremPromQuestion[]; // flattened from all diseases (backward compat)
}

// ============ KARDIOLOGI ============
const cardiologyRsbkItems: RsbkItem[] = [
  // SDM - DPJP
  { id: "sdm-sp-jp-pd", name: "Sp. JP / Sp. PD", category: "sdm", subCategory: "DPJP", target: 5, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-b", name: "Sp. B", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-a", name: "Sp. A", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-pdkkv", name: "Sp. PD.KKV", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-jp-intervensi", name: "Sp. JP (Sub) / Sp. JP Fellow Kardio Intervensi", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-b-onk", name: "Sp. B / Sp.B.Sub.Onk/ Sp.B. Sub BVE/ Sp.BTKV", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-jp-intensif", name: "Sp. JP (Sub/Fellow) Perawatan Intensif dan Kegawatan Kardiovaskular", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-jp-pediatrik", name: "Sp. JP (Sub/Fellow) Kardiologi Pediatrik dan PJB/ Sp. A (Sub) Kardio", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-jp-citra", name: "Sp. JP (Sub/ Fellow) Pencitraan Kardiovaskular / Ekokardiografi / Aritmia", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-jp-vaskular", name: "Sp. JP (Sub/Fellow) Kedokteran Vaskular / Prevensi Rehabilitasi", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-btkv-sub", name: "Sp. BTKV (Sub/Fellow) / Sp. BTKV Sub BVE", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },

  // SDM - Spesialis Lain
  { id: "sdm-sp-an", name: "Sp. An / Sp. An (Sub Intensif Care / Kardiovaskuler)", category: "sdm", subCategory: "Spesialis Lain", target: 3, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-pk", name: "Sp. PK / Sp. PK (Sub)", category: "sdm", subCategory: "Spesialis Lain", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-rad", name: "Sp. Rad / Sp. Rad (Fellow/Sub)", category: "sdm", subCategory: "Spesialis Lain", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-a-etia", name: "Sp. A (Fellow/Sub. ETIA)", category: "sdm", subCategory: "Spesialis Lain", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-kfr", name: "Sp. KFR", category: "sdm", subCategory: "Spesialis Lain", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-gk", name: "Sp. GK", category: "sdm", subCategory: "Spesialis Lain", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-p", name: "Sp. P", category: "sdm", subCategory: "Spesialis Lain", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-n", name: "Sp. N", category: "sdm", subCategory: "Spesialis Lain", target: 1, pointPerUnit: 1, inputUnit: "orang" },

  // Sarana - Kapasitas Bed (1 bed = 1 poin)
  { id: "sarana-iccu-bed", name: "ICCU (Intensive Cardiac Care Unit)", category: "sarana", subCategory: "Kapasitas Bed", target: 10, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-icu-bed", name: "ICU (General)", category: "sarana", subCategory: "Kapasitas Bed", target: 5, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-hcu-bed", name: "HCU (High Care Unit)", category: "sarana", subCategory: "Kapasitas Bed", target: 10, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-picu-nicu-bed", name: "PICU / NICU (Khusus Jantung Anak)", category: "sarana", subCategory: "Kapasitas Bed", target: 4, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-rawatinap-bed", name: "Ruang Rawat Inap Biasa (Khusus Jantung)", category: "sarana", subCategory: "Kapasitas Bed", target: 30, pointPerUnit: 1, inputUnit: "bed" },

  // Sarana - Ruangan Khusus (1 ruangan = 5 poin)
  { id: "sarana-cathlab", name: "Ruang Cathlab", category: "sarana", subCategory: "Ruangan Khusus", target: 2, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-ok-mayor", name: "Ruang Operasi Mayor", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },

  // Alat Medis Dasar & Madya
  { id: "alat-ekg", name: "EKG", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-usg", name: "USG", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-echo", name: "ECHO / Advance ECHO (3D)/TTE", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-xray", name: "X-ray", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-holter", name: "Holter monitor", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-treadmill", name: "Treadmill/Ergo cycle", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-bedside", name: "Bedside Monitor", category: "alat", target: 4, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ventilator", name: "Ventilator", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-abpm", name: "ABPM (Ambulatory Blood Pressure Monitoring)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ctscan", name: "CT Scan", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-atherectomy", name: "Atherectomy device", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ivus", name: "IVUS (Intravascular ultrasound)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-sternal_saw", name: "Sternal Saw", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-act", name: "ACT (Activated Clotting Time) Intraoperatif", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-thrombectomy", name: "Thrombectomy Device", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-syringe_actuator", name: "Syringe actuator for an injector (Injector Pump)", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ice", name: "Intracardiac Echocardiography (ICE) Probe ICE", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-tilt_table", name: "Tilt Table Test", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },

  // Alat Medis Utama & Paripurna
  { id: "alat-mri", name: "MRI", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ep_mapping", name: "Elektrofisiologi mapping system (2D dan 3D)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-thoracoscopy", name: "Thoracoscopy", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-iabp", name: "IABP (Intra-aortic balloon pump)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-heart_lung", name: "Heart lung machine", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-eecp", name: "EECP (Enhanced External Counterpulsation)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-rotablator", name: "Rotablator", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-gamma_camera", name: "Gamma Camera", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-lvad", name: "LVAD (Left Ventricular Assist Device)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-nitric_oxide", name: "Nitric Oxide machine", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ecmo", name: "ECMO (Extracorporeal Membrane Oxygenation)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-transplant_set", name: "Heart Transplant set", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ablation_pfa", name: "Pulse-Field Ablation / Cryoablation System", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },

  // ASPEK KEPERAWATAN (SIAP PERSI)
  { id: "sdm-ners-spkmb-cv", name: "Ners Sp.KMB (Medikal Bedah)", category: "sdm", subCategory: "Keperawatan", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-ners-cert-cv", name: "Ners dan Sertifikasi/Fellowship Cardiovascular", category: "sdm", subCategory: "Keperawatan", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-ners-cv-total", name: "Jumlah Ners", category: "sdm", subCategory: "Keperawatan", target: 10, pointPerUnit: 0, inputUnit: "orang" },
  { id: "sdm-perawat-d3-cv", name: "Jumlah Perawat D3", category: "sdm", subCategory: "Keperawatan", target: 10, pointPerUnit: 0, inputUnit: "orang" },
];

const cardiologyDiseases: DiseaseAudit[] = [
  {
    diseaseName: "STEMI (ST-Elevation Myocardial Infarction)",
    weight: "50%",
    questions: [
      { id: "card-st-1", question: "Dilakukan pemeriksaan EKG 10 menit sejak pasien datang di IGD", category: "Diagnosa (25%)" },
      { id: "card-st-2", question: "Dilakukan penetapan stratifikasi berdasarkan kelas Killip", category: "Diagnosa (25%)" },
      { id: "card-st-3", question: "Dilakukan revaskularisasi menggunakan agen fibrinolitik atau intervensi koroner perkutan primer (kecuali onset > 12 jam)", category: "Tatalaksana (25%)" },
      { id: "card-st-4", question: "Diberikan Clopidogrel dan Aspirin oral", category: "Tatalaksana (25%)" },
      { id: "card-st-nurse-1", question: "Dilakukan pengkajian hemodinamik", category: "Diagnosa (25%)" },
      { id: "card-st-nurse-2", question: "Diberikan manajemen aktifitas dan bedrest oleh perawat", category: "Tatalaksana (25%)" },
      { id: "card-st-5", question: "Pasien tidak meninggal dunia di RS", category: "Outcome (50%)" },
      { id: "card-st-6", question: "LOS < 5 hari (kecuali kelas Killip III dan IV, atau mengalami Syok Kardiogenik)", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "card-st-prem-1", question: "Dokter menjelaskan rencana tindakan (primary pci/trombolisis) dengan bahasa yang mudah anda mengerti", type: "prem", subCategory: "Komunikasi" },
      { id: "card-st-prem-2", question: "Staf medis merespons dengan cepat saat anda mengalami nyeri dada atau gejala berulang di bangsal", type: "prem", subCategory: "Responsivitas" },
      { id: "card-st-prem-3", question: "Dokter dan perawat menghormati serta mendengarkan seluruh keluhan dan kekhawatiran anda", type: "prem", subCategory: "Penghormatan" },
      { id: "card-st-prem-4", question: "Staf medis memberi informasi yang cukup tentang kondisi jantung dan pengobatan anda", type: "prem", subCategory: "Informasi" },
      { id: "card-st-prem-5", question: "Anda merasa dilibatkan dalam pengambilan keputusan terkait prosedur kardiovaskular anda", type: "prem", subCategory: "Shared Decision" },
      { id: "card-st-prem-6", question: "Ruang perawatan jantung bersih, nyaman, dan kondusif untuk pemulihan anda", type: "prem", subCategory: "Lingkungan" },
      { id: "card-st-prem-7", question: "Resep dan petunjuk penggunaan obat (antiplatelet, beta-blocker, statin) dijelaskan dengan jelas kepada anda", type: "prem", subCategory: "Edukasi Obat" },
      { id: "card-st-prem-8", question: "Anda mendapat informasi yang jelas tentang jadwal kontrol dan tanda bahaya yang harus diwaspadai setelah pulang", type: "prem", subCategory: "Discharge" },
      { id: "card-st-prem-9", question: "Proses administrasi (pendaftaran, pembiayaan, klaim bpjs) berjalan lancar dan tidak membebani", type: "prem", subCategory: "Administrasi" },
      { id: "card-st-prem-10", question: "Secara keseluruhan, seberapa puas Anda dengan pengalaman perawatan di unit jantung ini", type: "prem", subCategory: "Kepuasan Global" },
      { id: "card-st-prem-nurse", question: "Perawat memeriksa kondisi saudara/ri, memastikan tidak sesak dan nyeri", type: "prem", subCategory: "Aspek Keperawatan" },
    ],
    promQuestions: [
      { id: "card-st-prom-1", question: "Nyeri dada anda hilang atau berkurang secara signifikan setelah tindakan pci/trombolisis", type: "prom", subCategory: "Gejala (KCCQ)" },
      { id: "card-st-prom-2", question: "Anda mampu berjalan setara 100 meter tanpa merasa nyeri dada atau sesak napas", type: "prom", subCategory: "Kapasitas (Duke)" },
      { id: "card-st-prom-3", question: "Seberapa berkurang frekuensi sesak napas Anda dalam 1 minggu terakhir dibandingkan sebelum masuk RS", type: "prom", subCategory: "Respirasi" },
      { id: "card-st-prom-4", question: "Anda dapat melakukan aktivitas ringan sehari-hari (mandi, berpakaian) secara mandiri", type: "prom", subCategory: "Kemandirian" },
      { id: "card-st-prom-5", question: "Kualitas tidur anda membaik sejak mendapat perawatan di rumah sakit", type: "prom", subCategory: "Kualitas Tidur" },
      { id: "card-st-prom-6", question: "Anda merasa tenang dan tidak cemas berlebihan tentang kondisi jantung anda saat ini", type: "prom", subCategory: "Mental" },
      { id: "card-st-prom-7", question: "Anda memahami dan dapat mematuhi pengobatan jangka panjang anda", type: "prom", subCategory: "Kepatuhan" },
      { id: "card-st-prom-8", question: "Anda sudah mulai menerapkan gaya hidup sehat (berhenti merokok, diet) sesuai anjuran dokter", type: "prom", subCategory: "Gaya Hidup" },
      { id: "card-st-prom-9", question: "Semangat dan motivasi hidup anda meningkat setelah mendapat perawatan", type: "prom", subCategory: "Kesejahteraan" },
      { id: "card-st-prom-10", question: "Secara keseluruhan, apakah kondisi kesehatan Anda terasa lebih baik dibandingkan saat pertama kali masuk RS", type: "prom", subCategory: "Outcome Global" },
      { id: "card-st-prom-nurse", question: "Saya dapat bed rest dan istirahat selama perawatan", type: "prom", subCategory: "Aspek Keperawatan" },
    ],
  },
  {
    diseaseName: "Gagal Jantung",
    weight: "50%",
    questions: [
      { id: "card-gj-1", question: "Dilakukan pengukuran Ejection Fraction (EF)", category: "Diagnosa (25%)" },
      { id: "card-gj-2", question: "Dilakukan uji fungsional jantung, jalan 6 menit (kecuali ada kontraindikasi)", category: "Diagnosa (25%)" },
      { id: "card-gj-3", question: "Diberikan edukasi perubahan gaya hidup", category: "Tatalaksana (25%)" },
      { id: "card-gj-4", question: "Dilakukan pemberian ACE Inhibitor (Angiotensin-Converting Enzyme Inhibitor) atau ARB (Angiotensin Receptor Blocker) atau ARNI (Angiotensin Receptor Neprilysin)", category: "Tatalaksana (25%)" },
      { id: "card-gj-nurse-1", question: "Dilakukan pengkajian hemodinamik", category: "Diagnosa (25%)" },
      { id: "card-gj-nurse-2", question: "Diberikan manajemen aktifitas dan bedrest oleh perawat", category: "Tatalaksana (25%)" },
      { id: "card-gj-5", question: "Pasien pulang dengan skor NYHA 1-2", category: "Outcome (50%)" },
      { id: "card-gj-6", question: "Tidak ada readmisi dalam waktu 30 hari setelah pasien pulang rawat", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "card-gj-prem-1", question: "Dokter menjelaskan penyakit gagal jantung dan rencana pengobatan dengan bahasa yang anda mengerti", type: "prem", subCategory: "Komunikasi" },
      { id: "card-gj-prem-2", question: "Staf medis merespons dengan segera ketika anda mengalami sesak napas mendadak", type: "prem", subCategory: "Responsivitas" },
      { id: "card-gj-prem-3", question: "Anda mendapat penjelasan tentang batasan cairan dan garam dalam diet harian anda", type: "prem", subCategory: "Edukasi Diet" },
      { id: "card-gj-prem-4", question: "Keluarga anda dilibatkan dalam diskusi rencana pengobatan dan perawatan di rumah", type: "prem", subCategory: "Keterlibatan Keluarga" },
      { id: "card-gj-prem-5", question: "Anda mendapat informasi jelas tentang cara memantau berat badan harian dan gejala pemburukan", type: "prem", subCategory: "Self-Monitoring" },
      { id: "card-gj-prem-6", question: "Staf medis mendengarkan keluhan anda tentang batasan aktivitas harian anda", type: "prem", subCategory: "Penghormatan" },
      { id: "card-gj-prem-7", question: "Fasilitas kamar rawat inap bersih, tenang, dan mendukung pemulihan anda", type: "prem", subCategory: "Lingkungan" },
      { id: "card-gj-prem-8", question: "Proses pemulangan (discharge) direncanakan dengan baik dan tidak terburu-buru", type: "prem", subCategory: "Discharge" },
      { id: "card-gj-prem-9", question: "Anda merasa tim medis sangat empati terhadap kondisi keterbatasan fungsional anda", type: "prem", subCategory: "Empati" },
      { id: "card-gj-prem-10", question: "Secara keseluruhan, seberapa puas Anda dengan pelayanan di unit jantung ini", type: "prem", subCategory: "Kepuasan Global" },
    ],
    promQuestions: [
      { id: "card-gj-prom-1", question: "Sesak napas anda berkurang secara bermakna dibandingkan saat pertama masuk rs", type: "prom", subCategory: "Gejala (KCCQ)" },
      { id: "card-gj-prom-2", question: "Pembengkakan pada kaki (edema) anda sudah berkurang atau hilang", type: "prom", subCategory: "Gejala Fisik" },
      { id: "card-gj-prom-3", question: "Anda mampu berjalan di dalam ruangan tanpa harus berhenti akibat sesak napas", type: "prom", subCategory: "Kapasitas (6MWT)" },
      { id: "card-gj-prom-4", question: "Anda merasa mampu menjalani kehidupan yang bermakna meski dengan kondisi gagal jantung", type: "prom", subCategory: "Kesejahteraan" },
      { id: "card-gj-prom-5", question: "Anda mampu naik satu tingkat tangga tanpa merasa kelelahan atau sesak napas yang hebat", type: "prom", subCategory: "Aktivitas" },
      { id: "card-gj-prom-6", question: "Kualitas tidur anda membaik dan tidak terbangun karena sesak di malam hari", type: "prom", subCategory: "Kualitas Tidur" },
      { id: "card-gj-prom-7", question: "Anda mampu mematuhi pembatasan asupan cairan sesuai rekomendasi dokter", type: "prom", subCategory: "Disiplin Cairan" },
      { id: "card-gj-prom-8", question: "Anda memahami kegunaan setiap obat jantung yang telah diresepkan untuk anda", type: "prom", subCategory: "Literasi Obat" },
      { id: "card-gj-prom-9", question: "Anda merasa lebih berenergi untuk melakukan hobi ringan di rumah", type: "prom", subCategory: "Vitalitas" },
      { id: "card-gj-prom-10", question: "Secara keseluruhan, apakah kondisi jantung Anda terasa lebih stabil saat ini", type: "prom", subCategory: "Outcome Global" },
    ],
  },
];

// ============ NEUROLOGI ============
const neurologyRsbkItems: RsbkItem[] = [
  // SDM - DPJP
  { id: "sdm-sp-n", name: "Sp. N / Sp. N fellowship Neurointervensi vaskular", category: "sdm", subCategory: "DPJP", target: 5, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-pd", name: "Sp. PD", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-a", name: "Sp. A", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-bs-vaskular", name: "Sp. B / Sp. BS / Sp. BS Fellow Vaskular / Subs Bedah Saraf Vaskular", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-n-subs", name: "Sp. N Subs/Fellow Neurobehaviour / Geriatri / Neurogenetika", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-n-infeksi", name: "Sp. N Subs/Fellow Neuroinfeksi / Imunologi / Traumatologi", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-n-onkologi", name: "Sp. N / Sp. BS Subs/Fellow Neuro-Onkologi", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-n-pediatri", name: "Sp. N Subs Neuropediatri / Sp. BS Bedah Saraf Pediatrik", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-n-restorasi", name: "Sp. N Subs Neurorestorasi dan Neuroengineering", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-n-nyeri", name: "Sp. N Subs/Fellow Nyeri dan Nyeri Kepala", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-n-neuroftalmologi", name: "Sp. N Subs Neurootologi-Neurooftalmologi", category: "sdm", subCategory: "DPJP", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-bs-fungsional", name: "Sp. BS Fellowship Bedah Saraf Fungsional / Spine / Neurospine", category: "sdm", subCategory: "DPJP", target: 2, pointPerUnit: 1, inputUnit: "orang" },

  // SDM - Spesialis Lain
  { id: "sdm-sp-pk", name: "Sp. PK / Sp. PK (Sub)", category: "sdm", subCategory: "Spesialis Lain", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-rad", name: "Sp. Rad / Sp. Rad Fellow Neuroradiologi / Rad Subs Radiologi intervensi", category: "sdm", subCategory: "Spesialis Lain", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-an", name: "Sp. An (Sub Intensif Care / Neuroanestesi / KIC)", category: "sdm", subCategory: "Spesialis Lain", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-kfr", name: "Sp. KFR / Sp. KFR Subs Rehabilitasi Neuromuskuler", category: "sdm", subCategory: "Spesialis Lain", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-gk", name: "Sp. GK", category: "sdm", subCategory: "Spesialis Lain", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sp-pa", name: "Sp. PA", category: "sdm", subCategory: "Spesialis Lain", target: 1, pointPerUnit: 1, inputUnit: "orang" },

  // Sarana - Kapasitas Bed (1 bed = 1 poin)
  { id: "sarana-stroke-bed", name: "Unit Stroke (Stroke Unit)", category: "sarana", subCategory: "Kapasitas Bed", target: 10, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-hcu-bed", name: "HCU (Neurologi)", category: "sarana", subCategory: "Kapasitas Bed", target: 8, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-icu-bed", name: "ICU (Neuro-Intensive Care)", category: "sarana", subCategory: "Kapasitas Bed", target: 5, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-picu-nicu-bed", name: "PICU / NICU (Khusus Neuro)", category: "sarana", subCategory: "Kapasitas Bed", target: 2, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-rawatinap-bed", name: "Ruang Rawat Inap Biasa (Khusus Neuro)", category: "sarana", subCategory: "Kapasitas Bed", target: 20, pointPerUnit: 1, inputUnit: "bed" },
  
  // Sarana - Ruangan Khusus (1 ruangan = 5 poin)
  { id: "sarana-eeg", name: "Ruang EEG", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-cathlab", name: "Ruang Cathlab", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-ok", name: "Ruang Operasi Bedah Saraf", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-mri-ct", name: "Ruang MRI/CT", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },

  // Alat Medis Dasar & Madya
  { id: "alat-mikroskop", name: "Mikroskop", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-hematoanalyzer", name: "Hematoanalyzer / Chemical Analyzer", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-fotometer", name: "Fotometer/Spektrofotometer", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-xray", name: "X-Ray", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-usg", name: "USG", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-funduscopy", name: "Funduscopy", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-palu_percussor", name: "Palu Percussor (Reflex hammer)", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-garpu_tala", name: "Tuning Fork (Garpu Tala)", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-tcd", name: "Transcranial Doppler (TCD)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-usg_doppler", name: "USG Doppler (carotid/CDU)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ct_64", name: "CT Scan (64 Slice)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-cathlab", name: "Cathlab", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-set_biopsi", name: "Set Biopsi", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-set_kraniotomi", name: "Set Kraniotomi / Laminektomi", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-high_speed_drill", name: "High Speed Drill (BOR Highspeed)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },

  // Alat Medis Utama & Paripurna
  { id: "alat-immunoanalyzer", name: "Immunoanalyzer / Alkes Patologi Anatomi", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-flowcytometer", name: "Flowcytometer", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-qpcr", name: "qPCR (Real-Time PCR)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ct_128", name: "CT Scan (128/256 Slice)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-mri_15_3", name: "MRI (1.5 - 3 Tesla)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-c_arm", name: "C-Arm", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-eeg", name: "Electroencephalograph (EEG)/Video EEG / Long Term EEG", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-emg", name: "Elektromyogram (EMG), Evoke Potential, Neurostimulator", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-usg_muskuloskeletal", name: "Ultrasonography Muskuloskeletal", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-radiofrequency", name: "Radiofrequency Lesion Generator", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-set_microneurosurgery", name: "Set Microneurosurgery / Mikroskop Bedah Saraf", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-cathlab_biplane", name: "Cathlab Biplane", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-neurofisiologi", name: "Intraoperatif neurofisiologi Monitoring", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-stereotaxic", name: "Stereotaxic instrument (Neuronavigasi) / Set Bedah Saraf Stereotaxy", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-neuro_endoscope", name: "Neurological Endoscope", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-icp", name: "Intracranial Pressure Monitoring Device", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },

  // ASPEK KEPERAWATAN (SIAP PERSI)
  { id: "sdm-ners-spkmb-neuro", name: "Ners Sp.KMB (Medikal Bedah)", category: "sdm", subCategory: "Keperawatan", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-ners-cert-neuro", name: "Ners dan Sertifikasi/Fellowship Neurologi", category: "sdm", subCategory: "Keperawatan", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-ners-neuro-total", name: "Jumlah Ners", category: "sdm", subCategory: "Keperawatan", target: 10, pointPerUnit: 0, inputUnit: "orang" },
  { id: "sdm-perawat-d3-neuro", name: "Jumlah Perawat D3", category: "sdm", subCategory: "Keperawatan", target: 10, pointPerUnit: 0, inputUnit: "orang" },
];

const neurologyDiseases: DiseaseAudit[] = [
  {
    diseaseName: "Stroke Perdarahan",
    weight: "50%",
    questions: [
      { id: "neuro-sp-1", question: "Dilakukan pemeriksaan CT scan 30 menit sejak masuk RS", category: "Diagnosa (25%)" },
      { id: "neuro-sp-2", question: "Dilakukan skrining disphagia (GUSS score) dalam waktu 24 jam pertama", category: "Diagnosa (25%)" },
      { id: "neuro-sp-3", question: "Dilakukan penurunan tekanan darah secara aktif dengan IV short-acting antihypertensive kecuali perdarahan kurang dari 30cc atau SBP awal >220 mmHg", category: "Tatalaksana (25%)" },
      { id: "neuro-sp-4", question: "Dilakukan tindakan pembedahan kranial pada pasien dengan perdarahan supratentorial dalam waktu <24 jam kecuali tidak memenuhi kriteria klinis dan radiologis", category: "Tatalaksana (25%)" },
      { id: "neuro-sp-nurse-1", question: "Memposisikan pasien dengan elevasi 15-30 derajat dan posisi miring kanan-kiri lateral 30° setiap 2 jam sekali oleh perawat", category: "Tatalaksana (25%)" },
      { id: "neuro-sp-5", question: "Tidak meninggal dunia", category: "Outcome (50%)" },
      { id: "neuro-sp-6", question: "SBP <140 mmHg dalam 1 jam pertama sejak kedatangan kecuali SBP awal >220 mmHg", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "neuro-pd-prem-1", question: "Dokter menjelaskan kondisi perdarahan/penyumbatan otak dan rencana tindakan dengan bahasa yang mudah dipahami", type: "prem", subCategory: "Komunikasi" },
      { id: "neuro-pd-prem-2", question: "Staf icu/stroke unit merespons dengan cepat saat terjadi perubahan kesadaran atau kondisi memburuk", type: "prem", subCategory: "Responsivitas" },
      { id: "neuro-pd-prem-3", question: "Program fisioterapi dan terapi wicara dimulai sejak dini selama anda dirawat", type: "prem", subCategory: "Rehabilitasi" },
      { id: "neuro-pd-prem-4", question: "Perawat neurologi memberikan penanganan nyeri kepala dengan cepat dan tepat", type: "prem", subCategory: "Manajemen Nyeri" },
      { id: "neuro-pd-prem-5", question: "Anda dan keluarga mendapat edukasi komprehensif tentang rehabilitasi pasca stroke", type: "prem", subCategory: "Edukasi" },
      { id: "neuro-pd-prem-6", question: "Tim medis mendengarkan kekhawatiran keluarga dengan serius dan memberikan jawaban yang memuaskan", type: "prem", subCategory: "Empati" },
      { id: "neuro-pd-prem-7", question: "Dokter menjelaskan risiko stroke berulang dan upaya pencegahannya secara detail", type: "prem", subCategory: "Pencegahan" },
      { id: "neuro-pd-prem-8", question: "Fasilitas stroke unit (alat monitor, kebersihan) mendukung keamanan anda", type: "prem", subCategory: "Lingkungan" },
      { id: "neuro-pd-prem-9", question: "Proses administrasi perpanjangan rawat atau rujukan berjalan lancar", type: "prem", subCategory: "Administrasi" },
      { id: "neuro-pd-prem-10", question: "Secara keseluruhan, seberapa puas Anda dengan layanan Stroke Unit ini", type: "prem", subCategory: "Kepuasan Global" },
      { id: "neuro-pd-prem-nurse", question: "Perawat mengedukasi cara melakukan bantuan aktivitas sehari-hari pada pasien dan/keluarga", type: "prem", subCategory: "Aspek Keperawatan" },
    ],
    promQuestions: [
      { id: "neuro-pd-prom-1", question: "Anda mampu melakukan aktivitas harian dasar (makan, higiene) secara mandiri atau dengan bantuan minimal", type: "prom", subCategory: "Fisik (Barthel)" },
      { id: "neuro-pd-prom-2", question: "Kekuatan anggota gerak anda membaik dibandingkan saat pertama masuk rs", type: "prom", subCategory: "Motorik (NIHSS)" },
      { id: "neuro-pd-prom-3", question: "Anda mampu berkomunikasi (berbicara/menulis) dengan orang lain secara efektif", type: "prom", subCategory: "Bahasa" },
      { id: "neuro-pd-prom-4", question: "Tingkat nyeri kepala anda sudah dapat dikendalikan saat ini", type: "prom", subCategory: "Kontrol Nyeri" },
      { id: "neuro-pd-prom-5", question: "Anda mampu menelan makanan/minuman dengan aman tanpa risiko tersedak", type: "prom", subCategory: "Menelan (GUSS)" },
      { id: "neuro-pd-prom-6", question: "Anda merasa siap dan percaya diri dalam merawat diri sendiri atau dirawat keluarga di rumah nanti", type: "prom", subCategory: "Kesiapan" },
      { id: "neuro-pd-prom-7", question: "Anda mampu berpindah dari tempat tidur ke kursi secara mandiri (walau perlahan)", type: "prom", subCategory: "Mobilitas" },
      { id: "neuro-pd-prom-8", question: "Anda merasa suasana hati anda lebih stabil dan tidak mudah cemas", type: "prom", subCategory: "Psikologis" },
      { id: "neuro-pd-prom-9", question: "Daya ingat atau konsentrasi anda terasa membaik selama perawatan", type: "prom", subCategory: "Kognitif" },
      { id: "neuro-pd-prom-10", question: "Secara keseluruhan, apakah pemulihan Anda berjalan sesuai harapan Anda", type: "prom", subCategory: "Outcome Global" },
      { id: "neuro-pd-prom-nurse", question: "Kemampuan perawatan diri dan mobilisasi dengan keterbatasan meningkat", type: "prom", subCategory: "Aspek Keperawatan" },
    ],
  },
  {
    diseaseName: "Stroke Iskemik",
    weight: "50%",
    questions: [
      { id: "neuro-si-1", question: "Dilakukan pemeriksaan CT scan 30 menit sejak masuk RS", category: "Diagnosa (25%)" },
      { id: "neuro-si-2", question: "Dilakukan pemeriksaan gula darah sewaktu saat masuk", category: "Diagnosa (25%)" },
      { id: "neuro-si-3", question: "Diberikan trombolisis dengan rtPA (Alteplase) dosis 0,9 mg/kg atau 0.6 mg/kg kecuali onset > 4 jam", category: "Tatalaksana (25%)" },
      { id: "neuro-si-4", question: "Diberikan antiplatelets dan/atau antikoagulan", category: "Tatalaksana (25%)" },
      { id: "neuro-si-nurse-1", question: "Memposisikan pasien dengan elevasi 15-30 derajat dan posisi miring kanan-kiri lateral 30° setiap 2 jam sekali oleh perawat", category: "Tatalaksana (25%)" },
      { id: "neuro-si-nurse-2", question: "Dilakukan pemantauan neurologis berkala (GCS/pupil) oleh perawat", category: "Diagnosa (25%)" },
      { id: "neuro-si-5", question: "Tidak meninggal dunia", category: "Outcome (50%)" },
      { id: "neuro-si-6", question: "LOS < 7 hari kecuali ada komplikasi", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "neuro-si-prem-1", question: "Dokter menjelaskan kondisi perdarahan/penyumbatan otak dan rencana tindakan dengan bahasa yang mudah dipahami", type: "prem", subCategory: "Komunikasi" },
      { id: "neuro-si-prem-2", question: "Staf icu/stroke unit merespons dengan cepat saat terjadi perubahan kesadaran atau kondisi memburuk", type: "prem", subCategory: "Responsivitas" },
      { id: "neuro-si-prem-3", question: "Program fisioterapi dan terapi wicara dimulai sejak dini selama anda dirawat", type: "prem", subCategory: "Rehabilitasi" },
      { id: "neuro-si-prem-4", question: "Perawat neurologi memberikan penanganan nyeri kepala dengan cepat dan tepat", type: "prem", subCategory: "Manajemen Nyeri" },
      { id: "neuro-si-prem-5", question: "Anda dan keluarga mendapat edukasi komprehensif tentang rehabilitasi pasca stroke", type: "prem", subCategory: "Edukasi" },
      { id: "neuro-si-prem-6", question: "Tim medis mendengarkan kekhawatiran keluarga dengan serius dan memberikan jawaban yang memuaskan", type: "prem", subCategory: "Empati" },
      { id: "neuro-si-prem-7", question: "Dokter menjelaskan risiko stroke berulang dan upaya pencegahannya secara detail", type: "prem", subCategory: "Pencegahan" },
      { id: "neuro-si-prem-8", question: "Fasilitas stroke unit (alat monitor, kebersihan) mendukung keamanan anda", type: "prem", subCategory: "Lingkungan" },
      { id: "neuro-si-prem-9", question: "Proses administrasi perpanjangan rawat atau rujukan berjalan lancar", type: "prem", subCategory: "Administrasi" },
      { id: "neuro-si-prem-10", question: "Secara keseluruhan, seberapa puas Anda dengan layanan Stroke Unit ini", type: "prem", subCategory: "Kepuasan Global" },
      { id: "neuro-si-prem-nurse", question: "Perawat mengedukasi cara melakukan bantuan aktivitas sehari-hari pada pasien dan/keluarga", type: "prem", subCategory: "Aspek Keperawatan" },
    ],
    promQuestions: [
      { id: "neuro-si-prom-1", question: "Anda mampu melakukan aktivitas harian dasar (makan, higiene) secara mandiri atau dengan bantuan minimal", type: "prom", subCategory: "Fisik (Barthel)" },
      { id: "neuro-si-prom-2", question: "Kekuatan anggota gerak anda membaik dibandingkan saat pertama masuk rs", type: "prom", subCategory: "Motorik (NIHSS)" },
      { id: "neuro-si-prom-3", question: "Anda mampu berkomunikasi (berbicara/menulis) dengan orang lain secara efektif", type: "prom", subCategory: "Bahasa" },
      { id: "neuro-si-prom-4", question: "Tingkat nyeri kepala anda sudah dapat dikendalikan saat ini", type: "prom", subCategory: "Kontrol Nyeri" },
      { id: "neuro-si-prom-5", question: "Anda mampu menelan makanan/minuman dengan aman tanpa risiko tersedak", type: "prom", subCategory: "Menelan (GUSS)" },
      { id: "neuro-si-prom-6", question: "Anda merasa siap dan percaya diri dalam merawat diri sendiri atau dirawat keluarga di rumah nanti", type: "prom", subCategory: "Kesiapan" },
      { id: "neuro-si-prom-7", question: "Anda mampu berpindah dari tempat tidur ke kursi secara mandiri (walau perlahan)", type: "prom", subCategory: "Mobilitas" },
      { id: "neuro-si-prom-8", question: "Anda merasa suasana hati anda lebih stabil dan tidak mudah cemas", type: "prom", subCategory: "Psikologis" },
      { id: "neuro-si-prom-9", question: "Daya ingat atau konsentrasi anda terasa membaik selama perawatan", type: "prom", subCategory: "Kognitif" },
      { id: "neuro-si-prom-10", question: "Secara keseluruhan, apakah pemulihan Anda berjalan sesuai harapan Anda", type: "prom", subCategory: "Outcome Global" },
      { id: "neuro-si-prom-nurse", question: "Kemampuan perawatan diri dan mobilisasi dengan keterbatasan meningkat", type: "prom", subCategory: "Aspek Keperawatan" },
    ],
  },
];

// ============ ONKOLOGI ============
const oncologyRsbkItems: RsbkItem[] = [
  // SDM - DPJP Utama (Total Target SDM: 12)
  { id: "sdm-spb-onk", name: "Sp.B (K) Onkologi", category: "sdm", subCategory: "DPJP Utama", target: 3, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sppd-khom", name: "Sp.PD-KHOM (Hematologi Onkologi Medik)", category: "sdm", subCategory: "DPJP Utama", target: 3, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sponkrad", name: "Sp.Onk.Rad (Onkologi Radiasi)", category: "sdm", subCategory: "DPJP Utama", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  // SDM - Penunjang Khusus
  { id: "sdm-sppa", name: "Sp.PA (Patologi Anatomi)", category: "sdm", subCategory: "Penunjang Khusus", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sppk", name: "Sp.PK (Patologi Klinik)", category: "sdm", subCategory: "Penunjang Khusus", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-spread", name: "Sp.Rad (Radiologi)", category: "sdm", subCategory: "Penunjang Khusus", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  // Sarana - Kapasitas Bed (1 bed/chair = 1 poin, Total Target Bed: 58 Poin)
  { id: "sarana-kemo-bed", name: "Ruang Kemoterapi (One Day Care)", category: "sarana", subCategory: "Kapasitas Bed", target: 20, pointPerUnit: 1, inputUnit: "bed/chair" },
  { id: "sarana-isolasi-bed", name: "Ruang Isolasi Neutropenia (Neutropenic Ward)", category: "sarana", subCategory: "Kapasitas Bed", target: 8, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-hcu-icu-bed", name: "HCU / ICU (Onkologi)", category: "sarana", subCategory: "Kapasitas Bed", target: 5, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-rawatinap-bed", name: "Ruang Rawat Inap Biasa (Onkologi)", category: "sarana", subCategory: "Kapasitas Bed", target: 25, pointPerUnit: 1, inputUnit: "bed" },
  // Sarana - Ruangan Khusus (1 ruangan = 5 poin)
  { id: "sarana-bunker", name: "Bunker Radioterapi", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-aseptik", name: "Ruang Aseptik Dispensing", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  // Alat Medis
  { id: "alat-mammografi", name: "Mammografi", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-linac", name: "LINAC (Linear Accelerator)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-brakhiterapi", name: "Brachiterapi", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-pet-ct", name: "PET-CT", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-usg-biopsi", name: "USG Biopsi", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ct-sim", name: "CT Simulator", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-mri", name: "MRI", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },

  // ASPEK KEPERAWATAN (SIAP PERSI)
  { id: "sdm-ners-sp-onk", name: "Ners Sp.Kep Onkologi", category: "sdm", subCategory: "Keperawatan", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-ners-cert-onk", name: "Ners dan Sertifikasi/Fellowship Onkologi", category: "sdm", subCategory: "Keperawatan", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-ners-onk-total", name: "Jumlah Ners", category: "sdm", subCategory: "Keperawatan", target: 10, pointPerUnit: 0, inputUnit: "orang" },
  { id: "sdm-perawat-d3-onk", name: "Jumlah Perawat D3", category: "sdm", subCategory: "Keperawatan", target: 10, pointPerUnit: 0, inputUnit: "orang" },
];

const oncologyDiseases: DiseaseAudit[] = [
  {
    diseaseName: "CA Mammae (Kanker Payudara)",
    weight: "50%",
    questions: [
      { id: "onc-py-1", question: "Dilakukan penetapan stadium cTNM sebelum pengobatan", category: "Diagnosa (25%)" },
      { id: "onc-py-2", question: "Dilakukan pemeriksaan imunohistokimia: ER, PR, HER2, dan Ki67", category: "Diagnosa (25%)" },
      { id: "onc-py-3", question: "Dilakukan mastektomi (bila diindikasi) < 5 minggu sejak diagnosis", category: "Tatalaksana (25%)" },
      { id: "onc-py-4", question: "Diberikan kemoterapi regimen standar (CMF/CAF/CEF/Taxane) sesuai subtipe", category: "Tatalaksana (25%)" },
      { id: "onc-py-nurse-1", question: "Dilakukan asesmen nyeri dan manajemen nyeri non farmakologi serta terapi psikososial oleh perawat", category: "Tatalaksana (25%)" },
      { id: "onc-py-nurse-2", question: "Tidak terjadi ekstravasasi (kondisi kebocoran obat kemoterapi dari pembuluh darah vena ke jaringan sekitar yang sehat selama infus intravena)", category: "Outcome (50%)" },
      { id: "onc-py-5", question: "Pasien tidak mengalami limfedema berat pada sisi operasi", category: "Outcome (50%)" },
      { id: "onc-py-6", question: "Pasien menjalani follow-up rutin pasca operasi", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "onc-py-prem-1", question: "Dokter menjelaskan stadium kanker dan pilihan pengobatan (operasi, kemoterapi, hormonal) dengan jelas", type: "prem", subCategory: "Komunikasi" },
      { id: "onc-py-prem-2", question: "Staf medis menangani nyeri pasca operasi dan efek samping kemoterapi anda dengan responsivitas", type: "prem", subCategory: "Responsivitas" },
      { id: "onc-py-prem-3", question: "Anda mendapat dukungan psikologis yang memadai selama proses pengobatan", type: "prem", subCategory: "Dukungan Psikologi" },
      { id: "onc-py-prem-4", question: "Anda merasa mudah mendapatkan jadwal kemoterapi, radioterapi, dan kontrol pasca operasi", type: "prem", subCategory: "Akses" },
      { id: "onc-py-prem-5", question: "Anda mendapat layanan konseling nutrisi untuk mencegah penurunan berat badan selama terapi", type: "prem", subCategory: "Nutrisi" },
      { id: "onc-py-prem-6", question: "Perawat memberikan edukasi yang jelas tentang perawatan luka operasi di rumah", type: "prem", subCategory: "Edukasi Luka" },
      { id: "onc-py-prem-7", question: "Anda merasa tim medis sangat menghargai privasi anda selama perawatan", type: "prem", subCategory: "Privasi" },
      { id: "onc-py-prem-8", question: "Ketersediaan ruang tunggu dan fasilitas rumah sakit membuat anda merasa nyaman", type: "prem", subCategory: "Fasilitas" },
      { id: "onc-py-prem-9", question: "Staf administrasi membantu mempermudah proses klaim untuk terapi jangka panjang", type: "prem", subCategory: "Administrasi" },
      { id: "onc-py-prem-10", question: "Secara keseluruhan, seberapa puas Anda dengan kualitas layanan onkologi ini", type: "prem", subCategory: "Kepuasan Global" },
      { id: "onc-py-prem-nurse", question: "Perawat memberikan kenyamanan saat merawat dengan pendekatan psikologis dan budaya", type: "prem", subCategory: "Aspek Keperawatan" },
    ],
    promQuestions: [
      { id: "onc-py-prom-1", question: "Anda mampu melakukan aktivitas sehari-hari secara mandiri pasca operasi mastektomi", type: "prom", subCategory: "Fisik (EORTC)" },
      { id: "onc-py-prom-2", question: "Keterbatasan gerak dan nyeri pada lengan di sisi operasi sudah berkurang bermakna", type: "prom", subCategory: "Gerak Lengan" },
      { id: "onc-py-prom-3", question: "Anda merasa nyaman dengan perubahan fisik anda pasca operasi dan terapi (citra tubuh)", type: "prom", subCategory: "Citra Tubuh" },
      { id: "onc-py-prom-4", question: "Anda tidak mengalami mual-muntah berat yang mengganggu aktivitas saat menjalani kemoterapi", type: "prom", subCategory: "Toleransi Kemo" },
      { id: "onc-py-prom-5", question: "Tingkat kelelahan (fatigue) anda dapat dikelola dan membaik dari sebelumnya", type: "prom", subCategory: "Fatigue" },
      { id: "onc-py-prom-6", question: "Rasa nyeri pada area dada/bekas operasi sudah bisa diabaikan saat beraktivitas", type: "prom", subCategory: "Nyeri Sisa" },
      { id: "onc-py-prom-7", question: "Anda merasa kulit di area radiasi atau operasi sudah mulai pulih kembali", type: "prom", subCategory: "Pemulihan Kulit" },
      { id: "onc-py-prom-8", question: "Nafsu makan anda tetap baik selama masa pemulihan", type: "prom", subCategory: "Nafsu Makan" },
      { id: "onc-py-prom-9", question: "Anda merasa optimis terhadap hasil akhir dari seluruh rangkaian pengobatan ini", type: "prom", subCategory: "Optimisme" },
      { id: "onc-py-prom-10", question: "Secara keseluruhan, apakah Anda merasa kualitas hidup Anda membaik", type: "prom", subCategory: "Status Global" },
      { id: "onc-py-prom-nurse", question: "Nyeri saya berkurang dan nyaman setelah Latihan nafas dalam", type: "prom", subCategory: "Aspek Keperawatan" },
    ],
  },
  {
    diseaseName: "CA Serviks (Kanker Serviks)",
    weight: "50%",
    questions: [
      { id: "onc-sv-1", question: "Dilakukan penentuan diagnosis berdasarkan klasifikasi stadium dan histologi", category: "Diagnosa (25%)" },
      { id: "onc-sv-2", question: "Dilakukan pemeriksaan imaging (MRI/CT) untuk penentuan penyebaran parametrium", category: "Diagnosa (25%)" },
      { id: "onc-sv-3", question: "Dilakukan operasi (IA1-IIA2) atau Radioterapi/Kemoradiasi (stadium lanjut/risiko tinggi)", category: "Tatalaksana (25%)" },
      { id: "onc-sv-4", question: "Diberikan Kemoradiasi dengan cisplatin mingguan (untuk stadium lanjut lokal)", category: "Tatalaksana (25%)" },
      { id: "onc-sv-nurse-1", question: "Dilakukan asesmen nyeri dan manajemen nyeri non farmakologi serta terapi psikososial oleh perawat", category: "Tatalaksana (25%)" },
      { id: "onc-sv-nurse-2", question: "Tidak terjadi ekstravasasi (kondisi kebocoran obat kemoterapi dari pembuluh darah vena ke jaringan sekitar yang sehat selama infus intravena)", category: "Outcome (50%)" },
      { id: "onc-sv-5", question: "Status ECOG Performance Status saat pulang adalah 0-2", category: "Outcome (50%)" },
      { id: "onc-sv-6", question: "Nyeri terkendali dengan analgetik oral (skala nyeri < 3)", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "onc-sv-prem-1", question: "Anda mendapat informasi detail tentang efek jangka panjang pengobatan pada fungsi reproduksi dan kandung kemih", type: "prem", subCategory: "Informasi" },
      { id: "onc-sv-prem-2", question: "Privasi dan martabat anda selalu dijaga selama pemeriksaan dan prosedur ginekologi", type: "prem", subCategory: "Privasi" },
      { id: "onc-sv-prem-3", question: "Petugas medis memberikan empati dan dukungan emosional yang anda butuhkan", type: "prem", subCategory: "Dukungan Emosi" },
      { id: "onc-sv-prem-4", question: "Dokter menjelaskan hasil biopsi atau radiologi dengan cara yang menenangkan namun jujur", type: "prem", subCategory: "Komunikasi" },
      { id: "onc-sv-prem-5", question: "Anda merasa waktu tunggu untuk prosedur radioterapi atau brakiterapi sudah masuk akal", type: "prem", subCategory: "Waktu Tunggu" },
      { id: "onc-sv-prem-6", question: "Perawat membantu meredakan kecemasan anda sebelum prosedur tindakan ginekologi", type: "prem", subCategory: "Manajemen Cemas" },
      { id: "onc-sv-prem-7", question: "Anda mendapat informasi tentang kelompok pendukung (support group) penyintas kanker", type: "prem", subCategory: "Support Group" },
      { id: "onc-sv-prem-8", question: "Kebersihan toilet dan ruang perawatan di bangsal onkologi terjaga sangat baik", type: "prem", subCategory: "Fasilitas" },
      { id: "onc-sv-prem-9", question: "Dokter menanyakan keluhan-keluhan lain di luar penyakit utama anda", type: "prem", subCategory: "Perhatian Holistik" },
      { id: "onc-sv-prem-10", question: "Secara keseluruhan, seberapa puas Anda dengan kualitas layanan onkologi serviks di RS ini", type: "prem", subCategory: "Kepuasan Global" },
      { id: "onc-sv-prem-nurse", question: "Perawat memberikan kenyamanan saat merawat dengan pendekatan psikologis dan budaya", type: "prem", subCategory: "Aspek Keperawatan" },
    ],
    promQuestions: [
      { id: "onc-sv-prom-1", question: "Anda tidak mengalami gangguan berkemih bermakna (beser/ompol) pasca tindakan", type: "prom", subCategory: "Fungsi Kemih" },
      { id: "onc-sv-prom-2", question: "Anda tidak mengalami gangguan pencernaan bermakna (diare/konstipasi) akibat kemoradiasi", type: "prom", subCategory: "Fungsi Cerna" },
      { id: "onc-sv-prom-3", question: "Nyeri pelvis anda sudah terkendali sehingga tidak mengganggu aktivitas harian", type: "prom", subCategory: "Kontrol Nyeri" },
      { id: "onc-sv-prom-4", question: "Anda merasa gejala perdarahan abnormal sudah berhenti sepenuhnya", type: "prom", subCategory: "Kontrol Gejala" },
      { id: "onc-sv-prom-5", question: "Anda sudah merasa mampu menjalankan peran anda kembali di rumah atau lingkungan kerja", type: "prom", subCategory: "Peran Sosial" },
      { id: "onc-sv-prom-6", question: "Fungsi seksual atau kenyamanan intim anda tidak menjadi beban pikiran yang berat bagi anda", type: "prom", subCategory: "Kesehatan Intim" },
      { id: "onc-sv-prom-7", question: "Tingkat konsentrasi dan daya ingat anda tetap baik selama masa pengobatan", type: "prom", subCategory: "Kognitif" },
      { id: "onc-sv-prom-8", question: "Berat badan anda cenderung stabil atau mulai menunjukkan peningkatan", type: "prom", subCategory: "Nutrisi" },
      { id: "onc-sv-prom-9", question: "Anda merasa pengobatan ini memberikan harapan kesembuhan yang nyata bagi anda", type: "prom", subCategory: "Harapan" },
      { id: "onc-sv-prom-10", question: "Secara keseluruhan, apakah Anda merasa kondisi kesehatan Anda sudah membaik", type: "prom", subCategory: "Status Global" },
      { id: "onc-sv-prom-nurse", question: "Nyeri saya berkurang dan nyaman setelah Latihan nafas dalam (dipandu perawat)", type: "prom", subCategory: "Aspek Keperawatan" },
    ],
  },
];

// ============ EXPORTED DATA ============
export const specialtyAuditData: Record<string, SpecialtyData> = {
  cardiology: {
    name: "Kardiologi",
    nameEn: "Cardiology",
    disease: "STEMI & Gagal Jantung",
    diseases: cardiologyDiseases,
    medicalStaff: [
      { code: "Sp.JP", name: "Dokter Spesialis Jantung dan Pembuluh Darah" },
      { code: "Sp.BTKV", name: "Dokter Spesialis Bedah Toraks Kardiovaskular" },
      { code: "Sp.PD", name: "Dokter Spesialis Penyakit Dalam" },
      { code: "Sp.An", name: "Dokter Spesialis Anestesi" },
      { code: "Sp.Rad", name: "Dokter Spesialis Radiologi" },
    ],
    rsbkItems: cardiologyRsbkItems,
    auditQuestions: cardiologyDiseases.flatMap(d => d.questions),
    premQuestions: cardiologyDiseases.flatMap(d => d.premQuestions),
    promQuestions: cardiologyDiseases.flatMap(d => d.promQuestions),
  },
  neurology: {
    name: "Neurologi",
    nameEn: "Neurology",
    disease: "Stroke Perdarahan & Stroke Iskemik",
    diseases: neurologyDiseases,
    medicalStaff: [
      { code: "Sp.N", name: "Dokter Spesialis Neurologi" },
      { code: "Sp.BS", name: "Dokter Spesialis Bedah Saraf" },
      { code: "Sp.Rad", name: "Dokter Spesialis Radiologi" },
      { code: "Sp.PD", name: "Dokter Spesialis Penyakit Dalam" },
      { code: "Sp.An", name: "Dokter Spesialis Anestesi" },
    ],
    rsbkItems: neurologyRsbkItems,
    auditQuestions: neurologyDiseases.flatMap(d => d.questions),
    premQuestions: neurologyDiseases.flatMap(d => d.premQuestions),
    promQuestions: neurologyDiseases.flatMap(d => d.promQuestions),
  },
  oncology: {
    name: "Onkologi",
    nameEn: "Oncology",
    disease: "CA Mammae & CA Serviks",
    diseases: oncologyDiseases,
    medicalStaff: [
      { code: "Sp.PD-KHOM", name: "Sp.PD Konsultan Hematologi Onkologi Medik" },
      { code: "Sp.B-KOnk", name: "Sp.B Konsultan Onkologi" },
      { code: "Sp.Onk.Rad", name: "Sp.Onkologi Radiasi" },
      { code: "Sp.PA", name: "Dokter Spesialis Patologi Anatomi" },
      { code: "Sp.Rad", name: "Dokter Spesialis Radiologi" },
    ],
    rsbkItems: oncologyRsbkItems,
    auditQuestions: oncologyDiseases.flatMap(d => d.questions),
    premQuestions: oncologyDiseases.flatMap(d => d.premQuestions),
    promQuestions: oncologyDiseases.flatMap(d => d.promQuestions),
  },
};

// Backward compatibility - generic facilities (kept for legacy)
export const facilities = [
  { id: "icu", name: "ICU (Intensive Care Unit)" },
  { id: "hcu", name: "HCU (High Care Unit)" },
  { id: "operating-room", name: "Ruang Operasi" },
  { id: "isolation", name: "Ruang Isolasi" },
  { id: "emergency", name: "IGD (Instalasi Gawat Darurat)" },
  { id: "radiology", name: "Instalasi Radiologi" },
  { id: "laboratory", name: "Laboratorium Klinik" },
  { id: "pharmacy", name: "Instalasi Farmasi" },
];