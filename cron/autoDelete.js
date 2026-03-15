// cron/autoDelete.js - Modul penghapusan akun otomatis

const cron = require('node-cron');
const { db } = require('../db/init');

function startAutoDeleteCron() {
  // Jadwalkan cron untuk berjalan setiap menit
  cron.schedule('* * * * *', () => {
    console.log('🔄 [CRON] Memeriksa akun VPN yang kedaluwarsa...');

    // Ambil akun yang kedaluwarsa. Logika: created_at + duration (dalam hari) <= waktu saat ini (UTC)
    const query = `
      SELECT id, server_id, username
      FROM User
      WHERE datetime(created_at, '+' || duration || ' days') <= datetime('now')
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ [CRON] Gagal memeriksa akun kedaluwarsa:', err.message);
        return;
      }

      if (rows.length === 0) {
        // Tidak ada akun yang perlu dihapus saat ini
        return;
      }

      console.log(`⚠️ [CRON] Ditemukan ${rows.length} akun kedaluwarsa yang akan dihapus.`);

      // Hapus masing-masing akun yang expired dan kurangi total_create_akun dari server-nya
      rows.forEach((row) => {
        // Hapus akun dari tabel User
        db.run('DELETE FROM User WHERE id = ?', [row.id], function(err) {
          if (err) {
            console.error(`❌ [CRON] Gagal menghapus akun ${row.username} (ID: ${row.id}):`, err.message);
          } else if (this.changes > 0) {
            console.log(`✅ [CRON] Berhasil menghapus akun ${row.username} (ID: ${row.id})`);

            // Kurangi nilai total_create_akun di tabel Server agar slot kembali kosong
            db.run(
              'UPDATE Server SET total_create_akun = MAX(0, total_create_akun - 1) WHERE id = ?',
              [row.server_id],
              function(updateErr) {
                if (updateErr) {
                  console.error(`❌ [CRON] Gagal mengurangi total_create_akun untuk Server ID ${row.server_id}:`, updateErr.message);
                } else if (this.changes > 0) {
                  console.log(`✅ [CRON] Kuota Server ID ${row.server_id} berhasil dikembalikan (+1 slot).`);
                }
              }
            );
          }
        });
      });
    });
  });

  console.log('⏰ [CRON] Auto-delete cron job telah diinisialisasi (Berjalan setiap menit).');
}

module.exports = { startAutoDeleteCron };
