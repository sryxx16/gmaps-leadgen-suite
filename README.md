# 🗺️ GMaps LeadGen Suite

![License](https://img.shields.io/badge/license-MIT-green.svg)

Repositori ini adalah sebuah **Monorepo** yang berisi *tools* lengkap untuk melakukan otomatisasi pencarian prospek klien (Lead Generation) dari Google Maps. 

**Tujuan Utama Alat Ini:**
Alat ini dirancang khusus untuk **membantu para programmer, web developer, atau agensi IT mempermudah pencarian klien**. Ekstensi ini akan men-scrap (mengambil) data toko atau tempat usaha dari Google Maps, lalu menyaring mana bisnis yang **belum menggunakan atau belum memiliki website**, sehingga Anda bisa langsung menawarkan jasa pembuatan website kepada mereka.

Repositori ini terdiri dari dua bagian utama:

1. **`extension/`** — Ekstensi Google Chrome untuk melakukan scraping data bisnis secara otomatis dari halaman pencarian Google Maps.
2. **`web-dashboard/`** — Aplikasi Next.js untuk menerima file *export JSON* dari ekstensi, menyimpan data ke dalam SQLite lokal, dan menampilkannya di Dashboard dengan UI modern.

## 🚀 Download Cepat (Untuk Pengguna Non-Developer)

Jika Anda hanya ingin menggunakan ekstensinya tanpa perlu melihat kodenya, silakan **[Download gmaps-leadgen-extension-v1.0.0.zip](gmaps-leadgen-extension-v1.0.0.zip)**.

**Cara Install ZIP:**
1. Ekstrak file ZIP yang didownload.
2. Buka `chrome://extensions` di Google Chrome.
3. Aktifkan **Developer Mode** di pojok kanan atas.
4. Klik **Load unpacked** dan pilih folder hasil ekstraksi.

## 💻 Panduan Developer

Jika Anda ingin menjalankan Web Dashboard atau memodifikasi kode ekstensi:

### 1. Menjalankan Web Dashboard
```bash
cd web-dashboard
npm install
npm run dev
```
Buka browser di `http://localhost:3000`.

### 2. Mengembangkan Ekstensi
Folder `extension/` berisi *source code* ekstensi mentah. Anda dapat langsung meload folder `extension/` ini ke Chrome melalui fitur **Load unpacked**.
Setiap modifikasi pada *script* di folder ini akan langsung berlaku di Chrome setelah Anda menekan tombol *Refresh/Reload* di menu `chrome://extensions`.
