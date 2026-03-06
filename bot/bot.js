// bot/bot.js - Telegram Bot dengan Telegraf

const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_ID || "").split(",").map(id => id.trim());
const APP_URL = process.env.APP_URL || "https://your-app.com";

// =============================
// /start - Pesan sambutan
// =============================
bot.start(async (ctx) => {
  const name = ctx.from.first_name || "Pengguna";
  const userId = String(ctx.from.id);

  const welcomeText = `
👋 *Halo, ${name}!*

Selamat datang di *VPN Account Generator* 🚀

Aplikasi ini memungkinkan kamu membuat akun VPN dengan mudah dan cepat.

✅ Support: SSH, Vmess, Vless, Trojan
🔒 Aman & Terverifikasi

Klik tombol di bawah untuk membuka aplikasi 👇
  `.trim();

  await ctx.reply(welcomeText, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.webApp("🚀 Buka Aplikasi VPN", `${APP_URL}?uid=${userId}`)]
    ])
  });
});

// =============================
// /admin - Panel admin
// =============================
bot.command("admin", async (ctx) => {
  const userId = String(ctx.from.id);

  if (!ADMIN_IDS.includes(userId)) {
    return ctx.reply("❌ Kamu tidak memiliki akses ke panel admin.");
  }

  await ctx.reply("👑 *Panel Admin*\n\nPilih menu di bawah:", {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.webApp("⚙️ Buka Panel Admin", `${APP_URL}/admin?uid=${userId}&admin=true`)]
    ])
  });
});

// =============================
// /help - Bantuan
// =============================
bot.command("help", async (ctx) => {
  await ctx.reply(`
📖 *Panduan Penggunaan*

*Perintah Bot:*
• /start - Buka aplikasi VPN
• /help - Tampilkan bantuan ini

*Cara Membuat Akun:*
1️⃣ Klik "Buka Aplikasi VPN"
2️⃣ Pilih tipe akun (SSH/Vmess/Vless/Trojan)
3️⃣ Pilih server yang tersedia
4️⃣ Isi username (dan password jika SSH)
5️⃣ Selesaikan verifikasi keamanan
6️⃣ Klik "Create Account"
7️⃣ Detail akun akan dikirim ke sini 📩

❓ Butuh bantuan? Hubungi admin.
  `.trim(), { parse_mode: "Markdown" });
});

// =============================
// Fungsi: Kirim detail akun ke user
// =============================
async function sendAccountDetails(telegramId, accountData, protocol, serverName) {
  const protocolEmoji = {
    ssh: "🔐",
    vmess: "💎",
    vless: "⚡",
    trojan: "🛡️"
  };

  const emoji = protocolEmoji[protocol?.toLowerCase()] || "📦";

  let message = `
${emoji} *Akun ${protocol?.toUpperCase()} Berhasil Dibuat!*

🖥️ *Server:* ${serverName}
📋 *Detail Akun:*
\`\`\`
${typeof accountData === "object" ? JSON.stringify(accountData, null, 2) : accountData}
\`\`\`

⏰ Akun aktif sesuai konfigurasi server.
✅ Selamat menggunakan VPN!
  `.trim();

  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: "Markdown" });
    return true;
  } catch (e) {
    console.error("Gagal mengirim pesan ke user:", e.message);
    return false;
  }
}

module.exports = { bot, sendAccountDetails };
