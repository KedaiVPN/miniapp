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

  db.get("SELECT * FROM Server WHERE id = ?", [serverId], async (err, server) => {
    if (err || !server) {
      return res.status(404).json({ success: false, message: "Server tidak ditemukan" });
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
});

module.exports = router;
