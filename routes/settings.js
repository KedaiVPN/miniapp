// routes/settings.js - Route manajemen pengaturan (khusus Admin)

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const router = express.Router();

const dbPath = path.join(__dirname, "../db/miniapp.db");
const db = new sqlite3.Database(dbPath);

// Middleware cek admin
function isAdmin(req, res, next) {
  const adminIds = (process.env.ADMIN_ID || "").split(",").map(id => id.trim());
  const telegramId = req.headers["x-telegram-id"] || req.body?.telegramId;

  if (!telegramId || !adminIds.includes(String(telegramId))) {
    return res.status(403).json({ success: false, message: "Akses ditolak" });
  }
  next();
}

// GET /api/settings - Ambil semua pengaturan
router.get("/", isAdmin, (req, res) => {
  db.all("SELECT key, value FROM Settings", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengambil pengaturan" });

    // Ubah array of objects [{key: "K", value: "V"}] menjadi object { K: "V" }
    const settingsMap = {};
    rows.forEach(row => {
      settingsMap[row.key] = row.value;
    });

    res.json({ success: true, data: settingsMap });
  });
});

// POST /api/settings - Update pengaturan
router.post("/", isAdmin, (req, res) => {
  const settings = req.body;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, message: "Data pengaturan tidak valid" });
  }

  const keys = Object.keys(settings);
  if (keys.length === 0) {
    return res.json({ success: true, message: "Tidak ada pengaturan yang diubah" });
  }

  // Gunakan transaksi untuk update banyak kunci sekaligus
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare("UPDATE Settings SET value = ? WHERE key = ?");

    for (const key of keys) {
      stmt.run(String(settings[key]), key);
    }

    stmt.finalize();
    db.run("COMMIT", (err) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ success: false, message: "Gagal menyimpan pengaturan" });
      }
      res.json({ success: true, message: "Pengaturan berhasil disimpan" });
    });
  });
});

module.exports = router;