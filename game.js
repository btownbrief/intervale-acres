/* Intervale Acres: input, layout, places, sheets, tutorial, save/load, window.__T */
(function () {
  'use strict';
  const D = IA_DATA, P = ART.P, S = D.S, M = D.M, H = D.H;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'intervale-acres.save';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const FONT = (w, px, d) => w + ' ' + px + 'px ' + (d ? 'Fraunces, Georgia, serif' : '"DM Sans", system-ui, sans-serif');
  const SHOP_ORDER = ['oven', 'press', 'creamery', 'kitchen', 'creemee'];
  const SHOP_BELL = { oven: 0, press: 1, creamery: 2, kitchen: 3, creemee: 4 };

  const G = window.G = {
    s: null, off: 0, place: 'field', sel: 'radish', page: 0, edit: false, helperSel: null,
    W: 0, C: 0, dpr: 1, L: {}, hits: [], ptr: null, fx: [], floaters: [], flyers: [], anims: [],
    pendCoins: 0, pendGoods: 0, started: false, md: null, sheet: null, bubble: null, lift: null,
    lastSave: 0, lastSecond: 0, hint: null, toastAt: {}, slideT: 1, slideFrom: null, tTime: 0, horizonKey: '', horizonImg: null,
    trashArm: null, pulse: null, test: false, frameN: 0, fps: 60, popQ: [], popNext: 0,
  };
  const now = () => Date.now() + G.off;
  G.now = now;

  // ------------------------------------------------------------------ save / load
  function save() {
    if (!G.s) return;
    try { localStorage.setItem(SAVE_KEY, IA.serialize(G.s, now())); G.lastSave = now(); } catch (e) { /* private mode: play on without saving */ }
  }
  function loadSave() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    let v = -1; try { v = JSON.parse(raw).v; } catch (e) { v = -1; }
    if (v !== IA.VERSION) { try { localStorage.setItem(SAVE_KEY + '.bak', raw); } catch (e) {} }
    const r = IA.parse(raw, now());
    return r.ok ? r.s : null;
  }

  // ------------------------------------------------------------------ feedback helpers
  function vib(p) { if (!G.s || !G.s.settings.haptics) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function toast(msg, key, every) {
    key = key || msg; const t = performance.now();
    if (G.toastAt[key] && t - G.toastAt[key] < (every || 1500)) return;
    G.toastAt[key] = t;
    const el = $('toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 1700);
  }
  function bumpEl(id, cls) { const el = $(id); if (!el) return; el.classList.remove(cls || 'bump'); void el.offsetWidth; el.classList.add(cls || 'bump'); }
  function cellarFull() {
    SND.play('error'); bumpEl('hCellar', 'shake');
    const e = IA.extras(G.s), btns = cellarBtns(e);
    if (btns.length) showAct('Cellar full', btns);
    else toast('Cellar full', 'full', 5000);
  }
  // the two valves for a full cellar: sell what nothing needs, or a bigger cellar when you can afford it
  function cellarBtns(e) {
    const s = G.s, uc = IA.cellarUpCost(s), out = [];
    if (isFinite(uc) && s.coins >= uc) out.push(['Bigger <i class="i-coin"></i>' + IA.fmtNum(uc), upgradeCellarNow, 'alt']);
    if (e && e.n) out.push(['Sell extras <i class="i-coin"></i>+' + IA.fmtNum(e.coins), sellExtrasNow]);
    return out;
  }
  function upgradeCellarNow() { const r = IA.upgradeCellar(G.s); if (r.ok) { SND.play('project'); vib(20); bumpEl('hCellar'); const p = elCenter('hCellar'); floater('Cellar ' + G.s.cellar.cap, p.x, p.y + 50, { size: 18, col: P.leaf }); save(); if (G.sheet) renderSheet(); } else noCoins(); }
  function showAct(label, btns, ms) {
    const el = $('act'); el.innerHTML = label + ' ' + btns.map((b, i) => `<b data-i="${i}"${b[2] ? ' class="' + b[2] + '"' : ''}>${b[0]}</b>`).join('');
    el.classList.remove('hidden'); el.classList.toggle('low', G.place === 'barn'); // on the Barn: below the paddock headers and + pills
    el.onclick = e => { const b = e.target.closest('b'); if (!b) return; el.classList.add('hidden'); SND.unlock(); btns[+b.dataset.i][1](); };
    clearTimeout(showAct._t); showAct._t = setTimeout(() => el.classList.add('hidden'), ms || 5000);
  }
  // first time the cellar passes 80% at each size: nudge the cellar pill and offer the upgrade before the wall
  function cellarNudge() {
    const s = G.s; if (!G.started || G.md || G.sheet || s.tut < 99 || G.place === 'barn') return; // the Barn's cellar card already offers Bigger
    const n = IA.cellarCount(s), key = 'cel' + s.cellar.lvl; s.hints = s.hints || {};
    if (s.hints[key] || n < s.cellar.cap * 0.8) return;
    const uc = IA.cellarUpCost(s); if (!isFinite(uc)) { s.hints[key] = 1; return; }
    if (s.coins < uc) return;
    s.hints[key] = 1; bumpEl('hCellar', 'nudge'); SND.play('tap');
    showAct('Cellar almost full', [['Bigger <i class="i-coin"></i>' + IA.fmtNum(uc), upgradeCellarNow, 'alt']], 7000);
  }
  function sellExtrasNow() {
    const r = IA.sellExtras(G.s); if (!r.ok) return;
    SND.play('coin', 6); vib(12); const p = elCenter('hCellar'); flyCoins({ x: p.x, y: p.y + 20 }, r.coins, 8);
    floater('Sold ' + r.n + ' extras', G.L.appW / 2, p.y + 70, { size: 18, col: P.plum }); save();
    if (G.sheet) renderSheet();
  }
  function noCoins() { SND.play('error'); bumpEl('hCoins', 'shake'); toast('Not enough coins', 'coins', 2500); }

  // ------------------------------------------------------------------ layout (once, and on orientation change only)
  let lastLayoutW = 0, lastLayoutH = 0;
  function layout(force) {
    const app = $('app');
    const vh = window.innerHeight, vw = Math.min(window.innerWidth, 480);
    // ignore small growth (Safari's toolbar hiding), but never let the nav fall off a shrinking screen
    const dh = vh - lastLayoutH;
    if (!force && Math.abs(vw - lastLayoutW) < 2 && dh > -20 && dh < 140) return;
    lastLayoutW = vw; lastLayoutH = vh;
    // a short landscape phone cannot fit the portrait column: draw it at a virtual size and scale it to fit
    const short = vh < 560 && window.innerWidth > vh;
    if (short) {
      const VH = 760, VW = 420, k = vh / VH;
      G.scale = k; app.style.width = VW + 'px'; app.style.maxWidth = VW + 'px'; app.style.height = VH + 'px'; app.style.transform = 'scale(' + k + ')'; app.style.transformOrigin = 'top center';
    } else { G.scale = 1; app.style.width = ''; app.style.maxWidth = ''; app.style.transform = ''; app.style.height = vh + 'px'; }
    sizeStage();
  }
  function sizeStage() {
    const app = $('app'), stage = $('stage');
    const ar = app.getBoundingClientRect(), k = G.scale || 1;
    G.dpr = Math.min(2, (window.devicePixelRatio || 1) * Math.max(1, k));
    G.W = stage.offsetWidth; G.C = stage.offsetHeight;
    G.L.sx = stage.offsetLeft; G.L.sy = stage.offsetTop; G.L.ax = ar.left; G.L.ay = ar.top;
    const sc = $('scene'); sc.width = G.W * G.dpr; sc.height = G.C * G.dpr; sc.style.width = G.W + 'px'; sc.style.height = G.C + 'px';
    const aw = app.offsetWidth, ah = app.offsetHeight;
    const fx = $('fx'); fx.width = aw * G.dpr; fx.height = ah * G.dpr; fx.style.width = aw + 'px'; fx.style.height = ah + 'px';
    G.L.appW = aw; G.L.appH = ah;
    geom();
    G.horizonKey = '';
  }
  function geom() {
    const w = G.W, C = G.C, L = G.L;
    // field
    const tray = C < 560 ? 84 : 96;
    let tile = clamp(Math.floor((C - tray - 116) / 6), 48, 66); tile = Math.min(tile, Math.floor((w - 16) / 5));
    L.tile = tile; L.tray = tray; L.gw = tile * 5; L.gh = tile * 6;
    L.gx = Math.round((w - L.gw) / 2); L.gy = C - tray - L.gh - 6;
    L.th = clamp(Math.round(L.gy * 0.5), 40, 74);
    L.hz = Math.max(24, Math.round(L.gy - L.th * 0.62));
    L.trayY = C - tray;
    // barn
    // market
    L.ferryH = clamp(Math.round(C * 0.2), 92, 138);
    L.btnH = clamp(Math.round(C * 0.15), 80, 104);
    L.tkH = clamp(Math.floor((C - L.ferryH - L.btnH - 34) / 3), 74, 124);
  }
  function tileRect(i) { const L = G.L, c = i % 5, r = Math.floor(i / 5); return { x: L.gx + c * L.tile, y: L.gy + r * L.tile, w: L.tile, h: L.tile }; }
  function tileAt(x, y) { const L = G.L; if (x < L.gx || y < L.gy || x >= L.gx + L.gw || y >= L.gy + L.gh) return -1; return Math.floor((y - L.gy) / L.tile) * 5 + Math.floor((x - L.gx) / L.tile); }
  function treeRect(k) { const L = G.L, sw = G.W / 4; return { x: k * sw + 4, y: L.gy - L.th - 4, w: sw - 8, h: L.th + 2 }; }
  function treeAt(x, y) { for (let k = 0; k < 4; k++) { const r = treeRect(k); if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return k; } return -1; }
  // scene px -> app px (for the FX layer)
  const toApp = (x, y) => ({ x: x + G.L.sx, y: y + G.L.sy });
  function elCenter(id) { const el = typeof id === 'string' ? $(id) : id; if (!el) return { x: G.L.appW / 2, y: 20 }; const r = el.getBoundingClientRect(), k = G.scale || 1, a = $('app').getBoundingClientRect(); return { x: (r.left - a.left + r.width / 2) / k, y: (r.top - a.top + r.height / 2) / k, w: r.width / k, h: r.height / k }; }

  // ------------------------------------------------------------------ FX layer (particles, flyers, floaters, ghost hand)
  function particle(x, y, o) { if (G.fx.length > 80) G.fx.shift(); G.fx.push(Object.assign({ x, y, vx: 0, vy: 0, g: 600, life: 0, max: 0.6, size: 4, col: P.soilD, kind: 'dot', rot: 0, vr: 0 }, o)); }
  function specks(x, y, n, col) { for (let i = 0; i < n; i++) particle(x, y, { vx: (Math.random() - 0.5) * 160, vy: -80 - Math.random() * 120, size: 2 + Math.random() * 2.5, col: col || P.soilD, max: 0.45 + Math.random() * 0.2 }); }
  function confetti(x, y, n) { const cols = [P.red, P.gold, P.leaf, P.rose, P.lake, P.plum]; for (let i = 0; i < n; i++) particle(x, y, { kind: 'conf', vx: (Math.random() - 0.5) * 420, vy: -200 - Math.random() * 300, g: 520, size: 5 + Math.random() * 4, col: cols[i % 6], max: 1.4 + Math.random() * 0.6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 }); }
  function fly(img, from, to, o) {
    o = o || {};
    G.flyers.push({ img, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: -(o.delay || 0), dur: o.dur || 0.42, size: o.size || 26, arc: o.arc == null ? 60 : o.arc, done: o.done, coin: o.coin });
  }
  function flyCoins(from, total, n) {
    n = Math.max(1, Math.min(n || 8, total));
    const to = elCenter('hCoins'); to.x -= (to.w || 0) / 2 - 16;
    let left = total;
    for (let i = 0; i < n; i++) {
      const chunk = i === n - 1 ? left : Math.floor(total / n); left -= chunk;
      G.pendCoins += chunk;
      fly(null, { x: from.x + (Math.random() - 0.5) * 30, y: from.y + (Math.random() - 0.5) * 20 }, to, { coin: true, delay: i * 0.05, dur: 0.5, size: 18, arc: 70 + Math.random() * 40, done: () => { G.pendCoins -= chunk; SND.play('coin', i); bumpEl('hCoins'); } });
    }
  }
  function flyGoods(g, from, n, delay) {
    const to = elCenter('hCellar'); to.x -= (to.w || 0) / 2 - 16;
    const k = Math.min(n, 3);
    for (let i = 0; i < k; i++) { const c = i === k - 1 ? n - (k - 1) : 1; G.pendGoods += c; fly(ART.icon(g, 64), { x: from.x + (i - 1) * 8, y: from.y }, to, { delay: (delay || 0) + i * 0.06, dur: 0.36, size: 28, arc: 50, done: () => { G.pendGoods -= c; bumpEl('hCellar'); } }); }
  }
  function floater(text, x, y, o) { G.floaters.push(Object.assign({ text, x, y, t: 0, life: 1.1, col: P.ink, size: 22, hold: 0 }, o)); return G.floaters[G.floaters.length - 1]; }

  function drawFX(dt) {
    const c = $('fx').getContext('2d'), d = G.dpr;
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, G.L.appW, G.L.appH);
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const p = G.fx[i]; p.life += dt; if (p.life >= p.max) { G.fx.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const a = 1 - p.life / p.max; c.globalAlpha = Math.min(1, a * 1.6); c.fillStyle = p.col;
      if (p.kind === 'conf') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore(); }
      else if (p.kind === 'spark') { c.beginPath(); c.arc(p.x, p.y, p.size * a + 0.5, 0, 7); c.fill(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.size, 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
    for (let i = G.flyers.length - 1; i >= 0; i--) {
      const f = G.flyers[i]; f.t += dt; if (f.t < 0) continue;
      const k = Math.min(1, f.t / f.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = lerp(f.x0, f.x1, e), y = lerp(f.y0, f.y1, e) - Math.sin(k * Math.PI) * f.arc, s = f.size * (1 - 0.35 * k);
      if (f.coin) { c.beginPath(); c.arc(x, y, s / 2, 0, 7); c.fillStyle = P.gold; c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(43,36,32,.5)'; c.stroke(); c.beginPath(); c.arc(x - s * 0.12, y - s * 0.12, s * 0.16, 0, 7); c.fillStyle = 'rgba(255,240,190,.9)'; c.fill(); }
      else if (f.img) c.drawImage(f.img, x - s / 2, y - s / 2, s, s);
      if (k >= 1) { G.flyers.splice(i, 1); if (f.done) f.done(); }
    }
    for (let i = G.floaters.length - 1; i >= 0; i--) {
      const f = G.floaters[i];
      if (f.hold > 0) { f.hold -= dt; } else f.t += dt;
      if (f.t >= f.life) { G.floaters.splice(i, 1); continue; }
      const k = f.t / f.life, y = f.y - ease(k) * 46, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const pop = f.pop ? 1 + 0.25 * Math.max(0, 1 - (performance.now() - f.pop) / 160) : 1;
      c.globalAlpha = a; c.font = FONT(900, Math.round(f.size * pop), true); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = P.cream; c.strokeText(f.text, f.x, y); c.fillStyle = f.col; c.fillText(f.text, f.x, y);
    }
    c.globalAlpha = 1;
    drawHint(c);
  }

  // ------------------------------------------------------------------ ghost hand hints (tutorial + first-time moments)
  function hintPts() {
    const h = G.hint; if (!h) return null;
    try { return h.pts(); } catch (e) { return null; }
  }
  function drawHint(c) {
    const h = G.hint; if (!h || G.sheet && !h.sheetOk || G.md && !h.mdOk) return;
    const pts = hintPts(); if (!pts || !pts.length) return;
    h.t = (h.t || 0) + 1 / 60;
    const cyc = 1.8, k = (h.t % cyc) / cyc;
    let x, y, press = false, alpha = 1;
    if (pts.length === 1) { x = pts[0].x; y = pts[0].y; press = k > 0.35 && k < 0.6; alpha = k < 0.1 ? k / 0.1 : 1; }
    else {
      const mk = clamp((k - 0.12) / 0.66, 0, 1); press = k > 0.1 && k < 0.82; alpha = k < 0.08 ? k / 0.08 : k > 0.9 ? (1 - k) / 0.1 : 1;
      const seg = mk * (pts.length - 1), si = Math.min(pts.length - 2, Math.floor(seg)), f = seg - si;
      x = lerp(pts[si].x, pts[si + 1].x, f); y = lerp(pts[si].y, pts[si + 1].y, f);
      if (press) { c.globalAlpha = 0.35 * alpha; c.strokeStyle = P.gold; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i <= si; i++) c.lineTo(pts[i].x, pts[i].y); c.lineTo(x, y); c.stroke(); }
    }
    c.globalAlpha = 0.9 * alpha * (h.fade == null ? 1 : h.fade);
    ART.hand(c, x - 6, y - 4, 54, press);
    if (h.tag) {
      c.font = FONT(700, 14); const tw = c.measureText(h.tag).width + 20;
      const tx = clamp(pts[0].x - tw / 2 + (h.tagDx || 0), 8, G.L.appW - tw - 8), ty = clamp(pts[0].y + (h.tagDy || -66), 60, G.L.appH - 40);
      c.globalAlpha = 0.95 * alpha; c.fillStyle = P.cream; ART.rr(c, tx, ty, tw, 28, 8); c.fill(); c.strokeStyle = 'rgba(43,36,32,.35)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = P.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(h.tag, tx + tw / 2, ty + 14.5);
    }
    c.globalAlpha = 1;
  }
  function tileCenterApp(i) { const r = tileRect(i); return toApp(r.x + r.w / 2, r.y + r.h / 2); }
  function setHint(o) { G.hint = o ? Object.assign({ t: 0 }, o) : null; }

  // tutorial steps (G.s.tut): 0 swipe, 1 strip, 2 deliver, 3 field tab, 4 paint, 5 wheat chip, 99 done
  function tutorial() {
    const s = G.s; if (s.tut >= 99 || !G.started) { if (G.hint && G.hint.tut) setHint(null); return; }
    const t = s.tut;
    if (t === 0) {
      if ((s.stats.harv.radish || 0) >= 6 || ![1, 2, 3].some(i => IA.bedState(s, i, now()) === 'ripe')) { s.tut = 1; return; }
      if (G.place !== 'field') { hintNav('field', true); return; }
      if (!G.hint || G.hint.id !== 't0') setHint({ id: 't0', tut: true, tag: 'Swipe to pick', pts: () => [1, 2, 3].map(tileCenterApp).map((p, k) => ({ x: p.x + (k === 0 ? -18 : k === 2 ? 18 : 0), y: p.y })) });
    } else if (t === 1) {
      const o = s.orders[0] && s.orders[0].o;
      if (s.stats.orders >= 1) { s.tut = 3; return; }
      if (G.place === 'market') { s.tut = 2; return; }
      if (!o) { setHint(null); return; }
      if (!G.hint || G.hint.id !== 't1') setHint({ id: 't1', tut: true, tag: 'Fill the order', tagDy: 34, pts: () => { const p = elCenter('strip'); return [{ x: p.x + p.w / 2 - 30, y: p.y + 4 }]; } });
    } else if (t === 2) {
      if (s.stats.orders >= 1) { s.tut = 3; return; }
      if (G.place !== 'market') { if (!G.hint || G.hint.id !== 't1') { s.tut = 1; } return; }
      if (!G.hint || G.hint.id !== 't2') setHint({ id: 't2', tut: true, pts: () => { const r = G.L.deliver0; return r ? [toApp(r.x + r.w / 2, r.y + r.h / 2)] : null; } });
    } else if (t === 3) {
      if (G.place === 'field') { s.tut = 4; return; }
      if (G.banner) { setHint(null); return; }
      if (!G.hint || G.hint.id !== 't3') hintNav('field', true, 't3');
    } else if (t === 4) {
      const planted = s.tiles.filter(x => x.kind === 'bed' && x.crop).length;
      if (planted >= 5 || (s.stats.plant.radish || 0) >= 6) { s.tut = 5; setHint(null); return; }
      if (G.place !== 'field') { hintNav('field', true, 't3'); return; }
      if (G.sel !== 'radish' && (s.stats.plant.radish || 0) === 0) G.sel = 'radish';
      if (!G.hint || G.hint.id !== 't4') setHint({ id: 't4', tut: true, tag: 'Paint seeds', pts: () => [1, 2, 3, 8, 7, 6].map(tileCenterApp) });
    } else if (t === 5) {
      if ((s.stats.plant.wheat || 0) > 0 || G.sel === 'wheat') { s.tut = 99; setHint(null); return; }
      const ripeAny = s.tiles.some((x, i) => IA.bedState(s, i, now()) === 'ripe');
      if (!ripeAny || G.place !== 'field' || G.edit) { if (G.hint && G.hint.id === 't5') setHint(null); if (now() - (s.tut5At || (s.tut5At = now())) > 60 * S) s.tut = 99; return; }
      if (!G.hint || G.hint.id !== 't5') setHint({ id: 't5', tut: true, pts: () => { const r = G.L.chipRects && G.L.chipRects.find(c => c.crop === 'wheat'); return r ? [toApp(r.x + r.w / 2, r.y + r.h / 2)] : null; } });
    }
  }
  function hintNav(place, tut, id) {
    id = id || 'nav-' + place;
    if (G.hint && G.hint.id === id) return;
    setHint({ id, tut, pts: () => { const b = document.querySelector('#nav button[data-place="' + place + '"]'); const p = elCenter(b); return [{ x: p.x, y: p.y - 6 }]; } });
  }
  // one-time hints for new systems
  function firstHints() {
    const s = G.s; if (s.tut < 99 || G.hint && G.hint.tut) return;
    s.hints = s.hints || {};
    const done = id => s.hints[id];
    const t = now();
    let want = null;
    if (G.place === 'barn' && !done('pen') && s.pens.hens.length && IA.penInfo(s, 'hens', t).hungry && IA.have(s, 'corn') > 0) want = { id: 'pen', pts: () => { const b = G.L.penBubble && G.L.penBubble.hens; return b ? [toApp(b.x, b.y)] : null; } };
    else if (G.place === 'barn' && !done('build') && !s.shops.oven.built && s.level >= 2 && s.coins >= IA.SHOP.oven.cost) want = { id: 'build', pts: () => { const r = G.L.buildBtn && G.L.buildBtn.oven; return r ? [toApp(r.x + r.w / 2, r.y + r.h / 2)] : null; } };
    else if (G.sheet && G.sheet.kind === 'shop' && !done('make')) want = { id: 'make', sheetOk: true, pts: () => { const b = document.querySelector('#sheet [data-make]:not(.off)'); if (!b) return null; const p = elCenter(b); return [p]; } };
    else if (G.place === 'market' && !done('crate') && s.ferry && s.ferry.here && s.ferry.crates.some(c => !c.done && IA.have(s, c.g) >= c.n)) want = { id: 'crate', pts: () => { const k = s.ferry.crates.findIndex(c => !c.done && IA.have(s, c.g) >= c.n); const r = G.L.crates && G.L.crates[k]; return r ? [toApp(r.x + r.w / 2, r.y + r.h / 2)] : null; } };
    else if (G.place === 'field' && !done('lift') && s.tiles.some(x => IA.isHelper(x)) && !G.edit) want = { id: 'lift', tag: 'Hold to move', tagDy: -70, pts: () => { const i = s.tiles.findIndex(x => IA.isHelper(x)); const p = tileCenterApp(i); const nb = IA.nextBedTile(s); const j = IA.plusTiles(s).filter(x => x !== nb && IA.canMoveHelper(s, i, x))[0]; const q = j >= 0 ? tileCenterApp(j) : { x: p.x + 40, y: p.y }; return [p, p, q]; } };
    if (want) {
      if (!G.hint || G.hint.id !== want.id) { setHint(want); G.hint.lastT = performance.now(); s.hints[want.id + 'N'] = (s.hints[want.id + 'N'] || 0) + 1; if (s.hints[want.id + 'N'] > 3 && want.id !== 'make') hintDone(want.id); }
      else { const nowT = performance.now(); s.hints[want.id + 'T'] = (s.hints[want.id + 'T'] || 0) + Math.min(100, nowT - (G.hint.lastT || nowT)); G.hint.lastT = nowT; if (want.id !== 'make' && s.hints[want.id + 'T'] > 10000) hintDone(want.id); }
    }
    else if (G.hint && !G.hint.tut && !['pen', 'build', 'make', 'crate', 'lift'].includes(G.hint.id) === false) setHint(null);
  }
  function hintDone(id) { G.s.hints = G.s.hints || {}; G.s.hints[id] = 1; if (G.hint && G.hint.id === id) setHint(null); }

  // ------------------------------------------------------------------ places
  function setPlace(p, quiet) {
    if (G.md) return;
    if (p === G.place) return;
    G.slideFrom = G.place; G.slideT = 0; G.slideDir = ['field', 'barn', 'market'].indexOf(p) > ['field', 'barn', 'market'].indexOf(G.place) ? 1 : -1;
    G.place = p; G.edit = false; G.helperSel = null; G.helperAim = null; G.trashArm = null;
    $('act').classList.add('hidden'); // its buttons belong to the place you just left
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.place === p));
    if (!quiet) SND.play('page');
    if (G.hint && G.hint.id && G.hint.id.startsWith('nav-')) setHint(null);
  }

  // ---------------------------------------------------------------- scene drawing
  function sceneCtx() { const c = $('scene').getContext('2d'); c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); return c; }
  function rr(c, x, y, w, h, r) { ART.rr(c, x, y, w, h, r); }
  function card(c, x, y, w, h, r, fill, lift) {
    c.save(); c.shadowColor = 'rgba(43,36,32,.18)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
    rr(c, x, y, w, h, r); c.fillStyle = fill || '#FFF9EB'; c.fill(); c.restore();
    rr(c, x + 2, y + 2, w, h, r); c.strokeStyle = 'rgba(43,36,32,.10)'; c.lineWidth = 2; c.stroke();
    rr(c, x, y, w, h, r); c.strokeStyle = 'rgba(43,36,32,.16)'; c.lineWidth = 2; c.stroke();
  }
  function text(c, s, x, y, o) {
    o = o || {}; c.font = FONT(o.w || 700, o.px || 14, o.d); c.textAlign = o.al || 'center'; c.textBaseline = o.bl || 'middle';
    // fit: shrink the type (down to 9.5 px) before ever cutting a word
    if (o.fit) { let px = o.px || 14; while (px > 9.5 && c.measureText(s).width > o.fit) { px -= 0.5; c.font = FONT(o.w || 700, px, o.d); } o.max = o.fit; }
    if (o.max) { while (s.length > 2 && c.measureText(s).width > o.max) s = s.slice(0, -2) + '…'; if (c.measureText(s).width > o.max) s = s.slice(0, -1); }
    if (o.halo) { c.lineWidth = o.halo; c.strokeStyle = o.haloCol || P.cream; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = o.col || P.ink; c.fillText(s, x, y);
  }
  function coinGlyph(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = P.gold; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(43,36,32,.45)'; c.stroke(); }
  function heartGlyph(c, x, y, r) { c.save(); c.translate(x, y); c.scale(r / 10, r / 10); c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-12, 0, -9, -10, 0, -4); c.bezierCurveTo(9, -10, 12, 0, 0, 8); c.fillStyle = P.rose; c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(43,36,32,.45)'; c.stroke(); c.restore(); }
  function ring(c, x, y, r, k, col, w) { c.beginPath(); c.arc(x, y, r, 0, 7); c.strokeStyle = 'rgba(43,36,32,.15)'; c.lineWidth = w || 3; c.stroke(); c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(k, 0, 1)); c.strokeStyle = col || P.leaf; c.stroke(); }
  function hit(x, y, w, h, tap, o) { G.hits.push(Object.assign({ x, y, w, h, tap }, o || {})); }

  function drawScene(dt) {
    const c = sceneCtx(); G.hits = [];
    c.clearRect(0, 0, G.W, G.C);
    if (G.md) { MD.draw(c, dt); return; }
    if (G.slideT < 1) {
      G.slideT = Math.min(1, G.slideT + dt / 0.22);
      const k = ease(G.slideT), dir = G.slideDir;
      c.save(); c.translate(-dir * G.W * k, 0); drawPlace(c, G.slideFrom, dt, true); c.restore();
      c.save(); c.translate(dir * G.W * (1 - k), 0); drawPlace(c, G.place, dt, false); c.restore();
      G.hits = G.hits.filter(h => !h.ghost);
    } else drawPlace(c, G.place, dt, false);
  }
  function drawPlace(c, p, dt, ghost) {
    const n0 = G.hits.length;
    if (p === 'field') drawField(c, dt); else if (p === 'barn') drawBarn(c, dt); else drawMarket(c, dt);
    if (ghost) for (let i = n0; i < G.hits.length; i++) G.hits[i].ghost = true;
  }

  // ---------------------------------------------------------------- FIELD
  function horizonImg() {
    const s = G.s, d = new Date(now()), hr = d.getHours() + d.getMinutes() / 60, hq = Math.round(hr * 4) / 4;
    const built = {}; D.PROJECTS.forEach((p, k) => { if (s.projects[k].done) built[p.id] = 1; });
    const key = G.W + 'x' + G.L.hz + '|' + hq + '|' + Object.keys(built).join(',') + (s.festival ? 'F' : '');
    if (key !== G.horizonKey) { G.horizonKey = key; G.horizonImg = ART.horizon(G.W * G.dpr, G.L.hz * G.dpr, hr, built, s.festival); G.tone = ART.skyTone(hr); }
    return G.horizonImg;
  }
  function drawField(c, dt) {
    const s = G.s, L = G.L, t = now(), T = performance.now() / 1000;
    c.drawImage(horizonImg(), 0, 0, G.W, L.hz);
    // meadow ground
    const gg = c.createLinearGradient(0, L.hz, 0, G.C); gg.addColorStop(0, '#9CC56A'); gg.addColorStop(1, '#8DBF5A');
    c.fillStyle = gg; c.fillRect(0, L.hz, G.W, G.C - L.hz);
    c.fillStyle = 'rgba(63,125,78,.10)'; for (let i = 0; i < 26; i++) { const x = (i * 71) % G.W, y = L.hz + 10 + (i * 37) % Math.max(10, L.trayY - L.hz - 20); c.fillRect(x, y, 2, 6); c.fillRect(x + 4, y + 2, 2, 5); }
    // fence along the field top
    const fy = L.gy - 10;
    c.strokeStyle = '#8A5A3B'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, fy - 10); c.lineTo(G.W - 6, fy - 10); c.moveTo(6, fy - 2); c.lineTo(G.W - 6, fy - 2); c.stroke();
    c.fillStyle = '#7A4E33'; for (let x = 10; x < G.W; x += 34) { rr(c, x, fy - 16, 5, 18, 2); c.fill(); }
    // soil block under the grid
    drawTrees(c, t, T);
    // tiles
    const plus = new Set(IA.plusTiles(s)), nextBed = IA.nextBedTile(s), bedCost = IA.bedCost(s);
    const ripeK = [];
    for (let i = 0; i < 30; i++) {
      const r = tileRect(i), tl = s.tiles[i];
      if (G.lift && G.lift.from === i) { c.drawImage(ART.tile('sod', L.tile * G.dpr, i), r.x, r.y, r.w, r.h); continue; }
      if (tl.kind === 'sod') {
        rr(c, r.x + 4, r.y + 4, r.w - 8, r.h - 8, r.w * 0.16); c.fillStyle = 'rgba(255,255,255,.07)'; c.fill(); c.strokeStyle = 'rgba(63,125,78,.16)'; c.lineWidth = 1.5; c.stroke();
        c.drawImage(ART.tile('sod', L.tile * G.dpr, i), r.x, r.y, r.w, r.h);
        const canDrop = (G.lift && IA.canMoveHelper(s, G.lift.from, i)) || (G.edit && G.helperSel && plus.has(i));
        if (G.edit && plus.has(i) || canDrop) {
          if (canDrop) { rr(c, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 10); c.fillStyle = 'rgba(242,178,51,.22)'; c.fill(); }
          rr(c, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 10); c.setLineDash([5, 4]); c.strokeStyle = canDrop ? P.gold : 'rgba(43,36,32,.45)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
          if (canDrop && G.helperSel) { const nb = boostCount(i); text(c, String(nb), r.x + r.w / 2, r.y + r.h / 2 + 1, { px: 18, w: 900, d: true, col: nb >= 3 ? P.leaf : nb ? P.ink : 'rgba(43,36,32,.4)' }); }
          if (!G.helperSel && !G.lift) { text(c, '+', r.x + r.w / 2, r.y + r.h / 2 - 7, { px: 24, w: 700, col: 'rgba(43,36,32,.7)' }); text(c, String(bedCost), r.x + r.w / 2, r.y + r.h / 2 + 13, { px: 12, col: s.coins >= bedCost ? P.ink : P.red }); }
        } else if (!G.edit && i === nextBed && s.tut >= 99) {
          // price tag on the one next bed
          c.font = FONT(700, 12); const lbl = IA.fmtNum(bedCost), tw = Math.min(r.w - 4, c.measureText(lbl).width + 26), th = 24, tx = r.x + (r.w - tw) / 2, ty = r.y + (r.h - th) / 2;
          c.save(); c.translate(tx + tw / 2, ty + th / 2); c.rotate(-0.06); c.translate(-tw / 2, -th / 2);
          rr(c, 0, 0, tw, th, 6); c.fillStyle = 'rgba(251,244,228,.92)'; c.fill(); c.setLineDash([3, 3]); c.strokeStyle = 'rgba(43,36,32,.5)'; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
          coinGlyph(c, 11, th / 2, 6); text(c, lbl, 19, th / 2 + 0.5, { al: 'left', px: 12, col: s.coins >= bedCost ? P.ink : P.red });
          c.restore();
        }
        continue;
      }
      if (tl.kind === 'sprinkler') { c.drawImage(ART.sprinkler(L.tile * G.dpr), r.x, r.y, r.w, r.h); drawSpray(c, r, T); continue; }
      if (tl.kind === 'hive') { const hr = IA.honeyReady(s, i, t); c.drawImage(ART.hive(L.tile * G.dpr, hr), r.x, r.y, r.w, r.h); drawBees(c, r, T, i); if (hr) ripeK.push(i); continue; }
      // bed
      c.drawImage(ART.tile('bed', L.tile * G.dpr, i), r.x, r.y, r.w, r.h);
      const sp = IA.adjKind(s, i, 'sprinkler'), hv = IA.adjKind(s, i, 'hive');
      if (sp) { rr(c, r.x + 6, r.y + 6, r.w - 12, r.h - 12, r.w * 0.12); c.strokeStyle = 'rgba(79,160,178,.9)'; c.lineWidth = 2; c.stroke(); }
      if (hv) { rr(c, r.x + (sp ? 9 : 6), r.y + (sp ? 9 : 6), r.w - (sp ? 18 : 12), r.h - (sp ? 18 : 12), r.w * 0.1); c.setLineDash([4, 3]); c.strokeStyle = 'rgba(214,150,40,.95)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
      if (sp || hv) { let mx = r.x + r.w - 13; if (sp) { drawDrop(c, mx, r.y + 13, 5.5); mx -= 13; } if (hv) drawBeeMark(c, mx, r.y + 13); }
      const st = IA.bedState(s, i, t);
      if (st === 'empty') {
        c.fillStyle = 'rgba(246,235,211,.18)'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(r.x + r.w * (0.28 + (k % 3) * 0.22), r.y + r.h * (0.38 + Math.floor(k / 3) * 0.26), 1.6, 0, 7); c.fill(); }
        if (G.anim && G.anim[i] && T - G.anim[i] < 0.25) { const k = (T - G.anim[i]) / 0.25; c.beginPath(); c.arc(r.x + r.w / 2, r.y + r.h / 2, 6 + k * 14, 0, 7); c.strokeStyle = 'rgba(246,235,211,' + (0.6 * (1 - k)) + ')'; c.lineWidth = 2; c.stroke(); }
        continue;
      }
      const total = tl.readyAt - tl.plantedAt, prog = st === 'ripe' ? 1 : clamp((t - tl.plantedAt) / total, 0, 1);
      const stage = st === 'ripe' ? 2 : prog < 0.45 ? 0 : 1;
      const img = ART.plant(tl.crop, stage, Math.round(L.tile * 1.1 * G.dpr));
      let sx = 1, sy = 1;
      if (st === 'ripe') {
        const b = 1 + 0.06 * (0.5 + 0.5 * Math.sin(T * Math.PI * 2 / 1.2 + i * 0.7)); sx = sy = b;
        // gold rim: the brightest thing on the field
        c.save(); rr(c, r.x + 3, r.y + 3, r.w - 6, r.h - 6, r.w * 0.16); c.strokeStyle = P.gold; c.lineWidth = 3.5; c.shadowColor = 'rgba(242,178,51,.8)'; c.shadowBlur = 8; c.stroke(); c.restore();
        ripeK.push(i);
      }
      const pa = G.anim && G.anim['p' + i]; if (pa && T - pa < 0.3) { const k = (T - pa) / 0.3; const sq = k < 0.45 ? lerp(1, 0.82, k / 0.45) : lerp(0.82, 1, (k - 0.45) / 0.55); sx *= 2 - sq; sy *= sq; }
      const pw = r.w * 1.1 * sx, ph = r.h * 1.1 * sy;
      c.drawImage(img, r.x + r.w / 2 - pw / 2, r.y + r.h * 0.96 - ph * 0.86, pw, ph);
      if (st === 'growing') {
        // thin arc timer on the lower edge
        const bx0 = r.x + r.w * 0.2, bw0 = r.w * 0.6, by0 = r.y + r.h - 10;
        c.lineCap = 'round'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(bx0, by0); c.lineTo(bx0 + bw0, by0); c.strokeStyle = 'rgba(30,18,10,.45)'; c.stroke();
        c.beginPath(); c.moveTo(bx0, by0); c.lineTo(bx0 + Math.max(0.5, bw0 * prog), by0); c.strokeStyle = 'rgba(242,178,51,.95)'; c.stroke(); c.lineCap = 'butt';
      }
    }
    // helper preview: ghost helper on the spot, a mark on every bed it would boost, tap again to place
    const aim = G.helperHover != null ? G.helperHover : G.helperAim;
    if (G.edit && G.helperSel && aim != null && aim >= 0 && plus.has(aim) && s.tiles[aim].kind === 'sod') {
      const r = tileRect(aim), kind = G.helperSel, pulse = 0.5 + 0.5 * Math.sin(T * 6);
      IA.neighbors(aim).forEach(j => { if (s.tiles[j].kind !== 'bed') return; const q = tileRect(j); rr(c, q.x + 4, q.y + 4, q.w - 8, q.h - 8, q.w * 0.14); c.fillStyle = kind === 'hive' ? 'rgba(242,178,51,' + (0.18 + 0.14 * pulse) + ')' : 'rgba(127,184,188,' + (0.22 + 0.16 * pulse) + ')'; c.fill(); if (kind === 'hive') drawBeeMark(c, q.x + q.w / 2, q.y + q.h / 2, 2); else drawDrop(c, q.x + q.w / 2, q.y + q.h / 2 + 3, 10); });
      c.save(); c.globalAlpha = 0.8; c.drawImage(kind === 'hive' ? ART.hive(L.tile * G.dpr, false) : ART.sprinkler(L.tile * G.dpr), r.x, r.y, r.w, r.h); c.restore();
      rr(c, r.x + 2, r.y + 2, r.w - 4, r.h - 4, r.w * 0.16); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke();
    }
    // the lifted helper follows the finger
    if (G.lift) { const tl = s.tiles[G.lift.from]; const img = tl.kind === 'hive' ? ART.hive(L.tile * G.dpr, false) : ART.sprinkler(L.tile * G.dpr); c.save(); c.globalAlpha = 0.9; c.shadowColor = 'rgba(43,36,32,.35)'; c.shadowBlur = 14; c.shadowOffsetY = 8; c.drawImage(img, G.lift.x - L.tile * 0.6, G.lift.y - L.tile * 0.9, L.tile * 1.2, L.tile * 1.2); c.restore(); }
    // growing-time bubble
    if (G.bubble && performance.now() - G.bubble.at < 1500) {
      const r = tileRect(G.bubble.i), tl = s.tiles[G.bubble.i];
      let msg = null;
      if (tl.kind === 'bed' && tl.crop && t < tl.readyAt) msg = IA.fmtTime(tl.readyAt - t);
      else if (tl.kind === 'hive' && t < tl.honeyAt) msg = 'Honey ' + IA.fmtTime(tl.honeyAt - t);
      if (msg) { c.font = FONT(700, 14); const bw = c.measureText(msg).width + 18, bx = clamp(r.x + r.w / 2 - bw / 2, 4, G.W - bw - 4), by = r.y - 30; card(c, bx, by, bw, 28, 14, P.cream); text(c, msg, bx + bw / 2, by + 14.5, { px: 14 }); }
    }
    drawTray(c);
  }
  function drawDrop(c, x, y, r) { c.beginPath(); c.moveTo(x, y - r * 1.4); c.quadraticCurveTo(x + r, y, x, y + r * 0.8); c.quadraticCurveTo(x - r, y, x, y - r * 1.4); c.fillStyle = '#7FB8BC'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.5)'; c.lineWidth = 1; c.stroke(); }
  function drawBeeMark(c, x, y, k) { k = k || 1; ART.ell(c, x, y, 5 * k, 3.6 * k); c.fillStyle = P.gold; c.fill(); c.strokeStyle = 'rgba(43,36,32,.6)'; c.lineWidth = 1; c.stroke(); c.fillStyle = P.ink; c.fillRect(x - k, y - 3.5 * k, 2 * k, 7 * k); }
  function boostCount(i) { return IA.neighbors(i).filter(j => G.s.tiles[j].kind === 'bed').length; }
  function drawSpray(c, r, T) {
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.38;
    c.strokeStyle = 'rgba(127,184,188,.75)'; c.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const a = T * 1.6 + k * Math.PI / 2, ph = ((T * 1.2 + k * 0.25) % 1); c.globalAlpha = 1 - ph; c.beginPath(); c.arc(cx + Math.cos(a) * r.w * 0.36 * ph, cy + Math.sin(a) * r.w * 0.2 * ph - 3, 2, 0, 7); c.stroke(); }
    c.globalAlpha = 1;
  }
  function drawBees(c, r, T, i) { for (let k = 0; k < 2; k++) { const a = T * (2.2 + k) + i + k * 3; const x = r.x + r.w / 2 + Math.cos(a) * r.w * 0.38, y = r.y + r.h * 0.35 + Math.sin(a * 1.7) * r.h * 0.18; ART.ell(c, x, y, 3, 2.2); c.fillStyle = P.gold; c.fill(); c.fillStyle = P.ink; c.fillRect(x - 0.6, y - 2, 1.2, 4); } }
  function drawTrees(c, t, T) {
    const s = G.s, L = G.L;
    for (let k = 0; k < 4; k++) {
      const r = treeRect(k), tr = s.trees[k], cx = r.x + r.w / 2, base = L.gy - 6;
      if (!IA.treeSlotOpen(s, k)) {
        const nextSlot = Math.min(...D.TREE_SLOT_LVL.filter(l => l > s.level));
        if (s.level >= 3 && D.TREE_SLOT_LVL[k] === nextSlot) { // a small wooden sign on the next slots only
          const sw = 40, sh = 20, sx = cx - sw / 2, sy = base - 30;
          c.fillStyle = '#7A4E33'; c.fillRect(cx - 2, sy + sh, 4, 12); rr(c, sx, sy, sw, sh, 4); c.fillStyle = '#C9894A'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.5)'; c.lineWidth = 1.5; c.stroke();
          c.drawImage(ART.icon('apple', 64), sx - 14, sy - 2, 22, 22);
          text(c, 'Lv ' + D.TREE_SLOT_LVL[k], cx + 4, sy + sh / 2 + 0.5, { px: 11, col: P.cream });
        }
        continue;
      }
      if (!tr.kind) {
        const rad = Math.min(r.h * 0.34, 24), cy = base - rad - 4;
        c.beginPath(); c.arc(cx, cy, rad, 0, 7); c.setLineDash([4, 4]); c.strokeStyle = 'rgba(43,36,32,.45)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(251,244,228,.6)'; c.fill();
        text(c, '+', cx, cy - 1, { px: 22, col: 'rgba(43,36,32,.65)' });
        text(c, 'Tree', cx, cy + rad + 8, { px: 11, col: P.cream, halo: 3, haloCol: 'rgba(63,125,78,.8)' });
        if (G.pulse === 'tree' && Math.sin(T * 6) > 0) { c.beginPath(); c.arc(cx, cy, rad + 5, 0, 7); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
        hit(r.x, r.y, r.w, r.h, () => openSheet('tree', k), { tree: k });
        continue;
      }
      const ripe = t >= tr.readyAt, sz = Math.min(r.w * 1.05, r.h * 1.15);
      let sc = 1; if (ripe) sc = 1 + 0.03 * Math.sin(T * 5 + k);
      const pa = G.anim && G.anim['t' + k]; if (pa && T - pa < 0.3) sc *= 1 + 0.12 * Math.sin((T - pa) / 0.3 * Math.PI);
      const img = ART.tree(tr.kind, ripe, Math.round(sz * G.dpr));
      const w = sz * sc, h = sz * 1.15 * sc;
      c.drawImage(img, cx - w / 2, base - h * 0.95, w, h);
      if (ripe) { c.save(); c.beginPath(); c.ellipse(cx, base - h * 0.64, w * 0.34, w * 0.3, 0, 0, 7); c.strokeStyle = 'rgba(242,178,51,.9)'; c.lineWidth = 2.5; c.shadowColor = 'rgba(242,178,51,.8)'; c.shadowBlur = 6; c.stroke(); c.restore(); }
      else { const T0 = D.TREES[tr.kind]; const k2 = 1 - (tr.readyAt - t) / T0.every; c.beginPath(); c.arc(cx, base - 4, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(k2, 0, 1)); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
    }
  }
  function unlockedCrops() { return D.CROPS.filter(c => c.lvl <= G.s.level); }
  // seed tray entries: every unlocked crop plus a peek at the next locked one
  function trayEntries() { const U = unlockedCrops().slice(), nx = D.CROPS.find(c => c.lvl > G.s.level); if (nx) U.push(Object.assign({ locked: true }, nx)); return U; }
  function trayPageOf(id) { const ent = trayEntries(), per = ent.length > 6 ? 5 : 6, i = ent.findIndex(c => c.id === id); return i < 0 ? 0 : Math.floor(i / per); }
  function trayNextPage() { const ent = trayEntries(), per = ent.length > 6 ? 5 : 6, pages = Math.ceil(ent.length / per); G.page = (G.page + 1) % pages; SND.play('page'); if (G.pulse === 'page') G.pulse = null; }
  function drawTray(c) {
    const s = G.s, L = G.L, y0 = L.trayY, T = performance.now() / 1000;
    const g = c.createLinearGradient(0, y0, 0, G.C); g.addColorStop(0, '#EFE0BE'); g.addColorStop(1, P.shade);
    c.fillStyle = g; c.fillRect(0, y0, G.W, G.C - y0);
    c.fillStyle = 'rgba(43,36,32,.12)'; c.fillRect(0, y0, G.W, 2);
    const n = 7, gap = 6, cw = Math.min(56, Math.floor((G.W - 16 - gap * (n - 1)) / n)), ch = L.tray - 26;
    const x0 = Math.round((G.W - (cw * n + gap * (n - 1))) / 2), cy = y0 + 8;
    G.L.chipRects = [];
    if (G.edit) {
      const items = ['sprinkler', 'hive'];
      items.forEach((h, j) => {
        const H0 = D.HELPERS[h], x = x0 + j * (cw * 1.5 + gap), w = cw * 1.5, lock = s.level < H0.lvl, n2 = IA.helperCount(s, h), cost = IA.helperCost(s, h);
        const sel = G.helperSel === h, yy = cy - (sel ? 5 : 0);
        card(c, x, yy, w, ch, 12, sel ? '#FFF1C9' : P.cream);
        if (sel) { rr(c, x, yy, w, ch, 12); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
        const img = h === 'hive' ? ART.hive(96, false) : ART.sprinkler(96);
        c.globalAlpha = lock ? 0.4 : 1; c.drawImage(img, x + w / 2 - 20, yy + 4, 40, 40); c.globalAlpha = 1;
        text(c, lock ? 'Level ' + H0.lvl : n2 >= 3 ? 'Max' : String(cost), x + w / 2, yy + ch - 11, { px: 12, col: !lock && n2 < 3 && s.coins < cost ? P.red : P.ink });
        hit(x, y0, w, L.tray, () => { if (lock) { toast(H0.name + ' at Level ' + H0.lvl); SND.play('error'); return; } if (n2 >= 3) { toast('All 3 placed'); return; } G.helperSel = sel ? null : h; G.helperAim = null; SND.play('tap'); }, { chip: 'helper' });
      });
      const tx = x0 + 2 * (cw * 1.5 + gap) + 4, tw = x0 + cw * n + gap * (n - 1) - cw - gap - tx;
      const aimT = G.helperHover != null && G.helperHover >= 0 ? G.helperHover : G.helperAim, aimOk = G.helperSel && aimT != null && aimT >= 0 && s.tiles[aimT].kind === 'sod' && IA.plusTiles(s).includes(aimT), nbA = aimOk ? boostCount(aimT) : 0;
      text(c, G.helperSel ? (aimOk ? 'Boosts ' + nbA + ' bed' + (nbA === 1 ? '' : 's') : 'Number = beds it boosts') : 'Tap + to add a bed', tx + tw / 2, cy + ch / 2 - 8, { px: 12.5, fit: tw, col: aimOk && !nbA ? P.red : P.ink });
      text(c, G.helperSel ? (aimOk && G.helperHover == null ? 'Tap it again to place' : 'Tap a glowing tile') : 'Hold a helper to move it', tx + tw / 2, cy + ch / 2 + 9, { px: 11, w: 500, col: 'rgba(43,36,32,.6)', fit: tw });
    } else {
      const ent = trayEntries(), per = ent.length > 6 ? 5 : 6, pages = Math.ceil(ent.length / per);
      G.page = Math.min(G.page, pages - 1);
      const list = ent.slice(G.page * per, G.page * per + per);
      list.forEach((cr, j) => {
        const x = x0 + j * (cw + gap), sel = G.sel === cr.id && !cr.locked, yy = cy - (sel ? 6 : 0);
        card(c, x, yy, cw, ch, 12, sel ? '#FFF1C9' : P.cream);
        if (sel) { rr(c, x, yy, cw, ch, 12); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
        c.globalAlpha = cr.locked ? 0.35 : 1;
        const isz = Math.min(cw - 8, ch - 22); c.drawImage(ART.icon(cr.id, 96), x + cw / 2 - isz / 2, yy + 3, isz, isz);
        c.globalAlpha = 1;
        if (cr.locked) text(c, 'Lv ' + cr.lvl, x + cw / 2, yy + ch - 11, { px: 11, col: P.plum });
        else if (IA.seedCost(s, cr.id) === 0) text(c, 'Free', x + cw / 2, yy + ch - 10.5, { px: 12, col: P.leaf });
        else { coinGlyph(c, x + cw / 2 - 9, yy + ch - 11, 4.5); text(c, String(cr.seed), x + cw / 2 + 4, yy + ch - 10.5, { px: 12, col: s.coins >= cr.seed ? P.ink : P.red }); }
        const have = IA.have(s, cr.id); if (have && !cr.locked) { c.font = FONT(700, 10); const tw = c.measureText(have).width + 8; rr(c, x + cw - tw + 2, yy - 4, tw, 15, 7); c.fillStyle = P.leaf; c.fill(); text(c, String(have), x + cw - tw / 2 + 2, yy + 3.5, { px: 10, col: P.cream }); }
        G.L.chipRects.push({ x, y: yy, w: cw, h: ch, crop: cr.id, locked: !!cr.locked });
        if (G.pulse === 'seed:' + cr.id && Math.sin(T * 6) > 0) { rr(c, x - 3, yy - 3, cw + 6, ch + 6, 14); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
      });
      if (pages > 1) { // the page chip: a full-size target, with the page dots on it
        const x = x0 + 5 * (cw + gap);
        card(c, x, cy, cw, ch, 12, '#F3E8D2');
        const nxt = (G.page + 1) % pages, other = ent[nxt * per], isz = Math.min(cw - 14, ch - 30);
        if (other) { c.globalAlpha = 0.6; c.drawImage(ART.icon(other.id, 96), x + cw / 2 - isz / 2, cy + 5, isz, isz); c.globalAlpha = 1; }
        text(c, nxt > G.page ? 'More ›' : '‹ Back', x + cw / 2, cy + ch - 11, { px: 11.5, fit: cw - 6 });
        G.L.chipRects.push({ x, y: cy, w: cw, h: ch, page: true });
        if (G.pulse === 'page' && Math.sin(T * 6) > 0) { rr(c, x - 3, cy - 3, cw + 6, ch + 6, 14); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
      }
      G.L.pages = pages;
    }
    // wrench (edit mode) chip, far right
    const wx = x0 + 6 * (cw + gap), yy = cy - (G.edit ? 6 : 0);
    card(c, wx, yy, cw, ch, 12, G.edit ? P.gold : P.cream);
    drawWrench(c, wx + cw / 2, yy + ch / 2 - 6, 15);
    text(c, G.edit ? 'Done' : 'Build', wx + cw / 2, yy + ch - 11, { px: 11 });
    if (G.pulse === 'edit' && !G.edit && Math.sin(T * 6) > 0) { rr(c, wx - 3, yy - 3, cw + 6, ch + 6, 14); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
    hit(wx, y0, cw + 8, L.tray, () => { G.edit = !G.edit; G.helperSel = null; G.helperAim = null; SND.play('tap'); if (G.pulse === 'edit') G.pulse = null; }, { chip: 'wrench' });
    G.L.wrench = { x: wx, y: yy, w: cw, h: ch };
  }
  function drawWrench(c, x, y, r) {
    c.save(); c.translate(x, y); c.rotate(-0.7); c.fillStyle = '#7A6A5E'; c.strokeStyle = P.ink; c.lineWidth = 1.5;
    rr(c, -2.5, -r * 0.2, 5, r * 1.1, 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(0, -r * 0.45, r * 0.42, 0.9, Math.PI * 2 + 0.25); c.lineTo(r * 0.15, -r * 0.62); c.lineTo(-r * 0.15, -r * 0.62); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- BARN
  // A farmyard: the field fence behind, grass, a dirt lane under each row. Built and buildable plots share the
  // space; locked ones shrink to a row of small signposts at the bottom.
  function barnPlan() {
    const s = G.s, cells = [], signs = [];
    ['hens', 'cows'].forEach(k => (s.level >= D.ANIMALS[k].lvl ? cells : signs).push({ kind: 'pen', id: k, lvl: D.ANIMALS[k].lvl }));
    SHOP_ORDER.forEach(id => (s.level >= IA.SHOP[id].lvl ? cells : signs).push({ kind: 'shop', id, lvl: IA.SHOP[id].lvl }));
    cells.push({ kind: 'cellar', id: 'cellar' });
    signs.sort((a, b) => a.lvl - b.lvl);
    const top = 34, signH = signs.length ? 58 : 0, gap = 12, pad = 10, rows = Math.ceil(cells.length / 2);
    const rh = Math.min(200, Math.floor((G.C - top - signH - 6 - (rows - 1) * gap) / rows));
    const cw = (G.W - pad * 3) / 2;
    cells.forEach((it, i) => { it.x = pad + (i % 2) * (cw + pad); it.y = top + Math.floor(i / 2) * (rh + gap); it.w = cw; it.h = rh; });
    const used = top + rows * (rh + gap) - gap;
    return { cells, signs, top, rows, rh, gap, used, signY: G.C - signH + 2 };
  }
  function drawYard(c, plan, T) {
    const W = G.W, C = G.C, tone = G.tone || ART.skyTone(12);
    // sky sliver + the field beyond the fence
    const sk = c.createLinearGradient(0, 0, 0, 22); sk.addColorStop(0, tone.top); sk.addColorStop(1, '#E9EFD9'); c.fillStyle = sk; c.fillRect(0, 0, W, 22);
    c.fillStyle = '#A9C77A'; c.fillRect(0, 14, W, 14);
    c.fillStyle = 'rgba(63,125,78,.35)'; for (let x = -6; x < W; x += 14) { c.fillRect(x, 16, 7, 3); c.fillRect(x + 4, 22, 7, 3); }
    const g = c.createLinearGradient(0, 26, 0, C); g.addColorStop(0, '#B3CB86'); g.addColorStop(1, '#A2BF74'); c.fillStyle = g; c.fillRect(0, 26, W, C - 26);
    // split-rail fence behind the plots
    c.strokeStyle = '#8A5A3B'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 18); c.lineTo(W, 18); c.moveTo(0, 26); c.lineTo(W, 26); c.stroke();
    c.fillStyle = '#7A4E33'; for (let x = 8; x < W; x += 38) { rr(c, x, 12, 5, 20, 2); c.fill(); }
    // a dirt lane under each row: the shared ground the plots stand on
    for (let r = 0; r < plan.rows; r++) {
      const y = plan.top + r * (plan.rh + plan.gap) + plan.rh - 18;
      c.fillStyle = '#D9C49A'; rr(c, -10, y, W + 20, 26, 12); c.fill();
      c.fillStyle = 'rgba(122,78,51,.12)'; for (let x = 12 + r * 9; x < W; x += 31) { c.beginPath(); c.arc(x, y + 9 + (x % 3) * 4, 1.6, 0, 7); c.fill(); }
    }
    // grass tufts
    c.strokeStyle = 'rgba(63,125,78,.35)'; c.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { const x = (i * 67 + 13) % W, y = 40 + (i * 113) % Math.max(40, C - 60); c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x - 2, y); c.moveTo(x + 2, y + 6); c.lineTo(x + 4, y + 1); c.stroke(); }
  }
  function drawBarn(c, dt) {
    const s = G.s, t = now(), T = performance.now() / 1000, plan = barnPlan();
    drawYard(c, plan, T);
    // early on the yard has room: the big red barn stands in it (later the plots cover it)
    const free = (plan.signs.length ? plan.signY - 8 : G.C - 6) - plan.used;
    if (free > 110) drawBigBarn(c, G.W / 2, plan.used + free * 0.5 + Math.min(free - 30, 220) * 0.5, Math.min(free - 30, 220), T);
    G.L.pen = {}; G.L.buildBtn = {}; G.L.barnCells = {}; G.L.penBubble = {};
    plan.cells.forEach(it => {
      G.L.barnCells[it.id] = { x: it.x, y: it.y, w: it.w, h: it.h };
      if (it.kind === 'pen') drawPen(c, it.id, it.x, it.y, it.w, it.h, t, T);
      else if (it.kind === 'shop') drawShop(c, it.id, it.x, it.y, it.w, it.h, t, T);
      else drawCellarDoor(c, it.x, it.y, it.w, it.h);
    });
    drawSignposts(c, plan);
  }
  function drawBigBarn(c, cx, base, h, T) {
    const w = h * 1.15, wallH = h * 0.5, x = cx - w / 2, ink = 'rgba(43,36,32,.6)';
    c.fillStyle = '#D9C49A'; rr(c, x - 30, base - 8, w + 60, 22, 11); c.fill();
    c.fillStyle = 'rgba(30,18,10,.2)'; ART.ell(c, cx, base + 2, w * 0.56, 8); c.fill();
    // gambrel roof
    const sh = base - wallH, ry = sh - h * 0.22, peak = sh - h * 0.46;
    c.beginPath(); c.moveTo(x - 8, sh + 4); c.lineTo(x + w * 0.08, ry); c.lineTo(cx, peak); c.lineTo(x + w * 0.92, ry); c.lineTo(x + w + 8, sh + 4); c.closePath();
    c.fillStyle = '#6E4A3A'; c.fill(); c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(x + 2, sh); c.lineTo(x + w * 0.12, ry + 6); c.lineTo(cx, peak + 9); c.lineTo(x + w * 0.88, ry + 6); c.lineTo(x + w - 2, sh); c.closePath();
    c.fillStyle = P.red; c.fill();
    c.fillStyle = '#B23A27'; c.fillRect(x, sh, w, wallH);
    c.strokeStyle = 'rgba(43,36,32,.18)'; c.lineWidth = 1.5; for (let i = 1; i < 10; i++) { c.beginPath(); c.moveTo(x + w * i / 10, sh); c.lineTo(x + w * i / 10, base); c.stroke(); }
    c.strokeStyle = ink; c.lineWidth = 2; c.strokeRect(x, sh, w, wallH);
    // hayloft door with hay, big X doors
    const lw = w * 0.2, lh = h * 0.16, ly = ry + (sh - ry) * 0.1;
    c.fillStyle = '#3A2418'; c.fillRect(cx - lw / 2, ly, lw, lh); c.fillStyle = '#E2B75A'; c.fillRect(cx - lw / 2 + 3, ly + lh * 0.55, lw - 6, lh * 0.45 - 3);
    c.strokeStyle = P.cream; c.lineWidth = 3; c.strokeRect(cx - lw / 2, ly, lw, lh);
    const dw = w * 0.36, dh = wallH * 0.78, dx = cx - dw / 2, dy = base - dh;
    c.fillStyle = '#9A2F20'; c.fillRect(dx, dy, dw, dh);
    c.strokeStyle = P.cream; c.lineWidth = 3; c.strokeRect(dx, dy, dw, dh); c.beginPath(); c.moveTo(cx, dy); c.lineTo(cx, base);
    c.moveTo(dx, dy); c.lineTo(cx, base); c.moveTo(cx, dy); c.lineTo(dx, base); c.moveTo(cx, dy); c.lineTo(dx + dw, base); c.moveTo(dx + dw, dy); c.lineTo(cx, base); c.stroke();
    // trim + weathervane
    c.strokeStyle = P.cream; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + 2, sh); c.lineTo(x + w * 0.12, ry + 6); c.lineTo(cx, peak + 9); c.lineTo(x + w * 0.88, ry + 6); c.lineTo(x + w - 2, sh); c.stroke();
    c.strokeStyle = '#3A2418'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx, peak); c.lineTo(cx, peak - 18); c.stroke();
    const sw = Math.sin(T * 0.7) * 0.25; c.save(); c.translate(cx, peak - 16); c.rotate(sw); c.fillStyle = '#3A2418'; c.beginPath(); c.moveTo(-10, 0); c.lineTo(8, -3); c.lineTo(10, 0); c.lineTo(8, 3); c.closePath(); c.fill(); c.restore();
    // a few hay bales by the door
    [[dx - 26, 0], [dx - 14, -10], [dx + dw + 14, 0]].forEach(([bx, dy2]) => { rr(c, bx - 12, base - 14 + dy2, 24, 14, 3); c.fillStyle = '#E2B75A'; c.fill(); c.strokeStyle = 'rgba(122,78,51,.6)'; c.lineWidth = 1.2; c.stroke(); c.beginPath(); c.moveTo(bx - 4, base - 14 + dy2); c.lineTo(bx - 4, base + dy2); c.moveTo(bx + 4, base - 14 + dy2); c.lineTo(bx + 4, base + dy2); c.stroke(); });
  }
  // locked plots: one row of small signposts (icon + level); tap one to hear what it is
  function drawSignposts(c, plan) {
    const s = G.s; if (!plan.signs.length) return;
    const n = plan.signs.length, sw = Math.min(64, (G.W - 16) / n - 6), y = plan.signY, x0 = (G.W - (n * sw + (n - 1) * 6)) / 2;
    plan.signs.forEach((it, i) => {
      const x = x0 + i * (sw + 6), next = i === 0, name = it.kind === 'pen' ? D.ANIMALS[it.id].name : IA.SHOP[it.id].name;
      const g = it.kind === 'pen' ? D.ANIMALS[it.id].makes : IA.SHOP_RECIPES[it.id][0].id;
      c.globalAlpha = next ? 1 : 0.7;
      const tall = sw < 58, sh2 = tall ? 44 : 34;
      c.fillStyle = '#7A4E33'; c.fillRect(x + sw / 2 - 2, y + sh2 - 4, 4, 52 - sh2);
      rr(c, x, y, sw, sh2, 6); c.fillStyle = next ? '#C9894A' : '#B98F5E'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.45)'; c.lineWidth = 1.5; c.stroke();
      if (tall) { c.drawImage(ART.icon(g, 64), x + sw / 2 - 10, y + 3, 20, 20); text(c, 'Lv ' + it.lvl, x + sw / 2, y + 33, { px: 11, col: P.cream, fit: sw - 6 }); }
      else { c.drawImage(ART.icon(g, 64), x + 4, y + 6, 22, 22); text(c, 'Lv ' + it.lvl, x + 28 + (sw - 30) / 2, y + 17.5, { px: 11, col: P.cream, fit: sw - 30 }); }
      c.globalAlpha = 1;
      hit(x - 3, y - 6, sw + 6, 56, () => { toast(name + ' opens at Level ' + it.lvl); SND.play('tap'); });
    });
  }
  function drawPen(c, k, x, y, w, h, t, T) {
    const s = G.s, A = D.ANIMALS[k], info = IA.penInfo(s, k, t);
    G.L.pen[k] = { x, y, w, h };
    // grass paddock inside a rail fence
    c.save(); c.shadowColor = 'rgba(43,36,32,.18)'; c.shadowBlur = 6; c.shadowOffsetY = 3;
    rr(c, x, y, w, h, 14); c.fillStyle = k === 'hens' ? '#C3D79A' : '#B5D08A'; c.fill(); c.restore();
    if (k === 'hens') { c.fillStyle = 'rgba(201,160,110,.45)'; ART.ell(c, x + w * 0.5, y + h * 0.7, w * 0.36, h * 0.16); c.fill(); }
    c.strokeStyle = '#8A5A3B'; c.lineWidth = 2.5; rr(c, x + 4, y + 4, w - 8, h - 8, 11); c.stroke(); rr(c, x + 9, y + 10, w - 18, h - 18, 8); c.strokeStyle = 'rgba(138,90,59,.55)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#7A4E33'; [[x + 4, y + 4], [x + w - 9, y + 4], [x + 4, y + h - 13], [x + w - 9, y + h - 13]].forEach(([px, py]) => { rr(c, px, py, 5, 9, 2); c.fill(); });
    // name plank
    const nm = A.one[0].toUpperCase() + A.one.slice(1) + 's';
    c.font = FONT(700, 12.5); const nw = c.measureText(nm).width + 16;
    rr(c, x + 10, y + 8, nw, 22, 5); c.fillStyle = '#B98F5E'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.4)'; c.lineWidth = 1.2; c.stroke();
    text(c, nm, x + 18, y + 19.5, { al: 'left', px: 12.5, col: P.cream });
    if (G.pulse === 'pen:' + k && Math.sin(T * 6) > 0) { rr(c, x - 2, y - 2, w + 4, h + 4, 16); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
    hit(x, y, w, h, () => tapPen(k));
    const n = s.pens[k].length, slotW = (w - 16) / 3, gy = y + 34, gh = h - 44;
    if (!n) text(c, 'Buy a ' + A.one + ' →', x + w / 2, y + h * 0.6, { px: 13, col: 'rgba(43,36,32,.55)' });
    s.pens[k].forEach((a, ai) => {
      const ax = x + 8 + slotW * (ai + 0.5), ay = gy + gh * 0.62, sz = Math.min(slotW * 0.78, gh * 0.62);
      const busy = a.readyAt != null && t < a.readyAt;
      const act = busy ? Math.pow(Math.max(0, Math.sin(T * 3.1 + ai * 1.9)), 6) : 0;
      if (k === 'hens') ART.hen(c, ax, ay, sz * 0.85, [P.cream, '#C9894A', '#F1E3C8'][ai], act);
      else ART.cow(c, ax, ay, sz * 0.75, busy ? Math.pow(Math.max(0, Math.sin(T * 1.3 + ai * 2.3)), 3) : 0);
      if (a.readyAt == null) { // hungry: the feed bubble is what you tap
        const bx = ax + sz * 0.3, by = ay - sz * 0.62;
        c.globalAlpha = IA.have(s, A.eats) >= A.eatN ? 0.95 : 0.45; bubbleIcon(c, bx, by, A.eats, 14); c.globalAlpha = 1;
        if (!G.L.penBubble[k]) G.L.penBubble[k] = { x: bx, y: by };
      } else if (t >= a.readyAt) { const bb = Math.abs(Math.sin(T * 4 + ai)) * 4; c.drawImage(ART.icon(A.makes, 64), ax - 14, ay - sz * 0.92 - bb, 28, 28); }
      else { const k3 = clamp(1 - (a.readyAt - t) / A.t, 0, 1), bw2 = sz * 0.7, by2 = Math.min(ay + sz * 0.58, y + h - 16); c.lineCap = 'round'; c.lineWidth = 4; c.beginPath(); c.moveTo(ax - bw2 / 2, by2); c.lineTo(ax + bw2 / 2, by2); c.strokeStyle = 'rgba(43,36,32,.18)'; c.stroke(); c.beginPath(); c.moveTo(ax - bw2 / 2, by2); c.lineTo(ax - bw2 / 2 + Math.max(1, bw2 * k3), by2); c.strokeStyle = P.gold; c.stroke(); c.lineCap = 'butt'; }
    });
    // "+ hen" lives in a small pill in the top-right corner, so the paddock itself is one big tap target
    if (n < 3) {
      const cost = IA.animalCost(s, k), can = s.coins >= cost;
      c.font = FONT(700, 12); const lbl = '+ ' + A.one, tw = c.measureText(lbl).width, cwid = c.measureText(String(cost)).width;
      const pw = tw + cwid + 40, ph = 26, px = x + w - pw - 8, py = y + 6;
      rr(c, px, py, pw, ph, 13); c.fillStyle = can ? P.cream : 'rgba(251,244,228,.75)'; c.fill(); c.strokeStyle = can ? 'rgba(43,36,32,.45)' : 'rgba(43,36,32,.25)'; c.lineWidth = 1.5; c.stroke();
      text(c, lbl, px + 9, py + ph / 2 + 0.5, { al: 'left', px: 12 });
      coinGlyph(c, px + 19 + tw, py + ph / 2, 5); text(c, String(cost), px + 27 + tw, py + ph / 2 + 0.5, { al: 'left', px: 12, col: can ? P.ink : P.red });
      hit(px - 6, py - 8, pw + 12, ph + 16, () => { const r = IA.buyAnimal(s, k, now()); if (r.ok) { SND.play(k === 'hens' ? 'cluck' : 'moo'); SND.play('bed'); vib(12); const q = toApp(px + pw / 2, py + ph); confetti(q.x, q.y, 10); save(); } else if (r.err === 'coins') noCoins(); });
    }
  }
  function bubbleIcon(c, x, y, g, r) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = P.cream; c.fill(); c.strokeStyle = 'rgba(43,36,32,.35)'; c.lineWidth = 1.5; c.stroke(); c.drawImage(ART.icon(g, 64), x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); }
  function drawShop(c, id, x, y, w, h, t, T) {
    const s = G.s, W = IA.SHOP[id], sh = s.shops[id];
    const bsz = Math.min(h - 14, w * 0.46);
    if (!sh.built) {
      rr(c, x, y, w, h, 16); c.fillStyle = 'rgba(251,244,228,.55)'; c.fill(); c.setLineDash([6, 5]); c.strokeStyle = 'rgba(43,36,32,.35)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
      c.globalAlpha = 0.3; c.drawImage(ART.building(id, Math.round(bsz * 1.2 * G.dpr), Math.round(bsz * G.dpr), false), x + 6, y + 28, bsz * 1.2 * 0.85, bsz * 0.85); c.globalAlpha = 1;
      text(c, W.name, x + 12, y + 16, { al: 'left', px: 13.5, fit: w - 20 });
      const bw = Math.min(w * 0.48, 92), bh = 40, bx = x + w - bw - 8, by = y + h - bh - 8;
      const can = s.coins >= W.cost, pulse = (G.pulse === 'build:' + id || (id === 'oven' && s.notebook === 3)) && Math.sin(T * 6) > 0;
      rr(c, bx, by, bw, bh, 20); c.fillStyle = can ? P.red : '#B9A68A'; c.fill(); if (pulse) { c.strokeStyle = P.gold; c.lineWidth = 4; c.stroke(); }
      coinGlyph(c, bx + 18, by + bh / 2, 7); text(c, String(W.cost), bx + bw / 2 + 8, by + bh / 2 + 1, { px: 15, col: P.cream });
      G.L.buildBtn[id] = { x: bx, y: by, w: bw, h: bh };
      hit(x, y, w, h, () => { const r = IA.buildShop(s, id, now()); if (r.ok) { SND.play('project'); vib([20, 30, 20]); const p = toApp(x + w / 2, y + h / 2); confetti(p.x, p.y, 24); hintDone('build'); if (G.pulse === 'build:' + id) G.pulse = null; save(); } else if (r.err === 'coins') noCoins(); });
      return;
    }
    const ready = sh.shelf.length > 0;
    card(c, x, y, w, h, 16, ready ? '#FFF6D8' : '#FFF9EB');
    if (ready) { rr(c, x, y, w, h, 16); c.strokeStyle = 'rgba(242,178,51,.9)'; c.lineWidth = 3; c.stroke(); }
    // the building is the card: big and centred, with the name and status along the bottom
    const foot = 30, bH = Math.max(40, Math.min(h - foot - 10, (w - 12) / 1.2)), bW = bH * 1.2, bX = x + (w - bW) / 2, bY = y + h - foot - bH;
    c.fillStyle = 'rgba(30,18,10,.12)'; ART.ell(c, x + w / 2, bY + bH - 2, bW * 0.42, 5); c.fill();
    const pa = G.anim && G.anim['s' + id]; let bs = 1; if (pa && T - pa < 0.3) bs = 1 + 0.08 * Math.sin((T - pa) / 0.3 * Math.PI);
    c.drawImage(ART.building(id, Math.round(bW * G.dpr), Math.round(bH * G.dpr), sh.queue.length > 0), bX + bW * (1 - bs) / 2, bY + bH * (1 - bs), bW * bs, bH * bs);
    if (sh.queue.some(q => q.startAt <= t)) shopLife(c, id, bX, bY, bW, bH, T);
    // queue circles only while something is in them: every slot works at once, each with its own ring
    if (sh.queue.length) {
      const pr = 11, cols = Math.min(2, sh.queue.length);
      sh.queue.forEach((it, q) => {
        const px = x + w - 10 - pr - (q % cols) * (pr * 2 + 5), py = y + 8 + pr + Math.floor(q / cols) * (pr * 2 + 5);
        c.beginPath(); c.arc(px, py, pr + 1, 0, 7); c.fillStyle = '#fff'; c.fill();
        c.drawImage(ART.icon(it.r, 64), px - pr * 0.8, py - pr * 0.8, pr * 1.6, pr * 1.6);
        ring(c, px, py, pr + 2, (t - it.startAt) / (it.doneAt - it.startAt), P.leaf, 3);
      });
    }
    // bottom line: name on the left; on the right finished goods bounce, or the time left, or a Make pill
    const ly = y + h - foot / 2 - 2;
    let rightW = 0;
    if (ready) {
      const n = sh.shelf.length, isz = 24, show = sh.shelf.slice(0, 3);
      show.forEach((g, k) => { const bb = Math.abs(Math.sin(T * 4 + k * 0.9)) * 4; c.drawImage(ART.icon(g, 64), x + w - 10 - isz - k * (isz * 0.75), ly - isz / 2 - 2 - bb, isz, isz); });
      rightW = isz + (show.length - 1) * isz * 0.75 + 6;
      if (n > 3) { text(c, '+' + (n - 3), x + w - 14 - rightW - 4, ly, { al: 'right', px: 12, col: '#A3741A' }); rightW += 26; }
    } else if (sh.queue.length) {
      const nx = Math.min(...sh.queue.map(q => q.doneAt)), tl = IA.fmtTime(nx - t);
      c.font = FONT(700, 13); rightW = c.measureText(tl).width + 8;
      text(c, tl, x + w - 12, ly, { al: 'right', px: 13, col: 'rgba(43,36,32,.75)' });
    } else { const mw = 58; rr(c, x + w - mw - 8, ly - 11, mw, 22, 11); c.fillStyle = P.leaf; c.fill(); text(c, 'Make', x + w - mw / 2 - 8, ly + 0.5, { px: 12, col: P.cream }); rightW = mw + 4; }
    text(c, W.name, x + 12, ly, { al: 'left', px: 13, fit: w - 24 - rightW });
    if (G.pulse === 'shop:' + id && Math.sin(T * 6) > 0) { rr(c, x - 2, y - 2, w + 4, h + 4, 18); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
    hit(x, y, w, h, () => { if (sh.shelf.length) collectShop(id, x + w / 2, y + h / 2); else openSheet('shop', id); });
  }
  // each workshop does its own small thing while it works
  function shopLife(c, id, bX, bY, bW, bH, T) {
    const puff = (px, py, col, rise, n) => { for (let k = 0; k < (n || 3); k++) { const ph = (T * 0.55 + k / (n || 3)) % 1; c.globalAlpha = 0.5 * (1 - ph); c.beginPath(); c.arc(px + Math.sin(ph * 5 + k) * 4, py - ph * rise, 2.5 + ph * 6, 0, 7); c.fillStyle = col; c.fill(); } c.globalAlpha = 1; };
    if (id === 'oven') puff(bX + bW * 0.526, bY + bH * 0.06, '#FFFFFF', bH * 0.5, 4);
    else if (id === 'press') { // the press wheel turns
      const cx = bX + bW * 0.83, cy = bY + bH * 0.62, r = bH * 0.13, a = T * 2.4;
      c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = '#9A5A2A'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.7)'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = '#4B3020'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 4; k++) { const q = a + k * Math.PI / 2; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(q) * r, cy + Math.sin(q) * r); } c.stroke();
      c.beginPath(); c.arc(cx, cy, 2.5, 0, 7); c.fillStyle = P.gold; c.fill();
    } else if (id === 'creamery') { // the churn plunger bobs
      const cx = bX + bW * 0.83, top = bY + bH * 0.55, bob = Math.abs(Math.sin(T * 5)) * bH * 0.08;
      c.strokeStyle = '#7A4E33'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, top); c.lineTo(cx, top - bH * 0.16 - bob); c.stroke(); c.lineCap = 'butt';
      c.beginPath(); c.arc(cx, top - bH * 0.16 - bob, 3.5, 0, 7); c.fillStyle = '#8A5A3B'; c.fill();
    } else if (id === 'kitchen') puff(bX + bW * 0.8, bY + bH * 0.55, '#FFF6E0', bH * 0.4, 3);
    else if (id === 'creemee') { const bob = Math.sin(T * 4) * 3, sz = bH * 0.28; c.drawImage(ART.icon('mcreemee', 64), bX + bW * 0.9 - sz / 2, bY + bH * 0.66 - sz + bob, sz, sz); }
  }
  function drawCellarDoor(c, x, y, w, h) {
    const s = G.s;
    card(c, x, y, w, h, 16, '#FFF9EB');
    const dw = Math.min(h * 0.6, w * 0.34), dh = dw * 0.8, dx = x + 10, dy = y + (h - dh) / 2 + 4;
    c.fillStyle = '#A9B1A0'; rr(c, dx - 5, dy + dh - 4, dw + 10, 10, 4); c.fill(); c.fillStyle = '#8DBF5A'; c.beginPath(); c.ellipse(dx + dw / 2, dy + 2, dw * 0.62, dh * 0.22, 0, Math.PI, 0); c.fill();
    rr(c, dx, dy, dw, dh, 6); c.fillStyle = '#8A5A3B'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.6)'; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(dx + dw / 2, dy); c.lineTo(dx + dw / 2, dy + dh); c.stroke();
    c.fillStyle = P.gold; c.beginPath(); c.arc(dx + dw / 2 - 5, dy + dh / 2, 2.5, 0, 7); c.arc(dx + dw / 2 + 5, dy + dh / 2, 2.5, 0, 7); c.fill();
    const rx = dx + dw + 10;
    text(c, 'Root cellar', rx, y + 18, { al: 'left', px: 13 });
    const n = IA.cellarCount(s);
    text(c, n + '/' + s.cellar.cap, rx, y + 44, { al: 'left', px: 20, w: 900, d: true, col: n >= s.cellar.cap ? P.red : P.ink, max: x + w - 8 - rx });
    const pw = x + w - 10 - rx;
    const uc = IA.cellarUpCost(s), canUp = s.coins >= uc;
    [['Sell', P.gold, P.ink], [isFinite(uc) ? 'Bigger · ' + IA.fmtNum(uc) : 'Biggest', canUp ? P.leaf : '#B9A68A', P.cream]].forEach(([lb, col, tc], i) => { const px = rx, py = y + h - 56 + i * 26; rr(c, px, py, pw, 22, 11); c.fillStyle = col; c.fill(); text(c, lb, px + pw / 2, py + 11.5, { px: 11, col: tc, fit: pw - 6 }); });
    hit(x, y, w, h, () => openSheet('cellar'));
  }
  function tapPen(k) {
    const s = G.s, r = IA.tapPen(s, k, now()), R = G.L.pen[k];
    const p = toApp(R.x + R.w / 2, R.y + R.h / 2);
    if (r.got) { SND.play(k === 'hens' ? 'cluck' : 'moo'); SND.play('collect'); flyGoods(D.ANIMALS[k].makes, p, r.got); floater('+' + r.got, p.x, p.y - 20, { col: P.leaf }); vib(10); }
    if (r.fed) { SND.play('queue'); specks(p.x, p.y + 10, 6, P.gold); hintDone('pen'); }
    if (r.full) cellarFull();
    if (!r.got && !r.fed) {
      const A = D.ANIMALS[k], info = IA.penInfo(s, k, now());
      if (!s.pens[k].length) toast('Buy a ' + A.one + ' first');
      else if (info.hungry) { toast('Needs ' + A.eatN + ' ' + D.GOODS[A.eats].name.toLowerCase()); SND.play('error'); }
      else if (info.busy) toast('Ready in ' + IA.fmtTime(info.next - now()));
    }
    if (r.got || r.fed) save();
  }
  function collectShop(id, cx, cy) {
    const s = G.s, sh = s.shops[id], goods = sh.shelf.slice();
    const r = IA.collectShop(s, id, now());
    const p = toApp(cx, cy);
    if (r.n) {
      SND.play('collect'); vib(10); G.anim = G.anim || {}; G.anim['s' + id] = performance.now() / 1000;
      const by = {}; goods.slice(0, r.n).forEach(g => by[g] = (by[g] || 0) + 1);
      let d = 0; for (const g in by) { flyGoods(g, p, by[g], d); d += 0.08; }
      for (let i = 0; i < 8; i++) particle(p.x, p.y, { kind: 'spark', vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 90, g: -40, size: 5, col: '#FFFFFF', max: 0.6 });
      floater('+' + r.n, p.x, p.y - 24, { col: P.leaf });
      save();
    }
    if (r.full) cellarFull();
  }

  // ---------------------------------------------------------------- MARKET
  let corkPat = null;
  function cork(c) {
    if (!corkPat) { const cv = ART.mk(128, 128), x = cv.getContext('2d'); x.fillStyle = '#C49A68'; x.fillRect(0, 0, 128, 128); let sd = 11; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 700; i++) { x.fillStyle = r() < 0.5 ? 'rgba(91,58,41,' + (0.1 + r() * 0.2) + ')' : 'rgba(255,235,200,' + (0.08 + r() * 0.15) + ')'; const s2 = 1 + r() * 2.2; x.fillRect(r() * 128, r() * 128, s2, s2 * (0.6 + r())); } corkPat = c.createPattern(cv, 'repeat'); }
    return corkPat;
  }
  function drawMarket(c, dt) {
    const s = G.s, L = G.L, t = now(), T = performance.now() / 1000;
    const fH = (s.level < 7 || !s.ferry || !s.ferry.here) ? 56 : L.ferryH; G.L.fH = fH;
    drawFerry(c, t, T, fH);
    // cork board in a wooden frame
    const by = fH, bh = G.C - L.btnH - 10 - by;
    c.fillStyle = cork(c); c.fillRect(0, by, G.W, bh);
    const vg = c.createLinearGradient(0, by, 0, by + bh); vg.addColorStop(0, 'rgba(43,36,32,.16)'); vg.addColorStop(0.06, 'rgba(43,36,32,0)'); vg.addColorStop(0.94, 'rgba(43,36,32,0)'); vg.addColorStop(1, 'rgba(43,36,32,.14)'); c.fillStyle = vg; c.fillRect(0, by, G.W, bh);
    c.fillStyle = '#8A5A3B'; c.fillRect(0, by, G.W, 4);
    const pad = 10, tw = (G.W - pad * 3) / 2, rows = Math.ceil(s.orders.length / 2);
    const th = clamp(Math.floor((bh - 16 - (rows - 1) * 8) / rows), 74, 124), top = by + 10;
    G.L.tickets = []; G.L.deliver0 = null;
    s.orders.forEach((sl, k) => {
      const x = pad + (k % 2) * (tw + pad), y = top + Math.floor(k / 2) * (th + 8);
      G.L.tickets[k] = { x, y, w: tw, h: th };
      drawTicket(c, sl, k, x, y, tw, th, t, T);
    });
    const used = top + rows * (th + 8);
    const room = by + bh - used - 6;
    if (room >= 72 && s.level >= 4) projectNote(c, pad, used + 2, G.W - pad * 2, Math.min(room - 4, 86), t);
    // deliver animations: fold + courier
    G.anims = G.anims.filter(a => T - a.t0 < 1.6);
    G.anims.forEach(a => {
      const k = (T - a.t0);
      if (a.kind === 'fold' && k < 0.3) { const f = 1 - k / 0.3; c.save(); c.translate(a.x + a.w / 2, a.y + a.h / 2); c.scale(f, f * 0.6 + 0.1); card(c, -a.w / 2, -a.h / 2, a.w, a.h, 6, '#FFF9EB'); c.restore(); if (k > 0.2) paperBag(c, a.x + a.w / 2, a.y + a.h / 2, 30); }
      if (a.kind === 'fold' && k >= 0.25) { const cx = a.x + a.w / 2 + Math.pow((k - 0.25) / 1.2, 1.6) * (G.W + 80), cy = a.y + a.h - 8; ART.courier(c, cx, cy, 26, k); }
    });
    // three big buttons
    const bY = G.C - L.btnH - 4, bW = (G.W - pad * 4) / 3;
    marketButton(c, pad, bY, bW, L.btnH, 'csa', t, T);
    marketButton(c, pad * 2 + bW, bY, bW, L.btnH, 'md', t, T);
    marketButton(c, pad * 3 + bW * 2, bY, bW, L.btnH, 'town', t, T);
  }
  function projectNote(c, x, y, w, h, t) {
    const s = G.s, k = s.projects.findIndex(p => !p.done); if (k < 0) return;
    const Pj = D.PROJECTS[k], vis = IA.projVisible(s, k);
    c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(-0.008); c.translate(-w / 2, -h / 2);
    card(c, 0, 0, w, h, 6, '#FFF6DC');
    c.beginPath(); c.arc(w / 2, 4, 4.5, 0, 7); c.fillStyle = P.lake; c.fill();
    text(c, 'Town project', 12, 16, { al: 'left', px: 11, col: P.plum });
    if (!vis) { text(c, Pj.name, 12, 34, { al: 'left', px: 16, w: 900, d: true, fit: w - 24 }); text(c, 'Opens at Level ' + Pj.lvl + ' · ' + Pj.perk, 12, 56, { al: 'left', px: 12, w: 500, col: 'rgba(43,36,32,.6)', max: w - 24 }); c.restore(); hit(x, y, w, h, () => openSheet('town')); return; }
    text(c, Pj.name, 12, 34, { al: 'left', px: 16, w: 900, d: true, fit: w - 24 });
    const nd = IA.projNeeds(s, k), f = nd.reduce((a, n) => a + Math.min(1, n.got / n.need), 0) / nd.length;
    rr(c, 12, h - 12, w - 24, 6, 3); c.fillStyle = 'rgba(43,36,32,.12)'; c.fill(); rr(c, 12, h - 12, Math.max(6, (w - 24) * f), 6, 3); c.fillStyle = P.gold; c.fill();
    const order = nd.filter(n => n.got < n.need).concat(nd.filter(n => n.got >= n.need));
    let nx = 12; const ny = Math.min(h - 28, 58);
    for (const n of order) {
      const lbl = n.what === 'coins' ? IA.fmtNum(n.got) + '/' + IA.fmtNum(n.need) : n.what === 'feast' ? n.got + '/' + n.need + ' dishes' : n.got + '/' + n.need;
      c.font = FONT(700, 12); const tw2 = c.measureText(lbl).width;
      if (nx + 22 + tw2 > w - 12) break;
      if (n.what === 'coins') coinGlyph(c, nx + 8, ny, 7); else if (n.what === 'hearts') heartGlyph(c, nx + 8, ny, 8); else c.drawImage(ART.icon(n.what === 'feast' ? 'pie' : n.what, 64), nx - 1, ny - 10, 20, 20);
      text(c, lbl, nx + 20, ny + 0.5, { al: 'left', px: 12, col: n.got >= n.need ? P.leaf : P.ink });
      nx += 20 + tw2 + 12;
    }
    c.restore();
    hit(x, y, w, h, () => openSheet('town'));
  }
  function drawTicket(c, sl, k, x, y, w, h, t, T) {
    const s = G.s;
    if (!sl.o) {
      rr(c, x, y, w, h, 8); c.fillStyle = 'rgba(251,244,228,.25)'; c.fill(); c.setLineDash([5, 5]); c.strokeStyle = 'rgba(251,244,228,.6)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
      text(c, sl.at > t + 1000 ? 'New order ' + IA.fmtTime(sl.at - t) : 'New order…', x + w / 2, y + h / 2, { px: 12, col: 'rgba(43,36,32,.6)' });
      return;
    }
    const o = sl.o, met = IA.orderMet(s, o), pinned = s.pin === o.id;
    const rot = ((o.id * 37) % 5 - 2) * 0.006;
    c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot); c.translate(-w / 2, -h / 2);
    card(c, 0, 0, w, h, 6, o.golden ? '#FFF1C9' : '#FFFCF2');
    if (met) { rr(c, 1, 1, w - 2, h - 2, 6); c.strokeStyle = 'rgba(63,125,78,.85)'; c.lineWidth = 3; c.stroke(); }
    if (o.golden) { rr(c, 3, 3, w - 6, h - 6, 5); c.strokeStyle = P.gold; c.lineWidth = 2; c.stroke(); }
    // pin
    c.beginPath(); c.arc(w / 2, 4, pinned ? 6 : 4.5, 0, 7); c.fillStyle = pinned ? P.gold : P.red; c.fill(); c.strokeStyle = 'rgba(43,36,32,.5)'; c.lineWidth = 1; c.stroke();
    text(c, o.sender, 9, 16, { al: 'left', px: 12, col: 'rgba(43,36,32,.75)', fit: w - 46 });
    // lines
    const n = o.lines.length, lw = (w - 16) / n, ly = 26 + (h - 26 - 34) / 2, stack = n >= 3 || lw < 70;
    o.lines.forEach((l, i) => {
      const lx = 8 + i * lw, hv = IA.have(s, l.g), ok = hv >= l.n, label = Math.min(hv, l.n) + '/' + l.n;
      if (stack) {
        const isz = Math.min(28, h * 0.27), cx = lx + lw / 2;
        c.drawImage(ART.icon(l.g, 64), cx - isz / 2, ly - isz / 2 - 7, isz, isz);
        text(c, label, cx, ly + isz / 2 + 2, { px: 12, col: ok ? P.leaf : P.ink, max: lw - 2 });
        if (ok) { c.strokeStyle = P.leaf; c.lineWidth = 2.2; c.beginPath(); c.moveTo(cx + isz / 2 - 6, ly - 4); c.lineTo(cx + isz / 2 - 2, ly); c.lineTo(cx + isz / 2 + 5, ly - 9); c.stroke(); }
      } else {
        const isz = Math.min(34, h * 0.32);
        c.drawImage(ART.icon(l.g, 64), lx, ly - isz / 2, isz, isz);
        text(c, label, lx + isz + 2, ly + 1, { al: 'left', px: 13, col: ok ? P.leaf : P.ink, max: lw - isz - 4 });
        if (ok) { c.strokeStyle = P.leaf; c.lineWidth = 2.2; c.beginPath(); c.moveTo(lx + 1, ly + isz / 2 - 4); c.lineTo(lx + 5, ly + isz / 2); c.lineTo(lx + 12, ly + isz / 2 - 9); c.stroke(); }
      }
    });
    // reward + deliver
    const rush = o.rush && t < o.rush, coins = Math.round(o.coins * (rush ? 1.5 : 1));
    coinGlyph(c, 15, h - 17, 6); text(c, String(coins), 25, h - 16.5, { al: 'left', px: 13 });
    c.font = FONT(700, 13); const cwid = c.measureText(String(coins)).width;
    text(c, '+' + o.xp + ' xp', 31 + cwid, h - 16.5, { al: 'left', px: 11.5, w: 500, col: 'rgba(43,36,32,.62)' });
    const bw = Math.min(64, w * 0.4), bh = 28, bx = w - bw - 6, byy = h - bh - 5;
    rr(c, bx, byy, bw, bh, 14); c.fillStyle = met ? P.leaf : 'rgba(43,36,32,.08)'; c.fill();
    if (!met) { c.strokeStyle = 'rgba(43,36,32,.2)'; c.lineWidth = 1.5; c.stroke(); }
    text(c, 'Deliver', bx + bw / 2, byy + bh / 2 + 0.5, { px: 12, col: met ? P.cream : 'rgba(43,36,32,.45)' });
    // bin
    const arm = G.trashArm && G.trashArm.k === k && performance.now() - G.trashArm.at < 2500;
    c.save(); c.translate(w - 14, 13); c.strokeStyle = arm ? P.red : 'rgba(43,36,32,.4)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5, -4); c.lineTo(5, -4); c.moveTo(-2, -6); c.lineTo(2, -6); c.rect(-4, -3, 8, 9); c.stroke(); c.restore();
    if (arm) text(c, 'Bin?', w - 32, 13, { px: 11, col: P.red });
    // rush stamp + bar
    if (rush) {
      const k2 = (o.rush - t) / (5 * M);
      c.save(); c.translate(w - 40, 38); c.rotate(-0.12); rr(c, -30, -10, 60, 20, 4); c.fillStyle = 'rgba(255,252,242,.92)'; c.fill(); c.strokeStyle = P.plum; c.lineWidth = 2; c.stroke(); text(c, 'RUSH ' + IA.fmtTime(o.rush - t), 0, 1, { px: 10.5, col: P.plum, w: 900 }); c.restore();
      rr(c, 6, h - 5, w - 12, 4, 2); c.fillStyle = 'rgba(107,63,105,.18)'; c.fill(); rr(c, 6, h - 5, Math.max(4, (w - 12) * k2), 4, 2); c.fillStyle = P.plum; c.fill();
    }
    if (o.golden) { c.save(); c.translate(w * 0.64, 30); c.rotate(-0.16); text(c, '3×', 0, 0, { px: 16, col: '#B07A12', w: 900, d: true }); c.restore(); }
    c.restore();
    if (k === 0 || !G.L.deliver0 && met) G.L.deliver0 = { x: x + bx - 6, y: y + byy - 6, w: bw + 12, h: bh + 12 };
    // hits: later entries are on top, so the body goes first
    hit(x, y, w, h, () => { if (s.tut < 3) return; s.pin = pinned ? null : o.id; SND.play('tap'); updateStrip(); bumpEl('strip', 'slide'); toast(pinned ? (D.NOTEBOOK[s.notebook] ? 'Unpinned: Notebook is back on top' : 'Unpinned') : 'Pinned to the top strip', 'pin'); });
    hit(x + bx - 6, y + byy - 8, bw + 12, bh + 14, () => deliverOrder(k));
    hit(x + w - 44, y - 6, 50, 44, () => {
      if (G.trashArm && G.trashArm.k === k && performance.now() - G.trashArm.at < 2500) { G.trashArm = null; IA.trashOrder(s, k, now()); SND.play('page'); save(); }
      else { G.trashArm = { k, at: performance.now() }; SND.play('tap'); }
    });
  }
  function paperBag(c, x, y, sz) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-sz * 0.4, -sz * 0.3); c.lineTo(sz * 0.4, -sz * 0.3); c.lineTo(sz * 0.46, sz * 0.5); c.lineTo(-sz * 0.46, sz * 0.5); c.closePath();
    c.fillStyle = '#C9A06E'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.6)'; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.moveTo(-sz * 0.4, -sz * 0.3); for (let i = 0; i <= 6; i++) c.lineTo(-sz * 0.4 + i * sz * 0.8 / 6, -sz * 0.3 - (i % 2 ? 4 : 0)); c.stroke();
    c.fillStyle = P.red; c.fillRect(-sz * 0.2, sz * 0.02, sz * 0.4, sz * 0.18);
    c.restore();
  }
  function deliverOrder(k) {
    const s = G.s, sl = s.orders[k]; if (!sl || !sl.o) return;
    if (!IA.orderMet(s, sl.o)) {
      const miss = sl.o.lines.find(l => IA.have(s, l.g) < l.n);
      SND.play('error'); toast('Need ' + (miss.n - IA.have(s, miss.g)) + ' more ' + D.GOODS[miss.g].name.toLowerCase());
      return;
    }
    const r = G.L.tickets[k];
    const res = IA.deliver(s, k, now());
    if (!res.ok) return;
    G.anims.push({ kind: 'fold', x: r.x, y: r.y, w: r.w, h: r.h, t0: performance.now() / 1000 });
    const p = toApp(r.x + r.w / 2, r.y + r.h / 2);
    SND.play(res.rush ? 'rush' : 'deliver'); vib(20);
    flyCoins(p, res.coins, 8);
    floater('+' + res.coins, p.x, p.y - 10, { col: '#A3741A', size: 26 });
    bumpEl('hLevel', 'shine');
    save();
  }
  function drawFerry(c, t, T, h) {
    const s = G.s, L = G.L, f = s.ferry;
    const tone = G.tone || ART.skyTone(12);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, tone.far); g.addColorStop(1, tone.lake); c.fillStyle = g; c.fillRect(0, 0, G.W, h);
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.5; for (let i = 0; i < 10; i++) { const y = 10 + i * (h - 14) / 10, x = ((i * 67) + T * 8 * (i % 2 ? 1 : -1)) % (G.W + 60) - 30; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 26, y); c.stroke(); }
    // dock
    if (s.level >= 7) { c.fillStyle = '#8A5A3B'; c.fillRect(0, h - 22, G.W * 0.3, 10); for (let x = 6; x < G.W * 0.3; x += 22) c.fillRect(x, h - 14, 5, 14); }
    G.L.crates = [];
    if (s.level < 7) {
      boat(c, G.W * 0.78, h * 0.5, 0.32);
      text(c, 'Ferry docks at Level 7', 14, h / 2 + 1, { al: 'left', px: 13, col: P.cream, halo: 4, haloCol: 'rgba(31,85,96,.6)' });
      return;
    }
    if (!f || !f.here) {
      // boat far out on the lake
      boat(c, G.W * 0.8 + Math.sin(T * 0.3) * 8, h * 0.52, 0.32);
      text(c, f ? 'Ferry back in ' + IA.fmtTime(f.backAt - t) : '', 14, h / 2 + 1, { al: 'left', px: 13, col: P.cream, halo: 4, haloCol: 'rgba(31,85,96,.6)' });
      return;
    }
    const lf = G.ferryLeave && T - G.ferryLeave < 2 ? (T - G.ferryLeave) / 2 : 0;
    const bx = G.W * 0.5 + ease(lf) * G.W * 0.8, by = h * 0.66 + Math.sin(T * 1.3) * 1.5;
    boat(c, bx, by, 1);
    const cw = Math.min(70, G.W * 0.18), chh = Math.min(h * 0.66 - 32, 66);
    f.crates.forEach((cr, k) => {
      const x = bx - cw * 1.5 - 8 + k * (cw + 8), y = by - chh - 6;
      rr(c, x, y, cw, chh, 6); c.fillStyle = cr.done ? '#A8C77A' : '#D9A86A'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.55)'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = 'rgba(43,36,32,.2)'; c.beginPath(); c.moveTo(x + 4, y + chh * 0.33); c.lineTo(x + cw - 4, y + chh * 0.33); c.moveTo(x + 4, y + chh * 0.66); c.lineTo(x + cw - 4, y + chh * 0.66); c.stroke();
      const isz = Math.min(cw - 18, chh - 24); c.drawImage(ART.icon(cr.g, 64), x + cw / 2 - isz / 2, y + 3, isz, isz);
      const hv = IA.have(s, cr.g), ok = hv >= cr.n;
      if (cr.done) { c.strokeStyle = P.cream; c.lineWidth = 4; c.beginPath(); c.moveTo(x + cw * 0.3, y + chh * 0.55); c.lineTo(x + cw * 0.45, y + chh * 0.72); c.lineTo(x + cw * 0.72, y + chh * 0.36); c.stroke(); }
      else text(c, (ok ? '' : Math.min(hv, cr.n) + '/') + cr.n, x + cw / 2, y + chh - 10, { px: 12.5, col: ok ? P.cream : P.ink, halo: ok ? 3 : 0, haloCol: P.leaf });
      if (ok && !cr.done) { rr(c, x - 2, y - 2, cw + 4, chh + 4, 8); c.strokeStyle = P.gold; c.lineWidth = 2.5; c.stroke(); }
      G.L.crates[k] = { x, y, w: cw, h: chh };
      hit(x - 4, y - 4, cw + 8, chh + 8, () => fillCrate(k));
    });
    text(c, 'Full load: +50% · ' + (IA.projDone(s, 'lantern') ? 2 : 1) + ' heart' + (IA.projDone(s, 'lantern') ? 's' : ''), G.W - 10, h - 11, { al: 'right', px: 12, col: P.cream, halo: 3, haloCol: 'rgba(31,85,96,.7)' });
    // send it off (small)
    const sw = 66, sx = G.W - sw - 8, sy = 4;
    rr(c, sx, sy, sw, 24, 12); c.fillStyle = 'rgba(251,244,228,.75)'; c.fill(); text(c, 'Send off', sx + sw / 2, sy + 12.5, { px: 11 });
    hit(sx - 4, sy - 4, sw + 8, 34, () => openSheet('sendFerry'));
  }
  function boat(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(255,255,255,.25)'; ART.ell(c, 0, 12, 110, 6); c.fill();
    c.beginPath(); c.moveTo(-108, -4); c.lineTo(108, -4); c.lineTo(92, 12); c.lineTo(-96, 12); c.closePath(); c.fillStyle = P.cream; c.fill(); c.strokeStyle = 'rgba(43,36,32,.6)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = P.red; c.fillRect(-100, 4, 196, 4);
    c.fillStyle = '#F3E9D2'; rr(c, 50, -30, 46, 26, 4); c.fill(); c.stroke();
    c.fillStyle = P.lake; for (let i = 0; i < 3; i++) c.fillRect(56 + i * 13, -24, 8, 8);
    c.fillStyle = P.ink; c.fillRect(70, -42, 8, 12);
    c.restore();
  }
  function fillCrate(k) {
    const s = G.s, f = s.ferry, cr = f && f.crates[k]; if (!cr || cr.done) return;
    if (IA.have(s, cr.g) < cr.n) { SND.play('error'); toast('Need ' + (cr.n - IA.have(s, cr.g)) + ' more ' + D.GOODS[cr.g].name.toLowerCase()); return; }
    const R = G.L.crates[k], p = toApp(R.x + R.w / 2, R.y + R.h / 2);
    const res = IA.fillCrate(s, k, now());
    if (!res.ok) return;
    SND.play('collect'); vib(15); hintDone('crate');
    flyCoins(p, res.coins, 6);
    if (res.full) {
      G.ferryLeave = performance.now() / 1000;
      setTimeout(() => { SND.play('horn'); shake(3); flyCoins({ x: G.L.appW / 2, y: p.y }, res.bonus, 12); floater('+' + res.bonus + ' bonus', G.L.appW / 2, p.y + 20, { col: '#A3741A', size: 24 }); heartBurst(p, res.hearts); }, 200);
    }
    save();
  }
  function heartBurst(p, n) { const to = elCenter('hHearts'); for (let i = 0; i < n; i++) fly(heartImg(), p, to, { delay: i * 0.12, dur: 0.7, size: 30, arc: 90, done: () => { bumpEl('hHearts'); SND.play('coin', 8); } }); }
  let _heart = null;
  function heartImg() { if (_heart) return _heart; const cv = ART.mk(64, 64), x = cv.getContext('2d'); heartGlyph(x, 32, 32, 26); return _heart = cv; }
  function shake(px) { const el = $('app'); el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${px}px,${-px}px)` }, { transform: `translate(${-px}px,${px}px)` }, { transform: 'translate(0,0)' }], { duration: 260 }); }

  function marketButton(c, x, y, w, h, kind, t, T) {
    const s = G.s;
    let title, sub, lock = 0, glow = false, icon;
    if (kind === 'csa') { title = 'CSA box'; lock = s.level < 4 ? 4 : 0; if (!lock) { const n = s.csa.slots.filter(x => x.done).length; sub = s.csa.done ? 'Done today' : n + '/4 today'; glow = !s.csa.done && s.csa.slots.some(x => !x.done && IA.have(s, x.g) >= x.n); } }
    if (kind === 'md') { title = 'Market Day'; lock = s.level < 5 ? 5 : 0; if (!lock) { const ok = IA.mdCanOpen(s, t); sub = ok.ok ? 'Open now' : ok.err === 'cool' ? IA.fmtTime(ok.left) : 'Stock up: 12'; glow = ok.ok; } }
    if (kind === 'town') { title = 'Town'; lock = s.level < 4 ? 4 : 0; if (!lock) { const done = s.projects.filter(p => p.done).length; sub = done + '/7 built'; const k = s.projects.findIndex(p => !p.done); glow = k >= 0 && IA.projVisible(s, k) && (k === 0 || s.projects[k - 1].done) && IA.projNeeds(s, k).some(n => n.got < n.need && (n.what === 'hearts' ? s.hearts > 0 : n.what === 'coins' || n.what === 'feast' ? false : IA.have(s, n.what) > 0)); } }
    const nextLock = Math.min(...[4, 5, 4].filter(l => l > s.level).concat([99]));
    if (lock && lock > nextLock) { rr(c, x, y, w, h, 18); c.fillStyle = 'rgba(232,215,180,.45)'; c.fill(); c.setLineDash([5, 5]); c.strokeStyle = 'rgba(43,36,32,.18)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); text(c, title, x + w / 2, y + h / 2 - 8, { px: 12, w: 500, col: 'rgba(43,36,32,.38)' }); text(c, 'Level ' + lock, x + w / 2, y + h / 2 + 10, { px: 12, col: 'rgba(43,36,32,.38)' }); hit(x, y, w, h, () => { toast(title + ' at Level ' + lock); SND.play('error'); }); return; }
    card(c, x, y, w, h, 18, lock ? 'rgba(232,215,180,.9)' : glow ? '#FFF1C9' : '#FFF9EB');
    if (glow) { rr(c, x, y, w, h, 18); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
    const isz = Math.min(h * 0.44, 42), ix = x + w / 2, iy = y + 8 + isz / 2;
    c.globalAlpha = lock ? 0.4 : 1;
    if (kind === 'csa') csaIcon(c, ix, iy, isz);
    if (kind === 'md') bellIcon(c, ix, iy, isz, glow ? Math.sin(T * 8) * 0.15 : 0);
    if (kind === 'town') townIcon(c, ix, iy, isz);
    c.globalAlpha = 1;
    text(c, title, ix, y + h - 30, { px: 13 });
    text(c, lock ? 'Level ' + lock : sub, ix, y + h - 13, { px: 11.5, w: 500, col: lock ? P.plum : 'rgba(43,36,32,.7)' });
    if (kind === 'csa' && !lock && s.csa.streak) { const st = IA.csaStreakNow(s, t); if (st) { flame(c, x + w - 26, y + 15, 7); text(c, String(st), x + w - 12, y + 15.5, { px: 12 }); } }
    if (kind === 'town' && !lock) { const k = s.projects.findIndex(p => !p.done); if (k >= 0 && IA.projVisible(s, k)) { const nd = IA.projNeeds(s, k), f = nd.reduce((a, n) => a + Math.min(1, n.got / n.need), 0) / nd.length; rr(c, x + 14, y + h - 7, w - 28, 4, 2); c.fillStyle = 'rgba(43,36,32,.12)'; c.fill(); rr(c, x + 14, y + h - 7, Math.max(4, (w - 28) * f), 4, 2); c.fillStyle = P.gold; c.fill(); } }
    if (G.pulse === kind && Math.sin(T * 6) > 0) { rr(c, x - 3, y - 3, w + 6, h + 6, 20); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
    hit(x, y, w, h, () => {
      if (lock) { toast((kind === 'md' ? 'Market Day' : kind === 'csa' ? 'CSA box' : 'Town projects') + ' at Level ' + lock); SND.play('error'); return; }
      if (G.pulse === kind) G.pulse = null;
      openSheet(kind === 'md' ? 'mdSetup' : kind);
    });
  }
  function flame(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r); c.quadraticCurveTo(x - r, y + r * 0.2, x - r * 0.2, y - r); c.quadraticCurveTo(x + r * 0.1, y - r * 0.3, x + r * 0.4, y - r * 0.5); c.quadraticCurveTo(x + r, y + r * 0.3, x, y + r); c.fillStyle = '#E07A2E'; c.fill(); c.beginPath(); c.arc(x, y + r * 0.4, r * 0.4, 0, 7); c.fillStyle = P.gold; c.fill(); }
  function csaIcon(c, x, y, s) { c.save(); c.translate(x, y); rr(c, -s * 0.5, -s * 0.1, s, s * 0.55, 4); c.fillStyle = '#C9894A'; c.fill(); c.strokeStyle = 'rgba(43,36,32,.6)'; c.lineWidth = 1.5; c.stroke(); c.drawImage(ART.icon('carrot', 64), -s * 0.45, -s * 0.55, s * 0.5, s * 0.5); c.drawImage(ART.icon('tomato', 64), -s * 0.05, -s * 0.45, s * 0.45, s * 0.45); c.fillStyle = P.red; c.fillRect(-s * 0.5, s * 0.12, s, s * 0.08); c.restore(); }
  function bellIcon(c, x, y, s, rot) { c.save(); c.translate(x, y - s * 0.2); c.rotate(rot); c.beginPath(); c.moveTo(-s * 0.36, s * 0.4); c.quadraticCurveTo(-s * 0.34, -s * 0.3, 0, -s * 0.32); c.quadraticCurveTo(s * 0.34, -s * 0.3, s * 0.36, s * 0.4); c.closePath(); c.fillStyle = P.gold; c.fill(); c.strokeStyle = 'rgba(43,36,32,.6)'; c.lineWidth = 1.5; c.stroke(); c.beginPath(); c.arc(0, s * 0.46, s * 0.08, 0, 7); c.fillStyle = P.soilD; c.fill(); c.fillStyle = P.soilD; c.fillRect(-2, -s * 0.42, 4, s * 0.12); c.restore(); }
  function townIcon(c, x, y, s) { c.save(); c.translate(x, y); c.fillStyle = '#D8B98E'; c.fillRect(-s * 0.4, -s * 0.05, s * 0.8, s * 0.45); c.strokeStyle = 'rgba(43,36,32,.6)'; c.lineWidth = 1.5; c.strokeRect(-s * 0.4, -s * 0.05, s * 0.8, s * 0.45); c.fillStyle = P.red; c.beginPath(); c.moveTo(-s * 0.5, -s * 0.05); c.lineTo(0, -s * 0.45); c.lineTo(s * 0.5, -s * 0.05); c.closePath(); c.fill(); c.stroke(); heartGlyph(c, 0, s * 0.17, s * 0.2); c.restore(); }

  // ------------------------------------------------------------------ input on the scene canvas
  function local(e) { const r = $('scene').getBoundingClientRect(), k = G.scale || 1; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; }
  function findHit(x, y) { for (let i = G.hits.length - 1; i >= 0; i--) { const h = G.hits[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h; } return null; }
  function onDown(e) {
    SND.unlock();
    if (G.ptr) return; // a second finger is ignored
    e.preventDefault();
    try { $('scene').setPointerCapture(e.pointerId); } catch (er) {}
    const p = local(e);
    const ptr = G.ptr = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: performance.now(), moved: 0, mode: 'btn', visited: new Set(), n: 0 };
    if (G.md) { ptr.mode = 'md'; MD.down(p.x, p.y); return; }
    if (G.place === 'field' && G.slideT >= 1) {
      const L = G.L;
      if (p.y >= L.trayY) {
        const chip = !G.edit && G.L.chipRects.find(r => p.x >= r.x - 3 && p.x < r.x + r.w + 3 && p.y <= r.y + r.h + 10);
        if (chip) { ptr.mode = 'chip'; ptr.chip = chip; return; }
        ptr.hit = findHit(p.x, p.y); return;
      }
      const ti = tileAt(p.x, p.y);
      if (ti >= 0) {
        ptr.mode = 'paint'; ptr.startTile = ti;
        const tl = G.s.tiles[ti];
        if (IA.isHelper(tl)) ptr.lp = setTimeout(() => { if (G.ptr === ptr && ptr.moved < 12) startLift(ti, ptr); }, 350);
        if (G.edit && G.helperSel) { ptr.mode = 'placeHelper'; G.helperHover = ti; return; }
        visitTile(ti, ptr, true);
        return;
      }
      const tk = treeAt(p.x, p.y);
      if (tk >= 0 && G.s.trees[tk].kind) { ptr.mode = 'paint'; visitTree(tk, ptr); return; }
    }
    ptr.hit = findHit(p.x, p.y);
  }
  function onMove(e) {
    const ptr = G.ptr; if (!ptr || e.pointerId !== ptr.id) return;
    e.preventDefault();
    const p = local(e), dx = p.x - ptr.x0, dy = p.y - ptr.y0;
    ptr.moved = Math.max(ptr.moved, Math.hypot(dx, dy));
    const px = ptr.x, py = ptr.y; ptr.x = p.x; ptr.y = p.y;
    if (ptr.mode === 'md') { MD.move(p.x, p.y); return; }
    if (ptr.mode === 'lift') { G.lift.x = p.x; G.lift.y = p.y; return; }
    if (ptr.mode === 'placeHelper') { G.helperHover = tileAt(p.x, p.y); return; }
    if (ptr.lp && ptr.moved > 12) { clearTimeout(ptr.lp); ptr.lp = null; }
    if (ptr.mode === 'chip') {
      if (p.y < G.L.trayY - 4 && !ptr.paged && ptr.chip.crop && !ptr.chip.locked) { ptr.mode = 'paint'; ptr.fromChip = true; pickChip(ptr.chip); }
      else if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && G.L.pages > 1 && !ptr.paged) { ptr.paged = true; G.page = (G.page + (dx < 0 ? 1 : G.L.pages - 1)) % G.L.pages; SND.play('page'); }
      return;
    }
    if (ptr.mode === 'paint') {
      // sample the segment so fast swipes never skip a tile
      const dist = Math.hypot(p.x - px, p.y - py), step = Math.max(4, G.L.tile / 4), n = Math.ceil(dist / step);
      for (let i = 1; i <= n; i++) {
        const sx = px + (p.x - px) * i / n, sy = py + (p.y - py) * i / n;
        const ti = tileAt(sx, sy); if (ti >= 0) visitTile(ti, ptr, false);
        else { const tk = treeAt(sx, sy); if (tk >= 0) visitTree(tk, ptr); }
      }
    }
  }
  function onUp(e, cancel) {
    const ptr = G.ptr; if (!ptr || (e && e.pointerId !== ptr.id)) return;
    if (ptr.lp) clearTimeout(ptr.lp);
    G.ptr = null;
    const p = e ? local(e) : { x: ptr.x, y: ptr.y };
    if (ptr.mode === 'md') { if (!cancel) MD.up(p.x, p.y); return; }
    if (ptr.mode === 'chip') {
      if (cancel || ptr.paged || ptr.moved > 30) return;
      const ch = ptr.chip;
      if (ch.page) { trayNextPage(); return; }
      if (ch.locked) { toast(D.GOODS[ch.crop].name + ' at Level ' + D.CROPS.find(c => c.id === ch.crop).lvl); SND.play('error'); return; }
      pickChip(ch); return;
    }
    if (ptr.mode === 'lift') { dropLift(cancel ? -1 : tileAt(p.x, p.y)); return; }
    if (ptr.mode === 'placeHelper') {
      const ti = tileAt(p.x, p.y); G.helperHover = null;
      if (cancel || ti < 0) return;
      const okSpot = G.s.tiles[ti].kind === 'sod' && IA.plusTiles(G.s).includes(ti);
      if (!okSpot) { SND.play('error'); toast('Helpers go on an empty tile', 'helperSpot'); G.helperAim = null; return; }
      if (G.helperAim !== ti) { G.helperAim = ti; SND.play('tap'); vib(5); return; }
      const r = IA.placeHelper(G.s, ti, G.helperSel, now());
      if (r.ok) { SND.play('bed'); vib(15); const q = tileCenterApp(ti); confetti(q.x, q.y, 14); G.helperSel = null; G.helperAim = null; save(); }
      else if (r.err === 'coins') noCoins(); else { SND.play('error'); toast('Helpers go on an empty tile', 'helperSpot'); }
      return;
    }
    if (ptr.mode === 'paint') {
      if (ptr.floater) { ptr.floater.hold = 0.5; }
      if (!cancel && ptr.moved < 12 && ptr.n === 0) tapTile(ptr.startTile, ptr);
      if (ptr.n || ptr.planted) save();
      return;
    }
    if (cancel || ptr.moved > 12) return;
    const h = ptr.hit; if (h && p.x >= h.x - 6 && p.x < h.x + h.w + 6 && p.y >= h.y - 6 && p.y < h.y + h.h + 6) h.tap();
  }
  function pickChip(ch) { if (G.sel !== ch.crop) { G.sel = ch.crop; SND.play('tap'); } if (G.pulse === 'seed:' + ch.crop) G.pulse = null; }
  function tapTile(i, ptr) {
    if (i == null || i < 0) return;
    const s = G.s, tl = s.tiles[i], t = now();
    if (tl.kind === 'sod') {
      const plus = IA.plusTiles(s);
      if ((G.edit && plus.includes(i)) || (!G.edit && i === IA.nextBedTile(s) && s.tut >= 99)) {
        const r = IA.buyBed(s, i, t);
        if (r.ok) { SND.play('bed'); vib(15); const q = tileCenterApp(i); specks(q.x, q.y, 10); confetti(q.x, q.y, 8); save(); }
        else if (r.err === 'coins') noCoins();
      } else if (!G.edit && plus.length && s.tut >= 99) { G.pulse = 'edit'; toast('Tap Build to add beds'); }
      return;
    }
    if (tl.kind === 'bed' && tl.crop && t < tl.readyAt) { G.bubble = { i, at: performance.now() }; SND.play('tap'); }
    if (tl.kind === 'hive' && t < tl.honeyAt) { G.bubble = { i, at: performance.now() }; }
    if (tl.kind === 'bed' && !tl.crop && ptr && ptr.plantFail) { /* error already shown */ }
  }
  function visitTile(i, ptr, first) {
    if (ptr.visited.has(i)) return; ptr.visited.add(i);
    const s = G.s, t = now(), tl = s.tiles[i];
    const st = IA.bedState(s, i, t);
    if (st === 'ripe') {
      const r = IA.harvest(s, i, t);
      if (!r.ok) { if (r.err === 'full' && !ptr.fullShown) { ptr.fullShown = true; cellarFull(); } return; }
      ptr.n += r.n;
      G.anim = G.anim || {}; G.anim['p' + i] = performance.now() / 1000;
      const q = tileCenterApp(i);
      specks(q.x, q.y + 6, 5); flyGoods(r.good, q, r.n);
      SND.play('harvest', ptr.harvests = (ptr.harvests || 0) + 1); vib(8);
      if (!ptr.floater) ptr.floater = floater('+' + ptr.n, q.x, q.y - G.L.tile * 0.5, { hold: 999, col: P.ink, size: 24 });
      else { ptr.floater.text = '+' + ptr.n; ptr.floater.pop = performance.now(); }
      return;
    }
    if (tl.kind === 'hive' && IA.honeyReady(s, i, t)) {
      const r = IA.collectHoney(s, i, t);
      if (r.ok) { const q = tileCenterApp(i); flyGoods('honey', q, 1); SND.play('collect'); vib(8); ptr.n += 1; if (!ptr.floater) ptr.floater = floater('+1', q.x, q.y - 30, { hold: 999 }); else { ptr.floater.text = '+' + ptr.n; ptr.floater.pop = performance.now(); } }
      else if (r.err === 'full') cellarFull();
      return;
    }
    if (st === 'empty' && G.sel && !G.edit && !(first && G.s.tut < 4 && G.s.tut !== 99 && false)) {
      const r = IA.plant(s, i, G.sel, t);
      if (r.ok) { ptr.planted = (ptr.planted || 0) + 1; G.anim = G.anim || {}; G.anim[i] = performance.now() / 1000; const q = tileCenterApp(i); specks(q.x, q.y, 3, '#C9A06E'); SND.play('plant', ptr.planted); vib(5); }
      else if (r.err === 'coins' && !ptr.coinErr) {
        ptr.coinErr = true;
        // out of coins: radish seeds are free, so point there instead of a dead end
        if (IA.seedCost(s, 'radish') === 0) { G.sel = 'radish'; G.page = trayPageOf('radish'); G.pulse = 'seed:radish'; SND.play('error'); toast('Out of coins: radish seeds are free', 'freeRadish', 2500); }
        else noCoins();
      }
    }
  }
  function visitTree(k, ptr) {
    const key = 't' + k; if (ptr.visited.has(key)) return; ptr.visited.add(key);
    const s = G.s, tr = s.trees[k]; if (!tr.kind) return;
    if (now() < tr.readyAt) { if (ptr.moved < 12) { toast(D.TREES[tr.kind].name + ': ' + IA.fmtTime(tr.readyAt - now())); } return; }
    const r = IA.pickTree(s, k, now());
    if (!r.ok) { if (r.err === 'full') cellarFull(); return; }
    G.anim = G.anim || {}; G.anim['t' + k] = performance.now() / 1000;
    const R = treeRect(k), q = toApp(R.x + R.w / 2, R.y + R.h * 0.4);
    flyGoods(r.good, q, r.n); SND.play('harvest', 3); vib(8);
    for (let i = 0; i < 5; i++) particle(q.x, q.y, { vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 80, size: 3, col: P.leaf, max: 0.6 });
    ptr.n += r.n;
    if (!ptr.floater) ptr.floater = floater('+' + ptr.n, q.x, q.y - 20, { hold: 999 }); else { ptr.floater.text = '+' + ptr.n; ptr.floater.pop = performance.now(); }
  }
  function startLift(i, ptr) { ptr.mode = 'lift'; G.lift = { from: i, x: ptr.x, y: ptr.y }; vib(15); SND.play('tap'); hintDone('lift'); }
  function dropLift(to) {
    const from = G.lift.from; G.lift = null;
    if (to < 0 || to === from) return;
    const r = IA.moveHelper(G.s, from, to, now());
    if (r.ok) { SND.play('bed'); vib(12); const q = tileCenterApp(to); specks(q.x, q.y, 8); save(); }
    else { SND.play('error'); toast(G.s.tiles[to].kind === 'bed' ? 'That bed is growing' : 'Not there'); }
  }

  // ------------------------------------------------------------------ HUD, strip, nav badges
  const hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function updateHUD() {
    const s = G.s;
    setText('coinN', IA.fmtNum(Math.max(0, s.coins - G.pendCoins)));
    setText('heartN', String(s.hearts));
    setText('lvlN', String(s.level));
    const cnt = IA.cellarCount(s) - G.pendGoods;
    setText('cellarN', cnt + '/' + s.cellar.cap);
    $('hCellar').classList.toggle('full', cnt >= s.cellar.cap);
    const need = IA.xpNeed(s.level), pct = s.level >= D.MAX_LEVEL ? 100 : Math.round(100 * s.xp / need);
    if (hudCache.xp !== pct) { hudCache.xp = pct; $('xpFill').style.width = pct + '%'; }
    // nav badges
    const t = now();
    const fieldN = s.tiles.filter((x, i) => IA.bedState(s, i, t) === 'ripe' || IA.honeyReady(s, i, t)).length + s.trees.filter(x => x.kind && t >= x.readyAt).length;
    let barnN = 0; for (const id in s.shops) barnN += s.shops[id].shelf.length; ['hens', 'cows'].forEach(k => { barnN += IA.penInfo(s, k, t).ready; });
    const mkt = s.orders.some(sl => sl.o && IA.orderMet(s, sl.o)) || (s.ferry && s.ferry.here && s.ferry.crates.some(c => !c.done && IA.have(s, c.g) >= c.n)) || (s.level >= 4 && !s.csa.done && s.csa.slots.some(c => !c.done && IA.have(s, c.g) >= c.n));
    badge('field', fieldN ? String(fieldN) : ''); badge('barn', barnN ? String(barnN) : ''); badge('market', mkt ? '!' : '');
    updateStrip();
  }
  function badge(place, v) { const k = 'b' + place; if (hudCache[k] === v) return; hudCache[k] = v; const em = document.querySelector('#nav button[data-place="' + place + '"] em'); em.textContent = v; em.classList.toggle('show', !!v); }
  function chipHTML(g, need, have) { const ok = have >= need; return `<span class="chip${ok ? ' ok' : ''}"><img src="${ART.iconSrc(g)}" alt="">${ok ? '✓' : Math.min(have, need) + '/' + need}</span>`; }
  function stripOrder() {
    const s = G.s; let best = null;
    if (s.pin) { const sl = s.orders.find(x => x.o && x.o.id === s.pin); if (sl) return sl.o; s.pin = null; }
    s.orders.forEach(sl => { if (!sl.o) return; const met = IA.orderMet(s, sl.o); const score = (met ? 1e6 : 0) + sl.o.lines.reduce((a, l) => a + Math.min(1, IA.have(s, l.g) / l.n), 0) * 1000 + sl.o.coins / 100; if (!best || score > best.score) best = { o: sl.o, score }; });
    return best && best.o;
  }
  function pinnedOrder() { const s = G.s; if (!s.pin || s.tut < 3) return null; const sl = s.orders.find(x => x.o && x.o.id === s.pin); return sl ? sl.o : null; }
  function updateStrip() {
    const s = G.s, el = $('strip'); let html = '', key = '';
    if (G.md) return;
    const nb = D.NOTEBOOK[s.notebook], pin = pinnedOrder();
    if (pin) {
      const o = pin, met = IA.orderMet(s, o); key = 'o' + o.id + o.lines.map(l => Math.min(l.n, IA.have(s, l.g))).join(',') + met + 'p';
      html = `<span class="tag">Pinned</span><span class="txt">${o.sender}</span><span class="chips">${o.lines.map(l => chipHTML(l.g, l.n, IA.have(s, l.g))).join('')}</span><span class="go${met ? ' ready' : ''}">›</span>`;
    } else if (nb && !(nb.id === 'order1' && s.tut < 3) && s.tut >= 1) {
      const pr = IA.nbProgress(s);
      const nbText = nb.id === 'hen' && s.level >= D.ANIMALS.hens.lvl ? 'Buy a hen' : nb.text;
      key = 'nb' + s.notebook + (pr ? pr[0] : '') + nbText;
      html = `<span class="tag">Notebook</span><span class="txt">${nbText}${pr ? ' · ' + pr[0] + '/' + pr[1] : ''}</span><span class="gift"><i class="i-coin"></i>${nb.gift}</span><span class="go">›</span>`;
      if (nb.id === 'order1') { const o = s.orders[0] && s.orders[0].o; if (o) { const met = IA.orderMet(s, o); key += met; html = `<span class="tag">Order</span><span class="txt">${o.sender}</span><span class="chips">${o.lines.map(l => chipHTML(l.g, l.n, IA.have(s, l.g))).join('')}</span><span class="go${met ? ' ready' : ''}">›</span>`; } }
    } else if (s.tut < 1) {
      key = 'tut0'; html = `<span class="tag">Notebook</span><span class="txt">Pick the ripe radishes</span><span class="go">›</span>`;
    } else {
      const o = stripOrder();
      if (o) { const met = IA.orderMet(s, o); key = 'o' + o.id + o.lines.map(l => Math.min(l.n, IA.have(s, l.g))).join(',') + met + (s.pin === o.id); html = `<span class="tag">${s.pin === o.id ? 'Pinned' : 'Order'}</span><span class="txt">${o.sender}</span><span class="chips">${o.lines.map(l => chipHTML(l.g, l.n, IA.have(s, l.g))).join('')}</span><span class="go${met ? ' ready' : ''}">›</span>`; }
      else { key = 'none'; html = `<span class="txt" style="opacity:.6">New orders on the way…</span>`; }
    }
    if (hudCache.strip !== key) {
      const wasOrder = (hudCache.strip || '').startsWith('o') || (hudCache.strip || '').startsWith('nb1');
      hudCache.strip = key; el.innerHTML = html;
      if (!wasOrder && (key.startsWith('o') || key.startsWith('nb1'))) { el.classList.remove('slide'); void el.offsetWidth; el.classList.add('slide'); }
    }
    el.classList.toggle('pulse', s.tut === 1);
  }
  function stripTap() {
    const s = G.s; SND.unlock(); SND.play('tap');
    if (G.md) return;
    const nb = D.NOTEBOOK[s.notebook];
    if (s.tut === 1 || (nb && nb.id === 'order1')) { setPlace('market'); return; }
    if (nb && s.tut >= 1 && !pinnedOrder()) { jumpNotebook(nb.id); return; }
    const o = stripOrder(); if (o) { setPlace('market'); const k = s.orders.findIndex(x => x.o && x.o.id === o.id); if (IA.orderMet(s, o)) G.pulseTicket = k; else { const miss = o.lines.find(l => IA.have(s, l.g) < l.n); if (miss) jumpTo(miss.g); } }
  }
  function jumpNotebook(id) {
    G.pulse = null; const s = G.s;
    switch (id) {
      case 'pick6': setPlace('field'); break;
      case 'plantWheat': setPlace('field'); G.sel = 'wheat'; G.pulse = 'seed:wheat'; G.page = trayPageOf('wheat'); break;
      case 'oven': setPlace('barn'); G.pulse = 'build:oven'; break;
      case 'bread2': setPlace('barn'); G.pulse = 'shop:oven'; break;
      case 'orders3': setPlace('market'); break;
      case 'beds2': setPlace('field'); G.edit = true; break;
      case 'hen': setPlace('barn'); G.pulse = 'pen:hens'; break;
      case 'egg': setPlace('barn'); G.pulse = 'pen:hens'; break;
      case 'cornbread': setPlace('barn'); G.pulse = 'shop:oven'; break;
      case 'csa': setPlace('market'); G.pulse = 'csa'; break;
      case 'tree': setPlace('field'); G.pulse = 'tree'; break;
      case 'sprinkler': setPlace('field'); G.edit = true; break;
      case 'market': setPlace('market'); G.pulse = 'md'; break;
      case 'awning': case 'oven2': setPlace('market'); G.pulse = 'town'; break;
      case 'cider': setPlace('barn'); G.pulse = s.shops.press.built ? 'shop:press' : 'build:press'; break;
      case 'cow': case 'butter': setPlace('barn'); G.pulse = id === 'cow' ? 'pen:cows' : s.shops.creamery.built ? 'shop:creamery' : 'build:creamery'; break;
      case 'crate': setPlace('market'); break;
      case 'hive': setPlace('field'); G.edit = true; break;
      case 'csaBox': setPlace('market'); G.pulse = 'csa'; break;
      case 'kitchen': setPlace('barn'); G.pulse = 'build:kitchen'; break;
      case 'maple': setPlace('field'); G.pulse = 'tree'; break;
      case 'creemee': setPlace('barn'); G.pulse = s.shops.creemee.built ? 'shop:creemee' : 'build:creemee'; break;
      default: setPlace('market');
    }
  }
  // go to whatever makes this good
  function jumpTo(g) {
    closeSheet(true);
    const s = G.s;
    if (IA.CROP[g]) { setPlace('field'); if (IA.CROP[g].lvl <= s.level) { G.sel = g; G.pulse = 'seed:' + g; G.page = trayPageOf(g); } return; }
    if (g === 'apple' || g === 'maple') { setPlace('field'); G.pulse = 'tree'; return; }
    if (g === 'egg') { setPlace('barn'); G.pulse = 'pen:hens'; return; }
    if (g === 'milk') { setPlace('barn'); G.pulse = 'pen:cows'; return; }
    if (g === 'honey') { setPlace('field'); return; }
    const R = IA.RECIPE[g]; if (R) { setPlace('barn'); G.pulse = 'shop:' + R.shop; if (s.shops[R.shop].built) setTimeout(() => openSheet('shop', R.shop), 240); }
  }

  // ------------------------------------------------------------------ sheets (DOM)
  const img = g => `<img src="${ART.iconSrc(g)}" alt="">`;
  const coinI = '<i class="i-coin"></i>';
  const heartI = '<svg class="i-heart" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.1 1.8-1.9 3.3-3.1 5.4-3.1C21 4.5 23.1 8 21.6 11.6 19.5 16.4 12 21 12 21z"/></svg>';
  function openSheet(kind, arg) {
    G.sheet = { kind, arg, sel: null }; G.sheetAt = performance.now();
    $('act').classList.add('hidden'); // the quick-action pill never sits on top of a sheet
    SND.play('page');
    $('sheetWrap').classList.remove('hidden', 'out');
    renderSheet(true);
  }
  function closeSheet(quick) {
    if (!G.sheet) return;
    const k = G.sheet.kind; G.sheet = null;
    if (G.hint && G.hint.sheetOk) setHint(null);
    const w = $('sheetWrap');
    if (quick) { w.classList.add('hidden'); return; }
    w.classList.add('out'); setTimeout(() => { if (!G.sheet) w.classList.add('hidden'); }, 180);
    if (k === 'welcome' || k === 'festival') save();
  }
  function head(title, sub) { return `<div class="sh-head"><h2>${title}${sub ? `<small>${sub}</small>` : ''}</h2><button class="sh-x" data-act="close" aria-label="Close">×</button></div>`; }
  function renderSheet(first) {
    const sh = G.sheet; if (!sh) return;
    const s = G.s, t = now(), el = $('sheet');
    const body = el.querySelector('.sh-body'), scroll = body ? body.scrollTop : 0;
    let html = '', short = false;
    switch (sh.kind) {
      case 'shop': {
        const W = IA.SHOP[sh.arg], w = s.shops[sh.arg]; short = true;
        const rows = IA.SHOP_RECIPES[sh.arg].map(R => {
          const lock = R.lvl > s.level;
          const can = !lock && IA.hasAll(s, R.inp) && w.queue.length < w.slots;
          const ins = Object.keys(R.inp).map(g => { const hv = IA.have(s, g), short2 = hv < R.inp[g]; return short2 ? `<button data-jump="${g}" class="need short">${img(g)}${hv}/${R.inp[g]}</button>` : `<span class="need">${img(g)}×${R.inp[g]} <small style="font-weight:500;opacity:.6">have ${hv}</small></span>`; }).join('');
          return `<div class="row${lock ? ' lock' : ''}">${img(R.id)}<div class="mid"><div class="nm">${D.GOODS[R.id].name} <span style="font-weight:500;color:rgba(43,36,32,.6);font-size:12px">· ${IA.fmtTime(IA.recipeTime(s, R.id))}</span></div><div class="sub">${lock ? 'Level ' + R.lvl : ins}</div></div>${lock ? '' : `<button class="btn${can ? ' green' : ' ghost off'}" data-make="${R.id}">Make</button>`}</div>`;
        }).join('');
        const slotsTxt = w.queue.length + ' of ' + w.slots + ' slots busy · all work at once';
        const up = IA.slotCost(s, sh.arg);
        const upBtn = isFinite(up) && (w.slots < 3 || s.level >= 13) ? `<button class="btn ghost" data-act="slot" style="width:100%;margin-top:4px">Add a slot · ${coinI}${IA.fmtNum(up)}</button>` : '';
        html = head(W.name, slotsTxt) + `<div class="sh-body">${rows}${upBtn}</div>`;
        break;
      }
      case 'cellar': {
        const items = Object.keys(s.cellar.items).filter(g => s.cellar.items[g] > 0).sort((a, b) => D.GOODS[a].v - D.GOODS[b].v);
        const cells = items.map(g => `<button class="cell${sh.sel === g ? ' sel' : ''}" data-pick="${g}">${img(g)}<b>${s.cellar.items[g]}</b></button>`).join('') || '<p class="note">Empty. Harvest something!</p>';
        let sell = '';
        if (sh.sel && IA.have(s, sh.sel)) { const g = sh.sel, n = IA.have(s, g); sell = `<div class="row">${img(g)}<div class="mid"><div class="nm">${D.GOODS[g].name}</div><div class="sub">Sell at half price, no XP</div></div><button class="btn ghost" data-sell="1">1 · ${Math.round(D.GOODS[g].v * 0.5)}</button><button class="btn" data-sell="${n}">All · ${IA.fmtNum(Math.round(D.GOODS[g].v * 0.5 * n))}</button></div>`; }
        const uc = IA.cellarUpCost(s);
        const up = isFinite(uc) ? `<button class="btn big${s.coins >= uc ? ' green' : ' off'}" data-act="cellarUp">Bigger cellar → ${D.CELLAR[s.cellar.lvl + 1][0]} · ${coinI}${IA.fmtNum(uc)}</button>` : '';
        let hand = '';
        if (s.level >= 10 && s.farmhand < 2) { const c2 = s.farmhand ? 15000 : 3000, lv = s.farmhand ? 14 : 10; hand = `<div class="row" style="margin-top:10px"><div class="mid"><div class="nm">${s.farmhand ? 'Farmhand: 6 rounds' : 'Hire a farmhand'}</div><div class="sub">While you are away, picks and replants your beds, tends the animals and shelves the goods (${s.farmhand ? 6 : 3} rounds)</div></div>${s.level >= lv ? `<button class="btn${s.coins >= c2 ? ' green' : ' off'}" data-act="hand">${coinI}${IA.fmtNum(c2)}</button>` : `<span class="note">Level ${lv}</span>`}</div>`; }
        const ex = IA.extras(s);
        const exBtn = ex.n ? `<button class="btn big gold" data-act="extras">Sell ${ex.n} extras · ${coinI}${IA.fmtNum(ex.coins)}</button><p class="note">Keeps what your tickets, ferry, CSA box, town project and workshops need, and 4 of everything.</p>` : '';
        html = head('Root cellar', IA.cellarCount(s) + ' of ' + s.cellar.cap + ' spaces used') + `<div class="sh-body">${exBtn}<div class="grid">${cells}</div>${sell}${up}${hand}</div>`;
        break;
      }
      case 'tree': {
        const k = sh.arg; short = true;
        const rows = ['apple', 'maple'].map(kind => { const T0 = D.TREES[kind], lock = s.level < T0.lvl; return `<div class="row${lock ? ' lock' : ''}">${img(T0.good)}<div class="mid"><div class="nm">${T0.name}</div><div class="sub">${lock ? 'Level ' + T0.lvl : T0.yield + ' ' + D.GOODS[T0.good].name.toLowerCase() + (T0.yield > 1 ? 's' : '') + ' every ' + IA.fmtTime(T0.every).replace(':00', ' min')}</div></div>${lock ? '' : `<button class="btn${s.coins >= T0.cost ? ' green' : ' off'}" data-tree="${kind}">${coinI}${T0.cost}</button>`}</div>`; }).join('');
        html = head('Plant a tree', 'Trees are for keeps. Swipe to pick.') + `<div class="sh-body">${rows}</div>`;
        break;
      }
      case 'csa': {
        IA.csaEnsure(s, t);
        const c = s.csa, st = IA.csaStreakNow(s, t);
        const value = c.slots.reduce((a, x) => a + x.n * D.GOODS[x.g].v, 0);
        const nextStreak = c.done ? st : (c.lastDay === IA.dayNum(t) - 1 || (c.lastDay === IA.dayNum(t) - 2 && st)) ? st + 1 : 1;
        const hearts = nextStreak >= 7 ? 3 : nextStreak >= 3 ? 2 : 1;
        const rows = c.slots.map((x, k) => { const hv = IA.have(s, x.g), ok = hv >= x.n; return `<div class="row">${img(x.g)}<div class="mid"><div class="nm">${D.GOODS[x.g].name}</div><div class="sub">${x.done ? 'Packed ✓' : `<span class="need${ok ? '' : ' short'}">${hv}/${x.n}</span>`}</div></div>${x.done ? '' : ok ? `<button class="btn green" data-csa="${k}">Pack</button>` : `<button class="btn ghost" data-jump="${x.g}">${getVerb(x.g)}</button>`}</div>`; }).join('');
        const rain = c.rain >= IA.dayNum(t) - 7 && c.rain > 0 ? ' · ☂ rain check used' : '';
        html = head('CSA box', (c.done ? 'Packed for today. New box tomorrow.' : 'Pack all 4 before midnight') + '') +
          `<div class="sh-body"><p class="note">Pays ${coinI.replace('i-coin', 'i-coin" style="width:14px;height:14px;display:inline-block;vertical-align:-2px')} ${IA.fmtNum(value * 3)} and ${hearts} ${hearts > 1 ? 'hearts' : 'heart'}. Streak: <b>${st} day${st === 1 ? '' : 's'}</b>${rain}. Day 3 pays 2 hearts, day 7 pays 3.</p>${rows}</div>`;
        break;
      }
      case 'town': {
        const cards = D.PROJECTS.map((Pj, k) => {
          const p = s.projects[k], vis = IA.projVisible(s, k), cur = vis && !p.done && (k === 0 || s.projects[k - 1].done);
          const needs = IA.projNeeds(s, k);
          const got = needs.reduce((a, n) => a + Math.min(1, n.got / n.need), 0) / needs.length;
          const gives = needs.map(n => {
            const full = n.got >= n.need;
            let ic = n.what === 'coins' ? coinI : n.what === 'hearts' ? heartI : n.what === 'feast' ? img('pie') : img(n.what);
            const lbl = n.what === 'coins' ? IA.fmtNum(n.got) + '/' + IA.fmtNum(n.need) : n.what === 'feast' ? n.got + '/' + n.need + ' dishes' : n.got + '/' + n.need;
            const canGive = cur && !full && (n.what === 'coins' ? s.coins > 0 : n.what === 'hearts' ? s.hearts > 0 : n.what === 'feast' ? IA.PRODUCTS.some(g => ((p.feast || {})[g] || 0) < 3 && IA.have(s, g) + ((p.feast || {})[g] || 0) >= 3) : IA.have(s, n.what) > 0);
            return `<button class="give${full ? ' full' : canGive ? ' can' : ''}" ${cur && !full ? `data-give="${k}:${n.what}"` : ''}>${ic}${lbl}</button>`;
          }).join('');
          const feastNote = Pj.feast ? '<p class="note">Feast: 3 each of 12 different kitchen goods.</p>' : '';
          return `<div class="proj${p.done ? ' done' : cur ? ' cur' : ''}${vis ? '' : ' lock'}"><h3>${Pj.name}</h3><div class="perk">${p.done ? 'Built ✓ · ' : ''}${Pj.perk}</div>${vis ? `<div class="needs">${gives}</div>${feastNote}<div class="pbar"><i style="width:${Math.round(got * 100)}%"></i></div>` : `<p class="note">Opens at Level ${Pj.lvl}</p>`}</div>`;
        }).join('');
        html = head('Town projects', 'Give goods, coins and hearts. Each one changes the town.') + `<div class="sh-body"><div class="trail">${cards}</div></div>`;
        break;
      }
      case 'mdSetup': {
        // goods promised to tickets, ferry crates, today's CSA box and the town project stay home unless you say so
        const incl = !!sh.incl, ok = IA.mdCanOpen(s, t, incl);
        sh.shelf = (sh.shelf || IA.mdShelf(s, incl)).filter(g => IA.mdAvail(s, g, incl) > 0);
        if (!sh.shelf.length) sh.shelf = IA.mdShelf(s, incl);
        const load = IA.mdLoad(s, sh.shelf, incl), total = load.reduce((a, x) => a + x.n, 0), cnt = {}; load.forEach(x => cnt[x.g] = x.n);
        const cells = [0, 1, 2, 3, 4, 5].map(i => { const g = sh.shelf[i]; return g ? `<button class="cell${sh.swap === i ? ' sel' : ''}" data-slot="${i}">${img(g)}<b>${cnt[g] || 0}</b></button>` : `<button class="cell" data-slot="${i}" style="opacity:.5"><b style="margin-top:22px">+</b></button>`; }).join('');
        let pick = '';
        if (sh.swap != null) { const others = Object.keys(s.cellar.items).filter(g => IA.mdAvail(s, g, incl) > 0 && !sh.shelf.includes(g)); pick = `<p class="note">Swap in:</p><div class="grid">${others.map(g => `<button class="cell" data-swapin="${g}">${img(g)}<b>${IA.mdAvail(s, g, incl)}</b></button>`).join('') || '<p class="note">Nothing else to sell.</p>'}</div>`; }
        const kept = IA.mdKept(s);
        const keptRow = kept ? `<div class="toggle keep">${incl ? 'Selling goods kept for orders' : 'Kept for orders: ' + kept}<button class="sw${incl ? ' on' : ''}" data-act="mdIncl" aria-label="Include goods kept for orders"></button></div>` : '';
        const btn = ok.ok && total >= 12 ? `<button class="btn big" data-act="mdGo">Open the stall · ${total} goods</button>` : ok.err === 'cool' ? `<button class="btn big off">Next market in ${IA.fmtTime(ok.left)}</button>` : `<button class="btn big off">Stock up: 12 spare goods</button>`;
        const dbl = IA.dayNum(t) > s.market.lastHeartDay ? ' · 2× hearts today' : '';
        html = head('Market Day', '60 seconds on Church Street' + dbl) + `<div class="sh-body"><p class="note">Tap what each customer wants. Don't let anyone walk away.</p><div class="shelfpick">${cells}</div>${pick}${keptRow}${btn}${s.market.best ? `<p class="note" style="text-align:center">Best take: ${IA.fmtNum(s.market.best)} · best streak ${s.market.bestStreak}</p>` : ''}</div>`;
        break;
      }
      case 'mdResult': {
        const r = sh.arg;
        html = `<div class="cardTop"><div class="k" style="font-weight:700;letter-spacing:.12em;color:var(--plum);font-size:12px">MARKET DAY</div><div class="big-num">${coinI.replace('i-coin', 'i-coin" style="width:30px;height:30px;display:inline-block;vertical-align:2px')} ${IA.fmtNum(r.take)}</div>${r.isBest ? '<span class="newbest">New best!</span>' : ''}${r.bonus ? `<p style="margin-top:6px">Sold out! +${IA.fmtNum(r.bonus)}</p>` : ''}</div>
          <div class="stats3"><div><b>${r.served}</b><span>served</span></div><div><b>${r.best}</b><span>best streak</span></div><div><b>${r.hearts}</b><span>${r.doubled ? 'hearts (2×)' : 'hearts'}</span></div></div>
          ${!r.isBest && s.market.best ? `<p class="note" style="text-align:center">Best take: ${IA.fmtNum(s.market.best)}</p>` : ''}<p class="note" style="text-align:center">${r.served < 6 ? 'Tip: tap the good shown in each bubble, before the ring runs out.' : r.raw === 0 ? 'Serve ' + IA.MDH.one + ' for a heart.' : r.raw === 1 ? 'A streak of ' + IA.MDH.streak + ' earns 2 hearts.' : r.raw === 2 ? (r.walked ? r.walked + ' walked away. ' : '') + 'Serve ' + IA.MDH.clean + '+ with nobody leaving for 3 hearts.' : 'A clean stall. Nobody walked away!'}</p>
          <button class="btn big green" data-act="close">Back to the farm</button>`;
        break;
      }
      case 'sendFerry': {
        short = true;
        html = head('Send the ferry off?', 'It comes back with a new load in ' + (IA.projDone(s, 'lantern') ? '1 hour' : '2 hours') + '. No bonus.') + `<div class="sh-body"><button class="btn big" data-act="ferryGo">Send it off</button><button class="btn big ghost" data-act="close">Keep it</button></div>`;
        break;
      }
      case 'level': {
        const L = s.level, nxt = IA.unlocksAt(L + 1);
        const need = IA.xpNeed(L);
        const list = nxt.map(u => unlockRow(u)).join('');
        const pk = s.projects.findIndex(p => !p.done);
        html = head('Level ' + L, L >= D.MAX_LEVEL ? 'Festival score: ' + IA.fmtNum(s.lifeXP) : s.xp + ' / ' + need + ' xp · fill orders to earn xp') + `<div class="sh-body">${L < D.MAX_LEVEL ? `<p class="note"><b>Level ${L + 1}</b> brings:</p>${list || '<p class="note">More orders and bigger tickets.</p>'}` : ''}${pk >= 0 ? `<p class="note" style="margin-top:12px">Next town project: <b>${D.PROJECTS[pk].name}</b>${IA.projVisible(s, pk) ? '' : ' (Level ' + D.PROJECTS[pk].lvl + ')'}</p>` : ''}</div>`;
        break;
      }
      case 'settings': {
        const st = s.settings;
        html = head('Settings') + `<div class="sh-body">
          <div class="toggle">Sound<button class="sw${st.sound ? ' on' : ''}" data-set="sound" aria-label="Sound"></button></div>
          <div class="toggle">Music<button class="sw${st.music ? ' on' : ''}" data-set="music" aria-label="Music"></button></div>
          <div class="toggle">Vibration<button class="sw${st.haptics ? ' on' : ''}" data-set="haptics" aria-label="Vibration"></button></div>
          <p class="note" style="margin-top:14px">Start over? Type <b>RESET</b> and tap the button. This wipes your farm.</p>
          <input class="confirm" id="resetIn" autocomplete="off" autocapitalize="characters" placeholder="RESET"><button class="btn big ghost" data-act="reset">Start a new farm</button>
          <p class="note" style="margin-top:14px">Intervale Acres: a farm-and-market game set on the Winooski floodplain. All groups, names and places on the tickets are made up. Code, art and sound are drawn by the game itself.</p>
        </div>`;
        break;
      }
      case 'welcome': {
        const r = sh.arg, rows = [];
        if (r.ripe) rows.push([r.ripeCrop || 'radish', r.ripe + ' bed' + (r.ripe > 1 ? 's' : '') + ' ripe']);
        const made = Object.keys(r.made); if (made.length) rows.push([made[0], Object.values(r.made).reduce((a, b) => a + b, 0) + ' goods finished']);
        const an = Object.keys(r.animals); if (an.length) rows.push([an[0], an.map(g => r.animals[g] + ' ' + (g === 'egg' ? 'eggs' : 'milk')).join(', ') + ' waiting']);
        if (r.handN) rows.push([Object.keys(r.hand)[0], 'Farmhand brought in ' + r.handN + ' goods']);
        if (r.trees) rows.push(['apple', r.trees + ' tree' + (r.trees > 1 ? 's' : '') + ' ready to pick']);
        if (r.ferry) rows.push([(G.s.ferry && G.s.ferry.crates[0] && G.s.ferry.crates[0].g) || 'apple', 'The ferry is back with a new load']);
        if (r.csa) rows.push(['carrot', 'A new CSA box']);
        const hrs = Math.floor(r.away / H), mins = Math.floor(r.away % H / M);
        const exw = IA.extras(s), full = IA.cellarFree(s) < Math.max(6, s.cellar.cap * 0.1);
        const exRow = full && exw.n ? `<button class="btn big gold" data-act="extras">Cellar full: sell ${exw.n} extras · ${coinI}${IA.fmtNum(exw.coins)}</button>` : '';
        const tb = todayBits(s, t);
        const todayRow = tb.length ? `<button class="row today" data-act="today"><div class="mid"><div class="k">Today</div>${tb.map(b => `<div class="nm${b.hot ? ' hot' : ''}">${b.txt}</div>`).join('')}</div><span class="go">›</span></button>` : '';
        html = `<div class="cardTop"><h2>Welcome back</h2><p>While you were away (${hrs ? hrs + ' h ' : ''}${mins} m)</p></div><div class="sh-body awayRows">${rows.slice(0, tb.length ? 4 : 5).map(([g, tx]) => `<div class="row">${img(g)}<div class="mid"><div class="nm">${tx}</div></div></div>`).join('') || '<p class="note">The farm is just as you left it.</p>'}${todayRow}</div>${exRow}<button class="btn big green" data-act="close">To the field</button>`;
        break;
      }
      case 'festival': {
        const st = s.stats;
        html = `<div class="cardTop"><div class="k" style="font-weight:700;letter-spacing:.12em;color:var(--plum);font-size:12px">HARVEST FESTIVAL</div><h2>Thanks to you</h2><p>The whole town came out to the Intervale.</p></div>
        <div class="stats3"><div><b>${IA.fmtNum(st.orders)}</b><span>orders filled</span></div><div><b>${IA.fmtNum(Object.values(st.harv).reduce((a, b) => a + b, 0))}</b><span>picked</span></div><div><b>${IA.fmtNum(st.coinsEarned)}</b><span>coins earned</span></div></div>
        <p class="note" style="text-align:center">Golden orders keep coming. Chase your Market Day best and your CSA streak.</p><button class="btn big green" data-act="close">Back to the farm</button>`;
        break;
      }
    }
    el.className = short ? 'short' : '';
    el.innerHTML = html;
    const nb = el.querySelector('.sh-body'); if (nb && !first) nb.scrollTop = scroll;
  }
  function getVerb(g) { const k = D.GOODS[g].kind; return k === 'crop' ? 'Grow' : k === 'tree' ? 'Pick' : k === 'animal' || k === 'hive' ? 'Collect' : 'Make'; }
  function unlockRow(u) {
    let g = null, name = '';
    if (u.t === 'crop') { g = u.id; name = D.GOODS[u.id].name; }
    else if (u.t === 'recipe') { g = u.id; name = D.GOODS[u.id].name; }
    else if (u.t === 'shop') { g = IA.SHOP_RECIPES[u.id][0].id; name = IA.SHOP[u.id].name; }
    else if (u.t === 'animal') { g = D.ANIMALS[u.id].makes; name = D.ANIMALS[u.id].one[0].toUpperCase() + D.ANIMALS[u.id].one.slice(1) + 's'; }
    else if (u.t === 'helper') { g = u.id === 'hive' ? 'honey' : null; name = D.HELPERS[u.id].name; }
    else if (u.t === 'tree') { g = D.TREES[u.id].good; name = D.TREES[u.id].name; }
    else if (u.t === 'project') { name = 'Project: ' + D.PROJECTS.find(p => p.id === u.id).name; }
    else name = { csa: 'Daily CSA box', market: 'Market Day', ferry: 'The ferry', farmhand: 'Farmhand', slot4: '4th tree slot', ticket: 'Another order slot' }[u.id] || u.id;
    return `<div class="row" style="min-height:52px">${g ? img(g) : '<span style="width:46px;text-align:center;font-size:24px">★</span>'}<div class="mid"><div class="nm">${name}</div></div></div>`;
  }
  function sheetClick(e) {
    if (performance.now() - (G.sheetAt || 0) < 400) return; // swallow the ghost click from the touch that opened the sheet
    const b = e.target.closest('[data-act],[data-make],[data-jump],[data-pick],[data-sell],[data-tree],[data-csa],[data-give],[data-slot],[data-swapin],[data-set]');
    if (!b) { if (e.target.id === 'sheetBg') closeSheet(); return; }
    const s = G.s, sh = G.sheet, t = now(); if (!sh) return;
    SND.unlock();
    if (b.dataset.make) { if (b._held) { b._held = false; return; } makeOne(b.dataset.make); return; }
    if (b.dataset.jump) { SND.play('tap'); jumpTo(b.dataset.jump); return; }
    if (b.dataset.pick) { sh.sel = sh.sel === b.dataset.pick ? null : b.dataset.pick; SND.play('tap'); renderSheet(); return; }
    if (b.dataset.sell) { const r = IA.sell(s, sh.sel, +b.dataset.sell); if (r.ok) { SND.play('coin', 4); const p = elCenter(b); flyCoins(p, r.coins, 4); save(); } renderSheet(); return; }
    if (b.dataset.tree) { const r = IA.buyTree(s, sh.arg, b.dataset.tree, t); if (r.ok) { SND.play('bed'); vib(15); closeSheet(); const R = treeRect(sh.arg), q = toApp(R.x + R.w / 2, R.y + R.h / 2); confetti(q.x, q.y, 16); if (G.pulse === 'tree') G.pulse = null; save(); } else if (r.err === 'coins') noCoins(); return; }
    if (b.dataset.csa != null) { const k = +b.dataset.csa; const r = IA.fillCsa(s, k, t); if (r.ok) { SND.play('collect'); vib(12); if (r.done) { SND.play('csa'); const p = elCenter(b); flyCoins(p, r.coins, 10); heartBurst(p, r.hearts); confetti(p.x, p.y, 30); } save(); } renderSheet(); return; }
    if (b.dataset.give) { const [k, what] = b.dataset.give.split(':'); const r = IA.donate(s, +k, what, t); if (r.ok) { SND.play('collect'); vib(10); save(); } else { SND.play('error'); toast(what === 'feast' ? 'Make 3 of a kitchen good first' : 'Nothing to give yet'); } renderSheet(); return; }
    if (b.dataset.slot != null) { sh.swap = sh.swap === +b.dataset.slot ? null : +b.dataset.slot; SND.play('tap'); renderSheet(); return; }
    if (b.dataset.swapin) { sh.shelf[sh.swap] = b.dataset.swapin; sh.shelf = sh.shelf.filter(Boolean); sh.swap = null; SND.play('tap'); renderSheet(); return; }
    if (b.dataset.set) { const k = b.dataset.set; s.settings[k] = !s.settings[k]; if (k === 'sound') SND.setSound(s.settings.sound); if (k === 'music') SND.setMusic(s.settings.music); if (k === 'haptics' && s.settings.haptics) vib(15); SND.play('tap'); save(); renderSheet(); return; }
    switch (b.dataset.act) {
      case 'close': closeSheet(); break;
      case 'today': closeSheet(); setPlace('market'); break;
      case 'slot': { const r = IA.upgradeShop(s, sh.arg); if (r.ok) { SND.play('bed'); save(); } else if (r.err === 'coins') noCoins(); renderSheet(); break; }
      case 'cellarUp': upgradeCellarNow(); renderSheet(); break;
      case 'hand': { const r = IA.hireFarmhand(s); if (r.ok) { SND.play('project'); save(); } else noCoins(); renderSheet(); break; }
      case 'ferryGo': IA.sendFerry(s, t); SND.play('horn'); closeSheet(); save(); break;
      case 'extras': sellExtrasNow(); break;
      case 'mdGo': { const shelf = sh.shelf, incl = !!sh.incl; closeSheet(true); MD.start(shelf, incl); break; }
      case 'mdIncl': { sh.incl = !sh.incl; sh.shelf = null; sh.swap = null; SND.play('tap'); renderSheet(); break; }
      case 'reset': {
        if (($('resetIn').value || '').trim().toUpperCase() !== 'RESET') { SND.play('error'); toast('Type RESET first'); return; }
        try { localStorage.removeItem(SAVE_KEY); } catch (er) {}
        G.s = IA.newGame(now(), (Math.random() * 1e9) | 0); G.place = 'field'; closeSheet(true); save(); location.reload(); break;
      }
    }
  }
  // Make: tap queues one; holding keeps queuing 5 per second while slots and inputs last
  function makeOne(r) {
    const sh = G.sheet; if (!sh || sh.kind !== 'shop') return false;
    const res = IA.queueRecipe(G.s, sh.arg, r, now());
    if (res.ok) { SND.play('queue'); vib(6); hintDone('make'); save(); renderSheet(); return true; }
    SND.play('error');
    toast(res.err === 'slots' ? 'Every slot is busy' : res.err === 'inputs' ? 'Not enough to make it' : 'Not yet');
    return false;
  }
  function sheetDown(e) {
    const b = e.target.closest('[data-make]'); if (!b || performance.now() - (G.sheetAt || 0) < 400) return;
    const r = b.dataset.make; let n = 0;
    const id = setTimeout(function rep() { if (!b.isConnected && !G.sheet) return; n++; const ok = makeOne(r); if (n === 1) b._held = true; if (ok) G._hold = setTimeout(rep, 200); }, 380);
    G._hold = id;
    const stop = () => { clearTimeout(G._hold); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
  }

  // ------------------------------------------------------------------ engine events -> juice
  function handleEvents(evs) {
    for (const e of evs) {
      switch (e.type) {
        case 'levelup': levelBanner(e); break;
        case 'ready': if (G.place === 'barn') SND.play('ready', SHOP_BELL[e.shop]); break;
        case 'notebook': {
          SND.play('notebook'); const p = elCenter('strip'); flyCoins({ x: p.x + p.w / 2 - 50, y: p.y }, e.gift, 5);
          if (e.done) toast('Notebook done! Orders take the top strip now', 'nbdone');
          break;
        }
        case 'first': G.popQ.push('New: ' + D.GOODS[e.good].name + '!'); break;
        case 'firstGood': if (e.good === 'egg' || e.good === 'milk' || e.good === 'apple' || IA.CROP[e.good]) G.popQ.push('First ' + D.GOODS[e.good].name.toLowerCase() + '!'); break;
        case 'order': if (G.place === 'market') SND.play('page'); break;
        case 'ferryIn': if (G.started) { SND.play('horn'); } break;
        case 'project': projectBuilt(e); break;
        case 'festival': setTimeout(festival, 1200); break;
        case 'csaNew': break;
      }
    }
  }
  // "New: Bread!" pops sit in the stage about 40 px under the strip (never on it), one at a time
  function runPops() {
    if (!G.popQ.length || G.md || !G.started) return; // held through Market Day and the title
    const t = performance.now(); if (t < G.popNext) return;
    floater(G.popQ.shift(), G.L.appW / 2, G.L.sy + 56, { size: 20, col: P.plum, life: 1.2 });
    G.popNext = t + 900; // the last one is already rising and fading when the next appears
  }
  function levelBanner(e) {
    const nc = e.unlocks.find(u => u.t === 'crop'); if (nc) { G.page = trayPageOf(nc.id); G.pulse = 'seed:' + nc.id; }
    G.banner = true; G.hitPause = performance.now() + 250;
    SND.play('levelup'); vib([20, 40, 20]);
    const icons = e.unlocks.slice(0, 3).map(u => { const g = u.t === 'crop' || u.t === 'recipe' ? u.id : u.t === 'shop' ? IA.SHOP_RECIPES[u.id][0].id : u.t === 'animal' ? D.ANIMALS[u.id].makes : u.t === 'tree' ? D.TREES[u.id].good : u.t === 'helper' && u.id === 'hive' ? 'honey' : null; const nm = u.t === 'shop' ? IA.SHOP[u.id].name : u.t === 'animal' ? D.ANIMALS[u.id].name : u.t === 'helper' ? D.HELPERS[u.id].name : u.t === 'tree' ? D.TREES[u.id].name : u.t === 'project' ? 'Town project' : u.t === 'feature' ? ({ csa: 'CSA box', market: 'Market Day', ferry: 'Ferry', farmhand: 'Farmhand', ticket: 'Order slot', slot4: 'Tree slot' })[u.id] : D.GOODS[u.id].name; return `<div>${g ? img(g) : '<span class="glyph">★</span>'}${nm}</div>`; }).join('');
    const b = $('banner');
    b.innerHTML = `<div class="scroll"><div class="k">Level up</div><h1>Level ${e.level}</h1><div class="unl">${icons}</div><div style="margin-top:8px;font-weight:700;font-size:13px;color:#A3741A">+${e.coins} coins · +1 heart</div></div>`;
    b.classList.remove('hidden', 'out');
    const p = elCenter('hLevel'); confetti(G.L.appW / 2, G.L.appH * 0.3, 40);
    G.pendCoins += 0;
    clearTimeout(G._bannerT); G._bannerT = setTimeout(hideBanner, 2600);
  }
  function hideBanner() { const b = $('banner'); if (b.classList.contains('hidden')) return; b.classList.add('out'); setTimeout(() => { b.classList.add('hidden'); G.banner = false; }, 240); }
  function projectBuilt(e) {
    SND.play('project'); vib([20, 40, 20]); confetti(G.L.appW / 2, G.L.appH * 0.4, 50);
    const Pj = D.PROJECTS[e.k];
    const b = $('banner');
    b.innerHTML = `<div class="scroll"><div class="k">Town project built</div><h1 style="font-size:32px">${Pj.name}</h1><div style="font-weight:700;color:var(--plum)">${Pj.perk}</div></div>`;
    b.classList.remove('hidden', 'out'); G.banner = true;
    clearTimeout(G._bannerT); G._bannerT = setTimeout(hideBanner, 3000);
    G.horizonKey = '';
    drawTitleArt();
  }
  function festival() {
    closeSheet(true); setPlace('field', true);
    G.fest = performance.now() / 1000;
    const end = G.fest + 12;
    const burst = () => { const T = performance.now() / 1000; if (T > end) { openSheet('festival'); return; } const x = 40 + Math.random() * (G.L.appW - 80), y = G.L.sy + 20 + Math.random() * G.L.hz; const cols = [P.gold, P.rose, P.cream, P.lake, P.red]; const col = cols[(Math.random() * 5) | 0]; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, v = 90 + Math.random() * 60; particle(x, y, { kind: 'spark', vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 60, size: 3, col, max: 1.1 }); } SND.play('firework'); if (Math.random() < 0.3) shake(3); setTimeout(burst, 500 + Math.random() * 500); };
    burst();
  }

  // ------------------------------------------------------------------ title
  function drawTitleArt() {
    const cv = $('titleArt'), r = $('title').getBoundingClientRect(); if (!r.width) return;
    const d = Math.min(2, window.devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d;
    const x = cv.getContext('2d'); x.scale(d, d);
    const w = r.width, h = r.height, s = G.s;
    x.fillStyle = P.paper; x.fillRect(0, 0, w, h);
    const built = {}; D.PROJECTS.forEach((p, k) => { if (s && s.projects[k].done) built[p.id] = 1; });
    const hy = h * 0.2, hh = h * 0.36;
    const dt = new Date(), hr = dt.getHours() + dt.getMinutes() / 60, tone = ART.skyTone(hr);
    const sky = x.createLinearGradient(0, 0, 0, hy + 2); sky.addColorStop(0, P.paper); sky.addColorStop(1, tone.top); x.fillStyle = sky; x.fillRect(0, 0, w, hy + 2);
    x.drawImage(ART.horizon(w * d, hh * d, hr, built, s && s.festival, true), 0, hy, w, hh);
    const fg = x.createLinearGradient(0, hy + hh, 0, h); fg.addColorStop(0, '#9CC56A'); fg.addColorStop(1, '#7FB050'); x.fillStyle = fg; x.fillRect(0, hy + hh - 1, w, h - hy - hh + 1);
    // rows of beds in perspective
    const crops = ['radish', 'wheat', 'carrot', 'pumpkin', 'corn', 'strawberry', 'tomato', 'sunflower'];
    for (let row = 0; row < 3; row++) {
      const y = hy + hh - 34 + row * (h * 0.07), sz = 42 + row * 10, n = Math.ceil(w / sz) + 1;
      for (let i = 0; i < n; i++) { const cx = i * sz * 1.02 - (row % 2) * sz * 0.5; x.drawImage(ART.tile('bed', sz * d, i + row * 7), cx, y, sz, sz); x.drawImage(ART.plant(crops[(i + row * 3) % crops.length], 2, Math.round(sz * 1.1 * d)), cx - sz * 0.05, y - sz * 0.2, sz * 1.1, sz * 1.1); }
    }
    x.fillStyle = 'rgba(246,235,211,.55)'; x.fillRect(0, h * 0.72, w, h * 0.28);
    const g2 = x.createLinearGradient(0, h * 0.66, 0, h * 0.74); g2.addColorStop(0, 'rgba(246,235,211,0)'); g2.addColorStop(1, 'rgba(246,235,211,.55)'); x.fillStyle = g2; x.fillRect(0, h * 0.66, w, h * 0.08);
    // records
    const rec = $('records'); rec.innerHTML = '';
    if (s && (s.market.best || s.csa.best || s.stats.ferryBest)) rec.innerHTML = [s.market.best ? 'Market best ' + IA.fmtNum(s.market.best) : '', s.csa.best ? 'CSA streak ' + s.csa.best : '', s.stats.ferryBest ? 'Ferry bonus ' + IA.fmtNum(s.stats.ferryBest) : ''].filter(Boolean).map(t => `<span>${t}</span>`).join('');
    $('ribbon').classList.toggle('hidden', !(s && s.festival));
  }
  // what today offers, for the title and the welcome card: CSA box, Market Day, ferry (no new systems)
  function todayBits(s, t) {
    const out = []; if (!s || s.level < 4) return out;
    const c = s.csa, st = IA.csaStreakNow(s, t), packed = c.slots.filter(x => x.done).length;
    out.push({ g: 'carrot', txt: c.done ? 'CSA box packed ✓' : 'CSA box ' + packed + '/' + c.slots.length + (st ? ' · streak ' + st : ''), hot: !c.done });
    if (s.level >= 5) {
      const ok = IA.mdCanOpen(s, t), dbl = IA.dayNum(t) > s.market.lastHeartDay;
      out.push({ g: 'bread', txt: ok.err === 'cool' ? 'Market Day in ' + IA.fmtTime(ok.left) : ok.ok ? 'Market Day ready' + (dbl ? ' · 2× hearts' : '') : 'Market Day: stock 12 goods' + (dbl ? ' · 2× hearts' : ''), hot: ok.ok });
    }
    if (s.level >= 7 && s.ferry) out.push({ g: 'apple', txt: s.ferry.here ? 'Ferry docked' : 'Ferry in ' + IA.fmtTime(s.ferry.backAt - t), hot: s.ferry.here });
    return out;
  }
  function drawToday() {
    const el = $('today'); if (!el) return;
    const bits = G.returning ? todayBits(G.s, now()) : [];
    const html = bits.map(b => `<span${b.hot ? ' class="hot"' : ''}>${b.txt}</span>`).join('');
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
  }
  function start() {
    if (G.started) return;
    G.started = true; SND.unlock();
    SND.setSound(G.s.settings.sound); SND.setMusic(G.s.settings.music);
    $('title').classList.add('out'); setTimeout(() => $('title').classList.add('hidden'), 360);
    SND.play('tap');
    if (G.away && G.away.away >= 5 * M) openSheet('welcome', G.away);
    G.away = null;
  }

  // ------------------------------------------------------------------ main loop
  let last = performance.now();
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = ts; return; }
    let dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    G.frameN++; G.fps = G.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
    step(dt);
  }
  function step(dt) {
    const s = G.s, t = now();
    if (G.hitPause && performance.now() < G.hitPause) dt = 0;
    if (G.md) MD.step(dt); else { IA.tick(s, t); IA.notebookCheck(s, t); }
    handleEvents(IA.drain());
    runPops();
    if (G.started) { tutorial(); firstHints(); cellarNudge(); }
    drawScene(dt);
    drawFX(dt);
    updateHUD();
    if (t - G.lastSecond > 1000) { G.lastSecond = t; if (!G.started) drawToday(); if (G.sheet && !['settings', 'mdResult', 'welcome', 'festival'].includes(G.sheet.kind)) renderSheet(); }
    if (t - G.lastSave > 15000 && G.started) save();
    if (G.pulseTicket != null) { G.pulseTicket = null; }
  }

  // ------------------------------------------------------------------ boot
  function bindUI() {
    const sc = $('scene');
    sc.addEventListener('pointerdown', onDown, { passive: false });
    sc.addEventListener('pointermove', onMove, { passive: false });
    sc.addEventListener('pointerup', e => onUp(e, false));
    sc.addEventListener('pointercancel', e => onUp(e, true));
    sc.addEventListener('lostpointercapture', e => { if (G.ptr && e.pointerId === G.ptr.id) onUp(e, false); });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
    document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => { SND.unlock(); setPlace(b.dataset.place); }));
    $('strip').addEventListener('click', stripTap);
    $('hCellar').addEventListener('click', () => { SND.unlock(); openSheet('cellar'); });
    $('hLevel').addEventListener('click', () => { SND.unlock(); openSheet('level'); });
    $('hGear').addEventListener('click', () => { SND.unlock(); openSheet('settings'); });
    $('hHearts').addEventListener('click', () => { SND.unlock(); if (G.s.level >= 4) openSheet('town'); else toast('Hearts build town projects (Level 4)'); });
    $('hCoins').addEventListener('click', () => { SND.unlock(); toast('Coins: fill orders to earn more'); });
    $('sheet').addEventListener('click', sheetClick);
    $('sheet').addEventListener('pointerdown', sheetDown);
    $('sheetBg').addEventListener('click', () => { if (performance.now() - (G.sheetAt || 0) > 400) closeSheet(); });
    $('banner').addEventListener('click', hideBanner);
    $('playBtn').addEventListener('click', start);
    $('title').addEventListener('pointerdown', e => { if (e.target.id === 'playBtn') return; });
    window.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (!G.started && (k === 'enter' || k === ' ')) { start(); return; }
      if (k === 'escape') { closeSheet(); hideBanner(); return; }
      if (G.md) { const idx = 'qweasd'.indexOf(k); if (idx >= 0) MD.key(idx); return; }
      if (k === '1') setPlace('field'); if (k === '2') setPlace('barn'); if (k === '3') setPlace('market');
      if (k === 'm') { G.s.settings.sound = !G.s.settings.sound; SND.setSound(G.s.settings.sound); toast(G.s.settings.sound ? 'Sound on' : 'Sound off'); save(); }
      const qi = 'qwerty'.indexOf(k);
      if (qi >= 0 && G.place === 'field') { const r = G.L.chipRects && G.L.chipRects[qi]; if (r && r.page) trayNextPage(); else if (r && !r.locked) { G.sel = r.crop; SND.play('tap'); } }
    });
    // layout only on orientation change (or a real desktop resize), never on Safari's toolbar
    window.addEventListener('orientationchange', () => setTimeout(() => layout(true), 250));
    window.addEventListener('resize', () => { clearTimeout(G._rz); G._rz = setTimeout(() => layout(false), 200); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { save(); SND.suspend(true); if (G.md) G.md.paused = true; G.hiddenAt = now(); }
      else {
        SND.suspend(false); if (G.md) G.md.paused = false;
        const away = now() - (G.hiddenAt || now());
        if (away >= 5 * M && !G.md) { G.s.savedAt = G.hiddenAt; const rep = IA.catchUp(G.s, now()); IA.drain(); if (G.started) openSheet('welcome', rep); save(); }
      }
    });
    window.addEventListener('pagehide', save);
  }
  function boot() {
    $('grain').style.backgroundImage = 'url(' + ART.grainURL() + ')';
    const saved = loadSave();
    if (saved) { G.s = saved; G.away = IA.catchUp(G.s, now()); IA.drain(); G.returning = true; }
    else { G.s = IA.newGame(now(), (Date.now() % 1e9) | 0); }
    SND.st.sound = G.s.settings.sound; SND.st.music = G.s.settings.music;
    bindUI();
    layout(true);
    drawTitleArt(); drawToday();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawTitleArt(); G.horizonKey = ''; });
    requestAnimationFrame(frame);
    // warm the goods atlas in idle time so the first Market Day never hitches
    const goods = Object.keys(D.GOODS); let gi = 0;
    const warm = () => { const t0 = performance.now(); while (gi < goods.length && performance.now() - t0 < 8) { const g = goods[gi++]; ART.icon(g, 64); ART.icon(g, 96); ART.iconSrc(g); } if (gi < goods.length) setTimeout(warm, 30); };
    setTimeout(warm, 300);
  }

  // ------------------------------------------------------------------ test hooks
  window.__T = {
    start: () => { start(); return true; },
    state: () => JSON.parse(JSON.stringify(G.s)),
    step: (ms) => { const n = Math.max(1, Math.ceil(ms / 50)); for (let i = 0; i < n; i++) { const d = Math.min(50, ms - i * 50); G.off += d; step(d / 1000); } return true; },
    give: (g, n) => { IA.add(G.s, g, n == null ? 1 : n); return IA.have(G.s, g); },
    coins: (n) => { G.s.coins = n; return n; },
    hearts: (n) => { G.s.hearts = n; return n; },
    setLevel: (n) => { const s = G.s; for (let L = s.level + 1; L <= n; L++) { s.level = L; IA.addXP(s, 0, now()); } s.level = n; s.xp = 0; for (let L = 1; L <= n; L++) { /* mark unlocks */ IA.D.CROPS.forEach(c => { if (c.lvl <= n && s.unl[c.id] == null) s.unl[c.id] = now() - H; }); IA.D.RECIPES.forEach(r => { if (r.lvl <= n && s.unl[r.id] == null) s.unl[r.id] = now() - H; }); } ['apple', 'maple', 'egg', 'milk', 'honey'].forEach(g => { if (s.unl[g] == null) s.unl[g] = now() - H; }); IA.tick(s, now()); IA.drain(); return n; },
    plant: (i, crop) => IA.plant(G.s, i, crop, now()),
    harvestAll: () => { let n = 0; for (let i = 0; i < 30; i++) { const r = IA.harvest(G.s, i, now()); if (r.ok) n += r.n; } return n; },
    make: (shop, r) => { if (!G.s.shops[shop].built) { G.s.shops[shop].built = true; } return IA.queueRecipe(G.s, shop, r, now()); },
    deliver: (k) => IA.deliver(G.s, k, now()),
    place: (p) => { setPlace(p, true); G.slideT = 1; return G.place; },
    openMarketDay: () => MD.start(),
    serve: (i) => MD.serveIdx(i),
    md: () => G.md && JSON.parse(JSON.stringify(G.md.run)),
    away: (ms) => { save(); G.s.savedAt = now(); G.off += ms; const rep = IA.catchUp(G.s, now()); IA.drain(); if (ms >= 5 * M) openSheet('welcome', rep); save(); return rep; },
    save: () => { save(); return true; },
    load: () => { const s = loadSave(); if (s) { G.s = s; IA.catchUp(G.s, now()); IA.drain(); } return !!s; },
    reset: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} G.s = IA.newGame(now(), 4242); IA.drain(); return true; },
    noTutorial: () => { G.s.tut = 99; G.s.notebook = Math.max(G.s.notebook, 0); setHint(null); return true; },
    layout: () => {
      const k = G.scale || 1, a = $('app').getBoundingClientRect(); G.L.ax = a.left; G.L.ay = a.top;
      const R = r => r && ({ x: a.left + (r.x + G.L.sx) * k, y: a.top + (r.y + G.L.sy) * k, w: r.w * k, h: r.h * k });
      const out = []; for (let i = 0; i < 30; i++) out.push(R(tileRect(i)));
      return { tiles: out, chips: (G.L.chipRects || []).map(r => Object.assign({ crop: r.crop }, R(r))), trees: [0, 1, 2, 3].map(q => R(treeRect(q))), tickets: (G.L.tickets || []).map(R), deliver0: R(G.L.deliver0), stage: R({ x: 0, y: 0, w: G.W, h: G.C }), scale: k, L: G.L };
    },
    hits: () => { const k = G.scale || 1, a = $('app').getBoundingClientRect(); return G.hits.map(h => ({ x: a.left + (h.x + G.L.sx) * k, y: a.top + (h.y + G.L.sy) * k, w: h.w * k, h: h.h * k })); },
    sheet: () => G.sheet && G.sheet.kind,
    hint: () => G.hint && G.hint.id,
    fps: () => Math.round(G.fps),
    sound: () => SND.st.log.slice(),
    soundLog: (on) => { SND.st.logOn = !!on; SND.st.log = []; return true; },
    sel: (c) => { if (c) G.sel = c; return G.sel; },
    edit: (on) => { G.edit = !!on; return G.edit; },
    events: () => IA.drain(),
  };

  // shared with market.js
  G.api = { save, toast, vib, flyCoins, floater, confetti, particle, heartBurst, toApp, elCenter, text, card, rr, coinGlyph, heartGlyph, ring, openSheet, closeSheet, setPlace, sizeStage, setHint, hintDone, FONT, ease, clamp, lerp };
  boot();
})();
