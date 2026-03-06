// db/init.js - Inisialisasi dan setup database SQLite3

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(__dirname, "miniapp.db");
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    // Tabel Server - menyimpan data server VPS
    db.run(`
      CREATE TABLE IF NOT EXISTS Server (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        auth TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 30,
        ip_limit INTEGER NOT NULL DEFAULT 2,
        quota INTEGER NOT NULL DEFAULT 10,
        is_active INTEGER NOT NULL DEFAULT 1,
        total_create_akun INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabel User - menyimpan akun VPN yang berhasil dibuat
    db.run(`
      CREATE TABLE IF NOT EXISTS User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT,
        username TEXT NOT NULL,
        password TEXT DEFAULT '123',
        protocol TEXT NOT NULL,
        server_id INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        quota INTEGER DEFAULT 0,
        ip_limit INTEGER NOT NULL DEFAULT 2,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES Server(id)
      )
    `);

    // Tabel Log - mencatat aktivitas pembuatan akun
    db.run(`
      CREATE TABLE IF NOT EXISTS Log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT,
        action TEXT NOT NULL,
        detail TEXT,
        status TEXT DEFAULT 'success',
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabel Settings - menyimpan pengaturan global
    db.run(`
      CREATE TABLE IF NOT EXISTS Settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `, () => {
      // Inisialisasi pengaturan default jika belum ada
      const defaultSettings = [
        { key: "CREATE_LIMIT_ENABLED", value: "0" },
        { key: "CREATE_LIMIT_HOURS", value: "1" },
        { key: "CREATE_LIMIT_COUNT", value: "1" }
      ];

      const stmt = db.prepare("INSERT OR IGNORE INTO Settings (key, value) VALUES (?, ?)");
      for (const setting of defaultSettings) {
        stmt.run(setting.key, setting.value);
      }
      stmt.finalize();
    });

    console.log("✅ Database berhasil diinisialisasi");
  });
}

module.exports = { db, initDatabase };
