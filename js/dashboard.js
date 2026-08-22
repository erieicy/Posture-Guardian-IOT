(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    ipInput: $("esp-ip"),
    connect: $("btn-connect"),
    connBadge: $("conn-badge"),
    distance: $("distance"),
    fill: $("range-fill"),
    rangeIdeal: $("range-ideal"),
    lblMin: $("lbl-min"),
    lblMax: $("lbl-max"),
    lblRange: $("lbl-range"),
    posture: $("posture-status"),
    chart: $("chart"),
    modeManual: $("mode-manual"),
    modeAuto: $("mode-auto"),
    lamp: $("lamp-toggle"),
    deskState: $("desk-state"),
    devIp: $("dev-ip"),
    devUptime: $("dev-uptime"),
    devRssi: $("dev-rssi"),
    devReads: $("dev-reads"),
    logBody: $("log-body")
  };

  const chart = new LineChart(els.chart, {
    maxPoints: CONFIG.CHART.MAX_POINTS,
    rangeMax: CONFIG.POSTURE.RANGE_MAX_CM,
    zone: { min: CONFIG.POSTURE.IDEAL_MIN_CM, max: CONFIG.POSTURE.IDEAL_MAX_CM }
  });

  const state = {
    connected: false,
    mode: "manual",
    lastKey: null,
    reads: 0,
    timer: null
  };

  function initZones() {
    const z = Posture.zonePct();
    els.lblMin.textContent = CONFIG.POSTURE.IDEAL_MIN_CM;
    els.lblMax.textContent = CONFIG.POSTURE.IDEAL_MAX_CM;
    els.lblRange.textContent = CONFIG.POSTURE.RANGE_MAX_CM;
    els.rangeIdeal.style.left = `${z.min}%`;
    els.rangeIdeal.style.width = `${z.max - z.min}%`;
  }

  function setConnected(ok) {
    if (state.connected === ok) return;
    state.connected = ok;
    els.connBadge.textContent = ok ? "Terhubung" : "Terputus";
    els.connBadge.className = `badge ${ok ? "badge-ok" : "badge-danger"}`;
  }

  function fmtUptime(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}j ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function addLog(cm, p) {
    const emptyRow = els.logBody.querySelector(".empty");
    if (emptyRow) emptyRow.remove();

    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${new Date().toLocaleTimeString("id-ID")}</td>` +
      `<td>${cm.toFixed(1)} cm</td>` +
      `<td><span class="badge badge-${p.level || "muted"}">${p.label}</span></td>`;
    els.logBody.prepend(tr);

    while (els.logBody.children.length > CONFIG.LOG_MAX_ROWS) {
      els.logBody.removeChild(els.logBody.lastChild);
    }
  }

  function applyMode(mode) {
    state.mode = mode;
    els.modeManual.classList.toggle("active", mode !== "auto");
    els.modeAuto.classList.toggle("active", mode === "auto");
  }

  function apply(data) {
    const cm = Number(data.distance_cm) || 0;
    const p = Posture.evaluate(cm);

    els.distance.textContent = cm > 0 ? cm.toFixed(1) : "--";
    els.fill.style.width = `${(Posture.toRatio(cm) * 100).toFixed(1)}%`;
    els.fill.dataset.level = p.level;
    els.posture.textContent = p.label;
    els.posture.dataset.level = p.level;

    chart.push(cm);
    chart.draw();

    if (p.key !== state.lastKey) {
      if (state.lastKey !== null && cm > 0) addLog(cm, p);
      state.lastKey = p.key;
    }

    if (typeof data.mode === "string") applyMode(data.mode);
    if (typeof data.lamp === "boolean") els.lamp.checked = data.lamp;
    els.deskState.textContent = `Status meja: ${data.desk_state || "idle"}`;

    els.devIp.textContent = els.ipInput.value.trim();
    if (Number.isFinite(data.uptime_s)) els.devUptime.textContent = fmtUptime(data.uptime_s);
    if (Number.isFinite(data.rssi)) els.devRssi.textContent = `${data.rssi} dBm`;

    state.reads += 1;
    els.devReads.textContent = String(state.reads);
  }

  async function poll() {
    try {
      const data = await Api.getData();
      apply(data);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }

  function startPolling() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(poll, CONFIG.POLL_INTERVAL_MS);
  }

  async function connect() {
    const ip = els.ipInput.value.trim();
    if (!ip) return;
    Api.setBaseUrl(ip);
    localStorage.setItem(CONFIG.STORAGE_KEY, ip);
    await poll();
    if (state.connected && !state.timer) startPolling();
  }

  async function control(action, value) {
    try {
      await Api.sendControl(action, value);
    } catch {}
    poll();
  }

  els.connect.addEventListener("click", connect);

  els.ipInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") connect();
  });

  [els.modeManual, els.modeAuto].forEach((btn) =>
    btn.addEventListener("click", () =>
      control("set_mode", btn === els.modeAuto ? "auto" : "manual")
    )
  );

  document.querySelectorAll("[data-desk]").forEach((btn) =>
    btn.addEventListener("click", () => control("desk", btn.dataset.desk))
  );

  els.lamp.addEventListener("change", () =>
    control("lamp", els.lamp.checked ? "on" : "off")
  );

  initZones();
  const savedIp = localStorage.getItem(CONFIG.STORAGE_KEY) || CONFIG.DEFAULT_ESP_IP;
  els.ipInput.value = savedIp;
  Api.setBaseUrl(savedIp);
  connect();
})();
