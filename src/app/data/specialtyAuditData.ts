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
      { id: "card-st-prem-1", question: "Sejauh mana dokter menjelaskan rencana tindakan (Primary PCI/Trombolisis) dengan bahasa yang mudah dimengerti?", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "card-st-prem-2", question: "Apakah staf medis merespons dengan cepat saat Anda mengalami nyeri dada/gejala berulang di bangsal?", type: "prem", subCategory: "Responsivitas" },
      { id: "card-st-prem-3", question: "Seberapa terlibat Anda/keluarga dalam pengambilan keputusan mengenai prosedur PCI/trombolisis?", type: "prem", subCategory: "Keterlibatan Keluarga" },
      { id: "card-st-prem-4", question: "Bagaimana kebersihan dan kenyamanan ruang perawatan intensif (ICCU)?", type: "prem", subCategory: "Fasilitas" },
    ],
    promQuestions: [
      { id: "card-st-prom-1", question: "Seberapa sering Anda merasa sesak napas saat beraktivitas ringan dalam seminggu terakhir?", type: "prom", subCategory: "Fungsi Fisik" },
      { id: "card-st-prom-2", question: "Apakah Anda mampu berjalan 100 meter tanpa nyeri dada?", type: "prom", subCategory: "Fungsi Fisik" },
      { id: "card-st-prom-3", question: "Apakah Anda mampu naik tangga tanpa sesak napas?", type: "prom", subCategory: "Fungsi Fisik" },
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
      { id: "card-gj-prem-1", question: "Sejauh mana dokter menjelaskan kondisi gagal jantung Anda dan obat-obatan yang diberikan?", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "card-gj-prem-2", question: "Apakah staf medis memantau berat badan dan tanda-tanda kelebihan cairan secara rutin?", type: "prem", subCategory: "Monitoring" },
      { id: "card-gj-prem-3", question: "Apakah Anda mendapatkan edukasi tentang pembatasan cairan dan diet rendah garam?", type: "prem", subCategory: "Edukasi Pasien" },
      { id: "card-gj-prem-4", question: "Bagaimana kenyamanan ruangan dan waktu istirahat selama perawatan?", type: "prem", subCategory: "Fasilitas" },
    ],
    promQuestions: [
      { id: "card-gj-prom-1", question: "Seberapa sering Anda mengalami sesak napas saat tidur atau berbaring dalam seminggu terakhir?", type: "prom", subCategory: "Gejala Kardiak" },
      { id: "card-gj-prom-2", question: "Apakah Anda mengalami pembengkakan kaki sejak keluar RS?", type: "prom", subCategory: "Gejala Kardiak" },
      { id: "card-gj-prom-3", question: "Apakah Anda mampu melakukan aktivitas ringan (berjalan, mandi) tanpa kelelahan berlebihan?", type: "prom", subCategory: "Fungsi Fisik" },
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
      { id: "neuro-sp-prem-1", question: "Sejauh mana dokter menjelaskan kondisi perdarahan otak dan rencana tindakan pembedahan/perawatan dengan bahasa yang mudah dimengerti?", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "neuro-sp-prem-2", question: "Apakah staf medis merespons dengan cepat saat terjadi perubahan kesadaran atau gejala memburuk?", type: "prem", subCategory: "Responsivitas" },
      { id: "neuro-sp-prem-3", question: "Seberapa terlibat keluarga dalam pengambilan keputusan perawatan intensif/pembedahan?", type: "prem", subCategory: "Keterlibatan Keluarga" },
      { id: "neuro-sp-prem-4", question: "Bagaimana kebersihan dan kenyamanan ruang perawatan (ICU/HCU)?", type: "prem", subCategory: "Fasilitas" },
    ],
    promQuestions: [
      { id: "neuro-sp-prom-1", question: "Sejauh mana Anda mampu melakukan aktivitas harian (makan/mandi) secara mandiri?", type: "prom", subCategory: "Fungsi Fisik (Skala Barthel)" },
      { id: "neuro-sp-prom-2", question: "Apakah Anda mengalami kesulitan bicara atau memahami pembicaraan orang lain?", type: "prom", subCategory: "Fungsi Kognitif" },
      { id: "neuro-sp-prom-3", question: "Apakah kekuatan anggota gerak Anda membaik dibandingkan saat masuk RS?", type: "prom", subCategory: "Fungsi Motorik" },
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
      { id: "neuro-si-prem-1", question: "Sejauh mana dokter menjelaskan rencana tindakan trombolisis/antiplatelet dengan bahasa yang mudah dimengerti?", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "neuro-si-prem-2", question: "Apakah staf medis merespons dengan cepat saat Anda mengalami gejala stroke berulang di bangsal?", type: "prem", subCategory: "Responsivitas" },
      { id: "neuro-si-prem-3", question: "Apakah Anda/keluarga mendapat edukasi tentang rehabilitasi pasca stroke?", type: "prem", subCategory: "Edukasi Pasien" },
      { id: "neuro-si-prem-4", question: "Bagaimana kebersihan dan kenyamanan ruang perawatan (Stroke Unit)?", type: "prem", subCategory: "Fasilitas" },
    ],
    promQuestions: [
      { id: "neuro-si-prom-1", question: "Sejauh mana Anda mampu berpakaian secara mandiri pasca perawatan?", type: "prom", subCategory: "Fungsi Fisik (Skala Barthel)" },
      { id: "neuro-si-prom-2", question: "Apakah Anda mengalami gangguan keseimbangan atau kesulitan berjalan?", type: "prom", subCategory: "Fungsi Motorik" },
      { id: "neuro-si-prom-3", question: "Apakah Anda mampu berkomunikasi (berbicara/menulis) dengan baik?", type: "prom", subCategory: "Fungsi Kognitif" },
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
      { id: "onc-py-prem-1", question: "Seberapa jelas dokter menjelaskan rencana pengobatan (operasi, kemoterapi, efek samping)?", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "onc-py-prem-2", question: "Apakah staf medis merespons dengan cepat saat Anda merasakan nyeri pasca operasi?", type: "prem", subCategory: "Manajemen Nyeri" },
      { id: "onc-py-prem-3", question: "Sejauh mana Anda merasa didukung secara psikologis selama masa pengobatan?", type: "prem", subCategory: "Dukungan Psikososial" },
      { id: "onc-py-prem-4", question: "Kemudahan dalam mendapatkan jadwal kemoterapi dan kontrol pasca operasi.", type: "prem", subCategory: "Aksesibilitas" },
    ],
    promQuestions: [
      { id: "onc-py-prom-1", question: "Sejauh mana Anda mampu melakukan aktivitas sehari-hari (mandi/berpakaian) secara mandiri pasca mastektomi?", type: "prom", subCategory: "Fungsi Fisik" },
      { id: "onc-py-prom-2", question: "Apakah Anda mengalami nyeri atau keterbatasan gerak pada lengan sisi operasi?", type: "prom", subCategory: "Gejala Spesifik" },
      { id: "onc-py-prom-3", question: "Sejauh mana Anda merasa nyaman dengan perubahan fisik pasca tindakan medis (body image)?", type: "prom", subCategory: "Citra Tubuh" },
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
      { id: "onc-sv-prem-1", question: "Seberapa jelas dokter menjelaskan stadium penyakit dan pilihan pengobatan (operasi/kemoradiasi)?", type: "prem", subCategory: "Komunikasi Dokter" },
      { id: "onc-sv-prem-2", question: "Apakah staf medis menangani efek samping kemoradiasi dengan responsif?", type: "prem", subCategory: "Manajemen Efek Samping" },
      { id: "onc-sv-prem-3", question: "Sejauh mana Anda mendapat dukungan nutrisi dan psikososial selama pengobatan?", type: "prem", subCategory: "Dukungan Suportif" },
      { id: "onc-sv-prem-4", question: "Kemudahan mendapat jadwal radioterapi dan pemeriksaan kontrol.", type: "prem", subCategory: "Aksesibilitas" },
    ],
    promQuestions: [
      { id: "onc-sv-prom-1", question: "Apakah Anda mampu melakukan aktivitas ringan tanpa kelelahan berlebihan pasca pengobatan?", type: "prom", subCategory: "Fungsi Fisik (EORTC QLQ-C30)" },
      { id: "onc-sv-prom-2", question: "Tingkat nyeri yang dirasakan dalam 1 minggu terakhir (apakah terkendali)?", type: "prom", subCategory: "Gejala Spesifik" },
      { id: "onc-sv-prom-3", question: "Apakah Anda mengalami gangguan berkemih atau gangguan fungsi pencernaan pasca tindakan?", type: "prom", subCategory: "Gejala Spesifik" },
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