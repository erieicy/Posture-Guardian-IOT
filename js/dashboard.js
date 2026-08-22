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
    buzzer: $("buzzer-toggle"),
    deskState: $("desk-state"),
    notifBtn: $("btn-notif"),
    notifStatus: $("notif-status"),
    cardUsage: $("card-usage"),
    usageTime: $("usage-time"),
    sitTime: $("sit-time"),
    badTime: $("bad-time"),
    devLed: $("dev-led"),
    sitReset: $("btn-sit-reset"),
    weekChart: $("week-chart"),
    saranBox: $("saran-box"),
    tipsList: $("tips-list"),
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
    prevSitAlert: false,
    reads: 0,
    timer: null
  };

  function toast(msg, level) {
    let stack = document.getElementById("toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toast-stack";
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    while (stack.children.length >= 3) stack.removeChild(stack.firstChild);
    const el = document.createElement("div");
    el.className = `toast ${level || ""}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add("hide");
      setTimeout(() => el.remove(), 300);
    }, 4500);
  }

  function deliver(tag, title, body) {
    if (Notify.supported() && Notify.permission() === "granted" && Notify.fire(title, body, tag)) return;
    const msg = tag === "close" ? "WAJAH TERLALU DEKAT!" : "SAATNYA ISTIRAHAT!";
    control("oled_alert", msg);
  }

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

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function fmtHMS(totalSec) {
    const s = Math.max(0, Math.floor(totalSec || 0));
    return `${Math.floor(s / 3600)}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
  }

  function fmtDur(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = Math.floor(totalSec % 60);
    if (h > 0) return `${h}j ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
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

  let lastSaranMsg = "";

  function updateSaran(key, sitAlert) {
    const msg = Saran.utama(key, sitAlert);
    if (msg !== lastSaranMsg) {
      lastSaranMsg = msg;
      els.saranBox.textContent = msg;
    }
    const level = sitAlert ? "danger" : key === "ideal" ? "ok" : key === "too_close" ? "danger" : key === "too_far" ? "warn" : "";
    els.saranBox.className = `saran-box${level ? ` level-${level}` : ""}`;
  }

  function buildTips() {
    els.tipsList.innerHTML = "";
    for (const tip of Saran.TIPS_UMUM) {
      const li = document.createElement("li");
      li.textContent = tip;
      els.tipsList.appendChild(li);
    }
  }

  function loadDaily() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.DAILY_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveDaily() {
    localStorage.setItem(CONFIG.DAILY_STORAGE_KEY, JSON.stringify(daily));
  }

  const daily = loadDaily();
  let lastWeekSig = "";

  function dateKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function pruneDaily() {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (CONFIG.DAILY_DAYS - 1));
    for (const k of Object.keys(daily)) {
      const [y, m, d] = k.split("-").map(Number);
      if (new Date(y, m - 1, d) < cutoff) delete daily[k];
    }
  }

  function recordPoll(key) {
    const t = dateKey(new Date());
    const entry = daily[t] || { total: 0, ideal: 0, minutes: 0 };
    entry.total += 1;
    if (key === "ideal") entry.ideal += 1;
    entry.minutes += CONFIG.POLL_INTERVAL_MS / 60000;
    daily[t] = entry;
    pruneDaily();
    saveDaily();
  }

  const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  function renderWeek() {
    const today = new Date();
    const rows = [];
    for (let i = CONFIG.DAILY_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = dateKey(d);
      const e = daily[k] || { total: 0, ideal: 0, minutes: 0 };
      const pct = e.total > 0 ? Math.round((e.ideal / e.total) * 100) : 0;
      rows.push({ key: k, pct, minutes: e.minutes, label: DAY_LABELS[d.getDay()], isToday: i === 0 });
    }

    const sig = rows.map((r) => `${r.key}:${r.pct}:${Math.round(r.minutes)}`).join("|");
    if (sig === lastWeekSig) return;
    lastWeekSig = sig;

    els.weekChart.innerHTML = "";
    for (const r of rows) {
      const col = document.createElement("div");
      col.className = `week-col${r.isToday ? " today" : ""}`;
      col.title =
        `${r.key} • ${Math.round(r.minutes)} menit pakai • ${r.pct}% posisi ideal`;
      col.innerHTML =
        `<span class="week-pct">${r.pct}%</span>` +
        `<div class="week-bar-track"><div class="week-bar" style="height:${Math.max(r.pct, 3)}%"></div></div>` +
        `<span class="week-label">${r.label}</span>`;
      els.weekChart.appendChild(col);
    }
  }

  function apply(data) {
    const cm = Number(data.distance_cm) || 0;
    const p = Posture.evaluate(cm);
    const sitAlert = data.sit_alert === true;

    els.distance.textContent = cm > 0 ? cm.toFixed(1) : "--";
    els.fill.style.width = `${(Posture.toRatio(cm) * 100).toFixed(1)}%`;
    els.fill.dataset.level = p.level;
    els.posture.textContent = p.label;
    els.posture.dataset.level = p.level;

    chart.push(cm);
    chart.draw();

    if (Number.isFinite(data.uptime_s)) els.usageTime.textContent = fmtHMS(data.uptime_s);
    if (Number.isFinite(data.presence_s)) els.sitTime.textContent = fmtDur(data.presence_s);
    if (Number.isFinite(data.bad_posture_s)) els.badTime.textContent = fmtDur(data.bad_posture_s);

    els.cardUsage.dataset.alert = sitAlert;
    els.devLed.textContent = sitAlert ? "Nyala" : "Mati";
    els.devLed.classList.toggle("alert-on", sitAlert);

    updateSaran(p.key, sitAlert);

    if (p.key === "too_close" && state.lastKey !== "too_close" && cm > 0) {
      deliver("close", "Postur Guardian", "Terlalu dekat dengan layar! Mundurkan kursi Anda.");
      toast("Terlalu dekat dengan laptop! Mundur sedikit.", "danger");
    }

    if (sitAlert && !state.prevSitAlert) {
      deliver("sit", "Saatnya Istirahat", "Anda duduk terlalu lama. Bangun dan peregangan dulu.");
      toast("Anda duduk terlalu lama — saatnya istirahat.", "warn");
    }
    state.prevSitAlert = sitAlert;

    if (p.key !== state.lastKey) {
      if (state.lastKey !== null && cm > 0) addLog(cm, p);
      state.lastKey = p.key;
    }

    recordPoll(p.key);
    renderWeek();

    if (typeof data.mode === "string") applyMode(data.mode);
    if (typeof data.lamp === "boolean") els.lamp.checked = data.lamp;
    if (typeof data.buzzer_en === "boolean" && els.buzzer.checked !== data.buzzer_en) {
      els.buzzer.checked = data.buzzer_en;
    }
    els.deskState.textContent = `Status meja: ${data.desk_state || "idle"}`;

    els.devIp.textContent = els.ipInput.value.trim();
    if (Number.isFinite(data.uptime_s)) els.devUptime.textContent = fmtDur(data.uptime_s);
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

  els.sitReset.addEventListener("click", () => control("sit_reset", "1"));

  els.buzzer.addEventListener("change", () =>
    control("buzzer", els.buzzer.checked ? "on" : "off")
  );

  function updateNotifUi() {
    const perm = Notify.permission();
    const map = {
      granted: ["badge-ok", "Aktif"],
      denied: ["badge-warn", "Via OLED"],
      unsupported: ["badge-muted", "Via OLED"],
      default: ["badge-muted", "Belum aktif"]
    };
    const entry = map[perm] || map.default;
    els.notifStatus.className = `badge ${entry[0]}`;
    els.notifStatus.textContent = entry[1];
    els.notifBtn.textContent = perm === "granted" ? "Notifikasi Aktif" : "Aktifkan Notifikasi";
  }

  els.notifBtn.addEventListener("click", async () => {
    const result = await Notify.enable();
    updateNotifUi();
    if (result === "granted") toast("Notifikasi desktop diaktifkan.", "ok");
    else if (result === "denied") toast("Izin notifikasi ditolak. Peringatan dikirim lewat OLED.", "warn");
    else if (result === "unsupported") toast("Browser tidak mendukung notifikasi. Peringatan dikirim lewat OLED.", "warn");
    else if (result === "default") toast("Izin belum dijawab. Coba klik lagi.", "warn");
  });

  window.addEventListener("resize", () => chart.draw());

  initZones();
  buildTips();
  renderWeek();
  updateNotifUi();
  const savedIp = localStorage.getItem(CONFIG.STORAGE_KEY) || CONFIG.DEFAULT_ESP_IP;
  els.ipInput.value = savedIp;
  Api.setBaseUrl(savedIp);
  connect();
})();
