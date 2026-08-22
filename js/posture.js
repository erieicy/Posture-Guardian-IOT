const Posture = (() => {
  const { IDEAL_MIN_CM, IDEAL_MAX_CM, RANGE_MAX_CM } = CONFIG.POSTURE;

  function evaluate(cm) {
    if (!cm || cm <= 0 || cm > RANGE_MAX_CM) {
      return { key: "none", label: "Tidak Terdeteksi", level: "" };
    }
    if (cm < IDEAL_MIN_CM) {
      return { key: "too_close", label: "Terlalu Dekat", level: "danger" };
    }
    if (cm <= IDEAL_MAX_CM) {
      return { key: "ideal", label: "Posisi Ideal", level: "ok" };
    }
    return { key: "too_far", label: "Terlalu Jauh", level: "warn" };
  }

  function toRatio(cm) {
    const v = Math.min(Math.max(cm || 0, 0), RANGE_MAX_CM);
    return v / RANGE_MAX_CM;
  }

  function zonePct() {
    return {
      min: (IDEAL_MIN_CM / RANGE_MAX_CM) * 100,
      max: (IDEAL_MAX_CM / RANGE_MAX_CM) * 100
    };
  }

  return { evaluate, toRatio, zonePct };
})();
