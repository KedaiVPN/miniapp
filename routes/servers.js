// routes/servers.js - Route manajemen server (khusus Admin)

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

// GET /api/servers - Ambil semua server aktif (publik, untuk dropdown user)
router.get("/", (req, res) => {
  db.all("SELECT id, name, domain, duration, ip_limit, quota FROM Server WHERE is_active = 1", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengambil data server" });
    res.json({ success: true, data: rows });
  });
});

// GET /api/servers/all - Semua server termasuk nonaktif (admin only)
router.get("/all", isAdmin, (req, res) => {
  db.all("SELECT * FROM Server ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengambil data server" });
    res.json({ success: true, data: rows });
  });
});

// POST /api/servers - Tambah server baru (admin only)
router.post("/", isAdmin, (req, res) => {
  const { name, domain, auth, duration, ip_limit, quota } = req.body;

  if (!name || !domain || !auth || !duration || !ip_limit) {
    return res.status(400).json({ success: false, message: "Data server tidak lengkap" });
  }

  const stmt = db.prepare(`
    INSERT INTO Server (name, domain, auth, duration, ip_limit, quota)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(name, domain, auth, duration, ip_limit, quota || 0, function (err) {
    if (err) return res.status(500).json({ success: false, message: "Gagal menambah server" });

    // Log
    db.run(`INSERT INTO Log (action, detail, status) VALUES (?, ?, ?)`,
      ["ADD_SERVER", `Server: ${name} (${domain})`, "success"]);

    res.json({ success: true, message: "Server berhasil ditambahkan", id: this.lastID });
  });

  stmt.finalize();
});

// PUT /api/servers/:id - Edit server (admin only)
router.put("/:id", isAdmin, (req, res) => {
  const { id } = req.params;
  const { name, domain, auth, duration, ip_limit, quota, is_active } = req.body;

  db.run(`
    UPDATE Server 
    SET name = ?, domain = ?, auth = ?, duration = ?, ip_limit = ?, quota = ?, is_active = ?
    WHERE id = ?
  `, [name, domain, auth, duration, ip_limit, quota || 0, is_active ?? 1, id], function (err) {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengupdate server" });
    if (this.changes === 0) return res.status(404).json({ success: false, message: "Server tidak ditemukan" });

    db.run(`INSERT INTO Log (action, detail, status) VALUES (?, ?, ?)`,
      ["EDIT_SERVER", `Server ID: ${id}`, "success"]);

    res.json({ success: true, message: "Server berhasil diupdate" });
  });
});

// DELETE /api/servers/:id - Hapus server (admin only)
router.delete("/:id", isAdmin, (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM Server WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ success: false, message: "Gagal menghapus server" });
    if (this.changes === 0) return res.status(404).json({ success: false, message: "Server tidak ditemukan" });

    db.run(`INSERT INTO Log (action, detail, status) VALUES (?, ?, ?)`,
      ["DELETE_SERVER", `Server ID: ${id}`, "success"]);

    res.json({ success: true, message: "Server berhasil dihapus" });
  });
});

module.exports = router;
