const Saran = (() => {
  const SARAN_POSTUR = {
    too_close:
      "Anda terlalu dekat dengan layar. Mundurkan kursi hingga jarak minimal 40 cm agar mata tidak cepat lelah dan postur leher tetap tegak.",
    ideal:
      "Posisi mantap! Jarak Anda sudah aman. Pertahankan, dan jangan lupa aturan 20-20-20: setiap 20 menit, alihkan pandangan ke objek sejauh ±6 meter selama 20 detik.",
    too_far:
      "Anda terlalu jauh dari layar sehingga cenderung mendekatkan badan dan membungkuk. Dekatkan monitor atau geser kursi hingga masuk zona 40-70 cm.",
    none:
      "Sensor belum mendeteksi wajah Anda. Duduk menghadap laptop dengan posisi tegak agar Posture Guardian dapat memantau jarak dengan akurat."
  };

  const SARAN_ISTIRAHAT =
    "Anda sudah duduk terlalu lama! LED peringatan menyala. Bangun dari kursi, peregangan 2-3 menit, dan jalan sedikit sebelum kembali bekerja.";

  const TIPS_UMUM = [
    "Terapkan aturan 20-20-20: setiap 20 menit kerja, lihat objek berjarak ±6 meter selama 20 detik.",
    "Posisikan layar sejajar mata dan siku menekuk ±90 derajat saat mengetik.",
    "Duduk dengan punggung menempel sandaran dan kaki menapak rata ke lantai.",
    "Berdiri dan peregangan ringan setiap 30-45 menit untuk melancarkan sirkulasi darah.",
    "Jaga jarak pandang ke layar antara 40-70 cm sesuai zona ideal."
  ];

  function utama(key, sitAlert) {
    if (sitAlert) return SARAN_ISTIRAHAT;
    return SARAN_POSTUR[key] || SARAN_POSTUR.none;
  }

  return { utama, TIPS_UMUM };
})();
