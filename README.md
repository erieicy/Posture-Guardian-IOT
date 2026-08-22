# Smart Desk & Posture Guardian

Dashboard IoT berbasis web (tanpa framework) yang terhubung langsung ke **ESP8266**. Sistem memantau jarak wajah ke laptop menggunakan sensor ultrasonik **HC-SR04**, mengingatkan pengguna duduk terlalu lama, serta mengontrol meja pintar dan lampu meja.

## Fitur

- **Posture Guardian** — cek jarak wajah ke laptop (zona ideal 40–70 cm), status real-time: Terlalu Dekat / Ideal / Terlalu Jauh.
- **Smart Desk** — mode manual & otomatis: meja naik/turun menyesuaikan jarak agar posisi selalu ideal.
- **Waktu Penggunaan** — OLED SSD1306 menampilkan waktu pemakaian sejak alat menyala; LED menyala saat duduk terlalu lama (>45 menit tanpa jeda).
- **Buzzer** — berbunyi jika wajah terlalu dekat dengan laptop lebih dari 3 detik.
- **Notifikasi** — desktop notification di browser; bila tidak tersedia/ditolak, peringatan dikirim ke OLED perangkat.
- **Saran Kesehatan** — saran postur hardcoded sesuai kondisi + tips rutin.
- **Riwayat 7 Hari** — persentase waktu posisi ideal harian, tersimpan di localStorage browser.

## Struktur

```
IOT/
├── index.html                  Dashboard
├── style/                      CSS dipisah per-fungsi
│   ├── base.css                Variabel warna & reset
│   ├── layout.css              Header, grid, footer
│   ├── components.css          Card, tombol, badge, switch
│   ├── widgets.css             Gauge, chart, tabel, toast
│   └── mobile.css              Layout responsif HP
├── js/                         JS dipisah per-fungsi
│   ├── config.js               Konfigurasi & threshold
│   ├── api.js                  Komunikasi ke ESP8266
│   ├── posture.js              Logika evaluasi postur
│   ├── saran.js                Saran kesehatan (hardcoded)
│   ├── notify.js               Notifikasi browser
│   ├── chart.js                Grafik canvas riwayat jarak
│   └── dashboard.js            Orkestrasi UI & polling
└── esp8266/
    └── smart_desk_posture.ino  Firmware ESP8266
```

## Wiring

| Modul | Pin ESP8266 | GPIO |
|---|---|---|
| HC-SR04 TRIG | D5 | GPIO14 |
| HC-SR04 ECHO | D6 (pakai voltage divider 5V→3.3V) | GPIO12 |
| OLED SSD1306 SDA | D2 | GPIO4 |
| OLED SSD1306 SCL | D1 | GPIO5 |
| Lampu meja (relay) | D7 | GPIO13 |
| LED istirahat | D8 | GPIO15 |
| Buzzer aktif | D0 | GPIO16 |
| Driver motor IN1 (naik) | D3 | GPIO0 |
| Driver motor IN2 (turun) | D4 | GPIO2 |

## Cara Pakai

1. Install library Arduino: **Adafruit SSD1306**, **Adafruit GFX** (jika belum pakai OLED, set `USE_OLED` ke `0`).
2. Edit `esp8266/smart_desk_posture.ino`: isi `WIFI_SSID` dan `WIFI_PASS`, upload ke ESP8266.
3. Jalankan dashboard dari `http://localhost/IOT` (XAMPP/Apache atau server statis apa pun).
4. Masukkan IP ESP8266 di kolom atas dashboard, klik **Hubungkan**.
5. Klik **Aktifkan Notifikasi** untuk izin notifikasi desktop.

## API Firmware

- `GET /api/data` → JSON jarak, postur, timer duduk, status buzzer/LED/lampu.
- `POST /api/control?action=<aksi>&value=<nilai>` → aksi:
  - `set_mode` (`auto`/`manual`)
  - `desk` (`up`/`down`/`stop`)
  - `lamp`, `buzzer` (`on`/`off`/`toggle`)
  - `sit_reset` — reset timer duduk
  - `oled_alert` — tampilkan pesan di OLED (fallback notifikasi)

## Catatan AI

Proyek ini dikembangkan dengan bantuan asisten AI (**ox-alpha**) untuk penulisan kode dashboard dan firmware.
