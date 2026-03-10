// index.js - Entry point aplikasi

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { bot } = require("./bot/bot");
const { initDatabase } = require("./db/init");
const createRoute = require("./routes/create");
const serversRoute = require("./routes/servers");
const verifyRoute = require("./routes/verify");
const settingsRoute = require("./routes/settings");

const app = express();
const PORT = process.env.PORT || 3000;

// =============================
// Middleware
// =============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tambahkan middleware No-Cache untuk mem-bypass aggressive cache Telegram Webview
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '-1');
  next();
});

// Sajikan file statis dari folder public
app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

// =============================
// API Routes
// =============================
app.use("/api/create", createRoute);
app.use("/api/servers", serversRoute);
app.use("/api/verify-turnstile", verifyRoute);
app.use("/api/settings", settingsRoute);

// Route untuk mengambil konfigurasi publik (site key, dll)
app.get("/api/config", (req, res) => {
  res.json({
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "",
    appUrl: process.env.APP_URL || ""
  });
});

// Route untuk mengambil statistik global (misal: total pengguna)
app.get("/api/stats", (req, res) => {
  const { db } = require("./db/init");
  db.get("SELECT COUNT(*) as total FROM TelegramUser", [], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    return res.json({ success: true, totalUsers: row.total || 0 });
  });
});

// Route untuk otentikasi bahwa user telegram_id pernah menjalankan /start
app.get("/api/auth", (req, res) => {
  const telegramId = req.query.uid;
  if (!telegramId) return res.status(400).json({ success: false, message: "Missing uid parameter" });

  const { db } = require("./db/init");

  db.get("SELECT * FROM TelegramUser WHERE telegram_id = ?", [telegramId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    if (!row) return res.status(401).json({ success: false, message: "User not registered in bot" });
    return res.json({ success: true, user: row });
  });
});

// Route untuk notifikasi setelah akun berhasil dibuat
// (dipanggil dari routes/create.js via internal call atau dari sini langsung)
app.post("/api/notify", async (req, res) => {
  const { telegramId, accountData, protocol, serverName, serverDomain } = req.body;
  const { sendAccountDetails } = require("./bot/bot");

  if (!telegramId) {
    return res.status(400).json({ success: false, message: "telegramId diperlukan" });
  }

  const sent = await sendAccountDetails(telegramId, accountData, protocol, serverName, serverDomain);
  res.json({ success: sent });
});

// =============================
// Halaman Mini App (SPA)
// =============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});

// =============================
// Inisialisasi
// =============================
initDatabase();

// Jalankan bot Telegram
if (process.env.BOT_TOKEN) {
  bot.launch()
    .then(() => console.log("🤖 Bot Telegram berjalan!"))
    .catch(err => console.error("Gagal menjalankan bot:", err));
}

// Jalankan server Express
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📱 Mini App URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
});

// Graceful shutdown
process.once("SIGINT", () => { if (bot.botInfo) bot.stop("SIGINT") });
process.once("SIGTERM", () => { if (bot.botInfo) bot.stop("SIGTERM") });
