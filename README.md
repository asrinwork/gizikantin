# 🥗 GiziKantin — Aplikasi Pemantauan Gizi Siswa Berbasis Kantin Sekolah

Aplikasi web responsif (dapat diakses via HP & desktop) untuk memantau asupan gizi siswa berdasarkan transaksi pembelian makanan di kantin sekolah. Guru dan kepala sekolah dapat melihat status gizi setiap siswa secara harian: **Kurang ⚠️**, **Ideal ✅**, atau **Berlebih ❌**.

> Dibuat dengan **React + Vite + Tailwind CSS** dan **Lovable Cloud** (Supabase: PostgreSQL, Auth, Edge Functions, RLS).

---

## 📑 Daftar Isi

1. [Latar Belakang](#-latar-belakang)
2. [Fitur Utama](#-fitur-utama)
3. [Stack Teknologi](#-stack-teknologi)
4. [Arsitektur](#-arsitektur)
5. [Struktur Database](#-struktur-database)
6. [Peran Pengguna (RBAC)](#-peran-pengguna-rbac)
7. [Logika Klasifikasi Gizi](#-logika-klasifikasi-gizi)
8. [Akun Demo](#-akun-demo)
9. [Cara Menjalankan Lokal](#-cara-menjalankan-lokal)
10. [Struktur Folder](#-struktur-folder)
11. [Routing & Halaman](#-routing--halaman)
12. [Edge Functions](#-edge-functions)
13. [Keamanan (RLS)](#-keamanan-rls)
14. [Design System](#-design-system)
15. [Cara Mengisi Data agar Status "Ideal"](#-cara-mengisi-data-agar-status-ideal)
16. [Deployment](#-deployment)
17. [Roadmap](#-roadmap)

---

## 📌 Latar Belakang

Kesehatan dan kecukupan gizi siswa merupakan faktor penting dalam menunjang konsentrasi belajar dan perkembangan fisik anak. Sebagian besar sekolah belum memiliki sistem yang dapat memantau asupan gizi siswa secara terukur dan berkelanjutan.

Kantin sekolah sebagai penyedia makanan memiliki peran penting. **GiziKantin** menjembatani transaksi kantin dengan pemantauan gizi siswa secara real-time, sehingga sekolah dapat mengevaluasi pola makan dan memberi rekomendasi.

---

## ✨ Fitur Utama

### 👨‍💼 Modul Admin
- Manajemen data master siswa (NIS, nama, kelas, jenis kelamin, tanggal lahir).
- Konfigurasi target gizi harian (AKG) sekolah: kalori, protein, karbohidrat, lemak, gula.
- Manajemen makanan kantin.
- Akses penuh ke seluruh modul.

### 🍱 Modul Kantin
- Master data makanan (nama, kalori, protein, karbo, lemak, gula, harga).
- Pencatatan transaksi konsumsi siswa (siswa × makanan × jumlah porsi).
- Riwayat transaksi terbaru.

### 👩‍🏫 Modul Guru (Dashboard)
- Daftar siswa dengan status gizi harian (✅ Ideal / ⚠️ Kurang / ❌ Berlebih).
- Detail per siswa: total kalori, protein, karbo, lemak, gula hari ini.
- Riwayat sederhana 7 hari terakhir.
- Statistik agregat sekolah.

### 🔐 Otentikasi
- Sign up / sign in via email & password.
- Role-Based Access Control (admin / guru / kantin).
- 3 akun demo siap pakai (lihat di bawah).

---

## 🛠 Stack Teknologi

| Layer | Teknologi |
|---|---|
| Frontend | React 18, Vite 5, TypeScript 5 |
| Styling | Tailwind CSS v3, shadcn/ui, Lucide Icons |
| Routing | React Router v6 |
| Data fetching | TanStack Query, Supabase JS Client |
| Backend | **Lovable Cloud** (Supabase) |
| Database | PostgreSQL (managed) |
| Auth | Supabase Auth (email/password) |
| Serverless | Supabase Edge Functions (Deno) |
| Form & Toast | react-hook-form + sonner |

---

## 🏗 Arsitektur

```
┌────────────────────────────────────────────────────────┐
│                    React SPA (Vite)                    │
│   Pages → Hooks (useAuth) → Supabase JS Client         │
└──────────────────────┬─────────────────────────────────┘
                       │ HTTPS + JWT
                       ▼
┌────────────────────────────────────────────────────────┐
│                 Lovable Cloud (Supabase)               │
│  ┌──────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ Postgres │  │    Auth     │  │  Edge Functions   │  │
│  │  + RLS   │  │ (email/pwd) │  │ seed-demo-users   │  │
│  └──────────┘  └─────────────┘  └───────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 🗄 Struktur Database

| Tabel | Deskripsi |
|---|---|
| `profiles` | Profil pengguna (mirror `auth.users`). Auto-created via trigger `handle_new_user`. |
| `user_roles` | Role pengguna (`admin` / `guru` / `kantin`). **Terpisah** dari `profiles` untuk mencegah privilege escalation. |
| `students` | Data siswa (NIS, nama, kelas, gender, tanggal lahir). |
| `foods` | Daftar makanan kantin + nilai gizi (kkal, protein, karbo, lemak, gula) + harga. |
| `transactions` | Catatan konsumsi siswa: `student_id × food_id × quantity × consumed_at`. |
| `nutrition_targets` | Target AKG harian sekolah (default: 2000 kkal, 50g protein, 275g karbo, 65g lemak, 50g gula). |

### Database Functions
- `has_role(_user_id uuid, _role app_role)` — SECURITY DEFINER untuk RLS, mencegah recursive RLS.
- `get_my_roles()` — Ambil daftar role user yang sedang login.
- `handle_new_user()` — Trigger pasca-signup: insert ke `profiles`, assign role (user pertama jadi `admin`, sisanya jadi `guru` default).

---

## 👥 Peran Pengguna (RBAC)

| Role | Akses |
|---|---|
| **admin** | Semua modul (siswa, makanan, transaksi, target gizi, dashboard). |
| **kantin** | Modul makanan & transaksi + dashboard (read-only siswa). |
| **guru** | Dashboard saja (read-only). |

Routing di `src/App.tsx` membungkus halaman dengan `<ProtectedRoute roles={[...]}>`.

---

## 📊 Logika Klasifikasi Gizi

Logika tersentralisasi di **`src/lib/nutrition.ts`**.

Status gizi siswa dihitung dari **% kalori dikonsumsi vs target harian**:

| Status | Persentase | Label | Warna |
|---|---|---|---|
| ⚠️ Kurang | `< 80%` | Kurang | warning (kuning) |
| ✅ Ideal | `80% – 110%` | Ideal | success (hijau) |
| ❌ Berlebih | `> 110%` | Berlebih | destructive (merah) |

```ts
export const computeStatus = (consumed: number, target: number) => {
  const pct = (consumed / target) * 100;
  if (pct < 80) return "kurang";
  if (pct > 110) return "berlebih";
  return "ideal";
};
```

---

## 🔑 Akun Demo

Tersedia 3 akun demo siap pakai (di-seed via Edge Function `seed-demo-users`). Tombol shortcut tersedia di halaman `/auth`.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@gizikantin.demo` | `Admin#1234` |
| Guru | `guru@gizikantin.demo` | `Guru#1234` |
| Kantin | `kantin@gizikantin.demo` | `Kantin#1234` |

> Untuk membuat akun baru, kunjungi `/auth` dan pilih tab **Daftar**.

---

## 🚀 Cara Menjalankan Lokal

### Prasyarat
- Node.js 18+ atau Bun
- Akses ke project Lovable Cloud (kunci sudah otomatis di-inject di `.env`)

### Langkah
```bash
# Install dependency
npm install

# Jalankan dev server
npm run dev

# Build production
npm run build

# Preview production build
npm run preview

# Jalankan tests
npm run test
```

App berjalan di `http://localhost:8080` (default Vite Lovable).

---

## 📁 Struktur Folder

```
src/
├── components/
│   ├── AppLayout.tsx        # Layout utama dengan sidebar/nav
│   ├── NavLink.tsx          # Item navigasi
│   ├── ProtectedRoute.tsx   # Guard berbasis role
│   └── ui/                  # shadcn/ui components
├── hooks/
│   ├── useAuth.tsx          # Context auth + roles
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── integrations/supabase/
│   ├── client.ts            # Supabase JS client (auto-generated)
│   └── types.ts             # DB types (auto-generated)
├── lib/
│   ├── nutrition.ts         # Logika klasifikasi gizi
│   └── utils.ts
├── pages/
│   ├── Auth.tsx             # Sign in / Sign up + akun demo
│   ├── Dashboard.tsx        # Status gizi harian semua siswa
│   ├── Transactions.tsx     # Catat konsumsi (kantin/admin)
│   ├── Foods.tsx            # CRUD makanan (kantin/admin)
│   ├── Students.tsx         # CRUD siswa (admin)
│   ├── Target.tsx           # Set target AKG (admin)
│   └── NotFound.tsx
├── index.css                # Design tokens HSL
└── main.tsx

supabase/
├── config.toml
├── functions/
│   └── seed-demo-users/     # Edge Function buat akun demo
└── migrations/              # SQL migrations
```

---

## 🧭 Routing & Halaman

| Path | Halaman | Role yang Diizinkan |
|---|---|---|
| `/auth` | Login & Sign Up | Public |
| `/` | Dashboard (status gizi siswa) | semua role login |
| `/transaksi` | Catat transaksi kantin | `kantin`, `admin` |
| `/makanan` | Master data makanan | `kantin`, `admin` |
| `/siswa` | Master data siswa | `admin` |
| `/target` | Konfigurasi target AKG | `admin` |
| `*` | 404 NotFound | — |

---

## ⚡ Edge Functions

### `seed-demo-users`
Membuat 3 akun demo (admin, guru, kantin) menggunakan service role:
- `email_confirm: true` agar bisa langsung login.
- Auto-create row di `profiles` dan `user_roles`.
- Idempoten: jika user sudah ada, password & role akan di-reset.

Konfigurasi: `verify_jwt = false` (publik, dipanggil sekali untuk seeding).

---

## 🛡 Keamanan (RLS)

Semua tabel mengaktifkan **Row-Level Security**. Ringkasan policy:

| Tabel | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `profiles` | own profile / admin | own profile / admin |
| `user_roles` | own roles / admin | admin only |
| `students` | semua authenticated | admin |
| `foods` | semua authenticated | kantin / admin |
| `transactions` | semua authenticated | kantin / admin |
| `nutrition_targets` | semua authenticated | admin |

> Pengecekan role **selalu** lewat fungsi `has_role()` (SECURITY DEFINER) agar tidak terjadi RLS recursive.

---

## 🎨 Design System

Tema **"Fresh & Sehat"** dengan dominan hijau, terinspirasi dari kesegaran sayur dan buah.

- **Token warna HSL** didefinisikan di `src/index.css` (`--primary`, `--success`, `--warning`, `--destructive`, dll).
- **Tidak menggunakan** class warna langsung (`bg-green-500`, dll) — semua via semantic tokens.
- Komponen dasar dari **shadcn/ui** dengan variant kustom.
- Responsive mobile-first (sidebar collapse di < 768px).

---

## 🧪 Cara Mengisi Data agar Status "Ideal"

1. Login sebagai **Admin** → cek menu **Target Gizi** (default: 2000 kkal).
2. Login sebagai **Kantin** → buka **Transaksi**.
3. Catat konsumsi siswa hari ini sehingga total kalori berada di **80% – 110%** dari target (≈ 1.600 – 2.200 kkal).

Contoh kombinasi 1 hari (≈ 1.766 kkal = 88% → **Ideal ✅**):
- Nasi Putih (200) + Ayam Goreng (260) + Sayur Sop (70) + Tempe Goreng (190)
- Buah Pisang (90) + Susu Cokelat (180) + Telur Dadar (154)
- Soto Ayam (312) + Tahu Goreng (110) + Pisang Goreng (120) + Buah Apel (80)

---

## 🚢 Deployment

App di-deploy otomatis melalui **Lovable**:

1. Buka project di [Lovable](https://lovable.dev/projects/2df0de61-1d8e-4081-bd8d-bdb487d71d3e).
2. Klik **Share → Publish** untuk dapat URL `*.lovable.app`.
3. (Opsional) Hubungkan **custom domain** di **Project → Settings → Domains** (butuh paket berbayar).

Edge Functions otomatis ter-deploy setiap kali file di `supabase/functions/` berubah.

---

## 🗺 Roadmap

- [ ] Notifikasi otomatis ke wali murid jika status "Berlebih" beberapa hari berturut.
- [ ] Rekomendasi makanan AI (Lovable AI Gateway) berdasarkan kekurangan gizi siswa.
- [ ] Export laporan PDF/Excel mingguan & bulanan.
- [ ] Grafik tren gizi per kelas / per siswa.
- [ ] Mode offline untuk pencatatan transaksi di area kantin.
- [ ] QR code per siswa untuk scan cepat di kasir kantin.

---

## 📄 Lisensi

Project edukasi internal sekolah. Bebas dimodifikasi sesuai kebutuhan masing-masing institusi.

---

**Dibuat dengan ❤️ menggunakan [Lovable](https://lovable.dev).**
