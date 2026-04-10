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
  // SDM - DPJP Inti (Total Target SDM: 20)
  { id: "sdm-spjp", name: "Sp.JP (Jantung & Pembuluh Darah)", category: "sdm", subCategory: "DPJP Inti", target: 6, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sppd", name: "Sp.PD (Penyakit Dalam)", category: "sdm", subCategory: "DPJP Inti", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-spb", name: "Sp.B (Bedah)", category: "sdm", subCategory: "DPJP Inti", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-spa", name: "Sp.A (Anak)", category: "sdm", subCategory: "DPJP Inti", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  // SDM - Sub-Spesialis
  { id: "sdm-spjp-intervensi", name: "Sp.JP Sub/Fellow Kardio Intervensi", category: "sdm", subCategory: "Sub-Spesialis", target: 3, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sppdkkv", name: "Sp.PD-KKV (Kardiovaskular)", category: "sdm", subCategory: "Sub-Spesialis", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-spbtkv", name: "Sp.BTKV (Bedah Toraks Kardiovaskular)", category: "sdm", subCategory: "Sub-Spesialis", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-spa-kardio", name: "Sp.A Sub Kardio", category: "sdm", subCategory: "Sub-Spesialis", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  // SDM - Penunjang
  { id: "sdm-span", name: "Sp.An (Anestesi)", category: "sdm", subCategory: "Penunjang", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-spread", name: "Sp.Rad (Radiologi)", category: "sdm", subCategory: "Penunjang", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  // Sarana - Kapasitas Bed (1 bed = 1 poin, Total Target Bed: 59 Poin)
  { id: "sarana-iccu-bed", name: "ICCU (Intensive Cardiac Care Unit)", category: "sarana", subCategory: "Kapasitas Bed", target: 10, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-icu-bed", name: "ICU (General)", category: "sarana", subCategory: "Kapasitas Bed", target: 5, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-hcu-bed", name: "HCU (High Care Unit)", category: "sarana", subCategory: "Kapasitas Bed", target: 10, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-picu-nicu-bed", name: "PICU / NICU (Khusus Jantung Anak)", category: "sarana", subCategory: "Kapasitas Bed", target: 4, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-rawatinap-bed", name: "Ruang Rawat Inap Biasa (Khusus Jantung)", category: "sarana", subCategory: "Kapasitas Bed", target: 30, pointPerUnit: 1, inputUnit: "bed" },
  // Sarana - Ruangan Khusus (1 ruangan = 5 poin)
  { id: "sarana-cathlab", name: "Ruang Cathlab", category: "sarana", subCategory: "Ruangan Khusus", target: 2, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-ok-mayor", name: "Ruang Operasi Mayor", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  // Alat Medis
  { id: "alat-ekg", name: "EKG (Elektrokardiogram)", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-echo3d", name: "ECHO (3D)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-holter", name: "Holter Monitor", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-treadmill", name: "Treadmill", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ct", name: "CT Scan", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-mri", name: "MRI", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ivus", name: "IVUS (Intravascular Ultrasound)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-iabp", name: "IABP (Intra-aortic Balloon Pump)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-hlm", name: "Heart Lung Machine", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ecmo", name: "ECMO", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ventilator", name: "Ventilator", category: "alat", target: 4, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-bedside", name: "Bedside Monitor", category: "alat", target: 4, pointPerUnit: 1, inputUnit: "unit" },
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
      { id: "card-st-5", question: "Pasien tidak meninggal dunia di RS", category: "Outcome (50%)" },
      { id: "card-st-6", question: "LOS < 5 hari (kecuali kelas Killip III dan IV, atau mengalami Syok Kardiogenik)", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "card-st-prem-1", question: "Dokter menjelaskan rencana tindakan (Primary PCI/Trombolisis) dengan bahasa yang mudah dimengerti", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "card-st-prem-2", question: "Staf medis merespons dengan cepat saat saya mengalami nyeri dada atau gejala berulang di bangsal", type: "prem", subCategory: "Responsivitas (NHS PREM)" },
      { id: "card-st-prem-3", question: "Dokter dan perawat menghormati dan mendengarkan keluhan serta kekhawatiran saya", type: "prem", subCategory: "Penghormatan Pasien" },
      { id: "card-st-prem-4", question: "Staf medis memberi informasi yang cukup tentang kondisi jantung dan pengobatan saya", type: "prem", subCategory: "Pemberian Informasi" },
      { id: "card-st-prem-5", question: "Saya merasa terlibat dalam pengambilan keputusan prosedur kardiovaskular saya", type: "prem", subCategory: "Shared Decision Making" },
      { id: "card-st-prem-6", question: "Ruang perawatan jantung bersih, nyaman, dan kondusif untuk pemulihan", type: "prem", subCategory: "Lingkungan Perawatan" },
      { id: "card-st-prem-7", question: "Resep dan petunjuk penggunaan obat (antiplatelet, beta-blocker, statin) dijelaskan dengan jelas", type: "prem", subCategory: "Edukasi Farmasi" },
      { id: "card-st-prem-8", question: "Saya mendapat informasi yang jelas tentang jadwal kontrol dan tanda bahaya setelah pulang", type: "prem", subCategory: "Discharge Planning" },
      { id: "card-st-prem-9", question: "Proses administrasi (pendaftaran, pembiayaan, klaim BPJS) berjalan lancar dan tidak membebani", type: "prem", subCategory: "Administrasi" },
      { id: "card-st-prem-10", question: "Secara keseluruhan, saya puas dengan pengalaman perawatan di unit jantung ini", type: "prem", subCategory: "Kepuasan Global" },

    ],
    promQuestions: [
      { id: "card-st-prom-1", question: "Nyeri dada saya hilang atau berkurang signifikan setelah tindakan PCI/trombolisis", type: "prom", subCategory: "Gejala Kardiovaskular (KCCQ)" },
      { id: "card-st-prom-2", question: "Saya mampu berjalan setara 100 meter tanpa nyeri dada atau sesak napas", type: "prom", subCategory: "Kapasitas Fungsional (Duke Activity)" },
      { id: "card-st-prom-3", question: "Frekuensi sesak napas dalam 1 minggu terakhir sangat berkurang dibanding sebelum masuk RS", type: "prom", subCategory: "Gejala Residual" },
      { id: "card-st-prom-4", question: "Saya dapat melakukan aktivitas ringan sehari-hari (mandi, berpakaian) secara mandiri", type: "prom", subCategory: "Activities of Daily Living" },
      { id: "card-st-prom-5", question: "Kualitas tidur saya membaik sejak mendapat perawatan di rumah sakit", type: "prom", subCategory: "Kualitas Tidur (PSQI)" },
      { id: "card-st-prom-6", question: "Saya merasa tidak cemas berlebihan tentang kondisi jantung saya saat ini", type: "prom", subCategory: "Kesehatan Mental (PHQ-4)" },
      { id: "card-st-prom-7", question: "Saya memahami dan dapat mematuhi pengobatan jangka panjang (antiplatelet, statin, beta-blocker)", type: "prom", subCategory: "Kepatuhan Pengobatan" },
      { id: "card-st-prom-8", question: "Saya sudah menerapkan gaya hidup sehat (berhenti merokok, diet rendah lemak) sesuai anjuran dokter", type: "prom", subCategory: "Modifikasi Gaya Hidup" },
      { id: "card-st-prom-9", question: "Semangat dan motivasi hidup saya meningkat setelah mendapat perawatan yang baik", type: "prom", subCategory: "Kesejahteraan Psikologis (EQ-5D)" },
      { id: "card-st-prom-10", question: "Secara keseluruhan, kondisi kesehatan saya lebih baik dibandingkan saat pertama kali masuk RS", type: "prom", subCategory: "Status Kesehatan Global" },
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
      { id: "card-gj-5", question: "Pasien pulang dengan skor NYHA 1-2", category: "Outcome (50%)" },
      { id: "card-gj-6", question: "Tidak ada readmisi dalam waktu 30 hari setelah pasien pulang rawat", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "card-gj-prem-1", question: "Dokter menjelaskan penyakit gagal jantung dan rencana pengobatan dengan bahasa yang saya mengerti", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "card-gj-prem-2", question: "Staf medis merespons dengan segera ketika saya mengalami sesak napas mendadak", type: "prem", subCategory: "Responsivitas (NHS PREM)" },
      { id: "card-gj-prem-3", question: "Saya mendapat penjelasan tentang batasan cairan dan garam dalam diet harian saya", type: "prem", subCategory: "Edukasi Diet" },
      { id: "card-gj-prem-4", question: "Saya merasa dihormati dan diperlakukan dengan bermartabat oleh seluruh staf medis", type: "prem", subCategory: "Penghormatan Pasien" },
      { id: "card-gj-prem-5", question: "Keluarga saya dilibatkan dalam diskusi rencana pengobatan dan perawatan di rumah", type: "prem", subCategory: "Keterlibatan Keluarga" },
      { id: "card-gj-prem-6", question: "Saya mendapat informasi jelas tentang cara memantau berat badan harian dan gejala pemburukan", type: "prem", subCategory: "Self-Monitoring Edukasi" },
      { id: "card-gj-prem-7", question: "Fasilitas kamar rawat inap bersih, tenang, dan mendukung pemulihan saya", type: "prem", subCategory: "Lingkungan Perawatan" },
      { id: "card-gj-prem-8", question: "Proses pemulangan (discharge) terencana dengan baik dan tidak tergesa-gesa", type: "prem", subCategory: "Discharge Planning" },
      { id: "card-gj-prem-9", question: "Penanganan nyeri dan ketidaknyamanan saya dilakukan dengan baik selama perawatan", type: "prem", subCategory: "Manajemen Nyeri" },
      { id: "card-gj-prem-10", question: "Secara keseluruhan saya sangat puas dengan pelayanan di unit jantung ini", type: "prem", subCategory: "Kepuasan Global" },
    ],
    promQuestions: [
      { id: "card-gj-prom-1", question: "Sesak napas saya berkurang secara bermakna dibandingkan saat pertama masuk RS", type: "prom", subCategory: "Gejala Respirasi (KCCQ)" },
      { id: "card-gj-prom-2", question: "Pembengkakan kaki (edema) saya sudah berkurang atau hilang", type: "prom", subCategory: "Gejala Retensi Cairan" },
      { id: "card-gj-prom-3", question: "Saya dapat berjalan di dalam ruangan tanpa harus berhenti akibat sesak napas", type: "prom", subCategory: "Kapasitas Fungsional (6MWT)" },
      { id: "card-gj-prom-4", question: "Saya mampu melakukan aktivitas harian dasar (makan, berpakaian, higiene) secara mandiri", type: "prom", subCategory: "Activities of Daily Living" },
      { id: "card-gj-prom-5", question: "Kualitas tidur saya membaik sejak sesak napas berkurang", type: "prom", subCategory: "Kualitas Tidur" },
      { id: "card-gj-prom-6", question: "Saya tidak merasa cemas atau takut berlebihan tentang kondisi jantung saya", type: "prom", subCategory: "Kesehatan Mental (PHQ-4)" },
      { id: "card-gj-prom-7", question: "Saya memahami dan mampu mematuhi jadwal minum obat (diuretik, ACE-inhibitor, beta-blocker)", type: "prom", subCategory: "Kepatuhan Pengobatan (MMAS)" },
      { id: "card-gj-prom-8", question: "Saya sudah mengurangi asupan garam dan cairan sesuai rekomendasi dokter", type: "prom", subCategory: "Kepatuhan Diet" },
      { id: "card-gj-prom-9", question: "Kondisi kesehatan umum saya lebih baik dibanding sebelum masuk RS", type: "prom", subCategory: "Status Kesehatan Global (EQ-5D)" },
      { id: "card-gj-prom-10", question: "Saya merasa mampu menjalani kehidupan yang bermakna dan aktif meski dengan kondisi gagal jantung", type: "prom", subCategory: "Kesejahteraan Psikologis" },
    ],
  },
];

// ============ NEUROLOGI ============
const neurologyRsbkItems: RsbkItem[] = [
  // SDM - DPJP Inti (Total Target SDM: 15)
  { id: "sdm-spn", name: "Sp.N (Neurologi)", category: "sdm", subCategory: "DPJP Inti", target: 5, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-sppd", name: "Sp.PD (Penyakit Dalam)", category: "sdm", subCategory: "DPJP Inti", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-spa", name: "Sp.A (Anak)", category: "sdm", subCategory: "DPJP Inti", target: 1, pointPerUnit: 1, inputUnit: "orang" },
  // SDM - Sub-Spesialis
  { id: "sdm-spn-intervensi", name: "Sp.N Sub Neurovaskular/Intervensi", category: "sdm", subCategory: "Sub-Spesialis", target: 3, pointPerUnit: 1, inputUnit: "orang" },
  { id: "sdm-spbs-vaskular", name: "Sp.BS (Bedah Saraf) Vaskular", category: "sdm", subCategory: "Sub-Spesialis", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  // SDM - Penunjang
  { id: "sdm-span-neuro", name: "Sp.An (KIC/Neuroanestesi)", category: "sdm", subCategory: "Penunjang", target: 2, pointPerUnit: 1, inputUnit: "orang" },
  // Sarana - Kapasitas Bed (1 bed = 1 poin, Total Target Bed: 45 Poin)
  { id: "sarana-stroke-bed", name: "Unit Stroke (Stroke Unit)", category: "sarana", subCategory: "Kapasitas Bed", target: 10, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-hcu-bed", name: "HCU (Neurologi)", category: "sarana", subCategory: "Kapasitas Bed", target: 8, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-icu-bed", name: "ICU (Neuro-Intensive Care)", category: "sarana", subCategory: "Kapasitas Bed", target: 5, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-picu-nicu-bed", name: "PICU / NICU (Khusus Neuro)", category: "sarana", subCategory: "Kapasitas Bed", target: 2, pointPerUnit: 1, inputUnit: "bed" },
  { id: "sarana-rawatinap-bed", name: "Ruang Rawat Inap Biasa (Khusus Neuro)", category: "sarana", subCategory: "Kapasitas Bed", target: 20, pointPerUnit: 1, inputUnit: "bed" },
  // Sarana - Ruangan Khusus (1 ruangan = 5 poin)
  { id: "sarana-eeg", name: "Ruang EEG", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-cathlab", name: "Ruang Cathlab", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-ok", name: "Ruang Operasi", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  { id: "sarana-mri-ct", name: "Ruang MRI/CT", category: "sarana", subCategory: "Ruangan Khusus", target: 1, pointPerUnit: 5, inputUnit: "ruangan" },
  // Alat Medis
  { id: "alat-tcd", name: "Transcranial Doppler (TCD)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-ct", name: "CT Scan (256 Slice)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-mri", name: "MRI (3 Tesla)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-cathlab", name: "Cathlab Biplane", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-eeg", name: "EEG / Video EEG", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-emg", name: "EMG (Elektromiografi)", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-mikroskop", name: "Mikroskop Bedah Saraf", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-neuronavigasi", name: "Neuronavigasi", category: "alat", target: 1, pointPerUnit: 1, inputUnit: "unit" },
  { id: "alat-icp", name: "ICP Monitoring", category: "alat", target: 2, pointPerUnit: 1, inputUnit: "unit" },
];

const neurologyDiseases: DiseaseAudit[] = [
  {
    diseaseName: "Stroke Perdarahan",
    weight: "50%",
    questions: [
      { id: "neuro-sp-1", question: "Dilakukan pemeriksaan CT scan 30 menit sejak masuk RS", category: "Diagnosa (25%)" },
      { id: "neuro-sp-2", question: "Dilakukan skrining disfagia (GUSS score) dalam waktu 24 jam pertama", category: "Diagnosa (25%)" },
      { id: "neuro-sp-3", question: "Dilakukan penurunan tekanan darah secara aktif dengan IV short-acting antihypertensive (kecuali perdarahan kurang dari 30cc atau SBP awal >220 mmHg)", category: "Tatalaksana (25%)" },
      { id: "neuro-sp-4", question: "Dilakukan tindakan pembedahan kranial pada pasien dengan perdarahan supratentorial dalam waktu <24 jam (kecuali tidak memenuhi kriteria klinis dan radiologis)", category: "Tatalaksana (25%)" },
      { id: "neuro-sp-5", question: "Tidak meninggal dunia", category: "Outcome (50%)" },
      { id: "neuro-sp-6", question: "SBP <140 mmHg dalam 1 jam pertama sejak kedatangan (kecuali SBP awal >220 mmHg)", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "neuro-sp-prem-1", question: "Dokter menjelaskan kondisi perdarahan otak dan rencana tindakan dengan bahasa yang mudah dipahami keluarga", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "neuro-sp-prem-2", question: "Staf ICU/HCU merespons dengan cepat saat terjadi perubahan kesadaran atau kondisi memburuk", type: "prem", subCategory: "Responsivitas (NHS PREM)" },
      { id: "neuro-sp-prem-3", question: "Keluarga saya dilibatkan dalam setiap keputusan tindakan medis penting (operasi, monitoring ICP)", type: "prem", subCategory: "Keterlibatan Keluarga" },
      { id: "neuro-sp-prem-4", question: "Ruang perawatan intensif bersih, steril, dan kondusif untuk pemulihan", type: "prem", subCategory: "Lingkungan Perawatan" },
      { id: "neuro-sp-prem-5", question: "Perawat neurologi memberikan penanganan nyeri kepala dan kaku kuduk dengan cepat dan tepat", type: "prem", subCategory: "Manajemen Nyeri" },
      { id: "neuro-sp-prem-6", question: "Kami mendapat penjelasan tentang tanda-tanda perburukan yang harus diwaspadai setelah pulang", type: "prem", subCategory: "Discharge Education" },
      { id: "neuro-sp-prem-7", question: "Tim medis mendengarkan kekhawatiran keluarga dengan serius dan memberikan jawaban yang memuaskan", type: "prem", subCategory: "Penghormatan & Empati" },
      { id: "neuro-sp-prem-8", question: "Koordinasi antar-tim (neurologi, bedah saraf, ICU) berjalan terorganisir dengan baik", type: "prem", subCategory: "Koordinasi Tim" },
      { id: "neuro-sp-prem-9", question: "Proses administrasi dan klaim biaya perawatan tidak menjadi beban tambahan bagi keluarga", type: "prem", subCategory: "Administrasi" },
      { id: "neuro-sp-prem-10", question: "Secara keseluruhan, kami puas dengan kualitas layanan selama perawatan stroke perdarahan", type: "prem", subCategory: "Kepuasan Global" },
    ],
    promQuestions: [
      { id: "neuro-sp-prom-1", question: "Pasien mampu melakukan aktivitas harian dasar (makan, higiene) secara mandiri atau dengan bantuan minimal", type: "prom", subCategory: "Fungsi Fisik (Barthel Index)" },
      { id: "neuro-sp-prom-2", question: "Kekuatan anggota gerak pasien membaik dibandingkan saat pertama masuk RS", type: "prom", subCategory: "Fungsi Motorik (NIHSS)" },
      { id: "neuro-sp-prom-3", question: "Pasien tidak mengalami kesulitan bicara atau memahami pembicaraan orang lain", type: "prom", subCategory: "Fungsi Komunikasi" },
      { id: "neuro-sp-prom-4", question: "Tingkat nyeri kepala pasien sudah bisa dikendalikan dengan analgetik oral", type: "prom", subCategory: "Manajemen Nyeri (NRS)" },
      { id: "neuro-sp-prom-5", question: "Pasien tidak mengalami episode kejang pasca stroke selama perawatan", type: "prom", subCategory: "Komplikasi Neurologis" },
      { id: "neuro-sp-prom-6", question: "Pasien menunjukkan perbaikan status kesadaran (GCS) secara progresif", type: "prom", subCategory: "Status Kesadaran (GCS)" },
      { id: "neuro-sp-prom-7", question: "Pasien tidak mengalami infeksi sekunder (pneumonia, ISK) selama perawatan", type: "prom", subCategory: "Pencegahan Komplikasi" },
      { id: "neuro-sp-prom-8", question: "Kondisi tekanan darah pasien sudah terkontrol baik saat akan dipulangkan", type: "prom", subCategory: "Kontrol Tekanan Darah" },
      { id: "neuro-sp-prom-9", question: "Keluarga merasa siap dan percaya diri merawat pasien di rumah pasca stroke", type: "prom", subCategory: "Kesiapan Keluarga (EQ-5D-5L)" },
      { id: "neuro-sp-prom-10", question: "Status fungsional pasien (mRS ≤ 3) menunjukkan pasien dapat hidup mandiri atau dengan bantuan ringan", type: "prom", subCategory: "Outcome Fungsional (mRS)" },
    ],
  },
  {
    diseaseName: "Stroke Iskemik",
    weight: "50%",
    questions: [
      { id: "neuro-si-1", question: "Dilakukan pemeriksaan CT scan 30 menit sejak masuk RS", category: "Diagnosa (25%)" },
      { id: "neuro-si-2", question: "Dilakukan pemeriksaan gula darah sewaktu saat masuk", category: "Diagnosa (25%)" },
      { id: "neuro-si-3", question: "Diberikan trombolisis dengan rtPA (Alteplase) dosis 0,9 mg/kg atau 0,6 mg/kg (kecuali onset > 4 jam)", category: "Tatalaksana (25%)" },
      { id: "neuro-si-4", question: "Diberikan antiplatelets dan/atau antikoagulan", category: "Tatalaksana (25%)" },
      { id: "neuro-si-5", question: "Tidak meninggal dunia", category: "Outcome (50%)" },
      { id: "neuro-si-6", question: "LOS < 7 hari (kecuali ada komplikasi)", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "neuro-si-prem-1", question: "Dokter menjelaskan rencana tindakan trombolisis/antiplatelet dengan bahasa yang mudah dimengerti", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "neuro-si-prem-2", question: "Staf di Stroke Unit merespons dengan cepat ketika pasien mengalami gejala stroke berulang", type: "prem", subCategory: "Responsivitas (NHS PREM)" },
      { id: "neuro-si-prem-3", question: "Saya dan keluarga mendapat edukasi komprehensif tentang rehabilitasi pasca stroke", type: "prem", subCategory: "Edukasi Rehabilitasi" },
      { id: "neuro-si-prem-4", question: "Ruang Stroke Unit bersih, nyaman, dan dilengkapi alat monitoring yang memadai", type: "prem", subCategory: "Lingkungan Perawatan" },
      { id: "neuro-si-prem-5", question: "Saya merasa diperlakukan dengan hormat dan martabat oleh seluruh staf medis", type: "prem", subCategory: "Penghormatan Pasien" },
      { id: "neuro-si-prem-6", question: "Program fisioterapi dan terapi wicara dimulai sejak dini selama perawatan", type: "prem", subCategory: "Rehabilitasi Dini" },
      { id: "neuro-si-prem-7", question: "Saya mendapat informasi jelas tentang faktor risiko stroke dan cara mencegah kekambuhan", type: "prem", subCategory: "Edukasi Pencegahan" },
      { id: "neuro-si-prem-8", question: "Koordinasi antara dokter saraf, fisioterapis, dan perawat berjalan baik", type: "prem", subCategory: "Koordinasi Tim Multidisiplin" },
      { id: "neuro-si-prem-9", question: "Proses pemulangan pasien direncanakan dengan baik dan saya tahu ke mana harus kontrol", type: "prem", subCategory: "Discharge Planning" },
      { id: "neuro-si-prem-10", question: "Secara keseluruhan saya puas dengan pengalaman perawatan di Stroke Unit", type: "prem", subCategory: "Kepuasan Global" },
    ],
    promQuestions: [
      { id: "neuro-si-prom-1", question: "Saya mampu berpakaian dan melakukan higiene pribadi secara mandiri atau dengan bantuan minimal", type: "prom", subCategory: "Fungsi Fisik (Barthel Index)" },
      { id: "neuro-si-prom-2", question: "Kekuatan anggota gerak saya membaik secara bermakna dibandingkan saat pertama masuk RS", type: "prom", subCategory: "Fungsi Motorik (NIHSS)" },
      { id: "neuro-si-prom-3", question: "Saya mampu berkomunikasi (berbicara/menulis) dengan orang lain secara efektif", type: "prom", subCategory: "Fungsi Bahasa" },
      { id: "neuro-si-prom-4", question: "Kemampuan keseimbangan dan berjalan saya membaik dibanding saat awal masuk RS", type: "prom", subCategory: "Mobilitas & Keseimbangan" },
      { id: "neuro-si-prom-5", question: "Saya tidak mengalami gejala depresi atau kecemasan berat pasca stroke", type: "prom", subCategory: "Kesehatan Mental (PHQ-9)" },
      { id: "neuro-si-prom-6", question: "Fungsi kognitif saya (daya ingat, konsentrasi) tidak mengalami penurunan bermakna", type: "prom", subCategory: "Fungsi Kognitif (MoCA)" },
      { id: "neuro-si-prom-7", question: "Saya mampu menelan dengan aman tanpa risiko aspirasi", type: "prom", subCategory: "Fungsi Menelan (GUSS)" },
      { id: "neuro-si-prom-8", question: "Saya memahami dan mematuhi pengobatan antiplatelet/antikoagulan jangka panjang", type: "prom", subCategory: "Kepatuhan Pengobatan" },
      { id: "neuro-si-prom-9", question: "Saya sudah mengendalikan faktor risiko stroke (hipertensi, diabetes, dislipidemia) dengan baik", type: "prom", subCategory: "Modifikasi Faktor Risiko" },
      { id: "neuro-si-prom-10", question: "Status fungsional saya (mRS ≤ 2) memungkinkan saya kembali ke kehidupan yang bermakna", type: "prom", subCategory: "Outcome Fungsional (mRS)" },
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
];

const oncologyDiseases: DiseaseAudit[] = [
  {
    diseaseName: "CA Mammae (Kanker Payudara)",
    weight: "50%",
    questions: [
      { id: "onc-py-1", question: "Dilakukan penetapan stadium sesuai dengan cTNM sebelum pengobatan melalui pemeriksaan foto thorax, USG abdomen, dan bone survey/bone scan", category: "Diagnosa (25%)" },
      { id: "onc-py-2", question: "Dilakukan pemeriksaan imunohistokimia: ER, PR, HER2, dan Ki67", category: "Diagnosa (25%)" },
      { id: "onc-py-3", question: "Dilakukan mastektomi dalam waktu kurang dari 5 minggu sejak penegakan diagnosis", category: "Tatalaksana (25%)" },
      { id: "onc-py-4", question: "Diberikan kemoterapi regimen CMF atau CAF atau CEF atau golongan taxane (kecuali subtipe Luminal A pada stadium I, II, dan IIIa)", category: "Tatalaksana (25%)" },
      { id: "onc-py-5", question: "Pasien follow-up post operasi 3 bulan, 6 bulan dan 1 tahun pertama (kecuali belum 3 bulan operasi)", category: "Outcome (50%)" },
      { id: "onc-py-6", question: "Pasien tidak mengalami limfedema pada sisi operasi", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "onc-py-prem-1", question: "Dokter menjelaskan stadium kanker dan pilihan pengobatan (operasi, kemoterapi, hormonal) dengan jelas", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "onc-py-prem-2", question: "Staf medis menangani nyeri pasca operasi dan efek samping kemoterapi dengan responsif", type: "prem", subCategory: "Manajemen Nyeri & Efek Samping" },
      { id: "onc-py-prem-3", question: "Saya mendapat dukungan psikologis yang memadai selama proses pengobatan kanker", type: "prem", subCategory: "Dukungan Psikososial (EORTC)" },
      { id: "onc-py-prem-4", question: "Saya mudah mendapat jadwal kemoterapi, radioterapi, dan kontrol pasca operasi", type: "prem", subCategory: "Aksesibilitas Layanan" },
      { id: "onc-py-prem-5", question: "Tim medis (onkolog, bedah, radiasi) berkoordinasi dengan baik dalam rencana pengobatan saya", type: "prem", subCategory: "Koordinasi Tim Multidisiplin" },
      { id: "onc-py-prem-6", question: "Saya mendapat informasi tentang efek samping jangka panjang terapi dan cara mengatasinya", type: "prem", subCategory: "Edukasi Komprehensif" },
      { id: "onc-py-prem-7", question: "Keluarga saya dilibatkan dalam diskusi rencana perawatan dan support di rumah", type: "prem", subCategory: "Keterlibatan Keluarga" },
      { id: "onc-py-prem-8", question: "Ruang kemoterapi bersih, nyaman, dan tenaga onkologi sangat profesional", type: "prem", subCategory: "Lingkungan Perawatan" },
      { id: "onc-py-prem-9", question: "Saya mendapat layanan konseling nutrisi selama kemoterapi untuk mencegah penurunan berat badan", type: "prem", subCategory: "Dukungan Nutrisi" },
      { id: "onc-py-prem-10", question: "Secara keseluruhan saya puas dengan kualitas layanan onkologi yang saya terima", type: "prem", subCategory: "Kepuasan Global" },
    ],
    promQuestions: [
      { id: "onc-py-prom-1", question: "Saya mampu melakukan aktivitas sehari-hari (mandi, berpakaian) secara mandiri pasca mastektomi", type: "prom", subCategory: "Fungsi Fisik (EORTC QLQ-C30)" },
      { id: "onc-py-prom-2", question: "Keterbatasan gerak dan nyeri pada lengan sisi operasi sudah berkurang bermakna", type: "prom", subCategory: "Gejala Limfedema (FACT-B)" },
      { id: "onc-py-prom-3", question: "Saya merasa nyaman dengan perubahan fisik pasca operasi dan terapi (body image)", type: "prom", subCategory: "Citra Tubuh (EORTC QLQ-BR45)" },
      { id: "onc-py-prom-4", question: "Saya tidak mengalami mual-muntah berat yang mengganggu aktivitas saat kemoterapi", type: "prom", subCategory: "Toleransi Kemoterapi" },
      { id: "onc-py-prom-5", question: "Tingkat kelelahan (fatigue) saya dapat dikelola dan tidak separah sebelum pengobatan", type: "prom", subCategory: "Fatigue (FACIT-F)" },
      { id: "onc-py-prom-6", question: "Saya tidak mengalami depresi atau kecemasan berat terkait diagnosis kanker", type: "prom", subCategory: "Kesehatan Mental (HADS)" },
      { id: "onc-py-prom-7", question: "Fungsi kognitif saya (daya ingat, konsentrasi) tidak terganggu bermakna oleh kemoterapi", type: "prom", subCategory: "Fungsi Kognitif (EORTC)" },
      { id: "onc-py-prom-8", question: "Saya sudah menjalani program rehabilitasi fisik pasca mastektomi dengan baik", type: "prom", subCategory: "Rehabilitasi" },
      { id: "onc-py-prom-9", question: "Kondisi kesehatan umum saya membaik dan saya dapat kembali menjalani aktivitas sosial", type: "prom", subCategory: "Fungsi Sosial (EORTC)" },
      { id: "onc-py-prom-10", question: "Saya merasa optimis dan memiliki harapan yang realistis tentang perjalanan penyakit dan pengobatan", type: "prom", subCategory: "Kesejahteraan Global" },
    ],
  },
  {
    diseaseName: "CA Serviks (Kanker Serviks)",
    weight: "50%",
    questions: [
      { id: "onc-sv-1", question: "Dilakukan penentuan diagnosis berdasarkan klasifikasi stadium", category: "Diagnosa (25%)" },
      { id: "onc-sv-2", question: "Dilakukan penentuan diagnosis berdasarkan klasifikasi histologi", category: "Diagnosa (25%)" },
      { id: "onc-sv-3", question: "Dilakukan operasi sesuai dengan stadium: Stadium IA1 Konisasi atau Histerektomi Simple (kecuali LVSI positif); Stadium IA2\u2013IIA2 Histerektomi Radikal dengan Limfadenektomi", category: "Tatalaksana (25%)" },
      { id: "onc-sv-4", question: "Diberikan Ajuvan Radioterapi atau Kemoradiasi pada stadium IA2, IB1, dan IIA1 bila terdapat faktor risiko (metastasis KGB, metastasis parametrium, batas sayatan tidak bebas tumor, deep stromal invasion, LVSI) \u2014 kecuali tidak ada faktor risiko", category: "Tatalaksana (25%)" },
      { id: "onc-sv-5", question: "Pasien dipulangkan dengan ECOG Performance Status: 0\u20132", category: "Outcome (50%)" },
      { id: "onc-sv-6", question: "Pasien dipulangkan dengan nyeri terkendali dengan analgetik oral, skala nyeri < 3", category: "Outcome (50%)" },
    ],
    premQuestions: [
      { id: "onc-sv-prem-1", question: "Dokter menjelaskan stadium kanker serviks dan pilihan pengobatan (operasi/kemoradiasi) dengan jelas", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "onc-sv-prem-2", question: "Staf medis menangani efek samping kemoradiasi (mual, diare, kelelahan) secara responsif", type: "prem", subCategory: "Manajemen Efek Samping" },
      { id: "onc-sv-prem-3", question: "Saya mendapat dukungan nutrisi dan psikologis yang memadai selama pengobatan", type: "prem", subCategory: "Dukungan Suportif (WHO)" },
      { id: "onc-sv-prem-4", question: "Jadwal radioterapi dan pemeriksaan kontrol mudah didapatkan tanpa penundaan bermakna", type: "prem", subCategory: "Aksesibilitas" },
      { id: "onc-sv-prem-5", question: "Tim medis (ginekolog onkologi, radiasi, medical onkologi) berkoordinasi dengan baik", type: "prem", subCategory: "Koordinasi Tim" },
      { id: "onc-sv-prem-6", question: "Saya mendapat informasi detail tentang efek jangka panjang pengobatan pada fungsi reproduksi dan kandung kemih", type: "prem", subCategory: "Edukasi Efek Jangka Panjang" },
      { id: "onc-sv-prem-7", question: "Keluarga saya merasa dilibatkan dan mendapat cukup informasi selama proses pengobatan", type: "prem", subCategory: "Keterlibatan Keluarga" },
      { id: "onc-sv-prem-8", question: "Privasi dan martabat saya selalu dijaga selama pemeriksaan dan prosedur ginekologi", type: "prem", subCategory: "Privasi Pasien" },
      { id: "onc-sv-prem-9", question: "Petugas medis memberikan empati dan dukungan emosional yang saya butuhkan", type: "prem", subCategory: "Dukungan Emosional" },
      { id: "onc-sv-prem-10", question: "Secara keseluruhan saya puas dengan kualitas layanan onkologi ginekologi di RS ini", type: "prem", subCategory: "Kepuasan Global" },
    ],
    promQuestions: [
      { id: "onc-sv-prom-1", question: "Saya mampu melakukan aktivitas ringan tanpa kelelahan berlebihan pasca pengobatan", type: "prom", subCategory: "Fungsi Fisik (EORTC QLQ-C30)" },
      { id: "onc-sv-prom-2", question: "Nyeri pelvis dan nyeri pasca operasi sudah terkendali dengan analgetik oral (skala <3)", type: "prom", subCategory: "Kontrol Nyeri (NRS)" },
      { id: "onc-sv-prom-3", question: "Saya tidak mengalami gangguan berkemih bermakna (urgensi, inkontinensia) pasca tindakan", type: "prom", subCategory: "Fungsi Kandung Kemih (EORTC QLQ-CX24)" },
      { id: "onc-sv-prom-4", question: "Saya tidak mengalami gangguan pencernaan bermakna (diare, konstipasi) akibat kemoradiasi", type: "prom", subCategory: "Fungsi Gastrointestinal" },
      { id: "onc-sv-prom-5", question: "Tingkat kelelahan (fatigue) akibat kemoradiasi sudah berkurang bermakna", type: "prom", subCategory: "Fatigue (FACIT-F)" },
      { id: "onc-sv-prom-6", question: "Saya tidak merasa tertekan atau depresi berat terkait diagnosis dan pengobatan kanker", type: "prom", subCategory: "Kesehatan Mental (HADS)" },
      { id: "onc-sv-prom-7", question: "ECOG Performance Status saya ≤ 2 dan saya dapat melakukan aktivitas sosial normal", type: "prom", subCategory: "Status Performa (ECOG)" },
      { id: "onc-sv-prom-8", question: "Saya sudah menjalani jadwal kontrol rutin dan pap smear follow-up sesuai rekomendasi", type: "prom", subCategory: "Kepatuhan Follow-up" },
      { id: "onc-sv-prom-9", question: "Kondisi kesehatan umum saya membaik dan saya dapat kembali ke kehidupan sosial bermakna", type: "prom", subCategory: "Status Kesehatan Global (EQ-5D)" },
      { id: "onc-sv-prom-10", question: "Saya merasa memiliki harapan dan dapat menerima kondisi saya dengan dukungan tim medis yang baik", type: "prom", subCategory: "Kesejahteraan Psikologis" },
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