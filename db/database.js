const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(__dirname, "miniapp.db");
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    // Tabel Server
    db.run(`
      CREATE TABLE IF NOT EXISTS Server (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        auth TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 30,
        ip_limit INTEGER NOT NULL DEFAULT 2,
        quota INTEGER NOT NULL DEFAULT 0,
        total_create_akun INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabel User / Akun VPN
    db.run(`
      CREATE TABLE IF NOT EXISTS User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT,
        username TEXT NOT NULL,
        password TEXT,
        protocol TEXT NOT NULL,
        server_id INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        quota INTEGER DEFAULT 0,
        ip_limit INTEGER DEFAULT 2,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES Server(id)
      )
    `);

    // Tabel Log Aktivitas
    db.run(`
      CREATE TABLE IF NOT EXISTS ActivityLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT,
        action TEXT NOT NULL,
        detail TEXT,
        ip_address TEXT,
        status TEXT DEFAULT 'success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Database initialized");
  });
}

module.exports = { db, initDatabase };
