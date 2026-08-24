const Notify = (() => {
  const supported = typeof window !== "undefined" && typeof window.Notification !== "undefined";
  const lastSent = {};

  function permission() {
    return supported ? Notification.permission : "unsupported";
  }

  async function enable() {
    if (!supported) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }

  function fire(title, body, tag) {
    const now = Date.now();
    if (lastSent[tag] && now - lastSent[tag] < CONFIG.NOTIF_THROTTLE_MS) return false;
    lastSent[tag] = now;
    try {
      new Notification(title, { body, tag });
      return true;
    } catch {
      return fal
      
    }
  }

  return { enable, fire, permission, supported: () => supported };
})();
