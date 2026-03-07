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

// Sajikan file statis dari folder public
app.use(express.static(path.join(__dirname, "public")));

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
bot.launch()
  .then(() => console.log("🤖 Bot Telegram berjalan!"))
  .catch(err => console.error("Gagal menjalankan bot:", err));

// Jalankan server Express
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📱 Mini App URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
