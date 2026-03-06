// public/js/app.js - Frontend Logic untuk Mini App

const tg = window.Telegram?.WebApp;

// Inisialisasi Telegram Web App
if (tg) {
  tg.ready();
  tg.expand();
}

// ========================
// State
// ========================
let currentProtocol = "ssh";
let servers = [];
let turnstileToken = null;
let turnstileWidgetId = null;
let siteKey = "";

// ========================
// Inisialisasi
// ========================
(async function init() {
  try {
    // Ambil konfigurasi dari backend (termasuk Turnstile site key)
    const cfgRes = await fetch("/api/config");
    const cfg = await cfgRes.json();
    siteKey = cfg.turnstileSiteKey || "";

    // Render Turnstile setelah dapat site key
    renderTurnstile();

    // Ambil daftar server
    await loadServers();

    // Cek apakah user adalah admin
    checkAdminAccess();
  } catch (e) {
    showToast("Gagal memuat konfigurasi.", "error");
    console.error(e);
  }
})();

// ========================
// Load Server dari API
// ========================
async function loadServers() {
  try {
    const res = await fetch("/api/servers");
    const json = await res.json();

    servers = json.data || [];
    const select = document.getElementById("serverSelect");

    if (servers.length === 0) {
      select.innerHTML = `<option value="">Tidak ada server tersedia</option>`;
      return;
    }

    select.innerHTML = `<option value="">-- Pilih Server --</option>` +
      servers.map(s => `<option value="${s.id}">${s.name}</option>`).join("");

  } catch (e) {
    document.getElementById("serverSelect").innerHTML =
      `<option value="">Gagal memuat server</option>`;
  }
}

// ========================
// Pilih Protokol
// ========================
function selectProtocol(btn, proto) {
  document.querySelectorAll(".proto-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentProtocol = proto;

  // Tampilkan/sembunyikan password field
  const pwGroup = document.getElementById("passwordGroup");
  pwGroup.style.display = proto === "ssh" ? "block" : "none";
  if (proto !== "ssh") {
    document.getElementById("password").value = "";
  }
}

// ========================
// Saat Server Berubah
// ========================
function onServerChange() {
  const serverId = document.getElementById("serverSelect").value;
  const infoBox = document.getElementById("serverInfo");

  if (!serverId) {
    infoBox.style.display = "none";
    return;
  }

  const server = servers.find(s => String(s.id) === String(serverId));
  if (!server) return;

  document.getElementById("infoDuration").textContent = `${server.duration} Hari`;
  document.getElementById("infoQuota").textContent = server.quota > 0 ? `${server.quota} GB` : "Unlimited";
  document.getElementById("infoIpLimit").textContent = `${server.ip_limit} Device`;

  infoBox.style.display = "block";
}

// ========================
// Render Turnstile
// ========================
function renderTurnstile() {
  if (!siteKey || !window.turnstile) {
    // Coba lagi setelah script load
    setTimeout(renderTurnstile, 500);
    return;
  }

  turnstileWidgetId = window.turnstile.render("#turnstileWidget", {
    sitekey: siteKey,
    theme: "dark",
    callback: (token) => {
      turnstileToken = token;
    },
    "expired-callback": () => {
      turnstileToken = null;
    },
    "error-callback": () => {
      turnstileToken = null;
      showToast("Turnstile error, coba refresh.", "error");
    }
  });
}

// ========================
// Submit Form
// ========================
async function submitForm() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const serverId = document.getElementById("serverSelect").value;

  // Validasi
  if (!username) return showToast("Username wajib diisi!", "error");
  if (!serverId) return showToast("Pilih server terlebih dahulu!", "error");
  if (currentProtocol === "ssh" && !password) return showToast("Password wajib diisi untuk SSH!", "error");
  if (!turnstileToken) return showToast("Selesaikan verifikasi keamanan!", "error");

  // Verifikasi Turnstile ke backend
  try {
    const verRes = await fetch("/api/verify-turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: turnstileToken })
    });
    const verData = await verRes.json();
    if (!verData.success) {
      turnstileToken = null;
      window.turnstile?.reset(turnstileWidgetId);
      return showToast("Verifikasi gagal, coba lagi!", "error");
    }
  } catch (e) {
    return showToast("Gagal verifikasi, coba lagi!", "error");
  }

  // Ambil data server
  const server = servers.find(s => String(s.id) === String(serverId));
  if (!server) return showToast("Server tidak valid!", "error");

  // Ambil Telegram user ID
  const userId = tg?.initDataUnsafe?.user?.id || getQueryParam("uid") || null;

  // Set loading state
  setLoading(true);

  try {
    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId,
        username: username,
        password: currentProtocol === "ssh" ? password : "",
        protocol: currentProtocol,
        serverId: serverId,
        duration: server.duration,
        quota: server.quota,
        ipLimit: server.ip_limit
      })
    });

    const data = await res.json();

    if (data.success) {
      // Kirim notifikasi ke Telegram
      if (userId) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramId: userId,
            accountData: data.data,
            protocol: currentProtocol,
            serverName: server.name
          })
        });
      }

      showResult(data.data);
    } else {
      showToast(data.message || "Gagal membuat akun.", "error");
      window.turnstile?.reset(turnstileWidgetId);
      turnstileToken = null;
    }
  } catch (e) {
    showToast("Terjadi kesalahan. Coba lagi.", "error");
    console.error(e);
  } finally {
    setLoading(false);
  }
}

// ========================
// Tampilkan Hasil
// ========================
function showResult(data) {
  const formCard = document.getElementById("formCard");
  const resultCard = document.getElementById("resultCard");
  const resultDetail = document.getElementById("resultDetail");

  formCard.style.display = "none";

  // Format data akun
  let html = "";
  if (typeof data === "object" && data !== null) {
    for (const [key, val] of Object.entries(data)) {
      html += `<div style="margin-bottom:6px;">
        <span style="color:#8b8b9a;font-size:12px;">${key.toUpperCase()}</span><br/>
        <span style="font-weight:600;">${val}</span>
      </div>`;
    }
  } else {
    html = `<span>${data}</span>`;
  }

  resultDetail.innerHTML = html;
  resultCard.style.display = "block";

  // Haptic feedback
  tg?.HapticFeedback?.notificationOccurred("success");
}

// ========================
// Reset Form
// ========================
function resetForm() {
  document.getElementById("formCard").style.display = "block";
  document.getElementById("resultCard").style.display = "none";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("serverSelect").value = "";
  document.getElementById("serverInfo").style.display = "none";
  turnstileToken = null;
  window.turnstile?.reset(turnstileWidgetId);
}

// ========================
// Cek Admin Access
// ========================
function checkAdminAccess() {
  const isAdmin = getQueryParam("admin") === "true";
  if (isAdmin) {
    const header = document.querySelector(".header");
    const badge = document.createElement("div");
    badge.className = "admin-badge";
    badge.innerHTML = "👑 Admin Mode";
    header.appendChild(badge);
  }
}

// ========================
// Helpers
// ========================
function setLoading(loading) {
  const btn = document.getElementById("btnCreate");
  const btnText = document.getElementById("btnText");
  const btnLoader = document.getElementById("btnLoader");

  btn.disabled = loading;
  btnText.style.display = loading ? "none" : "inline";
  btnLoader.style.display = loading ? "inline" : "none";
}

function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
