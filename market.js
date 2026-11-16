/* Intervale Acres: Market Day, a 60-second rush at a stall on the Church Street bricks. Rules live in engine.js (md*). */
(function () {
  'use strict';
  const P = ART.P, D = IA_DATA;
  const MD = {};
  let run = null, st = null;

  function A() { return G.api; }
  MD.start = function (shelf, incl) {
    const s = G.s;
    const ok = IA.mdCanOpen(s, G.now(), incl);
    if (!ok.ok) { A().toast(ok.err === 'cool' ? 'Next market in ' + IA.fmtTime(ok.left) : ok.err === 'stock' ? 'Stock up: 12 goods' : 'Market Day at Level 5'); SND.play('error'); return false; }
    run = IA.mdStart(s, G.now(), shelf, incl);
    if (!run) { A().toast('Stock up: 12 goods'); return false; }
    st = { run, flash: [], flyers: [], pops: [], endAt: 0, hand: run.first ? 2 : 0, shake: 0, streakPop: 0, startT: performance.now() / 1000, tapped: -1, tappedAt: 0 };
    G.md = st;
    document.getElementById('app').classList.add('md');
    document.getElementById('strip').style.display = 'none';
    document.getElementById('nav').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    A().sizeStage();
    SND.setFast(true); SND.play('mdStart');
    return true;
  };
  function finish() {
    const s = G.s;
    const res = IA.mdEnd(s, run, G.now());
    G.md = null; run = null;
    document.getElementById('app').classList.remove('md');
    document.getElementById('strip').style.display = '';
    document.getElementById('nav').style.display = '';
    document.getElementById('hud').style.display = '';
    A().sizeStage(); A().setHint(null);
    SND.setFast(false); SND.play('mdEnd');
    if (res.hearts) { const p = A().elCenter('hHearts'); A().heartBurst({ x: G.L.appW / 2, y: G.L.appH * 0.4 }, res.hearts); }
    if (res.served) A().confetti(G.L.appW / 2, G.L.appH * 0.35, res.isBest ? 50 : 24);
    A().openSheet('mdResult', res);
    A().save();
  }

  // ---------------------------------------------------------------- geometry
  function geo() {
    const W = G.W, C = G.C;
    const top = 60, shelfH = Math.min(270, Math.round(C * 0.36)), shelfY = C - shelfH - 8;
    const spotW = Math.min(124, (W - 16) / 3), spotX = k => W / 2 + (k - 1) * spotW;
    const custY = top + (shelfY - top) * 0.72;
    const bw = Math.min(122, (W - 32) / 3), bh = Math.min(118, (shelfH - 22) / 2);
    const bx = k => W / 2 + ((k % 3) - 1) * (bw + 8) - bw / 2, by = k => shelfY + 14 + Math.floor(k / 3) * (bh + 8);
    return { W, C, top, shelfY, shelfH, spotW, spotX, custY, bw, bh, bx, by };
  }
  function shelfAt(x, y) { const g = geo(); for (let k = 0; k < run.shelf.length; k++) { if (x >= g.bx(k) - 4 && x < g.bx(k) + g.bw + 4 && y >= g.by(k) - 4 && y < g.by(k) + g.bh + 4) return k; } return -1; }

  // ---------------------------------------------------------------- step + input
  MD.step = function (dt) {
    if (!run) return;
    if (st.paused) return;
    if (run.over) { if (!st.endAt) { st.endAt = performance.now(); } else if (performance.now() - st.endAt > 1300) finish(); return; }
    const evs = IA.mdStep(run, dt);
    evs.forEach(e => {
      if (e.type === 'walk') { SND.play('walk'); st.pops.push({ k: e.k, text: '', sad: true, t: 0 }); }
      if (e.type === 'spawn' && st.hand > 0) { const k = e.k; const g2 = run.cust[k].g; const idx = run.shelf.findIndex(x => x.g === g2); st.hand--; A().setHint({ id: 'mdhand', mdOk: true, pts: () => { const g = geo(); const c = run && run.cust[k]; if (!c || c.state !== 'wait' && c.state !== 'walk') return null; return [A().toApp(g.bx(idx) + g.bw / 2, g.by(idx) + g.bh / 2)]; } }); }
    });
  };
  MD.down = function (x, y) {
    if (!run || run.over) return;
    const k = shelfAt(x, y); if (k < 0) return;
    MD.serveIdx(k);
  };
  MD.move = function () {}; MD.up = function () {};
  MD.key = function (k) { MD.serveIdx(k); };
  MD.serveIdx = function (k) {
    if (!run || run.over) return { ok: false };
    const s = G.s, g = geo(), item = run.shelf[k]; if (!item) return { ok: false };
    st.tapped = k; st.tappedAt = performance.now();
    const r = IA.mdServe(s, run, k);
    if (!r.ok) {
      if (r.err === 'nobody') { SND.play('wrong'); st.shake = performance.now(); A().vib(30); }
      return r;
    }
    SND.play('serve', r.streak); A().vib(12);
    st.streakPop = performance.now();
    st.flyers.push({ g: item.g, x0: g.bx(k) + g.bw / 2, y0: g.by(k) + g.bh / 2, x1: g.spotX(r.k), y1: g.custY - 40, t: 0 });
    const p = A().toApp(g.spotX(r.k), g.custY - 60);
    A().floater('+' + (r.pay + r.tip), p.x, p.y, { col: '#A3741A', size: 22 + Math.min(10, r.streak) });
    if (r.tip) A().floater('tip!', p.x + 30, p.y + 20, { col: P.plum, size: 16 });
    for (let i = 0; i < 6; i++) A().particle(p.x, p.y + 30, { kind: 'spark', vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 120, g: 200, size: 4, col: P.gold, max: 0.5 });
    if (G.hint && G.hint.id === 'mdhand') A().setHint(null);
    return r;
  };

  // ---------------------------------------------------------------- draw
  MD.draw = function (c, dt) {
    if (!run) return;
    const g = geo(), T = performance.now() / 1000, F = A().FONT, text = A().text;
    // Church Street: a row of shopfronts at the top, warm bricks below (quiet, so customers read first)
    const fy = g.top - 6, fh = Math.max(70, Math.min(140, (g.custY - 120) - fy));
    c.fillStyle = '#C98266'; c.fillRect(0, fy, g.W, g.C - fy);
    const bh = 16, bw = 36;
    for (let y = fy + fh, row = 0; y < g.shelfY; y += bh, row++) {
      for (let x = -(row % 2) * bw / 2; x < g.W; x += bw) { c.fillStyle = (Math.floor(x / bw) + row * 3) % 3 ? '#C98266' : '#C27B60'; c.fillRect(x + 1, y + 1, bw - 2, bh - 2); }
    }
    const fronts = [[P.lake, P.cream], [P.red, P.cream], [P.leaf, P.gold], [P.plum, P.cream], ['#8A5A3B', P.gold]];
    const fw = g.W / 4;
    for (let i = 0; i < 5; i++) {
      const x = i * fw - fw * 0.5, [wall, trim] = fronts[i % 5];
      c.fillStyle = i % 2 ? '#E7D3B0' : '#D9B98E'; c.fillRect(x, fy, fw, fh);
      c.fillStyle = 'rgba(43,36,32,.18)'; c.fillRect(x + fw - 2, fy, 2, fh);
      // awning stripes
      const ay = fy + fh * 0.42; for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? trim : wall; c.fillRect(x + 6 + k * (fw - 12) / 6, ay, (fw - 12) / 6, fh * 0.14); }
      c.fillStyle = wall; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x + 6 + (k + 0.5) * (fw - 12) / 6, ay + fh * 0.14, (fw - 12) / 12, 0, Math.PI); c.fill(); }
      // window glow + door
      c.fillStyle = 'rgba(242,178,51,.55)'; A().rr(c, x + 10, ay + fh * 0.22, fw * 0.45, fh * 0.3, 3); c.fill();
      const wg = ['bread', 'jam', 'cheddar', 'mcreemee', 'pumpkin'][i % 5], wsz = Math.min(fh * 0.24, fw * 0.2);
      c.drawImage(ART.icon(wg, 64), x + 10 + fw * 0.225 - wsz / 2, ay + fh * 0.24, wsz, wsz);
      c.fillStyle = 'rgba(43,36,32,.55)'; A().rr(c, x + fw * 0.66, ay + fh * 0.22, fw * 0.2, fh * 0.36, 3); c.fill();
      c.fillStyle = trim; A().rr(c, x + 10, fy + fh * 0.1, fw - 20, fh * 0.22, 3); c.fill(); c.strokeStyle = 'rgba(43,36,32,.35)'; c.lineWidth = 1.5; c.stroke();
      const sg = ['carrot', 'egg', 'apple', 'honey', 'corn'][i % 5], ssz = fh * 0.18; c.drawImage(ART.icon(sg, 64), x + fw / 2 - ssz / 2, fy + fh * 0.12, ssz, ssz);
    }
    c.fillStyle = '#B7AE9E'; c.fillRect(0, fy + fh, g.W, 8); c.fillStyle = 'rgba(43,36,32,.2)'; c.fillRect(0, fy + fh + 8, g.W, 2);
    // planters on the sidewalk edge
    [[26, fy + fh + 2], [g.W - 26, fy + fh + 2]].forEach(([x, y]) => { c.fillStyle = '#7A4E33'; A().rr(c, x - 18, y - 4, 36, 18, 4); c.fill(); [P.rose, P.gold, P.cream, P.rose].forEach((col, i) => { c.beginPath(); c.arc(x - 10 + i * 6.5, y - 6 - (i % 2) * 4, 5, 0, 7); c.fillStyle = col; c.fill(); }); });
    // customers
    run.cust.forEach((cu, k) => {
      if (!cu) return;
      const x = g.spotX(k);
      let y = g.custY, alpha = 1, mood = null;
      if (cu.state === 'walk') { const kk = A().ease(cu.a / 0.45); y = lerp(g.top - 40, g.custY, kk); alpha = kk; }
      if (cu.state === 'happy') { y = g.custY - A().ease(cu.a / 0.5) * 50; alpha = 1 - cu.a / 0.5; mood = 'happy'; }
      let dx = 0;
      if (cu.state === 'leave') { if (k === 1) y = g.custY - A().ease(cu.a / 0.5) * 60; else dx = (k === 0 ? -1 : 1) * A().ease(cu.a / 0.5) * g.spotW; alpha = 1 - Math.max(0, cu.a - 0.25) / 0.25; mood = 'sad'; }
      c.globalAlpha = Math.max(0, alpha);
      const ps = Math.min(g.spotW * 0.8, 96);
      ART.person(c, x + (typeof dx === 'number' ? dx : 0), y - ps * 0.55, ps, cu.look, mood);
      // bubble with the good and a patience ring
      if (cu.state === 'wait' || cu.state === 'walk') {
        const bx = x, by = y - ps * 0.55 - 34, r = 28;
        c.save(); c.shadowColor = 'rgba(43,36,32,.3)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
        c.beginPath(); c.arc(bx, by, r, 0, 7); c.fillStyle = P.cream; c.fill(); c.restore();
        c.beginPath(); c.moveTo(bx - 6, by + r - 2); c.lineTo(bx, by + r + 9); c.lineTo(bx + 6, by + r - 2); c.fillStyle = P.cream; c.fill();
        c.drawImage(ART.icon(cu.g, 96), bx - r * 0.78, by - r * 0.78, r * 1.56, r * 1.56);
        if (cu.state === 'wait') {
          const pk = Math.max(0, cu.pat / cu.patMax);
          c.beginPath(); c.arc(bx, by, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pk); c.strokeStyle = pk > 0.5 ? P.leaf : pk > 0.25 ? P.gold : P.red; c.lineWidth = 5; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
        }
      }
      c.globalAlpha = 1;
    });
    // flying goods
    st.flyers = st.flyers.filter(f => (f.t += dt) < 0.22);
    st.flyers.forEach(f => { const k = A().ease(f.t / 0.22); const x = lerp(f.x0, f.x1, k), y = lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * 40; c.drawImage(ART.icon(f.g, 64), x - 18, y - 18, 36, 36); });
    // stall: awning edge + counter
    c.fillStyle = '#8A5A3B'; c.fillRect(0, g.shelfY - 4, g.W, g.shelfH + 12);
    const sw = 26; for (let i = 0; i * sw < g.W + sw; i++) { c.fillStyle = i % 2 ? P.cream : P.red; c.beginPath(); c.moveTo(i * sw, g.shelfY - 14); c.lineTo(i * sw + sw, g.shelfY - 14); c.lineTo(i * sw + sw, g.shelfY - 2); c.arc(i * sw + sw / 2, g.shelfY - 2, sw / 2, 0, Math.PI); c.closePath(); c.fill(); }
    const wob = st.shake && performance.now() - st.shake < 260 ? Math.sin((performance.now() - st.shake) / 20) * 4 : 0;
    run.shelf.forEach((it, k) => {
      const x = g.bx(k) + wob, y = g.by(k), pressed = st.tapped === k && performance.now() - st.tappedAt < 120;
      // only the very first run lights up the wanted goods; after that you match bubble to shelf yourself
      const want = run.first && run.cust.some(cu => cu && (cu.state === 'wait' || cu.state === 'walk') && cu.g === it.g);
      const lift = want && it.n ? -3 : 0, yy = y + (pressed ? 2 : lift);
      A().card(c, x, yy, g.bw, g.bh, 16, it.n ? (want ? '#FFF3CC' : '#F3E8D2') : '#D9C6A4');
      if (want && it.n) { A().rr(c, x - 1, yy - 1, g.bw + 2, g.bh + 2, 17); c.strokeStyle = P.gold; c.lineWidth = 3; c.stroke(); }
      c.globalAlpha = !it.n ? 0.35 : want || !run.first ? 1 : 0.6;
      const isz = Math.min(g.bh - 26, g.bw * 0.55); c.drawImage(ART.icon(it.g, 96), x + g.bw / 2 - isz / 2, y + 6 + (pressed ? 2 : 0), isz, isz);
      c.globalAlpha = 1;
      text(c, it.n ? '×' + it.n : 'Sold out', x + g.bw / 2, y + g.bh - 12, { px: 14, col: it.n ? P.ink : P.red });
    });
    // top bar: take, timer, streak
    c.fillStyle = P.paper; c.fillRect(0, 0, g.W, g.top - 6); c.fillStyle = 'rgba(43,36,32,.15)'; c.fillRect(0, g.top - 8, g.W, 2);
    const left = Math.max(0, run.dur - run.t), k = left / run.dur;
    A().rr(c, 12, g.top - 18, g.W - 24, 7, 4); c.fillStyle = 'rgba(43,36,32,.12)'; c.fill();
    A().rr(c, 12, g.top - 18, (g.W - 24) * k, 7, 4); c.fillStyle = left < 10 ? P.red : P.leaf; c.fill();
    A().coinGlyph(c, 24, 20, 9); text(c, IA.fmtNum(run.take), 38, 21, { al: 'left', px: 20, w: 900, d: true });
    text(c, Math.ceil(left) + 's', g.W / 2, 21, { px: 20, w: 900, d: true, col: left < 10 ? P.red : P.ink });
    const mult = IA.mdMult(run.streak), sp = 1 + 0.3 * Math.max(0, 1 - (performance.now() - st.streakPop) / 200);
    if (run.streak > 0) text(c, '×' + mult.toFixed(1) + '  ' + run.streak, g.W - 14, 21, { al: 'right', px: Math.round((16 + Math.min(run.streak, 20) / 2) * sp), w: 900, d: true, col: run.streak >= 21 ? P.plum : P.ink });
    else text(c, '×1.0', g.W - 14, 21, { al: 'right', px: 16, w: 900, d: true, col: 'rgba(43,36,32,.45)' });
    if (run.first && run.t < 4) text(c, 'Tap what they want', g.W / 2, g.shelfY - 34, { px: 18, w: 900, d: true, col: P.cream, halo: 5, haloCol: 'rgba(43,36,32,.5)' });
    if (run.over) { const msg = run.soldOut ? 'Sold out!' : 'Time!'; c.fillStyle = 'rgba(43,36,32,.35)'; c.fillRect(0, 0, g.W, g.C); text(c, msg, g.W / 2, g.C * 0.4, { px: 52, w: 900, d: true, col: P.cream, halo: 8, haloCol: 'rgba(200,69,47,.9)' }); }
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  window.MD = MD;
})();
