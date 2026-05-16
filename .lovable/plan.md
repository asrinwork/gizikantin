# Rencana Pengembangan GiziKantin Lengkap

Aplikasi diperluas dari sistem POS kantin saat ini menjadi platform multi-role dengan pemesanan siswa, monitoring gizi, dan analitik.

## 1. Keputusan dari Pertanyaan
- **Login Siswa:** Email + password. Admin men-generate akun saat import CSV (email auto pakai NIS/format `nis@sekolah.local`, password default = NIS, harus diganti saat first login).
- **Alur Pemesanan:** Siswa pesan via app → kantin lihat antrian → siswa datang & tunjukkan QR → kantin scan QR untuk verifikasi & menandai "Selesai" (bayar tunai saat ambil).
- **Restriction:** Pesanan **diblokir total** jika total kalori (riwayat hari ini + cart) melebihi target harian siswa.
- **Rekomendasi:** Rule-based — hitung sisa kebutuhan kalori & makro hari ini, ranking menu berdasarkan kecocokan terbaik.
- **Kalkulator BMI:** Dinonaktifkan (tidak dibuat).

## 2. Perubahan Database (Migrasi)

### Tabel baru
- `classes` — daftar kelas (`name`, `grade_level`, `homeroom_teacher_id`).
- `student_profiles` — link ke `auth.users` untuk siswa (`user_id`, `nis`, `full_name`, `class_id`, `gender`, `birth_date`, `height_cm`, `weight_kg`, `activity_level`, `qr_code`). Menggantikan tabel `students` lama (migrasi data).
- `orders` — header pesanan (`student_id`, `status` enum: `pending|ready|completed|cancelled`, `total_calories`, `total_price`, `created_at`, `verified_by`, `verified_at`).
- `order_items` — detail (`order_id`, `food_id`, `quantity`, `unit_calories`, `unit_price`).
- `daily_nutrition_targets` — target per siswa per hari (cache hasil kalkulator Harris-Benedict): `student_id`, `date`, `calories`, `protein`, `carbs`, `fat`, `sugar`.

### Modifikasi
- `user_roles` enum tambah nilai `siswa`.
- `transactions` tetap untuk histori final (di-generate dari order yang completed).

### RLS
- Siswa: hanya bisa SELECT/INSERT data dirinya sendiri.
- Guru: SELECT semua data gizi siswa di kelas yang diampu (atau semua siswa untuk simpel).
- Kantin: SELECT semua order pending, UPDATE status order.
- Admin: full akses.
- Gunakan fungsi `has_role()` yang sudah ada.

### Function/Trigger
- `calculate_daily_target(student_id, date)` — return target kalori/makro (Mifflin-St Jeor + faktor aktivitas).
- Trigger: ketika `orders.status` → `completed`, otomatis insert ke `transactions`.
- Trigger validasi: tolak INSERT order jika `total_calories + sudah_dimakan_hari_ini > target`.

## 3. Halaman & Routing Baru

| Route | Role | Isi |
|---|---|---|
| `/` Dashboard | semua | Konten beda per role (lihat §4) |
| `/menu` | siswa | Browse menu, lihat rekomendasi, tambah ke cart, checkout |
| `/orders` | siswa, kantin | Siswa: riwayat ordernya. Kantin: antrian + scan QR |
| `/profil` | siswa | Data diri, kebutuhan kalori, edit BB/TB |
| `/monitoring` | guru, admin | Tabel siswa + status gizi + filter kelas |
| `/grafik` | guru, admin | Grafik harian/mingguan/bulanan, alert kurang/berlebih |
| `/kelas` | admin | CRUD kelas |
| `/users` | admin | Kelola user (list, ubah role, reset password) |
| `/siswa` | admin | Sudah ada — tambah tombol **Import CSV** |
| `/makanan` | admin, kantin | Sudah ada |
| `/transaksi` | kantin | Sudah ada (POS untuk transaksi walk-in non-order) |
| `/target` | admin | Sudah ada (default target global per kelompok usia) |

## 4. Dashboard per Role
- **Siswa:** Ring progress kalori hari ini, sisa kalori, 3 rekomendasi menu, tombol "Pesan sekarang", QR card.
- **Kantin:** Jumlah order pending, total penjualan hari ini, top menu, tombol scan QR.
- **Guru:** Jumlah siswa diampu, distribusi status gizi (kurang/ideal/berlebih), alert siswa bermasalah, grafik mingguan.
- **Admin:** Total siswa/menu/order, grafik tren konsumsi sekolah, shortcut import CSV.

## 5. Logika Inti

### Kalkulator kebutuhan kalori (`src/lib/calorie.ts`)
- Mifflin-St Jeor BMR berdasarkan gender, BB, TB, usia.
- TDEE = BMR × faktor aktivitas (sedentary 1.2, light 1.375, moderate 1.55, active 1.725).
- Distribusi makro: protein 15%, karbo 55%, lemak 30%, gula max 10% kalori.

### Rekomendasi (`src/lib/recommend.ts`)
- Hitung sisa = target − konsumsi hari ini.
- Score menu = 1 − |menu.kal − sisa.kal|/sisa.kal − penalty(makro overshoot).
- Filter: menu yang kalorinya melebihi sisa kalori dibuang.
- Return top 5.

### Restriction (`src/lib/restriction.ts`)
- Client-side: validasi sebelum submit (UX).
- Server-side: trigger di DB sebagai source of truth.

### Import CSV siswa (`src/lib/csv-import.ts`)
- Parser CSV (papaparse).
- Kolom: `nis,nama,kelas,gender,tgl_lahir,tinggi_cm,berat_kg,aktivitas`.
- Untuk tiap baris: edge function `bulk-create-students` → `supabase.auth.admin.createUser` + insert `student_profiles` + assign role `siswa`.

## 6. Edge Functions Baru
- `bulk-create-students` — terima array siswa, buat akun auth + profile + role (pakai service role key).
- `generate-recommendations` — opsional, untuk caching; sementara client-side cukup.

## 7. Komponen UI Baru
- `CalorieRing` — progress kalori melingkar.
- `MenuCard` — kartu menu dengan badge "Direkomendasi" / "Melebihi kalori".
- `OrderQueueItem` — kartu order untuk kantin.
- `NutritionStatusBadge`.
- `StudentImportDialog` — drag-and-drop CSV + preview + submit.
- `ClassManager`, `UserManager`.
- `NutritionChart` (recharts) — line/bar harian/mingguan/bulanan.

## 8. Update Navigation
Sidebar berubah dinamis berdasarkan role:
- Siswa: Beranda, Menu, Pesanan, Profil
- Kantin: Beranda, Order Masuk, Transaksi POS, Menu, Scan
- Guru: Beranda, Monitoring, Grafik
- Admin: Beranda, Siswa, Kelas, User, Menu, Target, Monitoring, Grafik

## 9. Urutan Implementasi (bertahap)
1. **Migrasi DB** (tabel + RLS + triggers + enum role siswa)
2. **Lib utilitas** (calorie, recommend, restriction, csv-import)
3. **Edge function** `bulk-create-students`
4. **Routing & sidebar dinamis**
5. **Halaman Siswa** (Dashboard, Menu, Pesan, Profil, Pesanan)
6. **Halaman Kantin** (Order queue + scan QR verifikasi)
7. **Halaman Guru** (Monitoring, Grafik dengan recharts)
8. **Halaman Admin** (Import CSV, Kelas, Users)
9. **Update Dashboard utama** per role
10. **Testing** + cleanup README

## 10. Catatan Teknis
- Recharts sudah tersedia di project (`src/components/ui/chart.tsx`).
- `html5-qrcode` & `qrcode` sudah terpasang dari iterasi sebelumnya.
- Auto-confirm email harus diaktifkan agar admin bisa langsung buat akun siswa tanpa verifikasi inbox (siswa pakai email dummy `@sekolah.local`).
- Kalkulator BMI dihapus dari UI sesuai permintaan; field BB/TB tetap disimpan untuk kalkulasi kalori.

## 11. Yang TIDAK termasuk
- Pembayaran cashless / e-wallet (tetap tunai).
- Notifikasi push.
- Mobile app native.
- Kalkulator BMI/obesitas (dinonaktifkan).

---

Setelah disetujui, saya mulai dari migrasi DB dulu (karena perubahannya besar dan butuh approval terpisah), lalu lanjut implementasi bertahap dalam beberapa pesan agar tetap manageable. Total estimasi: 4–6 iterasi besar.
