# Seed Data Order & Transaksi Siswa (13 Juli – 27 Agustus 2026)

## Kondisi saat ini

- 38 siswa (35 punya data lengkap: tanggal lahir, tinggi, berat) — hanya siswa lengkap yang target kalorinya bisa dihitung.
- 57 menu punya kalori > 0; 45 di antaranya lengkap (kalori, protein, karbo, lemak). Hanya menu lengkap ini yang dipakai.
- MBG hanya ada 20 entri, 13 Juli – 7 Agustus 2026.
- Tabel `orders` hanya berisi 1 baris dan `transactions` kosong, sehingga Grafik & Alert tidak menampilkan apa pun.

## Yang akan dibuat

1. **Periode 13 Juli – 7 Agustus 2026 (ada MBG)**
  - Order untuk sebagian siswa tiap hari sekolah (Senin–Jumat), 1–3 item per order, hanya dari menu lengkap.
  - Semua order berstatus `completed` dan punya `order_items` yang konsisten (kalori & harga per unit sesuai menu).
  - Porsi kalori order disesuaikan agar total (MBG + order) berada di sekitar jatah sekolah siswa — sebagian siswa sengaja dibuat kurang (<80%) dan sebagian berlebih (>110%) supaya Alert benar-benar muncul dan realistis.
2. **Periode 8 – 27 Agustus 2026 (tanpa MBG)**
  - Pola order yang sama, tanpa tambahan kalori MBG, sehingga rentang "Hari ini / 7 Hari / 30 Hari" pada halaman Grafik semuanya berisi data.
  - Hanya pada hari senin sampai jumat saja dan di tanggal tidak merah. tanggal 17 dan 25 agustus 2026 adalah tanggal merah   

3. **Transaksi**
  - Untuk setiap order completed dibuat baris `transactions` (student_id, food_id, quantity, consumed_at sesuai tanggal order) karena halaman Grafik, Alert, dan Riwayat membaca dari tabel ini.

## Konsistensi angka

- `total_calories` dan `total_price` pada order = jumlah item × nilai menu, jadi tidak ada selisih antara ringkasan order dan detail item.
- Status gizi pada Grafik dihitung ulang dari transaksi + target per siswa (`calc_daily_calories`), jadi distribusi Kurang / Ideal / Berlebih akan cocok dengan data yang disisipkan.
- Tidak ada perubahan skema database dan tidak ada perubahan logika aplikasi — hanya penambahan data.

## Catatan teknis

Data disisipkan lewat SQL (`INSERT` ke `orders`, `order_items`, `transactions`) dengan generator deterministik berbasis tanggal dan siswa. Order dibuat langsung berstatus `completed` beserta transaksinya, karena trigger `order_complete_to_transactions` hanya jalan saat status di-*update*. Setelah data masuk, hasilnya diverifikasi dengan query agregat (jumlah order per hari, total kalori per siswa, distribusi status) agar grafik dan alert benar-benar sesuai.