/* Intervale Acres art: code-drawn "seed-packet print" look. Every key in ASSETS can be replaced by a painted PNG
   later (see IMAGE-PROMPTS.md); the code-drawn version is the fallback. */
(function (root) {
  'use strict';
  const P = {
    paper: '#F6EBD3', shade: '#E8D7B4', ink: '#2B2420', soilD: '#5B3A29', soilL: '#7A4E33', sod: '#A9C77A', meadow: '#8DBF5A',
    leaf: '#3F7D4E', lake: '#2F7F8F', far: '#7FB8BC', sky: '#DCEFE6', mtn: '#6E8FA0', red: '#C8452F', gold: '#F2B233', rose: '#E4586A', plum: '#6B3F69',
    // tints derived from the palette
    orange: '#E07A2E', cream: '#FBF4E4', leafL: '#6FA05A', wheat: '#E2B75A', brown: '#8A5A3B', crust: '#C9894A', milk: '#FFFDF6', amber: '#C77A1E',
  };
  const ASSETS = {}; // key -> HTMLImageElement once a painted PNG exists; empty means use code-drawn art

  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2); }
  function lin(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(s[0], s[1])); return g; }
  function rad(c, x, y, r0, r1, stops) { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }
  function hex(h) { if (h[0] !== '#') { const m = h.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]]; } const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }
  function rgba(h, a) { const A = hex(h); return 'rgba(' + A.join(',') + ',' + a + ')'; }

  // A painted PNG for this key, if one has been loaded into ASSETS, drawn at the requested size.
  function asset(key, w, h) { const im = ASSETS[key]; if (!im || !im.complete || !im.naturalWidth) return null; const c = mk(w, h || w); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c; }
  // Misprint: an ink-tinted copy offset down-right, then the art. Optional soft drop shadow.
  function misprint(src, off, alpha) {
    const c = mk(src.width, src.height), x = c.getContext('2d');
    const t = mk(src.width, src.height), tx = t.getContext('2d');
    tx.drawImage(src, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = P.ink; tx.fillRect(0, 0, t.width, t.height);
    x.globalAlpha = alpha == null ? 0.22 : alpha; x.drawImage(t, off, off); x.globalAlpha = 1; x.drawImage(src, 0, 0);
    return c;
  }
  // draw fn(ctx) in a unit box [0..1]; returns a canvas of size px, with misprint
  function unit(px, fn, opts) {
    opts = opts || {};
    const pad = Math.round(px * 0.06);
    const c = mk(px, px), x = c.getContext('2d');
    x.save(); x.translate(pad, pad); x.scale(px - pad * 2, px - pad * 2); x.lineJoin = 'round'; x.lineCap = 'round';
    fn(x); x.restore();
    return opts.raw ? c : misprint(c, Math.max(1, Math.round(px / 40)), 0.2);
  }

  // ---------------------------------------------------------------- goods icons (unit coords, centre 0.5,0.5)
  const ICON = {};
  function leafShape(c, x, y, len, wid, ang, col) { c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(wid, -len * 0.5, 0, -len); c.quadraticCurveTo(-wid, -len * 0.5, 0, 0); c.fillStyle = col; c.fill(); c.strokeStyle = rgba(P.ink, 0.25); c.lineWidth = 0.012; c.beginPath(); c.moveTo(0, -0.02); c.lineTo(0, -len * 0.85); c.stroke(); c.restore(); }
  function shine(c, x, y, rx, ry, a) { ell(c, x, y, rx, ry, -0.5); c.fillStyle = 'rgba(255,255,255,' + (a || 0.45) + ')'; c.fill(); }
  function outline(c, w) { c.strokeStyle = rgba(P.ink, 0.55); c.lineWidth = w || 0.022; c.stroke(); }

  ICON.radish = c => {
    leafShape(c, 0.5, 0.42, 0.32, 0.1, -0.5, P.leaf); leafShape(c, 0.5, 0.42, 0.36, 0.11, 0.05, P.leafL); leafShape(c, 0.5, 0.42, 0.3, 0.1, 0.6, P.leaf);
    c.beginPath(); c.moveTo(0.5, 0.9); c.quadraticCurveTo(0.48, 0.82, 0.47, 0.76); c.strokeStyle = P.rose; c.lineWidth = 0.02; c.stroke();
    ell(c, 0.5, 0.6, 0.2, 0.19); c.fillStyle = rad(c, 0.44, 0.54, 0.02, 0.24, [[0, '#F06A6A'], [1, P.red]]); c.fill(); outline(c);
    c.beginPath(); c.moveTo(0.38, 0.7); c.quadraticCurveTo(0.5, 0.8, 0.62, 0.7); c.lineTo(0.5, 0.79); c.closePath(); c.fillStyle = P.cream; c.fill();
    shine(c, 0.43, 0.53, 0.05, 0.03);
  };
  ICON.wheat = c => {
    c.strokeStyle = P.crust; c.lineWidth = 0.025;
    [-0.18, 0, 0.18].forEach((a, k) => {
      c.save(); c.translate(0.5, 0.92); c.rotate(a);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -0.62); c.stroke();
      for (let i = 0; i < 6; i++) { const y = -0.32 - i * 0.07; [-1, 1].forEach(sd => { ell(c, sd * 0.045, y, 0.035, 0.06, sd * 0.5); c.fillStyle = k === 1 ? P.gold : P.wheat; c.fill(); c.strokeStyle = rgba(P.ink, 0.4); c.lineWidth = 0.01; c.stroke(); }); }
      ell(c, 0, -0.75, 0.03, 0.05); c.fillStyle = P.gold; c.fill(); c.strokeStyle = P.crust; c.lineWidth = 0.025;
      c.restore();
    });
    c.fillStyle = P.red; rr(c, 0.4, 0.74, 0.2, 0.07, 0.02); c.fill();
  };
  ICON.corn = c => {
    c.save(); c.translate(0.5, 0.5); c.rotate(0.35);
    ell(c, 0, 0.02, 0.15, 0.38); c.fillStyle = lin(c, -0.15, 0, 0.15, 0, [[0, '#E9A92A'], [0.5, '#F7CF4D'], [1, '#DB9A22']]); c.fill(); outline(c);
    c.fillStyle = rgba(P.amber, 0.45);
    for (let r = -6; r <= 6; r++) for (let q = -2; q <= 2; q++) { const y = r * 0.052, x = q * 0.055 + (r % 2 ? 0.027 : 0); if ((x * x) / 0.02 + (y * y) / 0.13 < 1) { ell(c, x, y, 0.016, 0.014); c.fill(); } }
    c.beginPath(); c.moveTo(0, 0.42); c.quadraticCurveTo(-0.26, 0.18, -0.13, -0.18); c.quadraticCurveTo(-0.12, 0.15, 0, 0.3); c.fillStyle = P.leafL; c.fill(); outline(c, 0.015);
    c.beginPath(); c.moveTo(0, 0.42); c.quadraticCurveTo(0.27, 0.15, 0.15, -0.12); c.quadraticCurveTo(0.1, 0.17, 0, 0.3); c.fillStyle = P.leaf; c.fill(); outline(c, 0.015);
    c.restore();
  };
  ICON.carrot = c => {
    leafShape(c, 0.5, 0.3, 0.24, 0.07, -0.4, P.leafL); leafShape(c, 0.5, 0.3, 0.28, 0.07, 0, P.leaf); leafShape(c, 0.5, 0.3, 0.24, 0.07, 0.4, P.leafL);
    c.beginPath(); c.moveTo(0.36, 0.3); c.quadraticCurveTo(0.5, 0.26, 0.64, 0.3); c.quadraticCurveTo(0.6, 0.6, 0.5, 0.93); c.quadraticCurveTo(0.4, 0.6, 0.36, 0.3);
    c.fillStyle = lin(c, 0.36, 0, 0.64, 0, [[0, '#E98A35'], [0.5, '#F4A043'], [1, '#D46C24']]); c.fill(); outline(c);
    c.strokeStyle = rgba(P.ink, 0.3); c.lineWidth = 0.014; [[0.42, 0.42, 0.5], [0.55, 0.52, 0.6], [0.45, 0.63, 0.5], [0.53, 0.74, 0.58]].forEach(([a, y, b]) => { c.beginPath(); c.moveTo(a, y); c.lineTo(b, y + 0.01); c.stroke(); });
  };
  ICON.tomato = c => {
    ell(c, 0.5, 0.56, 0.32, 0.28); c.fillStyle = rad(c, 0.4, 0.46, 0.03, 0.38, [[0, '#EE6248'], [1, '#B8362A']]); c.fill(); outline(c);
    c.strokeStyle = rgba(P.ink, 0.18); c.lineWidth = 0.015; c.beginPath(); c.moveTo(0.5, 0.32); c.quadraticCurveTo(0.42, 0.56, 0.5, 0.82); c.stroke();
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; leafShape(c, 0.5, 0.31, 0.13, 0.05, a + Math.PI / 2, P.leaf); }
    c.fillStyle = P.leaf; rr(c, 0.48, 0.18, 0.04, 0.12, 0.02); c.fill();
    shine(c, 0.38, 0.45, 0.07, 0.04);
  };
  ICON.strawberry = c => {
    c.beginPath(); c.moveTo(0.5, 0.92); c.bezierCurveTo(0.18, 0.7, 0.16, 0.32, 0.5, 0.3); c.bezierCurveTo(0.84, 0.32, 0.82, 0.7, 0.5, 0.92);
    c.fillStyle = rad(c, 0.42, 0.45, 0.03, 0.4, [[0, '#F0606A'], [1, '#B8303E']]); c.fill(); outline(c);
    c.fillStyle = P.gold; for (let r = 0; r < 5; r++) for (let q = -2; q <= 2; q++) { const x = 0.5 + q * 0.075 + (r % 2) * 0.035, y = 0.42 + r * 0.09; if (Math.abs(x - 0.5) < 0.25 - r * 0.04) { ell(c, x, y, 0.012, 0.018); c.fill(); } }
    for (let i = 0; i < 5; i++) leafShape(c, 0.5, 0.31, 0.14, 0.05, -1.2 + i * 0.6, i % 2 ? P.leafL : P.leaf);
  };
  ICON.pumpkin = c => {
    const cols = ['#D9692A', '#EE8A36', '#F29A44', '#EE8A36', '#D9692A'];
    [-0.24, 0.24, -0.12, 0.12, 0].forEach((x, i) => { ell(c, 0.5 + x, 0.6, 0.17 - Math.abs(x) * 0.15, 0.27); c.fillStyle = cols[[0, 4, 1, 3, 2][i]]; c.fill(); outline(c, 0.016); });
    c.fillStyle = P.soilD; rr(c, 0.46, 0.22, 0.08, 0.14, 0.03); c.fill();
    leafShape(c, 0.54, 0.3, 0.16, 0.07, 1.2, P.leaf);
    shine(c, 0.44, 0.48, 0.03, 0.08);
  };
  ICON.sunflower = c => {
    c.strokeStyle = P.leaf; c.lineWidth = 0.04; c.beginPath(); c.moveTo(0.5, 0.95); c.lineTo(0.5, 0.6); c.stroke();
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; c.save(); c.translate(0.5, 0.45); c.rotate(a); ell(c, 0, -0.24, 0.06, 0.13); c.fillStyle = i % 2 ? P.gold : '#F7C548'; c.fill(); c.strokeStyle = rgba(P.ink, 0.3); c.lineWidth = 0.01; c.stroke(); c.restore(); }
    ell(c, 0.5, 0.45, 0.15, 0.15); c.fillStyle = rad(c, 0.47, 0.42, 0.01, 0.16, [[0, '#7A4E33'], [1, '#4A2E1F']]); c.fill(); outline(c);
    c.fillStyle = rgba(P.gold, 0.5); for (let i = 0; i < 16; i++) { const a = i * 2.4, r = Math.sqrt(i / 16) * 0.12; ell(c, 0.5 + Math.cos(a) * r, 0.45 + Math.sin(a) * r, 0.01, 0.01); c.fill(); }
  };
  ICON.garlic = c => {
    c.beginPath(); c.moveTo(0.5, 0.15); c.quadraticCurveTo(0.55, 0.3, 0.68, 0.42); c.bezierCurveTo(0.9, 0.58, 0.8, 0.88, 0.5, 0.88); c.bezierCurveTo(0.2, 0.88, 0.1, 0.58, 0.32, 0.42); c.quadraticCurveTo(0.45, 0.3, 0.5, 0.15);
    c.fillStyle = rad(c, 0.42, 0.55, 0.02, 0.4, [[0, '#FFFDF6'], [1, '#E3D3C0']]); c.fill(); outline(c);
    c.strokeStyle = rgba(P.plum, 0.35); c.lineWidth = 0.015; [[0.36, 0.5], [0.5, 0.45], [0.64, 0.5]].forEach(([x, y]) => { c.beginPath(); c.moveTo(0.5, 0.3); c.quadraticCurveTo(x, y, 0.5 + (x - 0.5) * 0.6, 0.86); c.stroke(); });
    c.strokeStyle = P.soilL; c.lineWidth = 0.012; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0.5 + i * 0.03, 0.88); c.lineTo(0.5 + i * 0.05, 0.94); c.stroke(); }
  };
  ICON.apple = c => {
    c.beginPath(); c.moveTo(0.5, 0.34); c.bezierCurveTo(0.7, 0.22, 0.92, 0.4, 0.82, 0.66); c.bezierCurveTo(0.74, 0.88, 0.58, 0.9, 0.5, 0.84); c.bezierCurveTo(0.42, 0.9, 0.26, 0.88, 0.18, 0.66); c.bezierCurveTo(0.08, 0.4, 0.3, 0.22, 0.5, 0.34);
    c.fillStyle = rad(c, 0.38, 0.45, 0.03, 0.45, [[0, '#E8574A'], [0.7, P.red], [1, '#962C22']]); c.fill(); outline(c);
    c.strokeStyle = P.soilD; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0.5, 0.36); c.quadraticCurveTo(0.5, 0.22, 0.56, 0.14); c.stroke();
    leafShape(c, 0.53, 0.24, 0.18, 0.07, 1.1, P.leafL);
    shine(c, 0.33, 0.5, 0.06, 0.035);
  };
  function jug(c, body, label, cap) {
    c.beginPath(); c.moveTo(0.36, 0.3); c.lineTo(0.36, 0.22); c.lineTo(0.5, 0.22); c.lineTo(0.5, 0.3); c.quadraticCurveTo(0.78, 0.34, 0.78, 0.55); c.lineTo(0.78, 0.84); c.quadraticCurveTo(0.78, 0.9, 0.72, 0.9); c.lineTo(0.26, 0.9); c.quadraticCurveTo(0.2, 0.9, 0.2, 0.84); c.lineTo(0.2, 0.5); c.quadraticCurveTo(0.2, 0.32, 0.36, 0.3);
    c.fillStyle = body; c.fill(); outline(c);
    c.beginPath(); c.moveTo(0.56, 0.32); c.quadraticCurveTo(0.74, 0.18, 0.76, 0.44); c.strokeStyle = rgba(P.ink, 0.55); c.lineWidth = 0.045; c.stroke(); c.strokeStyle = body; c.lineWidth = 0.025; c.stroke();
    c.fillStyle = cap; rr(c, 0.34, 0.16, 0.18, 0.08, 0.02); c.fill(); outline(c, 0.015);
    if (label) label(c);
  }
  ICON.maple = c => jug(c, lin(c, 0, 0.3, 0, 0.9, [[0, P.cream], [1, '#EADBB8']]), c => {
    c.fillStyle = lin(c, 0, 0.55, 0, 0.9, [[0, '#D78A2A'], [1, '#9C5A18']]); rr(c, 0.2, 0.58, 0.58, 0.32, 0.04); c.fill();
    c.fillStyle = P.red; c.beginPath(); const x = 0.49, y = 0.7, r = 0.09; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.62; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.lineTo(x + Math.cos(a + 0.31) * r * 0.45, y + Math.sin(a + 0.31) * r * 0.45); } c.lineTo(x, y + r * 0.8); c.closePath(); c.fill();
  }, P.red);
  ICON.cider = c => {
    ell(c, 0.5, 0.64, 0.28, 0.27); c.fillStyle = rad(c, 0.42, 0.56, 0.02, 0.32, [[0, '#C88443'], [1, '#7A4318']]); c.fill(); outline(c);
    c.fillStyle = '#8A5A3B'; rr(c, 0.42, 0.2, 0.16, 0.2, 0.03); c.fill(); outline(c, 0.015);
    c.fillStyle = P.crust; rr(c, 0.43, 0.14, 0.14, 0.08, 0.02); c.fill();
    c.beginPath(); c.arc(0.7, 0.5, 0.1, -1.4, 1.2); c.strokeStyle = '#7A4318'; c.lineWidth = 0.04; c.stroke();
    c.fillStyle = P.cream; rr(c, 0.34, 0.6, 0.32, 0.14, 0.02); c.fill(); ICON._apple_mini(c, 0.5, 0.67, 0.045);
    shine(c, 0.36, 0.52, 0.05, 0.08, 0.35);
  };
  ICON._apple_mini = (c, x, y, r) => { ell(c, x, y, r, r * 0.9); c.fillStyle = P.red; c.fill(); };
  ICON.egg = c => {
    c.beginPath(); c.moveTo(0.5, 0.14); c.bezierCurveTo(0.78, 0.14, 0.82, 0.62, 0.78, 0.7); c.bezierCurveTo(0.72, 0.9, 0.28, 0.9, 0.22, 0.7); c.bezierCurveTo(0.18, 0.62, 0.22, 0.14, 0.5, 0.14);
    c.fillStyle = rad(c, 0.42, 0.4, 0.02, 0.45, [[0, '#FFF8EC'], [1, '#E8CFAE']]); c.fill(); outline(c);
    shine(c, 0.4, 0.36, 0.06, 0.09, 0.6);
  };
  ICON.milk = c => {
    c.beginPath(); c.moveTo(0.4, 0.26); c.lineTo(0.4, 0.34); c.quadraticCurveTo(0.26, 0.44, 0.26, 0.56); c.lineTo(0.26, 0.86); c.quadraticCurveTo(0.26, 0.92, 0.32, 0.92); c.lineTo(0.68, 0.92); c.quadraticCurveTo(0.74, 0.92, 0.74, 0.86); c.lineTo(0.74, 0.56); c.quadraticCurveTo(0.74, 0.44, 0.6, 0.34); c.lineTo(0.6, 0.26); c.closePath();
    c.fillStyle = lin(c, 0.26, 0, 0.74, 0, [[0, '#F4F1EA'], [0.4, P.milk], [1, '#DCD6CA']]); c.fill(); outline(c);
    c.fillStyle = P.lake; rr(c, 0.37, 0.14, 0.26, 0.12, 0.03); c.fill(); outline(c, 0.015);
    c.fillStyle = rgba(P.lake, 0.85); rr(c, 0.26, 0.6, 0.48, 0.14, 0.01); c.fill();
    shine(c, 0.33, 0.66, 0.025, 0.1, 0.5);
  };
  ICON.honey = c => {
    c.beginPath(); c.moveTo(0.26, 0.36); c.quadraticCurveTo(0.2, 0.62, 0.26, 0.84); c.quadraticCurveTo(0.5, 0.94, 0.74, 0.84); c.quadraticCurveTo(0.8, 0.62, 0.74, 0.36); c.closePath();
    c.fillStyle = lin(c, 0, 0.36, 0, 0.9, [[0, '#F6BE3C'], [1, '#C77A1E']]); c.fill(); outline(c);
    c.fillStyle = P.plum; rr(c, 0.22, 0.24, 0.56, 0.14, 0.04); c.fill(); outline(c, 0.015);
    c.fillStyle = P.cream; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.lineTo(0.5 + Math.cos(a) * 0.1, 0.62 + Math.sin(a) * 0.1); } c.closePath(); c.fill();
    c.fillStyle = P.gold; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.lineTo(0.5 + Math.cos(a) * 0.06, 0.62 + Math.sin(a) * 0.06); } c.closePath(); c.fill();
    shine(c, 0.33, 0.5, 0.03, 0.1, 0.4);
  };
  ICON.bread = c => {
    c.beginPath(); c.moveTo(0.12, 0.72); c.quadraticCurveTo(0.08, 0.38, 0.5, 0.34); c.quadraticCurveTo(0.92, 0.38, 0.88, 0.72); c.quadraticCurveTo(0.5, 0.82, 0.12, 0.72);
    c.fillStyle = rad(c, 0.45, 0.45, 0.04, 0.5, [[0, '#E6A65C'], [1, '#A8622A']]); c.fill(); outline(c);
    c.strokeStyle = '#F3D29A'; c.lineWidth = 0.035; [0.32, 0.5, 0.68].forEach(x => { c.beginPath(); c.moveTo(x - 0.06, 0.48); c.quadraticCurveTo(x, 0.42, x + 0.07, 0.46); c.stroke(); });
    shine(c, 0.32, 0.45, 0.08, 0.03, 0.3);
  };
  ICON.cornbread = c => {
    c.fillStyle = '#8A8F96'; rr(c, 0.12, 0.42, 0.76, 0.42, 0.05); c.fill(); outline(c);
    c.fillStyle = lin(c, 0, 0.3, 0, 0.6, [[0, '#F4C65A'], [1, '#D9962C']]); rr(c, 0.16, 0.3, 0.68, 0.36, 0.04); c.fill(); outline(c, 0.016);
    c.strokeStyle = rgba(P.amber, 0.6); c.lineWidth = 0.014; c.beginPath(); c.moveTo(0.38, 0.32); c.lineTo(0.38, 0.65); c.moveTo(0.62, 0.32); c.lineTo(0.62, 0.65); c.moveTo(0.17, 0.48); c.lineTo(0.83, 0.48); c.stroke();
    c.fillStyle = '#FFE38A'; rr(c, 0.43, 0.36, 0.14, 0.09, 0.02); c.fill();
  };
  ICON.donut = c => {
    ell(c, 0.5, 0.55, 0.36, 0.33); c.fillStyle = rad(c, 0.45, 0.48, 0.05, 0.4, [[0, '#C98A4A'], [1, '#8A4E24']]); c.fill(); outline(c);
    ell(c, 0.5, 0.53, 0.11, 0.1); c.fillStyle = P.paper; c.fill(); outline(c, 0.015);
    c.fillStyle = 'rgba(255,248,230,.85)'; for (let i = 0; i < 26; i++) { const a = i * 2.39, r = 0.17 + (i * 37 % 13) / 13 * 0.14; ell(c, 0.5 + Math.cos(a) * r, 0.55 + Math.sin(a) * r * 0.92, 0.011, 0.011); c.fill(); }
  };
  ICON.pie = c => {
    c.beginPath(); c.moveTo(0.14, 0.72); c.lineTo(0.86, 0.72); c.lineTo(0.5, 0.24); c.closePath(); c.fillStyle = lin(c, 0, 0.24, 0, 0.72, [[0, '#E98A35'], [1, '#C8642A']]); c.fill(); outline(c);
    c.fillStyle = P.crust; rr(c, 0.1, 0.7, 0.8, 0.12, 0.04); c.fill(); outline(c, 0.016);
    c.fillStyle = P.cream; ell(c, 0.5, 0.5, 0.08, 0.05); c.fill();
  };
  ICON.switchel = c => {
    c.beginPath(); c.moveTo(0.3, 0.3); c.lineTo(0.3, 0.86); c.quadraticCurveTo(0.3, 0.92, 0.36, 0.92); c.lineTo(0.64, 0.92); c.quadraticCurveTo(0.7, 0.92, 0.7, 0.86); c.lineTo(0.7, 0.3); c.closePath();
    c.fillStyle = lin(c, 0, 0.3, 0, 0.92, [[0, '#F0D27A'], [1, '#C79A35']]); c.fill(); outline(c);
    c.fillStyle = '#B9BEC3'; rr(c, 0.27, 0.2, 0.46, 0.12, 0.03); c.fill(); outline(c, 0.015);
    ell(c, 0.5, 0.62, 0.11, 0.11); c.fillStyle = '#F4E58A'; c.fill(); c.strokeStyle = '#E2C640'; c.lineWidth = 0.02; c.stroke();
    c.strokeStyle = rgba(P.ink, 0.25); c.lineWidth = 0.01; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.beginPath(); c.moveTo(0.5, 0.62); c.lineTo(0.5 + Math.cos(a) * 0.1, 0.62 + Math.sin(a) * 0.1); c.stroke(); }
    leafShape(c, 0.62, 0.82, 0.14, 0.05, 0.6, P.leafL);
  };
  ICON.butter = c => {
    c.fillStyle = P.cream; c.beginPath(); c.moveTo(0.08, 0.66); c.lineTo(0.5, 0.86); c.lineTo(0.92, 0.66); c.lineTo(0.5, 0.5); c.closePath(); c.fill(); outline(c, 0.016);
    c.beginPath(); c.moveTo(0.2, 0.56); c.lineTo(0.5, 0.7); c.lineTo(0.5, 0.5); c.lineTo(0.2, 0.38); c.closePath(); c.fillStyle = '#F2CF5B'; c.fill(); outline(c, 0.016);
    c.beginPath(); c.moveTo(0.5, 0.7); c.lineTo(0.8, 0.56); c.lineTo(0.8, 0.38); c.lineTo(0.5, 0.5); c.closePath(); c.fillStyle = '#E3B83E'; c.fill(); outline(c, 0.016);
    c.beginPath(); c.moveTo(0.2, 0.38); c.lineTo(0.5, 0.5); c.lineTo(0.8, 0.38); c.lineTo(0.5, 0.26); c.closePath(); c.fillStyle = '#FBE38A'; c.fill(); outline(c, 0.016);
  };
  function wedge(c, body, rind, holes) {
    // a classic triangular wedge: top face, cut face and a rind end, so it reads as cheese at 24 px
    const tip = [0.08, 0.6], bk = [0.8, 0.26], fr = [0.92, 0.46], frB = [0.92, 0.78], tipB = [0.08, 0.84], bkB = [0.8, 0.58];
    const poly = (pts, fill, w) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = fill; c.fill(); outline(c, w || 0.018); };
    poly([bk, fr, frB, bkB], rind);
    poly([tip, fr, frB, tipB], mix(body, '#2B2420', 0.12));
    poly([tip, bk, fr], body);
    if (holes) holes(c);
  }
  ICON.cheddar = c => { wedge(c, '#F6B83E', '#D98A22'); shine(c, 0.52, 0.44, 0.1, 0.022, 0.4); };
  ICON.aged = c => { wedge(c, '#F1D38A', '#2B2420'); c.fillStyle = P.red; ell(c, 0.5, 0.68, 0.075, 0.075); c.fill(); c.fillStyle = P.gold; ell(c, 0.5, 0.68, 0.03, 0.03); c.fill(); };
  function jar(c, fill, lid, extra) {
    c.beginPath(); c.moveTo(0.26, 0.34); c.quadraticCurveTo(0.2, 0.6, 0.24, 0.84); c.quadraticCurveTo(0.5, 0.94, 0.76, 0.84); c.quadraticCurveTo(0.8, 0.6, 0.74, 0.34); c.closePath();
    c.fillStyle = fill; c.fill(); outline(c);
    lid(c);
    if (extra) extra(c);
    shine(c, 0.33, 0.56, 0.03, 0.12, 0.35);
  }
  ICON.salsa = c => jar(c, lin(c, 0, 0.34, 0, 0.9, [[0, '#E2543C'], [1, '#A83224']]), c => { c.fillStyle = P.leaf; rr(c, 0.22, 0.22, 0.56, 0.14, 0.04); c.fill(); outline(c, 0.015); }, c => {
    c.fillStyle = '#F4D06A'; [[0.4, 0.6], [0.6, 0.7], [0.5, 0.78]].forEach(([x, y]) => { ell(c, x, y, 0.03, 0.025); c.fill(); }); c.fillStyle = P.leafL; [[0.58, 0.55], [0.38, 0.74]].forEach(([x, y]) => { ell(c, x, y, 0.025, 0.02); c.fill(); });
  });
  ICON.jam = c => jar(c, lin(c, 0, 0.34, 0, 0.9, [[0, '#D2364C'], [1, '#8E1E34']]), c => {
    c.beginPath(); c.moveTo(0.16, 0.34); c.lineTo(0.84, 0.34); c.lineTo(0.76, 0.18); c.lineTo(0.24, 0.18); c.closePath(); c.fillStyle = P.cream; c.fill(); outline(c, 0.015);
    c.fillStyle = rgba(P.red, 0.75); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) { c.fillRect(0.26 + i * 0.12, 0.2 + j * 0.065, 0.11, 0.06); }
  }, c => { c.fillStyle = P.cream; rr(c, 0.34, 0.56, 0.32, 0.16, 0.02); c.fill(); ell(c, 0.5, 0.64, 0.05, 0.05); c.fillStyle = P.red; c.fill(); });
  ICON.kettle = c => {
    c.beginPath(); c.moveTo(0.24, 0.42); c.lineTo(0.3, 0.9); c.lineTo(0.7, 0.9); c.lineTo(0.76, 0.42); c.closePath(); c.fillStyle = P.paper; c.fill(); outline(c);
    c.fillStyle = P.red; c.beginPath(); c.moveTo(0.26, 0.56); c.lineTo(0.74, 0.56); c.lineTo(0.72, 0.68); c.lineTo(0.28, 0.68); c.closePath(); c.fill();
    const pts = [[0.32, 0.36], [0.46, 0.3], [0.6, 0.34], [0.7, 0.4], [0.4, 0.42], [0.54, 0.24], [0.28, 0.44], [0.64, 0.46]];
    pts.forEach(([x, y], i) => { ell(c, x, y, 0.07, 0.06); c.fillStyle = i % 3 === 0 ? '#F3D07A' : P.cream; c.fill(); c.strokeStyle = rgba(P.ink, 0.35); c.lineWidth = 0.01; c.stroke(); });
  };
  ICON.granola = c => {
    c.beginPath(); c.moveTo(0.1, 0.52); c.quadraticCurveTo(0.14, 0.88, 0.5, 0.88); c.quadraticCurveTo(0.86, 0.88, 0.9, 0.52); c.closePath(); c.fillStyle = lin(c, 0, 0.5, 0, 0.9, [[0, P.lake], [1, '#1F5F6B']]); c.fill(); outline(c);
    const pts = [[0.24, 0.48], [0.36, 0.42], [0.5, 0.4], [0.64, 0.42], [0.76, 0.48], [0.3, 0.52], [0.44, 0.5], [0.58, 0.5], [0.7, 0.53]];
    pts.forEach(([x, y], i) => { rr(c, x - 0.05, y - 0.04, 0.1, 0.08, 0.03); c.fillStyle = ['#C9894A', '#E2B75A', '#A8622A'][i % 3]; c.fill(); c.strokeStyle = rgba(P.ink, 0.3); c.lineWidth = 0.01; c.stroke(); });
    c.fillStyle = P.gold; ell(c, 0.5, 0.36, 0.06, 0.03); c.fill();
  };
  function creemee(c, swirl, swirlD, drip) {
    c.beginPath(); c.moveTo(0.32, 0.5); c.lineTo(0.5, 0.94); c.lineTo(0.68, 0.5); c.closePath(); c.fillStyle = lin(c, 0.32, 0, 0.68, 0, [[0, '#D99A52'], [1, '#B8763A']]); c.fill(); outline(c);
    c.strokeStyle = rgba(P.ink, 0.25); c.lineWidth = 0.012; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0.34 + i * 0.06, 0.52); c.lineTo(0.48 + i * 0.03, 0.86); c.stroke(); c.beginPath(); c.moveTo(0.66 - i * 0.06, 0.52); c.lineTo(0.52 - i * 0.03, 0.86); c.stroke(); }
    [[0.5, 0.48, 0.22, 0.08], [0.5, 0.38, 0.17, 0.08], [0.5, 0.28, 0.12, 0.07]].forEach(([x, y, rx, ry], i) => { ell(c, x, y, rx, ry); c.fillStyle = i % 2 ? swirlD : swirl; c.fill(); outline(c, 0.016); });
    c.beginPath(); c.moveTo(0.46, 0.22); c.quadraticCurveTo(0.5, 0.12, 0.56, 0.18); c.strokeStyle = swirl; c.lineWidth = 0.05; c.stroke();
    if (drip) drip(c);
  }
  ICON.mcreemee = c => creemee(c, '#F1D9A8', '#E2BC78', c => { c.fillStyle = P.amber; ell(c, 0.42, 0.42, 0.04, 0.025); c.fill(); rr(c, 0.4, 0.42, 0.03, 0.08, 0.015); c.fill(); });
  ICON.bcreemee = c => creemee(c, '#F4B6C2', '#E8899E', c => { c.fillStyle = P.red; ell(c, 0.6, 0.26, 0.05, 0.045); c.fill(); });

  const iconCache = {}, iconURL = {};
  function icon(g, px) {
    px = px || 128;
    const key = g + '@' + px; if (iconCache[key]) return iconCache[key];
    if (ASSETS['good_' + g]) { const c = mk(px, px); c.getContext('2d').drawImage(ASSETS['good_' + g], 0, 0, px, px); return iconCache[key] = c; }
    const fn = ICON[g] || (c => { ell(c, 0.5, 0.5, 0.3, 0.3); c.fillStyle = P.gold; c.fill(); });
    return iconCache[key] = unit(px, fn);
  }
  function iconSrc(g) { if (!iconURL[g]) iconURL[g] = icon(g, 96).toDataURL(); return iconURL[g]; }

  // ---------------------------------------------------------------- plants on a bed (3 growth stages + ripe)
  const plantCache = {};
  function plant(crop, stage, px) {
    const key = crop + stage + '@' + px; if (plantCache[key]) return plantCache[key];
    const a = asset('plant_' + crop + '_' + stage, px); if (a) return plantCache[key] = a;
    const c = mk(px, px), x = c.getContext('2d');
    x.save(); x.scale(px, px); x.lineCap = 'round'; x.lineJoin = 'round';
    // soft oval shadow
    ell(x, 0.5, 0.78, 0.26, 0.07); x.fillStyle = 'rgba(30,18,10,.28)'; x.fill();
    const tall = { wheat: 1, corn: 1, sunflower: 1 }[crop];
    if (stage === 0) {
      leafShape(x, 0.5, 0.78, 0.18, 0.07, -0.6, P.leafL); leafShape(x, 0.5, 0.78, 0.18, 0.07, 0.6, P.leafL);
    } else if (stage === 1) {
      if (tall) { x.strokeStyle = P.leaf; x.lineWidth = 0.03; [-0.12, 0, 0.12].forEach(o => { x.beginPath(); x.moveTo(0.5 + o, 0.78); x.quadraticCurveTo(0.5 + o * 1.4, 0.6, 0.5 + o * 1.6, 0.42); x.stroke(); }); leafShape(x, 0.5, 0.74, 0.22, 0.07, -0.7, P.leaf); leafShape(x, 0.5, 0.74, 0.22, 0.07, 0.7, P.leafL); }
      else { [-0.9, -0.3, 0.3, 0.9].forEach((a, i) => leafShape(x, 0.5, 0.78, 0.26, 0.09, a, i % 2 ? P.leaf : P.leafL)); }
    } else {
      // ripe: foliage plus the produce on show
      if (crop === 'wheat') {
        x.strokeStyle = P.wheat; x.lineWidth = 0.022;
        for (let i = -3; i <= 3; i++) { const bx = 0.5 + i * 0.07, top = 0.2 + Math.abs(i) * 0.03; x.beginPath(); x.moveTo(bx, 0.8); x.quadraticCurveTo(bx + i * 0.01, 0.5, bx + i * 0.02, top + 0.1); x.stroke(); for (let k = 0; k < 4; k++) { ell(x, bx + i * 0.02 - 0.02, top + 0.06 + k * 0.05, 0.02, 0.035, -0.4); x.fillStyle = k % 2 ? P.gold : P.wheat; x.fill(); ell(x, bx + i * 0.02 + 0.02, top + 0.08 + k * 0.05, 0.02, 0.035, 0.4); x.fill(); } }
      } else if (crop === 'corn') {
        x.strokeStyle = P.leaf; x.lineWidth = 0.04; x.beginPath(); x.moveTo(0.5, 0.8); x.lineTo(0.5, 0.12); x.stroke();
        leafShape(x, 0.5, 0.62, 0.32, 0.07, -1.0, P.leafL); leafShape(x, 0.5, 0.5, 0.3, 0.07, 1.0, P.leaf); leafShape(x, 0.5, 0.36, 0.24, 0.06, -0.9, P.leaf);
        x.save(); x.translate(0.6, 0.48); x.rotate(0.4); ell(x, 0, 0, 0.07, 0.16); x.fillStyle = '#F7CF4D'; x.fill(); x.strokeStyle = rgba(P.ink, 0.4); x.lineWidth = 0.012; x.stroke(); x.restore();
        x.save(); x.translate(0.38, 0.55); x.rotate(-0.4); ell(x, 0, 0, 0.06, 0.14); x.fillStyle = '#F2C443'; x.fill(); x.stroke(); x.restore();
      } else if (crop === 'sunflower') {
        x.strokeStyle = P.leaf; x.lineWidth = 0.035; x.beginPath(); x.moveTo(0.5, 0.8); x.quadraticCurveTo(0.48, 0.5, 0.5, 0.36); x.stroke();
        leafShape(x, 0.5, 0.66, 0.2, 0.08, -1.1, P.leafL); leafShape(x, 0.49, 0.56, 0.2, 0.08, 1.1, P.leaf);
        x.drawImage(icon('sunflower', 128), 0.18, -0.02, 0.64, 0.64);
      } else {
        [-1.0, -0.4, 0.4, 1.0].forEach((a, i) => leafShape(x, 0.5, 0.78, 0.3, 0.1, a, i % 2 ? P.leaf : P.leafL));
        const ic = icon(crop, 128);
        if (crop === 'pumpkin') x.drawImage(ic, 0.16, 0.26, 0.68, 0.68);
        else if (crop === 'radish' || crop === 'carrot' || crop === 'garlic') { x.drawImage(ic, 0.12, 0.3, 0.5, 0.5); x.drawImage(ic, 0.4, 0.26, 0.5, 0.5); }
        else { x.drawImage(ic, 0.1, 0.32, 0.44, 0.44); x.drawImage(ic, 0.44, 0.22, 0.46, 0.46); x.drawImage(ic, 0.3, 0.42, 0.4, 0.4); }
      }
    }
    x.restore();
    return plantCache[key] = misprint(c, Math.max(1, px / 64), 0.18);
  }

  // ---------------------------------------------------------------- tiles
  const tileCache = {};
  function tile(kind, px, variant) {
    const key = kind + (variant || 0) + '@' + px; if (tileCache[key]) return tileCache[key];
    const a = asset('tile_' + kind, px); if (a) return tileCache[key] = a;
    const c = mk(px, px), x = c.getContext('2d'), r = px * 0.16, m = px * 0.05;
    let seed = (variant || 0) * 977 + 13; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    if (kind === 'bed') {
      rr(x, m, m + px * 0.03, px - 2 * m, px - 2 * m, r); x.fillStyle = 'rgba(43,36,32,.35)'; x.fill();
      rr(x, m, m, px - 2 * m, px - 2 * m, r); x.fillStyle = lin(x, 0, m, 0, px - m, [[0, P.soilL], [1, P.soilD]]); x.fill();
      x.save(); rr(x, m, m, px - 2 * m, px - 2 * m, r); x.clip();
      for (let i = 0; i < 4; i++) { const y = m + (px - 2 * m) * (0.2 + i * 0.2); x.fillStyle = 'rgba(43,25,15,.28)'; rr(x, m + px * 0.08, y, px - 2 * m - px * 0.16, px * 0.05, px * 0.025); x.fill(); x.fillStyle = 'rgba(255,220,180,.10)'; rr(x, m + px * 0.08, y - px * 0.03, px - 2 * m - px * 0.16, px * 0.025, px * 0.012); x.fill(); }
      for (let i = 0; i < 14; i++) { ell(x, m + rnd() * (px - 2 * m), m + rnd() * (px - 2 * m), px * 0.012, px * 0.01); x.fillStyle = rnd() < 0.5 ? 'rgba(255,230,200,.18)' : 'rgba(20,10,5,.25)'; x.fill(); }
      x.restore();
      rr(x, m, m, px - 2 * m, px - 2 * m, r); x.strokeStyle = 'rgba(255,225,190,.22)'; x.lineWidth = px * 0.025; x.stroke();
    } else if (kind === 'sod' || kind === 'plus') {
      // seamless meadow: just tufts and the odd flower, so bought beds are the only shapes on the field
      x.strokeStyle = rgba(P.leaf, 0.32); x.lineWidth = px * 0.018;
      for (let i = 0; i < 7; i++) { const gx = m + rnd() * (px - 2 * m), gy = m * 2 + rnd() * (px - 3 * m); x.beginPath(); x.moveTo(gx - px * 0.03, gy); x.lineTo(gx - px * 0.015, gy - px * 0.05); x.moveTo(gx, gy); x.lineTo(gx + px * 0.005, gy - px * 0.065); x.moveTo(gx + px * 0.03, gy); x.lineTo(gx + px * 0.02, gy - px * 0.045); x.stroke(); }
      if (rnd() < 0.35) { const fx = m * 2 + rnd() * (px - 4 * m), fy = m * 2 + rnd() * (px - 4 * m); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ell(x, fx + Math.cos(a) * px * 0.02, fy + Math.sin(a) * px * 0.02, px * 0.018, px * 0.018); x.fillStyle = P.cream; x.fill(); } ell(x, fx, fy, px * 0.014, px * 0.014); x.fillStyle = P.gold; x.fill(); }
    }
    return tileCache[key] = c;
  }

  // ---------------------------------------------------------------- helpers, trees, animals, buildings
  const objCache = {};
  function cached(key, fn) { if (objCache[key]) return objCache[key]; const keys = Object.keys(objCache); if (keys.length > 120) delete objCache[keys[0]]; return objCache[key] = fn(); }
  function sprinkler(px, t) { return cached('spr@' + px, () => sprinklerRaw(px)); }
  function sprinklerRaw(px) {
    const a = asset('helper_sprinkler', px); if (a) return a;
    const c = mk(px, px), x = c.getContext('2d');
    rr(x, px * 0.08, px * 0.08, px * 0.84, px * 0.84, px * 0.2); x.fillStyle = rgba('#C9DDA2', 0.85); x.fill(); x.strokeStyle = rgba(P.leaf, 0.25); x.lineWidth = px * 0.02; x.stroke();
    ell(x, px * 0.5, px * 0.72, px * 0.18, px * 0.06); x.fillStyle = 'rgba(30,18,10,.3)'; x.fill();
    x.fillStyle = '#8A949C'; rr(x, px * 0.45, px * 0.38, px * 0.1, px * 0.34, px * 0.03); x.fill();
    x.fillStyle = P.lake; ell(x, px * 0.5, px * 0.38, px * 0.14, px * 0.08); x.fill(); x.strokeStyle = rgba(P.ink, 0.5); x.lineWidth = px * 0.02; x.stroke();
    x.fillStyle = '#B9C3CA'; rr(x, px * 0.3, px * 0.3, px * 0.4, px * 0.05, px * 0.02); x.fill();
    return c;
  }
  function hive(px, honey) { return cached('hive' + !!honey + '@' + px, () => hiveRaw(px, honey)); }
  function hiveRaw(px, honey) {
    const a = asset('helper_hive', px); if (a) { if (honey) a.getContext('2d').drawImage(icon('honey', 128), px * 0.48, px * 0.4, px * 0.5, px * 0.5); return a; }
    const c = mk(px, px), x = c.getContext('2d');
    rr(x, px * 0.08, px * 0.08, px * 0.84, px * 0.84, px * 0.2); x.fillStyle = rgba('#C9DDA2', 0.85); x.fill(); x.strokeStyle = rgba(P.leaf, 0.25); x.lineWidth = px * 0.02; x.stroke();
    ell(x, px * 0.5, px * 0.82, px * 0.3, px * 0.07); x.fillStyle = 'rgba(30,18,10,.3)'; x.fill();
    const boxes = [[0.2, 0.52, 0.6, 0.28, P.cream], [0.22, 0.32, 0.56, 0.22, '#F3E2B8']];
    boxes.forEach(([bx, by, bw, bh, col]) => { rr(x, px * bx, px * by, px * bw, px * bh, px * 0.03); x.fillStyle = col; x.fill(); x.strokeStyle = rgba(P.ink, 0.5); x.lineWidth = px * 0.02; x.stroke(); });
    x.fillStyle = P.red; x.beginPath(); x.moveTo(px * 0.14, px * 0.34); x.lineTo(px * 0.5, px * 0.16); x.lineTo(px * 0.86, px * 0.34); x.closePath(); x.fill(); x.strokeStyle = rgba(P.ink, 0.5); x.stroke();
    x.fillStyle = P.ink; rr(x, px * 0.42, px * 0.72, px * 0.16, px * 0.05, px * 0.02); x.fill();
    if (honey) x.drawImage(icon('honey', 128), px * 0.48, px * 0.4, px * 0.5, px * 0.5);
    return misprint(c, Math.max(1, px / 60), 0.12);
  }
  const treeCache = {};
  function tree(kind, ripe, px) {
    const key = kind + ripe + '@' + px; if (treeCache[key]) return treeCache[key];
    const a = asset('tree_' + kind + (ripe ? '_ripe' : ''), px, px * 1.15); if (a) return treeCache[key] = a;
    const c = mk(px, px * 1.15), x = c.getContext('2d'), w = px, h = px * 1.15;
    ell(x, w * 0.5, h * 0.92, w * 0.32, h * 0.05); x.fillStyle = 'rgba(30,18,10,.3)'; x.fill();
    x.fillStyle = lin(x, w * 0.44, 0, w * 0.56, 0, [[0, '#6B4430'], [1, P.soilD]]); rr(x, w * 0.44, h * 0.5, w * 0.12, h * 0.42, w * 0.03); x.fill();
    if (kind === 'apple') {
      [[0.5, 0.36, 0.34], [0.32, 0.46, 0.22], [0.68, 0.46, 0.22], [0.5, 0.22, 0.22]].forEach(([cx, cy, r], i) => { ell(x, w * cx, h * cy, w * r, w * r * 0.85); x.fillStyle = i === 3 ? '#5E9A55' : i % 2 ? P.leaf : '#4C8A50'; x.fill(); });
      ell(x, w * 0.42, h * 0.26, w * 0.12, w * 0.07); x.fillStyle = 'rgba(255,255,255,.12)'; x.fill();
      if (ripe) [[0.34, 0.42], [0.58, 0.3], [0.66, 0.5], [0.46, 0.52], [0.42, 0.24]].forEach(([ax, ay]) => x.drawImage(icon('apple', 64), w * ax - w * 0.08, h * ay - w * 0.08, w * 0.18, w * 0.18));
    } else {
      // sugar maple: rounded crown, warm leaves when ripe, a bucket on the trunk
      [[0.5, 0.34, 0.36], [0.3, 0.44, 0.22], [0.7, 0.44, 0.22], [0.5, 0.18, 0.22]].forEach(([cx, cy, r], i) => { ell(x, w * cx, h * cy, w * r, w * r * 0.82); x.fillStyle = ripe ? ['#D9692A', '#C8452F', '#E2913A', '#E8A33A'][i] : ['#4C8A50', P.leaf, '#5E9A55', '#4C8A50'][i]; x.fill(); });
      x.fillStyle = '#9AA4AC'; rr(x, w * 0.53, h * 0.62, w * 0.12, w * 0.13, w * 0.02); x.fill(); x.strokeStyle = rgba(P.ink, 0.5); x.lineWidth = w * 0.015; x.stroke();
      if (ripe) x.drawImage(icon('maple', 64), w * 0.6, h * 0.58, w * 0.3, w * 0.3);
    }
    return treeCache[key] = misprint(c, Math.max(1, px / 60), 0.18);
  }
  // simple, faceless farm animals (no big eyes)
  // a plump, short-necked hen: round body, tail tuft, head tucked close. peck (0..1) dips the head to the ground.
  function hen(c, x, y, s, col, peck) {
    const k = Math.max(0, Math.min(1, peck || 0)), body = col || P.cream, dark = mix(body, '#2B2420', 0.22);
    c.save(); c.translate(x, y); c.scale(s, s);
    ell(c, 0.02, 0.42, 0.4, 0.09); c.fillStyle = 'rgba(30,18,10,.25)'; c.fill();
    c.strokeStyle = P.gold; c.lineWidth = 0.05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.06, 0.3); c.lineTo(-0.08, 0.44); c.moveTo(0.1, 0.3); c.lineTo(0.12, 0.44); c.stroke();
    // tail tuft
    c.beginPath(); c.moveTo(-0.28, -0.02); c.quadraticCurveTo(-0.5, -0.3, -0.44, -0.04); c.quadraticCurveTo(-0.56, -0.12, -0.42, 0.12); c.closePath();
    c.fillStyle = dark; c.fill(); c.strokeStyle = rgba(P.ink, 0.55); c.lineWidth = 0.035; c.stroke();
    // round body
    ell(c, 0, 0.08, 0.38, 0.27); c.fillStyle = body; c.fill(); c.stroke();
    // wing
    c.beginPath(); c.moveTo(-0.18, 0.02); c.quadraticCurveTo(0.02, -0.04, 0.14, 0.08); c.quadraticCurveTo(0.0, 0.22, -0.18, 0.02);
    c.fillStyle = dark; c.fill();
    // head on a short neck; pecking swings it forward and down
    const hx = 0.27 + k * 0.12, hy = -0.16 + k * 0.42;
    c.save(); c.translate(hx, hy); c.rotate(k * 0.9);
    ell(c, 0, 0, 0.15, 0.14); c.fillStyle = body; c.fill(); c.strokeStyle = rgba(P.ink, 0.55); c.lineWidth = 0.035; c.stroke();
    c.fillStyle = P.red; ell(c, -0.02, -0.15, 0.05, 0.045); c.fill(); ell(c, 0.05, -0.13, 0.04, 0.04); c.fill(); ell(c, 0.07, 0.1, 0.035, 0.05); c.fill();
    c.fillStyle = P.gold; c.beginPath(); c.moveTo(0.13, -0.03); c.lineTo(0.25, 0.01); c.lineTo(0.13, 0.05); c.closePath(); c.fill();
    c.fillStyle = P.ink; ell(c, 0.05, -0.03, 0.022, 0.022); c.fill();
    c.restore();
    c.restore();
  }
  // dip (0..1) lowers the head to graze
  function cow(c, x, y, s, dip) {
    const k = Math.max(0, Math.min(1, dip || 0));
    c.save(); c.translate(x, y); c.scale(s, s);
    ell(c, 0, 0.45, 0.6, 0.1); c.fillStyle = 'rgba(30,18,10,.25)'; c.fill();
    c.strokeStyle = rgba(P.ink, 0.6); c.lineWidth = 0.05;
    [-0.38, -0.22, 0.26, 0.4].forEach(lx => { c.beginPath(); c.moveTo(lx, 0.1); c.lineTo(lx, 0.44); c.stroke(); });
    rr(c, -0.55, -0.25, 1.05, 0.5, 0.2); c.fillStyle = P.milk; c.fill(); c.stroke();
    c.fillStyle = P.ink; ell(c, -0.2, -0.05, 0.16, 0.12, 0.3); c.fill(); ell(c, 0.22, 0.08, 0.1, 0.08); c.fill();
    c.save(); c.translate(0.02 * k, 0.3 * k);
    rr(c, 0.4, -0.45, 0.32, 0.36, 0.12); c.fillStyle = P.milk; c.fill(); c.strokeStyle = rgba(P.ink, 0.6); c.lineWidth = 0.05; c.stroke();
    c.fillStyle = '#E8A9A0'; rr(c, 0.5, -0.2, 0.26, 0.14, 0.06); c.fill();
    c.fillStyle = P.ink; ell(c, 0.5, -0.33, 0.025, 0.025); c.fill();
    c.strokeStyle = P.crust; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0.45, -0.44); c.lineTo(0.4, -0.55); c.moveTo(0.66, -0.44); c.lineTo(0.72, -0.55); c.stroke();
    c.restore();
    const sw = Math.sin((typeof performance !== 'undefined' ? performance.now() : 0) / 380 + x) * 0.08;
    c.strokeStyle = rgba(P.ink, 0.6); c.lineWidth = 0.035; c.beginPath(); c.moveTo(-0.55, -0.15); c.quadraticCurveTo(-0.72 - sw, 0, -0.66 + sw, 0.2); c.stroke();
    c.restore();
  }

  // workshop buildings: front elevations with one window light
  function building(id, w, h, lit) { return cached('b' + id + !!lit + '@' + Math.round(w) + 'x' + Math.round(h), () => buildingRaw(id, w, h, lit)); }
  function buildingRaw(id, w, h, lit) {
    const a = asset('shop_' + id, w, h); if (a) return a;
    const c = mk(w, h), x = c.getContext('2d');
    const base = h * 0.92;
    ell(x, w * 0.5, base, w * 0.42, h * 0.05); x.fillStyle = 'rgba(30,18,10,.25)'; x.fill();
    const wall = { oven: '#D8B98E', press: '#B8763A', creamery: P.milk, kitchen: P.sod, creemee: '#F4B6C2' }[id];
    const roof = { oven: P.red, press: P.leaf, creamery: P.lake, kitchen: P.plum, creemee: P.gold }[id];
    const prop = id !== 'creemee', bw = w * (prop ? 0.64 : 0.7), bx = prop ? w * 0.04 : (w - bw) / 2, by = h * 0.38, bh = base - by;
    // wall
    rr(x, bx, by, bw, bh, w * 0.02); x.fillStyle = lin(x, 0, by, 0, base, [[0, wall], [1, mix(wall, '#2B2420', 0.15)]]); x.fill(); x.strokeStyle = rgba(P.ink, 0.6); x.lineWidth = Math.max(1, w * 0.012); x.stroke();
    if (id === 'press') { x.strokeStyle = rgba(P.ink, 0.25); for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(bx + bw * i / 6, by); x.lineTo(bx + bw * i / 6, base); x.stroke(); } }
    // roof
    x.beginPath();
    if (id === 'creemee') { x.moveTo(bx - w * 0.06, by + h * 0.02); x.lineTo(bx + bw + w * 0.06, by + h * 0.02); x.lineTo(bx + bw + w * 0.02, by - h * 0.12); x.lineTo(bx - w * 0.02, by - h * 0.12); }
    else if (id === 'kitchen') { x.moveTo(bx - w * 0.05, by + h * 0.02); x.lineTo(w * 0.5, by - h * 0.26); x.lineTo(bx + bw + w * 0.05, by + h * 0.02); }
    else { x.moveTo(bx - w * 0.06, by + h * 0.02); x.lineTo(bx + bw * 0.25, by - h * 0.2); x.lineTo(bx + bw * 0.75, by - h * 0.2); x.lineTo(bx + bw + w * 0.06, by + h * 0.02); }
    x.closePath(); x.fillStyle = roof; x.fill(); x.strokeStyle = rgba(P.ink, 0.6); x.stroke();
    if (id === 'creemee') { x.fillStyle = P.cream; for (let i = 0; i < 6; i += 2) x.fillRect(bx - w * 0.02 + (bw + w * 0.04) * i / 6, by - h * 0.12, (bw + w * 0.04) / 6, h * 0.14); x.strokeStyle = rgba(P.ink, 0.6); x.strokeRect(bx - w * 0.02, by - h * 0.12, bw + w * 0.04, h * 0.14); }
    // chimney / details
    if (id === 'oven') { x.fillStyle = '#9A4A35'; x.fillRect(bx + bw * 0.7, by - h * 0.3, bw * 0.12, h * 0.18); x.strokeRect(bx + bw * 0.7, by - h * 0.3, bw * 0.12, h * 0.18); }
    if (id === 'creamery') { x.fillStyle = '#B9C3CA'; rr(x, bx + bw * 0.7, by - h * 0.32, bw * 0.16, h * 0.3, w * 0.03); x.fill(); x.stroke(); }
    // door + window (with light)
    const dw = bw * 0.24, dh = bh * 0.55;
    x.fillStyle = mix(roof, '#2B2420', 0.35); rr(x, bx + bw * 0.14, base - dh, dw, dh, w * 0.02); x.fill();
    const ww = bw * 0.3, wh = bh * 0.32, wx = bx + bw * 0.56, wy = by + bh * 0.22;
    x.fillStyle = lit ? P.gold : '#F3D99A'; rr(x, wx, wy, ww, wh, w * 0.015); x.fill(); x.strokeStyle = rgba(P.ink, 0.55); x.stroke();
    x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.moveTo(wx, wy + wh / 2); x.lineTo(wx + ww, wy + wh / 2); x.stroke();
    if (id === 'kitchen') { x.fillStyle = P.red; for (let i = 0; i < 3; i++) { ell(x, wx + ww * (0.2 + i * 0.3), wy + wh + h * 0.04, w * 0.03, w * 0.025); x.fill(); } }
    if (id === 'creemee') { x.drawImage(icon('mcreemee', 64), bx + bw * 0.12, by - h * 0.36, w * 0.2, w * 0.2); }
    // one prop each, so the five buildings read apart at a glance
    if (id === 'oven') { x.fillStyle = '#B8763A'; x.beginPath(); x.arc(bx + bw + w * 0.15, base, w * 0.13, Math.PI, 0); x.fill(); x.strokeStyle = rgba(P.ink, 0.6); x.stroke(); x.fillStyle = '#3A2418'; x.beginPath(); x.arc(bx + bw + w * 0.15, base, w * 0.06, Math.PI, 0); x.fill(); x.fillStyle = '#F2B233'; x.beginPath(); x.arc(bx + bw + w * 0.15, base, w * 0.03, Math.PI, 0); x.fill(); x.drawImage(icon('bread', 64), bx + bw + w * 0.08, base - w * 0.26, w * 0.14, w * 0.14); }
    if (id === 'press') { const px = bx + bw + w * 0.15, pw = w * 0.17, ph = h * 0.26; x.fillStyle = '#9A5A2A'; rr(x, px - pw / 2, base - ph, pw, ph, w * 0.04); x.fill(); x.strokeStyle = rgba(P.ink, 0.6); x.stroke(); x.strokeStyle = '#4B3020'; x.lineWidth = Math.max(1, w * 0.012); [0.3, 0.7].forEach(k => { x.beginPath(); x.moveTo(px - pw / 2, base - ph * k); x.lineTo(px + pw / 2, base - ph * k); x.stroke(); }); x.drawImage(icon('apple', 64), px - w * 0.06, base - ph - w * 0.1, w * 0.12, w * 0.12); }
    if (id === 'creamery') { const px = bx + bw + w * 0.15, pw = w * 0.12, ph = h * 0.3; x.fillStyle = '#C9CFD4'; rr(x, px - pw / 2, base - ph, pw, ph, w * 0.03); x.fill(); x.strokeStyle = rgba(P.ink, 0.6); x.stroke(); x.fillStyle = '#9AA4AC'; rr(x, px - pw * 0.35, base - ph - h * 0.05, pw * 0.7, h * 0.06, w * 0.015); x.fill(); x.stroke(); }
    if (id === 'kitchen') { const px = bx + bw + w * 0.15; [0, 1].forEach(k => x.drawImage(icon(k ? 'jam' : 'salsa', 64), px - w * 0.07 + k * w * 0.02, base - w * 0.15 - k * w * 0.1, w * 0.13, w * 0.13)); }
    return misprint(c, Math.max(1, w / 90), 0.16);
  }

  // ---------------------------------------------------------------- horizon (lake, Adirondacks, town), day cycle
  function skyTone(hour) {
    // returns {top, bot, lake, tint, tintA, night}
    if (hour >= 20 || hour < 5.5) return { top: '#1F4752', bot: '#2F6B73', lake: '#1F5560', far: '#3E7E86', mtn: '#3E5F6D', tint: '#163A44', tintA: 0.16, night: 1 };
    if (hour >= 17) { const k = Math.min(1, (hour - 17) / 3); return { top: mix('#F7C9A0', '#C77A6A', k * 0.6), bot: mix(P.paper, '#F2B48A', k), lake: mix(P.lake, '#3A6E78', k), far: mix(P.far, '#D99A80', k * 0.6), mtn: mix(P.mtn, '#7A6A88', k), tint: '#E07A2E', tintA: 0.06 + 0.06 * k, night: 0 }; }
    if (hour < 8) { const k = (8 - hour) / 2.5; return { top: mix(P.sky, '#F2C8A8', k), bot: P.paper, lake: P.lake, far: P.far, mtn: mix(P.mtn, '#8A7F9A', k * 0.5), tint: '#F2B233', tintA: 0.04 * k, night: 0 }; }
    return { top: P.sky, bot: P.paper, lake: P.lake, far: P.far, mtn: P.mtn, tint: null, tintA: 0, night: 0 };
  }
  function horizon(w, h, hour, built, festival, noSun) {
    const c = mk(w, h), x = c.getContext('2d'), T = skyTone(hour);
    x.fillStyle = lin(x, 0, 0, 0, h, [[0, T.top], [0.7, T.bot], [1, T.bot]]); x.fillRect(0, 0, w, h);
    if (T.night) { for (let i = 0; i < 40; i++) { const sx = (i * 97.3) % w, sy = (i * 41.7) % (h * 0.45); x.fillStyle = 'rgba(255,248,230,' + (0.3 + (i % 3) * 0.2) + ')'; x.fillRect(sx, sy, 1.5, 1.5); } ell(x, w * 0.82, h * 0.18, Math.min(h * 0.07, w * 0.03), Math.min(h * 0.07, w * 0.03)); x.fillStyle = '#F6EBD3'; x.fill(); }
    else if (!noSun) { const sr = Math.min(h * 0.09, w * 0.035); ell(x, w * 0.8, h * 0.22, sr, sr); x.fillStyle = rgba(P.gold, hour >= 17 ? 0.9 : 0.55); x.fill(); }
    const lakeTop = h * 0.4, lakeBot = h * 0.62;
    // Adirondacks across the lake: layered silhouettes
    const ridge = (y0, amp, col, seed) => { x.beginPath(); x.moveTo(0, lakeTop); for (let i = 0; i <= 24; i++) { const px = w * i / 24; const py = y0 - amp * (0.5 + 0.5 * Math.sin(i * 0.9 + seed) * Math.cos(i * 0.37 + seed * 2)) - (i > 8 && i < 13 ? amp * 0.6 : 0); x.lineTo(px, py); } x.lineTo(w, lakeTop); x.closePath(); x.fillStyle = col; x.fill(); };
    ridge(lakeTop, h * 0.18, mix(T.mtn, T.bot, 0.45), 1.3);
    ridge(lakeTop, h * 0.12, T.mtn, 4.1);
    // lake
    x.fillStyle = lin(x, 0, lakeTop, 0, lakeBot, [[0, T.far], [1, T.lake]]); x.fillRect(0, lakeTop, w, lakeBot - lakeTop);
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1; for (let i = 0; i < 9; i++) { const ly = lakeTop + 4 + i * (lakeBot - lakeTop - 6) / 9; const lx = (i * 53) % (w - 60); x.beginPath(); x.moveTo(lx, ly); x.lineTo(lx + 22 + (i % 3) * 10, ly); x.stroke(); }
    // a little sailboat
    x.fillStyle = T.night ? '#C9C2B0' : P.cream; x.beginPath(); x.moveTo(w * 0.22, lakeTop + 4); x.lineTo(w * 0.22, lakeTop - h * 0.1); x.lineTo(w * 0.26, lakeTop + 2); x.closePath(); x.fill();
    // near shore + meadow
    x.fillStyle = lin(x, 0, lakeBot, 0, h, [[0, mix(P.meadow, '#2B2420', T.night ? 0.45 : 0.05)], [1, mix(P.sod, '#2B2420', T.night ? 0.45 : 0)]]);
    x.beginPath(); x.moveTo(0, lakeBot + 4); x.quadraticCurveTo(w * 0.3, lakeBot - 6, w * 0.6, lakeBot + 2); x.quadraticCurveTo(w * 0.85, lakeBot + 8, w, lakeBot - 2); x.lineTo(w, h); x.lineTo(0, h); x.closePath(); x.fill();
    // town landmarks for finished projects, along the shore (left to right)
    const lm = [
      ['awning', 0.08], ['oven2', 0.2], ['cart', 0.34], ['lantern', 0.48], ['bandstand', 0.62], ['hall', 0.78], ['festival', 0.92],
    ];
    lm.forEach(([id, fx]) => { if (built && built[id]) landmark(x, id, w * fx, lakeBot + 3, Math.min(h * 0.42, w * 0.085), T.night); });
    // string lights after the festival
    if (festival) { x.strokeStyle = rgba(P.ink, 0.5); x.lineWidth = 1; x.beginPath(); x.moveTo(0, h * 0.86); for (let i = 1; i <= 8; i++) x.quadraticCurveTo(w * (i - 0.5) / 8, h * 0.93, w * i / 8, h * 0.86); x.stroke(); for (let i = 0; i < 32; i++) { const lx = w * (i + 0.5) / 32, k = ((i + 0.5) % 4) / 4; const ly = h * 0.86 + Math.sin(k * Math.PI) * h * 0.06; ell(x, lx, ly + 2, 2.2, 2.6); x.fillStyle = [P.gold, P.rose, P.cream, P.gold][i % 4]; x.fill(); } }
    if (T.tint) { x.globalCompositeOperation = 'multiply'; x.fillStyle = rgba(T.tint, T.tintA); x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over'; }
    return c;
  }
  function landmark(x, id, cx, by, s, night) {
    x.save(); x.translate(cx, by); const k = s / 40; x.scale(k, k); x.lineWidth = 1.2; x.strokeStyle = rgba(P.ink, 0.6);
    const lit = night ? P.gold : '#F3D99A';
    if (id === 'awning') { x.fillStyle = '#C9894A'; x.fillRect(-12, -14, 24, 14); x.strokeRect(-12, -14, 24, 14); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? P.cream : P.red; x.fillRect(-14 + i * 7, -20, 7, 6); } x.strokeRect(-14, -20, 28, 6); }
    if (id === 'oven2') { x.fillStyle = '#B8763A'; x.beginPath(); x.arc(0, 0, 13, Math.PI, 0); x.fill(); x.stroke(); x.fillStyle = P.ink; x.beginPath(); x.arc(0, 0, 5, Math.PI, 0); x.fill(); x.fillStyle = '#9A4A35'; x.fillRect(5, -18, 4, 8); }
    if (id === 'cart') { x.fillStyle = P.lake; x.fillRect(-10, -12, 20, 9); x.strokeRect(-10, -12, 20, 9); x.fillStyle = P.gold; x.fillRect(-12, -17, 24, 4); x.strokeStyle = P.ink; [-6, 6].forEach(wx => { x.beginPath(); x.arc(wx, -2, 3.5, 0, 7); x.stroke(); }); }
    if (id === 'lantern') { x.fillStyle = P.soilD; x.fillRect(-1.5, -26, 3, 26); x.fillStyle = lit; rr(x, -4, -32, 8, 8, 2); x.fill(); x.stroke(); if (night) { ell(x, 0, -28, 10, 10); x.fillStyle = rgba(P.gold, 0.25); x.fill(); } x.fillStyle = '#8A5A3B'; x.fillRect(-14, -2, 28, 3); }
    if (id === 'bandstand') { x.fillStyle = P.cream; x.fillRect(-12, -12, 24, 12); x.strokeRect(-12, -12, 24, 12); x.fillStyle = P.leaf; x.beginPath(); x.moveTo(-15, -12); x.lineTo(0, -24); x.lineTo(15, -12); x.closePath(); x.fill(); x.stroke(); x.fillStyle = P.red; x.fillRect(-12, -4, 24, 4); }
    if (id === 'hall') { x.fillStyle = '#D8B98E'; x.fillRect(-16, -16, 32, 16); x.strokeRect(-16, -16, 32, 16); x.fillStyle = P.red; x.beginPath(); x.moveTo(-18, -16); x.lineTo(0, -28); x.lineTo(18, -16); x.closePath(); x.fill(); x.stroke(); x.fillStyle = lit; for (let i = 0; i < 3; i++) x.fillRect(-12 + i * 9, -11, 6, 6); }
    if (id === 'festival') { x.fillStyle = P.cream; x.beginPath(); x.moveTo(-14, 0); x.lineTo(0, -26); x.lineTo(14, 0); x.closePath(); x.fill(); x.stroke(); x.fillStyle = P.red; x.beginPath(); x.moveTo(-5, 0); x.lineTo(0, -26); x.lineTo(5, 0); x.closePath(); x.fill(); x.fillStyle = P.gold; x.beginPath(); x.moveTo(0, -26); x.lineTo(6, -30); x.lineTo(0, -32); x.fill(); }
    x.restore();
  }

  // ---------------------------------------------------------------- customers (Market Day), courier, ghost hand
  function person(x, cx, cy, s, look, mood) {
    const coats = [P.red, P.lake, P.plum, P.leaf, P.gold, P.rose], hats = [P.gold, P.cream, P.red, P.ink, P.lake, P.rose], skins = ['#E9C3A0', '#C99872', '#8E5E3E', '#F1D3B6', '#B07A52', '#6E4A33'];
    const coat = coats[look % 6], skin = skins[(look * 5 + 1) % 6], ink = rgba(P.ink, 0.6);
    x.save(); x.translate(cx, cy); x.scale(s, s); x.lineJoin = 'round'; x.lineCap = 'round';
    ell(x, 0, 1.02, 0.42, 0.07); x.fillStyle = 'rgba(30,18,10,.28)'; x.fill();
    // feet
    x.fillStyle = P.ink; ell(x, -0.13, 0.98, 0.1, 0.05); x.fill(); ell(x, 0.13, 0.98, 0.1, 0.05); x.fill();
    // coat
    x.beginPath(); x.moveTo(-0.3, 0.95); x.quadraticCurveTo(-0.36, 0.34, 0, 0.28); x.quadraticCurveTo(0.36, 0.34, 0.3, 0.95); x.closePath(); x.fillStyle = coat; x.fill(); x.strokeStyle = ink; x.lineWidth = 0.035; x.stroke();
    x.strokeStyle = rgba(P.ink, 0.25); x.beginPath(); x.moveTo(0, 0.36); x.lineTo(0, 0.93); x.stroke();
    // arms holding a basket in front
    x.strokeStyle = coat; x.lineWidth = 0.11; x.beginPath(); x.moveTo(-0.26, 0.42); x.quadraticCurveTo(-0.32, 0.62, -0.12, 0.66); x.moveTo(0.26, 0.42); x.quadraticCurveTo(0.32, 0.62, 0.12, 0.66); x.stroke();
    x.strokeStyle = ink; x.lineWidth = 0.03; x.beginPath(); x.arc(0, 0.62, 0.13, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.fillStyle = '#C9894A'; x.beginPath(); x.moveTo(-0.2, 0.6); x.lineTo(0.2, 0.6); x.lineTo(0.16, 0.8); x.lineTo(-0.16, 0.8); x.closePath(); x.fill(); x.stroke();
    x.strokeStyle = rgba(P.ink, 0.3); x.beginPath(); x.moveTo(-0.17, 0.68); x.lineTo(0.17, 0.68); x.stroke();
    x.fillStyle = skin; ell(x, -0.15, 0.64, 0.05, 0.05); x.fill(); ell(x, 0.15, 0.64, 0.05, 0.05); x.fill();
    // scarf on some
    if (look % 3 === 2) { x.fillStyle = hats[(look + 3) % 6]; rr(x, -0.17, 0.25, 0.34, 0.09, 0.04); x.fill(); x.fillRect(0.06, 0.3, 0.07, 0.18); }
    // head
    ell(x, 0, 0.08, 0.19, 0.21); x.fillStyle = skin; x.fill(); x.strokeStyle = ink; x.lineWidth = 0.035; x.stroke();
    if (look % 3 === 0) { x.fillStyle = hats[look % 6]; x.beginPath(); x.ellipse(0, -0.06, 0.21, 0.12, 0, Math.PI, 0); x.fill(); x.stroke(); rr(x, -0.27, -0.08, 0.54, 0.045, 0.02); x.fill(); }
    else if (look % 3 === 1) { x.fillStyle = hats[look % 6]; x.beginPath(); x.ellipse(0, -0.03, 0.2, 0.16, 0, Math.PI, 0); x.fill(); ell(x, 0, -0.19, 0.055, 0.055); x.fill(); x.fillStyle = rgba(P.cream, 0.6); x.fillRect(-0.2, -0.05, 0.4, 0.035); }
    else { x.fillStyle = [P.ink, '#7A4E33', P.gold][look % 3 === 2 ? (look >> 1) % 3 : 0]; x.beginPath(); x.ellipse(0, -0.01, 0.2, 0.14, 0, Math.PI, 0); x.fill(); }
    x.fillStyle = P.ink;
    if (mood === 'happy') { x.lineWidth = 0.03; x.strokeStyle = P.ink; x.beginPath(); x.arc(0, 0.12, 0.07, 0.2, Math.PI - 0.2); x.stroke(); }
    else if (mood === 'sad') { x.lineWidth = 0.03; x.strokeStyle = P.ink; x.beginPath(); x.arc(0, 0.22, 0.06, Math.PI + 0.4, -0.4); x.stroke(); }
    ell(x, -0.07, 0.05, 0.022, 0.022); x.fill(); ell(x, 0.07, 0.05, 0.022, 0.022); x.fill();
    x.restore();
  }
  function courier(x, cx, cy, s, t) {
    x.save(); x.translate(cx, cy); x.scale(s, s); x.strokeStyle = P.ink; x.lineWidth = 0.05;
    const wheel = (wx) => { x.beginPath(); x.arc(wx, 0, 0.32, 0, 7); x.stroke(); x.save(); x.translate(wx, 0); x.rotate(t * 12); x.beginPath(); x.moveTo(-0.3, 0); x.lineTo(0.3, 0); x.moveTo(0, -0.3); x.lineTo(0, 0.3); x.lineWidth = 0.02; x.stroke(); x.restore(); };
    wheel(-0.55); wheel(0.55);
    x.strokeStyle = P.red; x.lineWidth = 0.07; x.beginPath(); x.moveTo(-0.55, 0); x.lineTo(-0.1, -0.45); x.lineTo(0.4, -0.45); x.lineTo(0.55, 0); x.moveTo(-0.1, -0.45); x.lineTo(0.05, 0); x.lineTo(0.4, -0.45); x.stroke();
    x.fillStyle = '#C9894A'; rr(x, 0.3, -0.85, 0.42, 0.34, 0.04); x.fill(); x.strokeStyle = P.ink; x.lineWidth = 0.03; x.stroke();
    x.strokeStyle = P.lake; x.lineWidth = 0.14; x.beginPath(); x.moveTo(-0.1, -0.55); x.lineTo(0.02, -1.0); x.stroke();
    x.fillStyle = '#E9C3A0'; ell(x, 0.06, -1.18, 0.15, 0.15); x.fill(); x.fillStyle = P.gold; x.beginPath(); x.ellipse(0.06, -1.24, 0.17, 0.12, 0, Math.PI, 0); x.fill();
    x.strokeStyle = '#E9C3A0'; x.lineWidth = 0.06; x.beginPath(); x.moveTo(0.02, -0.9); x.lineTo(0.35, -0.55); x.stroke();
    x.restore();
  }
  function hand(x, cx, cy, s, press) {
    x.save(); x.translate(cx, cy); x.scale(s * (press ? 0.9 : 1), s * (press ? 0.9 : 1)); x.globalAlpha *= 0.88;
    x.beginPath();
    x.moveTo(-0.08, 0); x.lineTo(-0.08, 0.55); x.quadraticCurveTo(-0.3, 0.42, -0.36, 0.55); x.quadraticCurveTo(-0.2, 0.75, -0.1, 0.95); x.lineTo(0.42, 0.95);
    x.quadraticCurveTo(0.52, 0.7, 0.5, 0.5); x.lineTo(0.5, 0.42); x.quadraticCurveTo(0.44, 0.34, 0.37, 0.42); x.quadraticCurveTo(0.33, 0.3, 0.24, 0.38); x.quadraticCurveTo(0.2, 0.28, 0.1, 0.36); x.lineTo(0.1, 0); x.quadraticCurveTo(0.01, -0.1, -0.08, 0);
    x.fillStyle = P.cream; x.fill(); x.strokeStyle = P.ink; x.lineWidth = 0.05; x.stroke();
    if (press) { x.globalAlpha = 0.5; x.beginPath(); x.arc(0.01, -0.02, 0.22, 0, 7); x.strokeStyle = P.gold; x.lineWidth = 0.05; x.stroke(); }
    x.restore();
  }

  // paper grain as a data URL (used by a CSS overlay so the canvases pay nothing)
  function grainURL() {
    const c = mk(256, 256), x = c.getContext('2d'), d = x.createImageData(256, 256);
    let seed = 7; for (let i = 0; i < d.data.length; i += 4) { seed = (seed * 16807) % 2147483647; const v = 150 + (seed % 106); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return c.toDataURL();
  }

  root.ART = { P, ASSETS, mk, rr, ell, lin, rad, mix, rgba, misprint, icon, iconSrc, plant, tile, sprinkler, hive, tree, hen, cow, building, horizon, skyTone, person, courier, hand, grainURL };
})(window);
