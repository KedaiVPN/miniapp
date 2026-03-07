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
async function sendAccountDetails(telegramId, accountData, protocol, serverName, serverDomain) {
  const protocolEmoji = {
    ssh: "🔐",
    vmess: "💎",
    vless: "⚡",
    trojan: "🛡️"
  };

  const emoji = protocolEmoji[protocol?.toLowerCase()] || "📦";

  let tlsInfo = "";
  let baseAccountData = accountData;

  if (protocol?.toLowerCase() === "ssh" && accountData && typeof accountData === "object") {
    // Ekstrak tls dan non_tls jika ada (dari payload front-end)
    // Jika tidak ada dari front-end tapi kita punya serverDomain, kita generate
    const tls = accountData.tls || (serverDomain ? `${serverDomain}:443@${accountData.username || 'user'}:${accountData.password || 'pass'}` : '');
    const non_tls = accountData.non_tls || (serverDomain ? `${serverDomain}:80@${accountData.username || 'user'}:${accountData.password || 'pass'}` : '');
    
    // Jangan tampilkan tls dan non_tls di dalam blok JSON utama
    const { tls: _tls, non_tls: _non_tls, ...rest } = accountData;
    baseAccountData = rest;

    if (tls && non_tls) {
      tlsInfo = `
TLS:
\`${tls}\`

NON TLS:
\`${non_tls}\`
`;
    }
  }

  let message = `
${emoji} *Akun ${protocol?.toUpperCase()} Berhasil Dibuat!*

🖥️ *Server:* ${serverName}
📋 *Detail Akun:*
\`\`\`
${typeof baseAccountData === "object" ? JSON.stringify(baseAccountData, null, 2) : baseAccountData}
\`\`\`
${tlsInfo}
⏰ Akun aktif sesuai konfigurasi server.
✅ Selamat menggunakan VPN!
  `.trim();

  const extra = { parse_mode: "Markdown" };
  
  if (tlsInfo) {
    // Tambahkan tombol copy menggunakan fitur copy_text Telegram (Bot API 7.0+)
    extra.reply_markup = {
      inline_keyboard: [
        [
          { text: "📋 Copy TLS", copy_text: { text: accountData.tls || (serverDomain ? `${serverDomain}:443@${accountData.username || 'user'}:${accountData.password || 'pass'}` : '') } },
          { text: "📋 Copy NON TLS", copy_text: { text: accountData.non_tls || (serverDomain ? `${serverDomain}:80@${accountData.username || 'user'}:${accountData.password || 'pass'}` : '') } }
        ]
      ]
    };
  }

  try {
    await bot.telegram.sendMessage(telegramId, message, extra);
    return true;
  } catch (e) {
    console.error("Gagal mengirim pesan ke user:", e.message);
    return false;
  }
}

module.exports = { bot, sendAccountDetails };
