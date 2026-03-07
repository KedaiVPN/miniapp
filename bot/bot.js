// bot/bot.js - Telegram Bot dengan Telegraf

const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_ID || "").split(",").map(id => id.trim());
const APP_URL = process.env.APP_URL || "https://your-app.com";

// Import koneksi DB untuk mencatat pengguna
const { db } = require("../db/init");

// =============================
// /start - Pesan sambutan
// =============================
bot.start(async (ctx) => {
  const name = ctx.from.first_name || "Pengguna";
  const userId = String(ctx.from.id);
  const username = ctx.from.username || null;

  // Simpan data pengguna ke dalam database saat mereka menekan /start
  db.run(`
    INSERT INTO TelegramUser (telegram_id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name
  `, [userId, username, name], (err) => {
    if (err) console.error("Gagal mencatat pengguna ke DB:", err.message);
  });

  const welcomeText = `
👋 *Halo, ${name}!*
Welcome To *UNIVERSAL SSH* Mini App

Gass akun gratisan coys, Masa aktif account yang kalian buat itu 3 hari. Tolong gunakan account yang kalian buat dengan bijak dan mematuhi rules.🙏

📝Rules:
🚫No DDOS
🚫No Torrent
🚫No Spam
🚫No Multi Login

✅ Support: SSH, Vmess, Vless, Trojan

Klik tombol di bawah untuk membuka aplikasi 👇
  `.trim();

  await ctx.reply(welcomeText, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.webApp("🖱️Buka Mini App", `${APP_URL}?uid=${userId}`)]
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
1️⃣ Ketik /start "Buka Mini App"
2️⃣ Pilih tipe akun (SSH/Vmess/Vless/Trojan)
3️⃣ Pilih server yang tersedia
4️⃣ Isi username (dan password jika SSH)
5️⃣ Selesaikan verifikasi keamanan (cloudflare trunstile)
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

  let baseAccountData = accountData;
  let inline_keyboard = [];
  let linkTexts = [];

  const addLinkOrButton = (label, url) => {
    if (!url || url.length === 0) return null;
    if (url.length <= 256) {
      // Valid for inline button
      return { text: `📋 Copy ${label}`, copy_text: { text: String(url) } };
    } else {
      // Too long for inline button.
      // Do not append to linkTexts here since we already hardcode all strings
      // directly inside the ASCII message body templates.
      return null;
    }
  };

  if (accountData && typeof accountData === "object") {
    let tls = "";
    let nonTls = "";
    let grpc = "";
    let go = "";

    const protoName = protocol?.toLowerCase();

    if (protoName === "ssh") {
      let fallbackDomain = serverDomain || accountData.domain || serverName || "-";
      let fallbackUsr = accountData.username || 'user';
      let fallbackPwd = accountData.password || 'pass';

      tls = accountData.tls || `${fallbackDomain}:443@${fallbackUsr}:${fallbackPwd}`;
      nonTls = accountData.non_tls || `${fallbackDomain}:80@${fallbackUsr}:${fallbackPwd}`;

      // Pisahkan tls dan non_tls dari detail utama khusus untuk SSH
      const { tls: _tls, non_tls: _non_tls, ...rest } = accountData;
      baseAccountData = rest;

      // Hapus block tlsInfo yang lama karena sekarang text format khusus ASCII Border sudah diletakkan di `message` variabel di bawah
      // tlsInfo = `...`;  (Dihapus karena redundancy)

      let row1 = [];
      const btnTls = addLinkOrButton("TLS", tls);
      const btnNonTls = addLinkOrButton("NON TLS", nonTls);
      if (btnTls) row1.push(btnTls);
      if (btnNonTls) row1.push(btnNonTls);
      if (row1.length > 0) inline_keyboard.push(row1);
    } else if (protoName === "vmess" || protoName === "vless") {
      for (const [key, val] of Object.entries(accountData)) {
        if (key.includes("tls") && !key.includes("non")) {
          tls = val;
        } else if (key.includes("non") && key.includes("tls")) {
          nonTls = val;
        } else if (key.includes("grpc")) {
          grpc = val;
        }
      }

      let row1 = [];
      const btnTls = addLinkOrButton("TLS", tls);
      const btnNonTls = addLinkOrButton("NON TLS", nonTls);
      if (btnTls) row1.push(btnTls);
      if (btnNonTls) row1.push(btnNonTls);
      if (row1.length > 0) inline_keyboard.push(row1);

      const btnGrpc = addLinkOrButton("GRPC", grpc);
      if (btnGrpc) {
        inline_keyboard.push([btnGrpc]);
      }
    } else if (protoName === "trojan") {
      for (const [key, val] of Object.entries(accountData)) {
        if (key.includes("tls")) {
          tls = val;
        } else if (key.includes("go")) {
          go = val;
        } else if (key.includes("grpc")) {
          grpc = val;
        }
      }

      let row1 = [];
      const btnTls = addLinkOrButton("TLS", tls);
      const btnGo = addLinkOrButton("GO", go);
      if (btnTls) row1.push(btnTls);
      if (btnGo) row1.push(btnGo);
      if (row1.length > 0) inline_keyboard.push(row1);

      const btnGrpc = addLinkOrButton("GRPC", grpc);
      if (btnGrpc) {
        inline_keyboard.push([btnGrpc]);
      }
    }
  }

  const protoName = protocol?.toLowerCase();
  let message = "";

  if (protoName === "ssh") {
    const usr = accountData?.username || "-";
    const pwd = accountData?.password || "-";
    const exp = accountData?.expired || accountData?.duration || "-";
    const ipLmt = accountData?.ip_limit || "-";
    const domain = serverDomain || accountData?.domain || serverName || "-";

    // Tentukan string TLS/NON-TLS dengan logika fallback karena server API tidak merespon tls/non_tls untuk akun SSH
    let fallbackTls = accountData?.tls || `${domain}:443@${usr}:${pwd}`;
    let fallbackNonTls = accountData?.non_tls || `${domain}:80@${usr}:${pwd}`;

    const sshTlsStr = String(fallbackTls).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sshNonTlsStr = String(fallbackNonTls).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    message = `
🔹 <b>Informasi Akun Anda</b>
┌─────────────────────
│ Username : <code>${usr}</code>
│ Password : <code>${pwd}</code>
└─────────────────────
┌─────────────────────
│ Domain   : <code>${domain}</code>
│ SSH WS   : 80
│ SSL/TLS  : 443
└─────────────────────
🔗 <b>FORMAT AKUN</b>
───────────────────────
<b>TLS:</b>
<code>${sshTlsStr}</code>
───────────────────────
<b>NON TLS:</b>
<code>${sshNonTlsStr}</code>
┌─────────────────────
│ Expired: ${exp}
│ IP Limit: ${ipLmt} Device
└─────────────────────
    `.trim();
  } else {
    // Tampilan format ASCII Custom untuk VMESS, VLESS, TROJAN
    const usr = accountData?.username || "-";
    const domain = serverDomain || accountData?.domain || serverName || "-";
    const exp = accountData?.expired || accountData?.duration || "-";
    const ipLmt = accountData?.ip_limit || "-";
    const quota = accountData?.quota || "Unlimited";
    const uuid = accountData?.uuid || accountData?.password || "-";
    const upProto = protocol?.toUpperCase();

    const escapeHTML = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let tlsStr = "";
    let nonTlsStr = "";
    let grpcStr = "";

    if (protoName === "vmess" || protoName === "vless") {
      for (const [key, val] of Object.entries(accountData || {})) {
        if (key.includes("tls") && !key.includes("non")) tlsStr = escapeHTML(val);
        else if (key.includes("non") && key.includes("tls")) nonTlsStr = escapeHTML(val);
        else if (key.includes("grpc")) grpcStr = escapeHTML(val);
      }

      message = `
🔹 <b>Informasi Akun Anda</b>
┌─────────────────────
│ Username : <code>${usr}</code>
│ Domain   : <code>${domain}</code>
│ Port TLS : 443
│ Port HTTP: 80
└─────────────────────
<b>${upProto} TLS</b>
<code>${tlsStr}</code>
──────────────────────
<b>${upProto} NON TLS</b>
<code>${nonTlsStr}</code>
──────────────────────
<b>${upProto} GRPC</b>
<code>${grpcStr}</code>
──────────────────────
🔒 <b>UUID</b>
<code>${uuid}</code>
┌─────────────────────
│ Expired : ${exp}
│ Quota   : ${quota}
│ IP Limit: ${ipLmt} Device
└─────────────────────
      `.trim();
    } else if (protoName === "trojan") {
      for (const [key, val] of Object.entries(accountData || {})) {
        if (key.includes("tls")) tlsStr = escapeHTML(val);
        else if (key.includes("go")) nonTlsStr = escapeHTML(val); // nonTlsStr digunakan untuk GO di Trojan
        else if (key.includes("grpc")) grpcStr = escapeHTML(val);
      }

      message = `
🔹 <b>Informasi Akun Anda</b>
┌─────────────────────
│ Username : <code>${usr}</code>
│ Domain   : <code>${domain}</code>
│ Port TLS : 443
│ Port HTTP: 80
└─────────────────────
<b>${upProto} TLS</b>
<code>${tlsStr}</code>
──────────────────────
<b>${upProto} GO</b>
<code>${nonTlsStr}</code>
──────────────────────
<b>${upProto} GRPC</b>
<code>${grpcStr}</code>
──────────────────────
🔒 <b>UUID / Password</b>
<code>${uuid}</code>
┌─────────────────────
│ Expired : ${exp}
│ Quota   : ${quota}
│ IP Limit: ${ipLmt} Device
└─────────────────────
      `.trim();
    }
  }

  const extra = { parse_mode: "HTML" };
  
  if (inline_keyboard.length > 0) {
    extra.reply_markup = { inline_keyboard };
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
