/* Intervale Acres sound: every effect is synthesized with WebAudio. Nothing plays before the first tap. */
(function (root) {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  const st = { sound: true, music: false, unlocked: false, log: [], logOn: false, lastAnimal: {}, musicTimer: null, fast: false };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

  function init() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = st.sound ? 1 : 0; sfxBus.connect(master);
      musBus = ctx.createGain(); musBus.gain.value = 0; musBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; return false; }
    return true;
  }
  function unlock() {
    st.unlocked = true;
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (st.music) startMusic();
  }
  const hz = (semi, base) => (base || 440) * Math.pow(2, semi / 12);
  function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f, t, a, peak, d, opts) {
    opts = opts || {};
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + a + d);
    if (opts.detune) o.detune.value = opts.detune;
    env(g, t, a, peak, d);
    let node = o;
    if (opts.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = opts.lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(opts.bus || sfxBus); o.start(t); o.stop(t + a + d + 0.05);
  }
  function noise(t, a, peak, d, type, freq, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.value = freq || 1500; f.Q.value = q || 1;
    env(g, t, a, peak, d); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + a + d + 0.05);
  }

  const SFX = {
    harvest: (p) => { const t = ctx.currentTime, k = Math.min(12, p || 0); tone('triangle', hz(3 + k, 523.25 / 2), t, 0.004, 0.32, 0.16); noise(t, 0.002, 0.12, 0.04, 'highpass', 4000); },
    plant: (p) => { const t = ctx.currentTime, k = PENTA[Math.max(0, 7 - Math.min(7, p || 0))]; tone('sine', hz(k - 12, 220), t, 0.004, 0.32, 0.1, { to: hz(k - 14, 220) }); noise(t, 0.003, 0.08, 0.05, 'lowpass', 600); },
    bed: () => { const t = ctx.currentTime; noise(t, 0.01, 0.35, 0.18, 'bandpass', 900, 0.8); tone('sine', 90, t + 0.05, 0.005, 0.5, 0.18, { to: 50 }); },
    queue: () => { const t = ctx.currentTime; tone('square', 880, t, 0.002, 0.08, 0.04, { lp: 1800 }); tone('sine', 660, t, 0.002, 0.25, 0.06); },
    ready: (k) => { const t = ctx.currentTime; tone('sine', hz([0, 4, 7, 9, 12][k || 0], 880), t, 0.003, 0.14, 0.5); },
    collect: () => { const t = ctx.currentTime; tone('sine', 1567.98, t, 0.002, 0.2, 0.25); tone('sine', 2093, t + 0.05, 0.002, 0.12, 0.3); noise(t, 0.01, 0.08, 0.1, 'highpass', 3000); },
    cluck: () => { if (!throttle('cluck')) return; const t = ctx.currentTime; [0, 0.11].forEach(o => tone('square', 760, t + o, 0.003, 0.06, 0.05, { to: 520, lp: 1600 })); },
    moo: () => { if (!throttle('moo')) return; const t = ctx.currentTime; tone('sawtooth', 150, t, 0.08, 0.1, 0.55, { to: 105, lp: 600 }); },
    deliver: () => { const t = ctx.currentTime; [0, 0.16].forEach(o => { tone('sine', 2637, t + o, 0.002, 0.16, 0.18); tone('sine', 3520, t + o, 0.002, 0.08, 0.12); }); },
    coin: (k) => { const t = ctx.currentTime; tone('triangle', hz(Math.min(12, k || 0), 1318.5), t, 0.002, 0.08, 0.06); },
    rush: () => { const t = ctx.currentTime; SFX.deliver(); [0, 4, 7, 12].forEach((s, i) => tone('triangle', hz(s, 784), t + 0.3 + i * 0.06, 0.003, 0.14, 0.12)); },
    levelup: () => { const t = ctx.currentTime; [0, 4, 7].forEach((s, i) => tone('triangle', hz(s, 523.25), t + i * 0.12, 0.005, 0.24, 0.5)); tone('sine', 2093, t + 0.36, 0.01, 0.06, 0.8); [0, 7, 12, 16].forEach((s, i) => tone('sine', hz(s, 1046.5), t + 0.4 + i * 0.05, 0.003, 0.04, 0.3)); },
    horn: () => { const t = ctx.currentTime; [[0, 196], [0.5, 164.8]].forEach(([o, f]) => { tone('sawtooth', f, t + o, 0.05, 0.12, 0.45, { lp: 700 }); tone('sawtooth', f, t + o, 0.05, 0.12, 0.45, { lp: 700, detune: 12 }); }); },
    csa: () => { const t = ctx.currentTime; noise(t, 0.02, 0.2, 0.15, 'bandpass', 2500, 3); [0, 4, 7, 12].forEach(s => tone('triangle', hz(s, 659.25), t + 0.18, 0.01, 0.12, 0.6)); },
    serve: (k) => { const t = ctx.currentTime, s = Math.min(10, k || 0); tone('square', hz(s, 1046.5), t, 0.002, 0.07, 0.07, { lp: 3500 }); tone('sine', hz(s + 7, 1046.5), t + 0.06, 0.002, 0.14, 0.18); noise(t, 0.001, 0.08, 0.03, 'highpass', 5000); },
    walk: () => { const t = ctx.currentTime; tone('sine', 520, t, 0.02, 0.12, 0.4, { to: 300 }); },
    wrong: () => { const t = ctx.currentTime; tone('sine', 180, t, 0.003, 0.25, 0.08); tone('sine', 160, t + 0.11, 0.003, 0.22, 0.09); },
    mdEnd: () => { const t = ctx.currentTime; [0, 0.32, 0.64].forEach(o => { tone('sine', 880, t + o, 0.002, 0.2, 0.7); tone('sine', 2217, t + o, 0.002, 0.05, 0.4); }); },
    mdStart: () => { const t = ctx.currentTime; tone('sine', 880, t, 0.002, 0.2, 0.6); tone('sine', 1320, t + 0.15, 0.002, 0.14, 0.6); },
    project: () => { const t = ctx.currentTime; [0, 0.16, 0.32].forEach(o => { noise(t + o, 0.001, 0.3, 0.06, 'bandpass', 1800, 2); tone('sine', 300, t + o, 0.001, 0.2, 0.06, { to: 150 }); }); [0, 4, 7, 12].forEach((s, i) => tone('triangle', hz(s, 523.25), t + 0.55 + i * 0.1, 0.005, 0.2, 0.5)); },
    error: () => { const t = ctx.currentTime; [0, 0.1].forEach(o => { tone('sine', 140, t + o, 0.002, 0.3, 0.07); noise(t + o, 0.001, 0.1, 0.03, 'lowpass', 500); }); },
    tap: () => { const t = ctx.currentTime; tone('sine', 1200, t, 0.001, 0.06, 0.03); },
    page: () => { const t = ctx.currentTime; noise(t, 0.005, 0.08, 0.08, 'bandpass', 3000, 2); },
    firework: () => { const t = ctx.currentTime; noise(t, 0.005, 0.3, 0.6, 'lowpass', 800); noise(t + 0.05, 0.005, 0.12, 0.5, 'highpass', 5000); },
    notebook: () => { const t = ctx.currentTime; [0, 7].forEach((s, i) => tone('triangle', hz(s, 784), t + i * 0.08, 0.003, 0.14, 0.25)); },
  };
  function throttle(k) { const n = performance.now(); if (n - (st.lastAnimal[k] || 0) < 3000) return false; st.lastAnimal[k] = n; return true; }

  function play(name, arg) {
    if (!st.unlocked || !st.sound || !SFX[name]) return;
    if (st.logOn) st.log.push(name);
    if (!ctx) return;
    if (ctx.state !== 'running') { ctx.resume().catch(() => {}); }
    try { SFX[name](arg); } catch (e) { /* never break the game for audio */ }
  }

  // ---------------- music: a quiet plucked 4-bar pentatonic loop (84 bpm), brighter at 120 bpm in Market Day
  const PATTERN = [0, 4, 7, 9, 7, 4, 2, 4, 0, 2, 4, 7, 12, 9, 7, 4];
  const BASS = [0, 0, -5, -3];
  let step = 0;
  function startMusic() {
    if (!ctx || st.musicTimer) return;
    musBus.gain.setTargetAtTime(st.music ? 0.32 : 0, ctx.currentTime, 0.5);
    const tickMs = () => 60000 / (st.fast ? 120 : 84) / 2;
    const loop = () => {
      if (!st.music) { st.musicTimer = null; return; }
      const t = ctx.currentTime + 0.02;
      const n = PATTERN[step % 16];
      if (step % 2 === 0 || st.fast) tone('triangle', hz(n, 392), t, 0.004, 0.09, 0.45, { bus: musBus, lp: 2200 });
      if (step % 8 === 0) tone('sine', hz(BASS[(step / 8 | 0) % 4], 98), t, 0.01, 0.16, 1.2, { bus: musBus });
      step++;
      st.musicTimer = setTimeout(loop, tickMs());
    };
    loop();
  }
  function setSound(on) { st.sound = !!on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02); }
  function setMusic(on) {
    st.music = !!on;
    if (!ctx) return;
    musBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.3);
    if (on && st.unlocked) startMusic();
  }
  function setFast(on) { st.fast = !!on; }
  function suspend(on) { if (!ctx) return; try { on ? ctx.suspend() : ctx.resume(); } catch (e) {} }

  root.SND = { play, unlock, setSound, setMusic, setFast, suspend, st, SFX };
})(window);
