// routes/create.js - Route pembuatan akun VPN (sesuai spesifikasi)

const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const router = express.Router();

const dbPath = path.join(__dirname, "../db/miniapp.db");
const db = new sqlite3.Database(dbPath);

router.post("/", (req, res) => {
  const { userId, username, password, protocol, duration, quota, ipLimit, serverId } = req.body;

  if (!username || !protocol || !duration || !ipLimit || !serverId) {
    return res.status(400).json({ success: false, message: "Parameter tidak lengkap" });
  }

  // Cek pengaturan batasan pembuatan akun
  db.all("SELECT key, value FROM Settings WHERE key IN ('CREATE_LIMIT_ENABLED', 'CREATE_LIMIT_HOURS', 'CREATE_LIMIT_COUNT')", [], (err, settingsRows) => {
    if (err) return res.status(500).json({ success: false, message: "Terjadi kesalahan internal (Settings)" });

    const settings = {};
    settingsRows.forEach(row => settings[row.key] = row.value);

    const isLimitEnabled = settings.CREATE_LIMIT_ENABLED === "1";
    const limitHours = parseInt(settings.CREATE_LIMIT_HOURS) || 1;
    const limitCount = parseInt(settings.CREATE_LIMIT_COUNT) || 1;

    // Admin bebas dari limit
    const adminIds = (process.env.ADMIN_ID || "").split(",").map(id => id.trim());
    const isAdmin = userId && adminIds.includes(String(userId));

    if (isLimitEnabled && !isAdmin && userId) {
      // Cek jumlah akun yang dibuat oleh user ini dalam N jam terakhir
      const timeThreshold = `datetime('now', '-${limitHours} hours')`;

      db.get(`SELECT COUNT(*) as count FROM User WHERE telegram_id = ? AND created_at >= ${timeThreshold}`, [userId], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "Terjadi kesalahan internal (Rate Limit)" });

        if (row && row.count >= limitCount) {
          return res.status(429).json({
            success: false,
            message: `Anda telah mencapai batas pembuatan ${limitCount} akun per ${limitHours} jam. Silakan coba lagi nanti.`
          });
        }

        // Lanjut ke proses pembuatan jika belum mencapai batas
        processCreateAccount();
      });
    } else {
      // Fitur limit nonaktif atau user adalah admin, langsung lanjut
      processCreateAccount();
    }
  });

  function processCreateAccount() {
    db.get("SELECT * FROM Server WHERE id = ?", [serverId], async (err, server) => {
    if (err || !server) {
      return res.status(404).json({ success: false, message: "Server tidak ditemukan" });
    }

    // Cek apakah server sudah penuh
    const maxUsers = server.max_users !== undefined ? server.max_users : 100;
    if (maxUsers > 0 && server.total_create_akun >= maxUsers) {
      return res.status(400).json({ success: false, message: "Server ini sudah penuh" });
    }

    // 🔑 Tentukan port berdasarkan pola domain
    const port = server.domain.includes("-upc.") ? 8443 : 5888;

    // 🔑 Susun endpoint API
    const endpoint = `http://${server.domain}:${port}/create${protocol}?user=${username}` +
      (protocol === "ssh" ? `&password=${password || "123"}` : "") +
      `&exp=${duration}&quota=${quota || 0}&iplimit=${ipLimit}&auth=${server.auth}`;

    try {
      const response = await axios.get(endpoint);
      const data = response.data;

      if (data.status === "success") {
        // ✅ Simpan ke tabel User
        const stmt = db.prepare(`
          INSERT INTO User (telegram_id, username, password, protocol, server_id, duration, quota, ip_limit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          userId || null,
          username,
          password || "123",
          protocol,
          serverId,
          duration,
          quota || 0,
          ipLimit
        );

        // ✅ Update jumlah akun dibuat
        db.run(`
          UPDATE Server 
          SET total_create_akun = total_create_akun + 1 
          WHERE id = ?
        `, [serverId]);

        // ✅ Catat log aktivitas
        db.run(`
          INSERT INTO Log (telegram_id, action, detail, status)
          VALUES (?, ?, ?, ?)
        `, [
          userId || null,
          "CREATE_ACCOUNT",
          `Protocol: ${protocol}, Server: ${server.name}, User: ${username}`,
          "success"
        ]);

        return res.json({
          success: true,
          message: data.message,
          data: data.data
        });
      } else {
        // Log kegagalan
        db.run(`
          INSERT INTO Log (telegram_id, action, detail, status)
          VALUES (?, ?, ?, ?)
        `, [userId || null, "CREATE_ACCOUNT", `Gagal: ${data.message}`, "failed"]);

        return res.status(400).json({ success: false, message: data.message });
      }
    } catch (e) {
      console.error("API error:", e.message);

      db.run(`
        INSERT INTO Log (telegram_id, action, detail, status)
        VALUES (?, ?, ?, ?)
      `, [userId || null, "CREATE_ACCOUNT", `Error: ${e.message}`, "error"]);

      return res.status(500).json({ success: false, message: "Gagal menghubungi API server" });
    }
    });
  } // akhir fungsi processCreateAccount
});

module.exports = router;
