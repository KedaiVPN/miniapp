// public/js/admin.js - Logic Panel Admin

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// Ambil Telegram ID dari query param atau Telegram WebApp
const telegramId = tg?.initDataUnsafe?.user?.id || getQueryParam("uid") || "";

// ========================
// Inisialisasi
// ========================
(async function init() {
  if (!telegramId) {
    showAuthError();
    return;
  }

  // Verifikasi admin di backend (cek header x-telegram-id)
  try {
    const res = await fetch("/api/servers/all", {
      headers: { "x-telegram-id": telegramId }
    });

    if (res.status === 403) {
      showAuthError();
      return;
    }

    document.getElementById("adminPanel").style.display = "block";
    const json = await res.json();
    renderServers(json.data || []);
  } catch (e) {
    showAuthError();
  }
})();

// ========================
// Render Daftar Server
// ========================
function renderServers(servers) {
  const list = document.getElementById("serverList");
  const active = servers.filter(s => s.is_active);

  // Update stats
  document.getElementById("statTotal").textContent = servers.length;
  document.getElementById("statActive").textContent = active.length;
  const totalAkun = servers.reduce((sum, s) => sum + (s.total_create_akun || 0), 0);
  document.getElementById("statAccounts").textContent = totalAkun;

  if (servers.length === 0) {
    list.innerHTML = `<div class="loading-text">Belum ada server. Tambah server baru!</div>`;
    return;
  }

  list.innerHTML = servers.map(s => `
    <div class="server-item ${s.is_active ? "" : "inactive"}">
      <div class="server-header">
        <div class="server-name">
          <span class="server-status ${s.is_active ? "" : "offline"}"></span>
          ${escHtml(s.name)}
        </div>
        <span style="font-size:11px;color:var(--hint);">${s.total_create_akun || 0} akun</span>
      </div>
      <div class="server-domain">🌐 ${escHtml(s.domain)}</div>
      <div class="server-meta">
        <span class="meta-tag">⏱️ ${s.duration} Hari</span>
        <span class="meta-tag">📶 ${s.quota > 0 ? s.quota + " GB" : "∞"}</span>
        <span class="meta-tag">🖥️ ${s.ip_limit} IP</span>
        <span class="meta-tag">${s.is_active ? "✅ Aktif" : "❌ Nonaktif"}</span>
      </div>
      <div class="server-actions">
        <button class="btn-edit" onclick="openEditModal(${s.id})">✏️ Edit</button>
        <button class="btn-delete" onclick="deleteServer(${s.id}, '${escHtml(s.name)}')">🗑️ Hapus</button>
      </div>
    </div>
  `).join("");
}

// ========================
// Refresh server list
// ========================
async function refreshServers() {
  try {
    const res = await fetch("/api/servers/all", {
      headers: { "x-telegram-id": telegramId }
    });
    const json = await res.json();
    renderServers(json.data || []);
  } catch (e) {
    showToast("Gagal refresh data", "error");
  }
}

// ========================
// Modal - Buka Tambah
// ========================
function openModal() {
  document.getElementById("modalTitle").textContent = "➕ Tambah Server";
  document.getElementById("editServerId").value = "";
  document.getElementById("mName").value = "";
  document.getElementById("mDomain").value = "";
  document.getElementById("mAuth").value = "";
  document.getElementById("mDuration").value = "30";
  document.getElementById("mQuota").value = "0";
  document.getElementById("mIpLimit").value = "2";
  document.getElementById("statusGroup").style.display = "none";
  document.getElementById("modalOverlay").classList.add("open");
}

// ========================
// Modal - Buka Edit
// ========================
async function openEditModal(serverId) {
  try {
    const res = await fetch("/api/servers/all", {
      headers: { "x-telegram-id": telegramId }
    });
    const json = await res.json();
    const server = json.data?.find(s => s.id === serverId);
    if (!server) return showToast("Server tidak ditemukan", "error");

    document.getElementById("modalTitle").textContent = "✏️ Edit Server";
    document.getElementById("editServerId").value = server.id;
    document.getElementById("mName").value = server.name;
    document.getElementById("mDomain").value = server.domain;
    document.getElementById("mAuth").value = server.auth;
    document.getElementById("mDuration").value = server.duration;
    document.getElementById("mQuota").value = server.quota;
    document.getElementById("mIpLimit").value = server.ip_limit;
    document.getElementById("mStatus").value = server.is_active;
    document.getElementById("statusGroup").style.display = "block";

    document.getElementById("modalOverlay").classList.add("open");
  } catch (e) {
    showToast("Gagal mengambil data server", "error");
  }
}

// ========================
// Modal - Tutup
// ========================
function closeModal(event) {
  if (event && event.target !== document.getElementById("modalOverlay")) return;
  document.getElementById("modalOverlay").classList.remove("open");
}

// ========================
// Simpan Server (Add/Edit)
// ========================
async function saveServer() {
  const editId = document.getElementById("editServerId").value;
  const isEdit = !!editId;

  const body = {
    name: document.getElementById("mName").value.trim(),
    domain: document.getElementById("mDomain").value.trim(),
    auth: document.getElementById("mAuth").value.trim(),
    duration: parseInt(document.getElementById("mDuration").value) || 30,
    quota: parseInt(document.getElementById("mQuota").value) || 0,
    ip_limit: parseInt(document.getElementById("mIpLimit").value) || 2,
    is_active: isEdit ? parseInt(document.getElementById("mStatus").value) : 1,
    telegramId: telegramId
  };

  if (!body.name || !body.domain || !body.auth) {
    return showToast("Nama, domain, dan auth wajib diisi!", "error");
  }

  try {
    const url = isEdit ? `/api/servers/${editId}` : "/api/servers";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-telegram-id": telegramId
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message, "success");
      document.getElementById("modalOverlay").classList.remove("open");
      refreshServers();
      tg?.HapticFeedback?.notificationOccurred("success");
    } else {
      showToast(data.message || "Gagal menyimpan", "error");
    }
  } catch (e) {
    showToast("Terjadi kesalahan", "error");
  }
}

// ========================
// Hapus Server
// ========================
async function deleteServer(serverId, serverName) {
  if (!confirm(`Yakin ingin menghapus server "${serverName}"?`)) return;

  try {
    const res = await fetch(`/api/servers/${serverId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-id": telegramId
      },
      body: JSON.stringify({ telegramId })
    });

    const data = await res.json();

    if (data.success) {
      showToast("Server berhasil dihapus", "success");
      refreshServers();
    } else {
      showToast(data.message || "Gagal menghapus server", "error");
    }
  } catch (e) {
    showToast("Terjadi kesalahan", "error");
  }
}

// ========================
// Auth Error
// ========================
function showAuthError() {
  document.getElementById("authError").style.display = "block";
  document.getElementById("adminPanel").style.display = "none";
}

// ========================
// Helpers
// ========================
function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}
