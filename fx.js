/* fx.js — starfield, rain, cursor trail, grey mode, clock, rainbow title.
   Everything optional is off by default and remembered in localStorage. */

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOUCH = window.matchMedia('(hover: none)').matches;
  const pref = (window.Site && Site.pref) || { get: () => false, set() {} };

  function setPressed(btn, on) { if (btn) btn.setAttribute('aria-pressed', String(on)); }

  // ---------- starfield ----------
  (function stars() {
    const c = $('#stars');
    if (!c) return;
    const ctx = c.getContext('2d');
    const COLORS = ['#ffffff', '#ffffff', '#ffffff', '#cfe8ff', '#7fff00', '#c9b8ff'];
    let w = 0, h = 0, list = [], resizeTimer = 0;

    function draw(t) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      for (const s of list) {
        if (!REDUCED) { s.y += s.v; if (s.y > h) s.y = -2; }
        ctx.globalAlpha = REDUCED ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.sp + s.ph));
        ctx.fillStyle = s.c;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    function size() {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      c.width = Math.round(w * d); c.height = Math.round(h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const n = Math.round(w * h / 5500);
      list = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        s: Math.random() < 0.08 ? 2 : 1,
        ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 1.6, v: 0.03 + Math.random() * 0.1,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      }));
      draw(0);
    }

    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(size, 150); });
    size();
    if (!REDUCED) {
      (function loop(t) { draw(t); requestAnimationFrame(loop); }(0));
    }
  }());

  // ---------- rain ----------
  (function rain() {
    const btn = $('#toggleRain');
    const c = $('#rain');
    if (!btn || !c) return;
    const ctx = c.getContext('2d');
    let on = pref.get('rain', false);
    let drops = [], raf = 0;

    function fit() { c.width = window.innerWidth; c.height = window.innerHeight; }
    window.addEventListener('resize', fit);
    fit();

    function frame() {
      ctx.clearRect(0, 0, c.width, c.height);
      if (on) {
        for (let i = 0; i < 5; i++) {
          drops.push({ x: Math.random() * c.width, y: -20, len: 8 + Math.random() * 12, v: 7 + Math.random() * 9, w: 1 + Math.random() });
        }
      }
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
      for (const d of drops) {
        d.y += d.v;
        ctx.lineWidth = d.w;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y + d.len); ctx.stroke();
      }
      drops = drops.filter(d => d.y < c.height + 20);
      if (on || drops.length) raf = requestAnimationFrame(frame); else raf = 0;
    }

    function apply() {
      setPressed(btn, on);
      if (on && !raf) raf = requestAnimationFrame(frame);
    }

    btn.addEventListener('click', () => { on = !on; pref.set('rain', on); apply(); });
    apply();
  }());

  // ---------- cursor trail of little moths ----------
  (function trail() {
    const btn = $('#toggleTrail');
    if (!btn) return;
    if (TOUCH) { btn.hidden = true; return; }

    const wrap = document.createElement('div');
    wrap.id = 'trail';
    wrap.setAttribute('aria-hidden', 'true');
    const items = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('span');
      s.className = 'moth';
      s.textContent = '}o{';
      s.style.opacity = String(0.9 - i * 0.09);
      wrap.append(s);
      items.push({ el: s, x: -100, y: -100 });
    }
    document.body.append(wrap);

    let on = pref.get('trail', false);
    let mx = window.innerWidth / 2, my = window.innerHeight / 2, raf = 0;

    function frame() {
      items.forEach((it, i) => {
        const tx = i === 0 ? mx : items[i - 1].x;
        const ty = i === 0 ? my : items[i - 1].y;
        it.x += (tx - it.x) * (i === 0 ? 0.3 : 0.35);
        it.y += (ty - it.y) * (i === 0 ? 0.3 : 0.35);
        it.el.style.transform = 'translate(' + (it.x + 8) + 'px,' + (it.y + 8) + 'px)';
      });
      raf = on ? requestAnimationFrame(frame) : 0;
    }

    function apply() {
      wrap.style.display = on ? 'block' : 'none';
      setPressed(btn, on);
      if (on && !raf) raf = requestAnimationFrame(frame);
    }

    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
    document.addEventListener('click', () => {
      if (!on) return;
      const hue = Math.floor(Math.random() * 360);
      items.forEach(it => { it.el.style.color = 'hsl(' + hue + ', 100%, 55%)'; });
    });
    btn.addEventListener('click', () => { on = !on; pref.set('trail', on); apply(); });
    apply();
  }());

  // ---------- grey / invert mode ----------
  (function invert() {
    const btn = $('#toggleInvert');
    if (!btn) return;
    let on = pref.get('invert', false);
    function apply() {
      document.body.classList.toggle('invert-mode', on);
      btn.textContent = on ? 'toggle 🌕' : 'toggle 🌑';
      setPressed(btn, on);
    }
    btn.addEventListener('click', () => { on = !on; pref.set('invert', on); apply(); });
    apply();
  }());

  // ---------- clock ----------
  (function clock() {
    const btn = $('#toggleTime');
    const out = $('#systemClock');
    if (!btn || !out) return;
    let on = pref.get('clock', false);
    let timer = 0;

    function moon(h) {
      if (h < 4) return '🌑';
      if (h < 6) return '🌘';
      if (h < 9) return '🌄';
      if (h < 18) return '🌞';
      if (h < 21) return '🌅';
      if (h < 23) return '🌓';
      return '🌒';
    }
    function tick() {
      const d = new Date();
      const h = d.getHours();
      out.textContent = moon(h) + ' ' + String(h % 12 || 12).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0') + (h < 12 ? ' am' : ' pm');
    }
    function apply() {
      out.hidden = !on;
      setPressed(btn, on);
      clearInterval(timer);
      if (on) { tick(); timer = setInterval(tick, 1000); }
    }
    btn.addEventListener('click', () => { on = !on; pref.set('clock', on); apply(); });
    apply();
  }());

  // ---------- rainbow title (new colour every second) ----------
  (function rainbow() {
    const t = $('#rainbow');
    if (!t || REDUCED) return;
    setInterval(() => {
      const light = document.body.classList.contains('invert-mode') ? 30 : 62;
      t.style.color = 'hsl(' + Math.floor(Math.random() * 360) + ', 100%, ' + light + '%)';
    }, 1000);
  }());
}());
