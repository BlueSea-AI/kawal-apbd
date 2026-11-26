# Sumber Data Resmi & Protokol Provenance — Kawal APBD

> **Kebijakan Zero-Fabrication:** Seluruh angka anggaran (APBD) dan indikator sosial-ekonomi pada `public/data/regions.json` bersumber langsung dari publikasi resmi **DJPK Kementerian Keuangan RI** dan **Badan Pusat Statistik (BPS RI)**. Sub-metrik yang belum dipublikasikan secara terbuka pada endpoint resmi ditandai eksplisit sebagai `null` (*"Data Belum Dipublikasikan Resmi"*), bukan dikarang atau diestimasi.

---

## 1. Data APBD Daerah — DJPK Kementerian Keuangan RI (Portal Data SIKD)

- **Portal Interaktif:** `https://djpk.kemenkeu.go.id/portal/data/apbd`
- **Endpoint Otomatis (Zero-Auth SpreadsheetML XML):**
  `https://djpk.kemenkeu.go.id/portal/csv_apbd?type=apbd&periode=12&tahun=2025&provinsi={kode_djpk}&pemda={kode_pemda}`
- **Daftar Pemda per Provinsi (JSON):**
  `https://djpk.kemenkeu.go.id/portal/pemda/{kode_djpk}/2025`
- **Cakupan Terverifikasi (Nasional Penuh — 546 Pemda Otonom):**
  - **38 Pemerintah Provinsi** (`provinsi=01..38`, `pemda=00`, termasuk 4 DOB Papua: Papua Selatan `35`, Papua Tengah `36`, Papua Pegunungan `37`, Papua Barat Daya `38`).
  - **508 Pemerintah Kabupaten/Kota Otonom** (seluruh Kabupaten dan Kota otonom di 37 provinsi yang menerbitkan APBD mandiri pada endpoint resmi `portal/pemda/{kode_djpk}/2025`; 5 Kota & 1 Kab. Administrasi di DKI Jakarta dikonsolidasikan dalam APBD Provinsi DKI Jakarta sesuai status daerah khusus).
  - **Protokol Rate-Limiting & Cache:** Seluruh respons JSON katalog & XML APBD di-cache per daerah di `data/raw/djpk/` dengan jeda sopan (`0.35s`) dan *exponential backoff* sehingga proses ETL dapat dilanjutkan seketika tanpa mengunduh ulang daerah yang sudah tersimpan.
- **Field yang Diambil Langsung (Anggaran & Realisasi TA 2025, Periode 12):**
  - `Pendapatan Daerah`, `PAD` (`Pajak Daerah`, `Retribusi Daerah`, `Hasil Pengelolaan Kekayaan Daerah yang Dipisahkan`, `Lain-Lain PAD yang Sah`), `TKDD` / `Pendapatan Transfer Pemerintah Pusat`, `Pendapatan Lainnya`.
  - `Belanja Daerah`, `Belanja Pegawai`, `Belanja Barang dan Jasa`, `Belanja Modal`, `Belanja Lainnya` (`Belanja Bagi Hasil`, `Belanja Bantuan Keuangan`, `Belanja Subsidi`, `Belanja Hibah`, `Belanja Bantuan Sosial`, `Belanja Tidak Terduga`).
- **Catatan Transparansi Klasifikasi Fungsi:**
  Endpoint `csv_apbd` DJPK mempublikasikan **Klasifikasi Ekonomi** (bukan Klasifikasi Fungsi). Oleh karena itu, field `pendidikan_miliar`, `pendidikan_pct`, `kesehatan_miliar`, `kesehatan_pct`, dan `infrastruktur_hkpd_pct` (definisi 40% UU HKPD) secara default bernilai `null` sampai data resmi klasifikasi fungsi diunduh ke `data/raw/`.

---

## 2. Data Sosial-Ekonomi — Badan Pusat Statistik (BPS RI)

Pipeline `scripts/etl_pipeline.py` mengunduh data langsung dari tabel statistik terbuka resmi BPS RI (tanpa autentikasi), dan juga mendukung **WebAPI BPS** bila `BPS_API_KEY` diisi di environment:

| Indikator | Cakupan | Var ID | URL Resmi BPS RI |
| :--- | :--- | :---: | :--- |
| **IPM (Metode Baru, UHH Long Form SP2020)** | 38 Provinsi | `2207` | `https://www.bps.go.id/id/statistics-table/2/MjIwNyMy/metode-baru-indeks-pembangunan-manusia-ipm-menurut-provinsi-umur-harapan-hidup-hasil-long-form-sp2020.html` |
| **IPM (Metode Baru, UHH Long Form SP2020)** | 514 Kab/Kota | `2205` | `https://www.bps.go.id/id/statistics-table/2/MjIwNSMy/metode-baru-indeks-pembangunan-manusia-umur-harapan-hidup-hasil-long-form-sp2020.html` |
| **Persentase Penduduk Miskin (P0)** | 38 Provinsi | `192` | `https://www.bps.go.id/id/statistics-table/2/MTkyIzI=/persentase-penduduk-miskin--p0--menurut-provinsi-dan-daerah.html` |
| **Jumlah Penduduk Miskin (Ribu Jiwa)** | 38 Provinsi | `185` | `https://www.bps.go.id/id/statistics-table/2/MTg1IzI=/jumlah-penduduk-miskin-ribu-jiwa-menurut-provinsi-dan-daerah.html` |
| **Persentase Penduduk Miskin (P0)** | 514 Kab/Kota | `621` | `https://www.bps.go.id/id/statistics-table/2/NjIxIzI=/persentase-penduduk-miskin--p0--menurut-kabupaten-kota.html` |
| **Jumlah Penduduk Miskin (Ribu Jiwa)** | 514 Kab/Kota | `619` | `https://www.bps.go.id/id/statistics-table/2/NjE5IzI=/jumlah-penduduk-miskin--ribu-jiwa--menurut-kabupaten-kota.html` |
| **Tingkat Pengangguran Terbuka (TPT)** | 38 Provinsi | `543` | `https://www.bps.go.id/id/statistics-table/2/NTQzIzI=/tingkat-pengangguran-terbuka-menurut-provinsi.html` |
| **Jumlah Penduduk Usia 15 Tahun ke Atas** | 38 Provinsi | `2397` | `https://www.bps.go.id/id/statistics-table/2/MjM5NyMy/jumlah-penduduk-usia-15-tahun-ke-atas-menurut-provinsi-orang.html` |

---

## 3. Batas Wilayah Geospasial — 38 Provinsi Indonesia

- **Sumber Terbuka (BIG/BPS 38 Provinsi):**
  `https://raw.githubusercontent.com/AlfianAliM/Indonesia-GeoJSON/master/provinsi.geojson`
- **Pemrosesan Kartografi:**
  Batas asli beresolusi tinggi (112.940 verteks) disederhanakan secara bersih menggunakan algoritma **Douglas-Peucker** (`tol = 0.0042°`, preservasi pulau utama & menengah) menjadi ~450–650 KB di `public/data/indonesia_provinces.geojson` dengan kecocokan 100% `province_code` (`11`–`96`) terhadap `public/data/regions.json`.
- **Basemap Kartografi (Zero-Token):**
  - Mode Terang: **CARTO Positron** (`https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`)
  - Mode Gelap: **CARTO Dark Matter** (`https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`)

---

## 4. Ingesti Hibrida (Opsional `data/raw/` & `BPS_API_KEY`)

Bila Anda mengunduh dokumen resmi tambahan (misalnya rincian Belanja Menurut Fungsi dari Ringkasan APBD/Perda atau Proyeksi Penduduk Total 38 Provinsi BPS), letakkan file CSV di folder `data/raw/`:

1. **`data/raw/djpk_fungsi_belanja.csv`** (mengaktifkan skor penuh 3 pilar UU HKPD):
   ```csv
   bps_code,pendidikan_miliar,kesehatan_miliar,infrastruktur_hkpd_pct
   31,19500.0,11200.0,42.5
   ```
2. **`data/raw/bps_penduduk.csv`** (mengaktifkan kalkulasi APBD per Kapita & TPT Kab/Kota):
   ```csv
   bps_code,population,tpt_pct
   31,10684900,
   3578,3009300,4.96
   ```
3. **Menjalankan Pembaruan Data Langsung:**
   ```bash
   # Unduh ulang seluruh data resmi terbaru dari DJPK Kemenkeu & BPS RI + validasi
   python scripts/etl_pipeline.py --refresh --verify

   # Membangun ulang dataset dari cache data/raw/ lokal tanpa hit jaringan
   python scripts/etl_pipeline.py --verify
   ```
