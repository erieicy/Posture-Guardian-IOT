class LineChart {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.data = [];
    this.maxPoints = options.maxPoints || 60;
    this.rangeMax = options.rangeMax || 200;
    this.zone = options.zone || null;
    this.colors = Object.assign(
      { line: "#38bdf8", zone: "rgba(34,197,94,.16)", grid: "rgba(148,163,184,.15)", text: "#94a3b8" },
      options.colors
    );
    window.addEventListener("resize", () => this.draw());
  }

  push(value) {
    this.data.push(value);
    if (this.data.length > this.maxPoints) this.data.shift();
  }

  draw() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, rect.width, rect.height);

    const padL = 32;
    const padR = 8;
    const padT = 10;
    const padB = 8;
    const w = rect.width - padL - padR;
    const h = rect.height - padT - padB;

    let peak = 100;
    for (const v of this.data) if (v > peak) peak = v;
    const yMax = Math.ceil((peak * 1.15) / 50) * 50;

    const x = (i) => padL + (this.data.length <= 1 ? w : (i / (this.data.length - 1)) * w);
    const y = (v) => padT + h - (Math.min(v, this.rangeMax) / yMax) * h;

    if (this.zone) {
      ctx.fillStyle = this.colors.zone;
      const zy1 = y(this.zone.max);
      const zy2 = y(this.zone.min);
      ctx.fillRect(padL, zy1, w, zy2 - zy1);
    }

    ctx.strokeStyle = this.colors.grid;
    ctx.fillStyle = this.colors.text;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";

    for (let i = 0; i <= 4; i++) {
      const vy = padT + (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, vy);
      ctx.lineTo(padL + w, vy);
      ctx.stroke();
      ctx.fillText(String(Math.round(yMax - (yMax * i) / 4)), padL - 6, vy + 3);
    }

    if (this.data.length === 0) return;

    ctx.strokeStyle = this.colors.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    this.data.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.stroke();

    const lx = x(this.data.length - 1);
    const ly = y(this.data[this.data.length - 1]);
    ctx.fillStyle = this.colors.line;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
