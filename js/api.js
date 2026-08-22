const Api = (() => {
  let base = "";

  const qs = (params) => "?" + new URLSearchParams(params).toString();

  async function request(path, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(base + path, { ...options, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    setBaseUrl(ip) {
      base = /^https?:\/\//.test(ip) ? ip : `http://${ip}`;
    },
    getData() {
      return request(`/api/data${qs({ t: Date.now() })}`);
    },
    sendControl(action, value) {
      return request(`/api/control${qs({ action, value })}`, { method: "POST" });
    }
  };
})();
