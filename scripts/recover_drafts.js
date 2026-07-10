import { createClient } from "@libsql/client";

// Konfigurasi Database (Sesuaikan dengan path di VPS Anda)
const DB_URL = process.env.DATABASE_URL || "file:./data/nhr-persi.db";

const client = createClient({ url: DB_URL });

async function recoverDrafts() {
  console.log("Memulai proses recovery draft...");
  
  try {
    // Ambil semua draft tipe assessment yang mungkin nyasar
    const draftsRs = await client.execute("SELECT id, hospital_code, data FROM drafts WHERE type = 'hospital-assessment'");
    const drafts = draftsRs.rows;
    console.log(`Ditemukan ${drafts.length} draft assessment.`);

    let recoveredCount = 0;

    for (const row of drafts) {
      const draftId = row.id;
      const currentDbCode = row.hospital_code;
      
      let dataObj;
      try {
        dataObj = JSON.parse(row.data);
      } catch (e) {
        continue; // Lewati jika JSON corrupt
      }

      const email = dataObj.hospitalEmail || "";
      if (!email) {
        continue; // Tidak bisa di-recover jika tidak ada email
      }

      // Cari hospital_code yang sebenarnya dari tabel hospital_accounts
      const accRs = await client.execute({
        sql: "SELECT hospital_code FROM hospital_accounts WHERE LOWER(email) = LOWER(?) LIMIT 1",
        args: [email.trim()]
      });

      if (accRs.rows.length > 0) {
        const correctCode = accRs.rows[0].hospital_code;
        
        // Jika kode di database saat ini salah/berbeda dari akun aslinya
        if (correctCode && currentDbCode !== correctCode) {
          console.log(`Memperbaiki draft ${draftId} dari kode '${currentDbCode}' menjadi '${correctCode}' (Email: ${email})`);
          
          // Update JSON data dengan kode yang benar
          dataObj.hospitalCode = correctCode;
          
          // Update ke database
          await client.execute({
            sql: "UPDATE drafts SET hospital_code = ?, data = ? WHERE id = ?",
            args: [correctCode, JSON.stringify(dataObj), draftId]
          });
          
          recoveredCount++;
        }
      }
    }

    console.log(`\nProses selesai! Berhasil mengembalikan ${recoveredCount} draft yang nyasar ke akun aslinya.`);
  } catch (err) {
    console.error("Terjadi kesalahan saat recovery:", err);
  }
}

recoverDrafts();
