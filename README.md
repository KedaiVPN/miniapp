# 🔐 VPN Account Generator - Telegram Mini App

Aplikasi Telegram Mini App untuk membuat akun VPN (SSH, Vmess, Vless, Trojan) langsung dari Telegram.

---

## 📁 Struktur Proyek

```
vpn-miniapp/
├── index.js              # Entry point utama
├── package.json
├── .env.example          # Template konfigurasi
├── bot/
│   └── bot.js            # Telegram Bot (Telegraf)
├── db/
│   └── init.js           # Inisialisasi SQLite3
├── routes/
│   ├── create.js         # API pembuatan akun VPN
│   ├── servers.js        # API manajemen server
│   └── verify.js         # Verifikasi Cloudflare Turnstile
└── public/
    ├── index.html        # Halaman Mini App (user)
    ├── admin/
    │   └── index.html    # Panel Admin
    ├── css/
    │   ├── style.css     # Style utama
    │   └── admin.css     # Style panel admin
    └── js/
        ├── app.js        # Logic frontend user
        └── admin.js      # Logic frontend admin
```

---

## ⚙️ Cara Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd vpn-miniapp
npm install
```

### 2. Konfigurasi `.env`

```bash
cp .env.example .env
```

Edit file `.env` dan isi semua nilai yang diperlukan:

| Variabel | Keterangan |
|---|---|
| `BOT_TOKEN` | Token bot dari @BotFather |
| `APP_URL` | URL publik aplikasi (HTTPS, wajib untuk Mini App) |
| `PORT` | Port server Express (default: 3000) |
| `ADMIN_IDS` | ID Telegram admin, pisahkan koma jika lebih dari satu |
| `TURNSTILE_SITE_KEY` | Site key dari Cloudflare Turnstile Dashboard |
| `TURNSTILE_SECRET_KEY` | Secret key dari Cloudflare Turnstile Dashboard |

### 3. Setup Cloudflare Turnstile

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pilih **Turnstile** → **Add Site**
3. Masukkan domain kamu
4. Salin **Site Key** dan **Secret Key** ke `.env`

### 4. Jalankan Aplikasi

```bash
# Development
npm run dev

# Production
npm start
```

---

## 🤖 Perintah Bot

| Perintah | Fungsi |
|---|---|
| `/start` | Buka aplikasi VPN |
| `/admin` | Buka panel admin (hanya untuk admin) |
| `/help` | Tampilkan panduan |

---

## 🌐 Endpoint API

| Method | Route | Akses | Fungsi |
|---|---|---|---|
| `GET` | `/api/servers` | Publik | Ambil daftar server aktif |
| `GET` | `/api/servers/all` | Admin | Semua server |
| `POST` | `/api/servers` | Admin | Tambah server |
| `PUT` | `/api/servers/:id` | Admin | Edit server |
| `DELETE` | `/api/servers/:id` | Admin | Hapus server |
| `POST` | `/api/create` | Publik | Buat akun VPN |
| `POST` | `/api/verify-turnstile` | Publik | Verifikasi Turnstile |
| `GET` | `/api/config` | Publik | Konfigurasi publik |
| `POST` | `/api/notify` | Internal | Kirim notifikasi ke user |

---

## 🗄️ Skema Database (SQLite3)

### Tabel `Server`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER | Primary key |
| name | TEXT | Nama server |
| domain | TEXT | Domain server |
| auth | TEXT | Auth key API |
| duration | INTEGER | Masa aktif (hari) |
| ip_limit | INTEGER | Limit IP per akun |
| quota | INTEGER | Kuota (GB), 0 = unlimited |
| is_active | INTEGER | 1=aktif, 0=nonaktif |
| total_create_akun | INTEGER | Counter akun dibuat |

### Tabel `User`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER | Primary key |
| telegram_id | TEXT | ID Telegram user |
| username | TEXT | Username akun VPN |
| password | TEXT | Password (SSH) |
| protocol | TEXT | ssh/vmess/vless/trojan |
| server_id | INTEGER | FK ke Server |
| duration | INTEGER | Masa aktif |
| quota | INTEGER | Kuota |
| ip_limit | INTEGER | Limit IP |

### Tabel `Log`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER | Primary key |
| telegram_id | TEXT | ID Telegram |
| action | TEXT | Jenis aksi |
| detail | TEXT | Detail aksi |
| status | TEXT | success/failed/error |

---

## 🚀 Deploy ke VPS

```bash
# Install PM2
npm install -g pm2

# Jalankan dengan PM2
pm2 start index.js --name vpn-miniapp

# Auto-start saat reboot
pm2 startup
pm2 save
```

Pastikan domain kamu sudah mengarah ke VPS dan SSL aktif (Nginx + Certbot direkomendasikan).
