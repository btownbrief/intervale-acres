/* Intervale Acres engine: pure state + rules. No DOM, no Date.now(); the caller passes `now` (ms).
   Browser: global IA. Node: module.exports. */
(function (root) {
  'use strict';
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.IA_DATA;
  const { GOODS, CROPS, TREES, TREE_SLOT_LVL, ANIMALS, HELPERS, SHOPS, RECIPES, LEVELS, MAX_LEVEL, CELLAR, PROJECTS, SENDERS, NOTEBOOK, S, M, H } = D;

  const VERSION = 1;
  const COLS = 5, ROWS = 6, NT = COLS * ROWS;
  const START_BEDS = [1, 2, 3, 6, 7, 8];
  const CROP = {}; CROPS.forEach(c => CROP[c.id] = c);
  const RECIPE = {}; RECIPES.forEach(r => RECIPE[r.id] = r);
  const SHOP = {}; SHOPS.forEach(w => SHOP[w.id] = w);
  const SHOP_RECIPES = {}; SHOPS.forEach(w => SHOP_RECIPES[w.id] = RECIPES.filter(r => r.shop === w.id));
  const PRODUCTS = RECIPES.map(r => r.id);

  // ------------------------------------------------------------------ events (drained by the game for juice)
  let EV = [];
  function emit(type, d) { EV.push(Object.assign({ type }, d || {})); if (EV.length > 400) EV.shift(); }
  function drain() { const e = EV; EV = []; return e; }

  // ------------------------------------------------------------------ helpers
  function mulberry(a) { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return [a, ((t ^ t >>> 14) >>> 0) / 4294967296]; }
  function rand(s) { const [a, r] = mulberry(s.rng); s.rng = a; return r; }
  function seeded(seed) { let a = seed | 0; return () => { const [n, r] = mulberry(a); a = n; return r; }; }
  function pickW(rnd, items, wfn) { let tot = 0; const w = items.map(x => { const v = Math.max(0, wfn(x)); tot += v; return v; }); if (tot <= 0) return null; let r = rnd() * tot; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function dayNum(now) { return Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000); }
  function deep(o) { return JSON.parse(JSON.stringify(o)); }
  const val = g => GOODS[g].v;

  function neighbors(i) { const r = Math.floor(i / COLS), c = i % COLS, out = []; if (r > 0) out.push(i - COLS); if (r < ROWS - 1) out.push(i + COLS); if (c > 0) out.push(i - 1); if (c < COLS - 1) out.push(i + 1); return out; }
  function isHelper(t) { return t.kind === 'sprinkler' || t.kind === 'hive'; }
  function adjKind(s, i, kind) { return neighbors(i).some(j => s.tiles[j].kind === kind); }
  function sprinkF(s, i) { return adjKind(s, i, 'sprinkler') ? HELPERS.sprinkler.speed : 1; }
  function bedYield(s, i) { return adjKind(s, i, 'hive') ? HELPERS.hive.yield : 2; }
  function projDone(s, id) { const k = PROJECTS.findIndex(p => p.id === id); return k >= 0 && s.projects[k].done; }

  // ------------------------------------------------------------------ cellar
  function cellarCount(s) { let n = 0; for (const g in s.cellar.items) n += s.cellar.items[g]; return n; }
  function cellarFree(s) { return s.cellar.cap - cellarCount(s); }
  function have(s, g) { return s.cellar.items[g] || 0; }
  function add(s, g, n) {
    s.cellar.items[g] = (s.cellar.items[g] || 0) + n; s.stats.got[g] = (s.stats.got[g] || 0) + n;
    if (!RECIPE[g] && !s.firsts[g]) { s.firsts[g] = 1; if (g !== 'radish') emit('firstGood', { good: g }); }
  }
  function take(s, g, n) { s.cellar.items[g] = (s.cellar.items[g] || 0) - n; if (s.cellar.items[g] <= 0) delete s.cellar.items[g]; }
  function hasAll(s, inp) { for (const g in inp) if (have(s, g) < inp[g]) return false; return true; }

  // ------------------------------------------------------------------ new game
  function newGame(now, seed) {
    const s = {
      v: VERSION, savedAt: now, startedAt: now, rng: (seed == null ? 12345 : seed) >>> 0,
      coins: 10, xp: 0, level: 1, hearts: 0, lifeXP: 0,
      tiles: [], trees: [null, null, null, null].map(() => ({ kind: null, readyAt: 0 })),
      pens: { hens: [], cows: [] },
      shops: {}, cellar: { lvl: 0, cap: CELLAR[0][0], items: {} },
      orders: [{ o: null, at: now + 4500 }], ferry: null,
      csa: { day: -1, slots: [], done: false, streak: 0, lastDay: -99, rain: -99, best: 0 },
      market: { cool: 0, best: 0, lastHeartDay: -1, runs: 0, bestStreak: 0 },
      projects: PROJECTS.map(() => ({ coins: 0, hearts: 0, goods: {}, done: false })),
      farmhand: 0, notebook: 0, firsts: {}, unl: {}, festival: false,
      stats: { harv: {}, plant: {}, made: {}, got: {}, orders: 0, ordersGen: 0, bedsBought: 0, csaSlots: 0, csaBoxes: 0, ferryLoads: 0, ferryBest: 0, coinsEarned: 0, planted: 0 },
      settings: { sound: true, music: false, haptics: true },
      tut: 0,
    };
    for (let i = 0; i < NT; i++) s.tiles.push({ kind: 'sod' });
    START_BEDS.forEach(i => { s.tiles[i] = { kind: 'bed', crop: null }; });
    // tutorial: top row of three ripe radishes
    [1, 2, 3].forEach(i => Object.assign(s.tiles[i], { crop: 'radish', plantedAt: now - 20 * S, readyAt: now, f: 1 }));
    SHOPS.forEach(w => { s.shops[w.id] = { built: false, slots: 2, queue: [], shelf: [] }; });
    s.unl.radish = now - H;
    return s;
  }

  // ------------------------------------------------------------------ unlocks / producible
  function unlocksAt(L) {
    const out = [];
    CROPS.forEach(c => c.lvl === L && out.push({ t: 'crop', id: c.id }));
    RECIPES.forEach(r => r.lvl === L && SHOP[r.shop].lvl !== L && out.push({ t: 'recipe', id: r.id }));
    SHOPS.forEach(w => w.lvl === L && out.push({ t: 'shop', id: w.id }));
    for (const k in ANIMALS) if (ANIMALS[k].lvl === L) out.push({ t: 'animal', id: k });
    for (const k in HELPERS) if (HELPERS[k].lvl === L) out.push({ t: 'helper', id: k });
    for (const k in TREES) if (TREES[k].lvl === L) out.push({ t: 'tree', id: k });
    if (L === 4) out.push({ t: 'feature', id: 'csa' });
    if (L === 5) out.push({ t: 'feature', id: 'market' });
    if (L === 7) out.push({ t: 'feature', id: 'ferry' });
    if (L === 10) out.push({ t: 'feature', id: 'farmhand' });
    if (L === 13) out.push({ t: 'feature', id: 'slot4' });
    PROJECTS.forEach((p, k) => p.lvl === L && out.push({ t: 'project', id: p.id }));
    if (L === 2 || L === 6 || L === 12) out.push({ t: 'feature', id: 'ticket' });
    return out;
  }
  function markUnlocks(s, L, now) {
    CROPS.forEach(c => { if (c.lvl === L && s.unl[c.id] == null) s.unl[c.id] = now; });
    RECIPES.forEach(r => { if (r.lvl === L && s.unl[r.id] == null) s.unl[r.id] = now; });
    for (const k in TREES) if (TREES[k].lvl === L && s.unl[TREES[k].good] == null) s.unl[TREES[k].good] = now;
    for (const k in ANIMALS) if (ANIMALS[k].lvl === L && s.unl[ANIMALS[k].makes] == null) s.unl[ANIMALS[k].makes] = now;
    if (L === HELPERS.hive.lvl && s.unl.honey == null) s.unl.honey = now;
  }
  // goods the player can make right now (owns the means), recursively for recipes
  function producible(s) {
    const P = {};
    CROPS.forEach(c => { if (c.lvl <= s.level) P[c.id] = 1; });
    s.trees.forEach(t => { if (t.kind) P[TREES[t.kind].good] = 1; });
    if (s.pens.hens.length) P.egg = 1;
    if (s.pens.cows.length) P.milk = 1;
    if (s.tiles.some(t => t.kind === 'hive')) P.honey = 1;
    for (let pass = 0; pass < 3; pass++) RECIPES.forEach(r => {
      if (r.lvl <= s.level && s.shops[r.shop].built && Object.keys(r.inp).every(g => P[g])) P[r.id] = 1;
    });
    return P;
  }

  // ------------------------------------------------------------------ XP / levels
  function xpNeed(L) { return L >= MAX_LEVEL ? Infinity : LEVELS[L]; }
  function addXP(s, n, now) {
    n = Math.max(0, Math.round(n)); s.lifeXP += n;
    if (s.level >= MAX_LEVEL) { s.xp += n; return; }
    s.xp += n;
    while (s.level < MAX_LEVEL && s.xp >= xpNeed(s.level)) {
      s.xp -= xpNeed(s.level); s.level++;
      const gift = 25 * s.level; s.coins += gift; s.hearts += 1;
      markUnlocks(s, s.level, now);
      resizeBoard(s, now);
      if (s.level === 7 && !s.ferry) dockFerry(s, now, true);
      emit('levelup', { level: s.level, coins: gift, unlocks: unlocksAt(s.level) });
    }
    if (s.level >= MAX_LEVEL) s.xp = 0;
  }
  function firstMade(s, g, now) {
    if (s.firsts[g]) return;
    s.firsts[g] = now;
    const bonus = Math.ceil(0.1 * (s.level >= MAX_LEVEL ? 1000 : xpNeed(s.level)));
    emit('first', { good: g, xp: bonus });
    addXP(s, bonus, now);
  }

  // ------------------------------------------------------------------ field
  function bedCount(s) { return s.tiles.filter(t => t.kind === 'bed').length; }
  function bedCostN(n) { return Math.round(20 * Math.pow(1.35, n - 7)); }
  function bedCost(s) { return bedCostN(bedCount(s) + 1); }
  function plusTiles(s) { const out = []; for (let i = 0; i < NT; i++) if (s.tiles[i].kind === 'sod' && neighbors(i).some(j => s.tiles[j].kind !== 'sod')) out.push(i); return out; }
  function nextBedTile(s) { const p = plusTiles(s); return p.length ? p[0] : -1; }
  function bedState(s, i, now) { const t = s.tiles[i]; if (t.kind !== 'bed') return t.kind; if (!t.crop) return 'empty'; return now >= t.readyAt ? 'ripe' : 'growing'; }
  // a farm can never lock up: with no coins left, radish seeds are free
  function seedCost(s, crop) { const c = CROP[crop].seed; return crop === 'radish' && s.coins < c ? 0 : c; }
  function growTime(s, crop) { return (s.stats.planted < 6 && crop === 'radish') ? 8 * S : CROP[crop].t; }

  function plant(s, i, crop, now) {
    const t = s.tiles[i], c = CROP[crop];
    if (!t || t.kind !== 'bed' || t.crop) return { ok: false, err: 'busy' };
    if (!c || c.lvl > s.level) return { ok: false, err: 'locked' };
    const cost = seedCost(s, crop);
    if (s.coins < cost) return { ok: false, err: 'coins' };
    s.coins -= cost;
    const f = sprinkF(s, i), dur = growTime(s, crop) * f;
    Object.assign(t, { crop, plantedAt: now, readyAt: now + dur, f });
    s.stats.plant[crop] = (s.stats.plant[crop] || 0) + 1; s.stats.planted++;
    emit('plant', { i, crop });
    return { ok: true };
  }
  function harvest(s, i, now) {
    const t = s.tiles[i];
    if (!t || t.kind !== 'bed' || !t.crop || now < t.readyAt) return { ok: false, err: 'notripe' };
    const y = bedYield(s, i);
    if (cellarFree(s) < y) return { ok: false, err: 'full' };
    const g = t.crop; add(s, g, y);
    s.stats.harv[g] = (s.stats.harv[g] || 0) + y;
    t.crop = null; delete t.plantedAt; delete t.readyAt;
    emit('harvest', { i, good: g, n: y });
    return { ok: true, good: g, n: y };
  }
  function buyBed(s, i, now) {
    if (s.tiles[i].kind !== 'sod' || !plusTiles(s).includes(i)) return { ok: false, err: 'place' };
    const c = bedCost(s); if (s.coins < c) return { ok: false, err: 'coins' };
    s.coins -= c; s.tiles[i] = { kind: 'bed', crop: null }; s.stats.bedsBought++;
    emit('bed', { i, cost: c });
    return { ok: true };
  }
  function helperCount(s, kind) { return s.tiles.filter(t => t.kind === kind).length; }
  function helperCost(s, kind) { const n = helperCount(s, kind); return n < 3 ? HELPERS[kind].costs[n] : Infinity; }
  function placeHelper(s, i, kind, now) {
    const h = HELPERS[kind];
    if (!h || s.level < h.lvl) return { ok: false, err: 'locked' };
    if (helperCount(s, kind) >= 3) return { ok: false, err: 'max' };
    if (s.tiles[i].kind !== 'sod' || !plusTiles(s).includes(i)) return { ok: false, err: 'place' };
    const c = helperCost(s, kind); if (s.coins < c) return { ok: false, err: 'coins' };
    s.coins -= c;
    s.tiles[i] = { kind };
    if (kind === 'hive') s.tiles[i].honeyAt = now + h.honeyT;
    rescale(s, now);
    emit('helper', { i, kind });
    return { ok: true };
  }
  function canMoveHelper(s, from, to) {
    if (from === to) return false;
    const a = s.tiles[from], b = s.tiles[to];
    if (!a || !isHelper(a) || !b) return false;
    if (b.kind === 'bed') return !b.crop;
    if (b.kind !== 'sod') return false;
    return neighbors(to).some(j => j !== from && s.tiles[j].kind !== 'sod');
  }
  function moveHelper(s, from, to, now) {
    if (!canMoveHelper(s, from, to)) return { ok: false, err: 'place' };
    const a = s.tiles[from], b = s.tiles[to];
    s.tiles[to] = a; s.tiles[from] = b.kind === 'bed' ? b : { kind: 'sod' };
    rescale(s, now);
    emit('moved', { from, to });
    return { ok: true };
  }
  // keep growth progress consistent when sprinklers change
  function rescale(s, now) {
    for (let i = 0; i < NT; i++) {
      const t = s.tiles[i];
      if (t.kind !== 'bed' || !t.crop) continue;
      const nf = sprinkF(s, i), of = t.f || 1;
      if (nf === of) continue;
      if (now < t.readyAt) {
        const total = t.readyAt - t.plantedAt, p = total > 0 ? (now - t.plantedAt) / total : 1;
        const rem = (t.readyAt - now) * nf / of;
        t.readyAt = now + rem;
        t.plantedAt = p < 1 ? t.readyAt - rem / (1 - p) : now;
      }
      t.f = nf;
    }
  }
  function honeyReady(s, i, now) { const t = s.tiles[i]; return t.kind === 'hive' && now >= t.honeyAt; }
  function collectHoney(s, i, now) {
    if (!honeyReady(s, i, now)) return { ok: false };
    if (cellarFree(s) < 1) return { ok: false, err: 'full' };
    add(s, 'honey', 1); s.tiles[i].honeyAt = now + HELPERS.hive.honeyT;
    emit('collect', { good: 'honey', n: 1, src: 'hive', i });
    return { ok: true };
  }

  // ------------------------------------------------------------------ trees
  function treeSlotOpen(s, k) { return s.level >= TREE_SLOT_LVL[k]; }
  function buyTree(s, k, kind, now) {
    const T = TREES[kind], t = s.trees[k];
    if (!T || !t || t.kind) return { ok: false, err: 'busy' };
    if (!treeSlotOpen(s, k) || s.level < T.lvl) return { ok: false, err: 'locked' };
    if (s.coins < T.cost) return { ok: false, err: 'coins' };
    s.coins -= T.cost; t.kind = kind; t.readyAt = now + T.first;
    emit('tree', { k, kind });
    return { ok: true };
  }
  function pickTree(s, k, now) {
    const t = s.trees[k]; if (!t || !t.kind || now < t.readyAt) return { ok: false };
    const T = TREES[t.kind]; if (cellarFree(s) < T.yield) return { ok: false, err: 'full' };
    add(s, T.good, T.yield); s.stats.harv[T.good] = (s.stats.harv[T.good] || 0) + T.yield;
    t.readyAt = now + T.every;
    emit('pick', { k, good: T.good, n: T.yield });
    return { ok: true, good: T.good, n: T.yield };
  }

  // ------------------------------------------------------------------ animals
  function animalCost(s, kind) { const n = s.pens[kind].length; return n < 3 ? ANIMALS[kind].costs[n] : Infinity; }
  function buyAnimal(s, kind, now) {
    const A = ANIMALS[kind]; if (s.level < A.lvl) return { ok: false, err: 'locked' };
    if (s.pens[kind].length >= 3) return { ok: false, err: 'max' };
    const c = animalCost(s, kind); if (s.coins < c) return { ok: false, err: 'coins' };
    s.coins -= c; s.pens[kind].push({ readyAt: null });
    emit('animal', { kind });
    return { ok: true };
  }
  function penInfo(s, kind, now) {
    let ready = 0, hungry = 0, busy = 0, next = Infinity;
    s.pens[kind].forEach(a => { if (a.readyAt == null) hungry++; else if (now >= a.readyAt) ready++; else { busy++; next = Math.min(next, a.readyAt); } });
    return { ready, hungry, busy, next, n: s.pens[kind].length };
  }
  function tapPen(s, kind, now) {
    const A = ANIMALS[kind]; let got = 0, fed = 0, full = false;
    s.pens[kind].forEach(a => {
      if (a.readyAt != null && now >= a.readyAt) {
        if (cellarFree(s) >= 1) { add(s, A.makes, 1); a.readyAt = null; got++; } else full = true;
      }
    });
    s.pens[kind].forEach(a => {
      if (a.readyAt == null && have(s, A.eats) >= A.eatN) { take(s, A.eats, A.eatN); a.readyAt = now + A.t; fed++; }
    });
    const hungry = s.pens[kind].filter(a => a.readyAt == null).length;
    if (got) emit('collect', { good: A.makes, n: got, src: kind });
    if (fed) emit('feed', { kind, n: fed });
    return { ok: got > 0 || fed > 0, got, fed, full, hungry };
  }

  // ------------------------------------------------------------------ workshops
  function recipeTime(s, r) { return RECIPE[r].t * (RECIPE[r].shop === 'oven' && projDone(s, 'oven2') ? 0.75 : 1); }
  function slotCost(s, id) {
    const w = s.shops[id], base = SHOP[id].cost;
    if (w.slots === 2) return base * 4;
    if (w.slots === 3) return Math.round(base * 12 * (s.level > 16 ? Math.pow(0.75, s.level - 16) : 1));
    return Infinity;
  }
  function buildShop(s, id, now) {
    const w = s.shops[id], W = SHOP[id];
    if (!w || w.built) return { ok: false, err: 'built' };
    if (s.level < W.lvl) return { ok: false, err: 'locked' };
    if (s.coins < W.cost) return { ok: false, err: 'coins' };
    s.coins -= W.cost; w.built = true; w.builtAt = now;
    emit('build', { shop: id });
    return { ok: true };
  }
  function upgradeShop(s, id) {
    const w = s.shops[id]; if (!w.built) return { ok: false };
    const c = slotCost(s, id); if (!isFinite(c)) return { ok: false, err: 'max' };
    if (w.slots === 3 && s.level < 13) return { ok: false, err: 'locked' };
    if (s.coins < c) return { ok: false, err: 'coins' };
    s.coins -= c; w.slots++;
    emit('upgrade', { shop: id });
    return { ok: true };
  }
  function queueRecipe(s, id, r, now) {
    const w = s.shops[id], R = RECIPE[r];
    if (!w || !w.built || !R || R.shop !== id) return { ok: false, err: 'shop' };
    if (R.lvl > s.level) return { ok: false, err: 'locked' };
    if (w.queue.length >= w.slots) return { ok: false, err: 'slots' };
    if (!hasAll(s, R.inp)) return { ok: false, err: 'inputs' };
    for (const g in R.inp) take(s, g, R.inp[g]);
    // every slot works at once: two slots bake two loaves side by side
    const dur = recipeTime(s, r);
    w.queue.push({ r, startAt: now, doneAt: now + dur });
    emit('queue', { shop: id, r });
    return { ok: true };
  }
  function collectShop(s, id, now) {
    const w = s.shops[id]; let n = 0, full = false; const got = {};
    while (w.shelf.length) {
      if (cellarFree(s) < 1) { full = true; break; }
      const g = w.shelf.shift(); add(s, g, 1); n++; got[g] = (got[g] || 0) + 1;
      s.stats.made[g] = (s.stats.made[g] || 0) + 1;
      firstMade(s, g, now);
    }
    if (n) emit('collect', { shop: id, n, goods: got, src: 'shop' });
    return { ok: n > 0, n, full, got };
  }

  // ------------------------------------------------------------------ orders
  function boardSize(L) { return L >= 12 ? 5 : L >= 6 ? 4 : L >= 2 ? 3 : 1; }
  function resizeBoard(s, now) {
    const n = boardSize(s.level);
    while (s.orders.length < n) s.orders.push({ o: null, at: now + 1500 * s.orders.length });
  }
  function orderEligible(s, now) {
    const P = producible(s), out = [];
    for (const g in P) if (s.unl[g] != null && now - s.unl[g] >= 20 * S) out.push(g);
    if (!out.length) out.push('radish');
    return out;
  }
  // how many of a good an order may ask for, given how fast the player can make it right now
  function qtyCap(s, g) {
    const k = GOODS[g].kind;
    if (k === 'crop') return clamp(Math.floor(bedCount(s) * 1.5), 4, 12);
    if (g === 'egg') return s.pens.hens.length * 2 + 1;
    if (g === 'milk') return s.pens.cows.length * 2;
    if (g === 'apple') return s.trees.filter(t => t.kind === 'apple').length * 4;
    if (g === 'maple') return s.trees.filter(t => t.kind === 'maple').length * 2;
    if (g === 'honey') return helperCount(s, 'hive') * 2;
    if (g === 'bread' && s.level < 5) return 3; // the first session never waits on a 4-loaf ticket
    if (RECIPE[g]) return clamp(Math.round(4 * M / RECIPE[g].t), 1, 4);
    return 12;
  }
  function qtyFor(s, g, target, lo, hi, capMul) {
    let n = Math.round(target / val(g));
    n = Math.min(n, Math.max(lo, Math.round(qtyCap(s, g) * capMul)));
    return clamp(n, lo, hi);
  }
  function genOrder(s, now, k) {
    const st = s.stats;
    st.ordersGen++;
    if (st.ordersGen === 1) return { id: st.ordersGen, sender: 'Old North End potluck', lines: [{ g: 'radish', n: 4 }], coins: 18, xp: 15, rush: 0, golden: false };
    const L = s.level, rnd = () => rand(s);
    let nl = L <= 2 ? 1 : L <= 5 ? (rnd() < 0.5 ? 1 : 2) : (rnd() < 0.35 ? 1 : rnd() < 0.7 ? 2 : 3);
    const elig = orderEligible(s, now);
    const usage = {}; s.orders.forEach(sl => sl.o && sl.o.lines.forEach(l => usage[l.g] = (usage[l.g] || 0) + 1));
    const lines = [];
    const target = 12 * Math.pow(L, 1.5);
    let total = 0;
    for (let n = 0; n < nl; n++) {
      // a workshop good sits on at most one ticket at a time (crops on two), so the board never queues up behind one oven
      const cands = elig.filter(g => !lines.some(l => l.g === g) && (usage[g] || 0) < (RECIPE[g] ? 1 : 2));
      const g = pickW(rnd, cands, x => {
        const unl = s.unl[x] || 0; const newish = CROP[x] ? CROP[x].lvl >= L - 1 : RECIPE[x] ? RECIPE[x].lvl >= L - 1 : false;
        // long crafts and very pricey goods are asked for less often
        let w = newish ? 3 : GOODS[x].kind === 'crop' ? 1 : 2;
        if (val(x) > target * 2) w *= 0.3;
        return w;
      });
      if (!g) break;
      let q = Math.round(target / val(g) * lerp(0.6, 1.4, rnd()));
      q = clamp(q, 1, Math.max(1, Math.min(12, qtyCap(s, g))));
      q = Math.min(q, Math.max(1, s.cellar.cap - total));
      total += q;
      lines.push({ g, n: q });
    }
    if (!lines.length) lines.push({ g: 'radish', n: 3 });
    const value = lines.reduce((a, l) => a + l.n * val(l.g), 0);
    const golden = projDone(s, 'hall') && k === 0;
    const awn = projDone(s, 'awning') ? 1.1 : 1;
    const coins = Math.round(value * (golden ? 3 : 1.5) * awn);
    const xp = Math.ceil(golden ? value / 1.5 : value / 2);
    let rush = 0;
    // Rush only on tickets you could fill inside the 5 minutes (every line in stock or quick to make)
    if (!golden && L >= 4 && !s.orders.some(sl => sl.o && sl.o.rush) && rnd() < 0.25 && lines.every(l => quickLine(s, l.g, l.n - have(s, l.g)))) rush = now + 5 * M;
    const onBoard = s.orders.map(sl => sl.o && sl.o.sender).filter(Boolean);
    const free = SENDERS.filter(x => !onBoard.includes(x));
    const pool = free.length ? free : SENDERS;
    const sender = pool[Math.floor(rnd() * pool.length)];
    return { id: st.ordersGen, sender, lines, coins, xp, rush, golden, value };
  }
  // can `short` more of g be had within about 5 minutes?
  function quickLine(s, g, short) {
    if (short <= 0) return true;
    if (CROP[g]) return growTime(s, g) <= 3 * M && short <= bedCount(s) * 2;
    if (g === 'egg') return s.pens.hens.length > 0 && short <= s.pens.hens.length * 2 && have(s, 'corn') >= short;
    if (g === 'apple') return s.trees.filter(t => t.kind === 'apple').length * 3 >= short;
    const R = RECIPE[g];
    if (R && s.shops[R.shop].built && recipeTime(s, g) * Math.ceil(short / Math.max(1, s.shops[R.shop].slots)) <= 4 * M) { for (const i in R.inp) if (have(s, i) < R.inp[i] * short) return false; return true; }
    return false;
  }
  function orderMet(s, o) { return o.lines.every(l => have(s, l.g) >= l.n); }
  function deliver(s, k, now) {
    const sl = s.orders[k]; if (!sl || !sl.o) return { ok: false };
    const o = sl.o; if (!orderMet(s, o)) return { ok: false, err: 'short' };
    o.lines.forEach(l => take(s, l.g, l.n));
    const rushOn = o.rush && now <= o.rush;
    const coins = Math.round(o.coins * (rushOn ? 1.5 : 1));
    s.coins += coins; s.stats.coinsEarned += coins; s.stats.orders++;
    sl.o = null;
    sl.at = now + (projDone(s, 'cart') ? 0 : s.stats.orders <= 10 ? 5 * S : 20 * S);
    if (s.pin === o.id) s.pin = null;
    emit('deliver', { k, coins, xp: o.xp, rush: !!rushOn, golden: o.golden });
    addXP(s, o.xp, now);
    return { ok: true, coins, xp: o.xp, rush: !!rushOn };
  }
  function trashOrder(s, k, now) {
    const sl = s.orders[k]; if (!sl || !sl.o) return { ok: false };
    if (s.pin === sl.o.id) s.pin = null;
    sl.o = null; sl.at = now + (projDone(s, 'cart') ? 30 * S : 2 * M);
    emit('trash', { k });
    return { ok: true };
  }

  // ------------------------------------------------------------------ ferry (L7)
  function dockFerry(s, now, first) {
    const L = s.level, rnd = () => rand(s);
    const gentle = !!first;
    const P = Object.keys(producible(s)).filter(g => s.unl[g] != null);
    const crops = P.filter(g => GOODS[g].kind === 'crop');
    const pool = gentle ? crops : P;
    const goods = [];
    const c0 = crops[Math.floor(rnd() * crops.length)] || 'radish'; goods.push(c0);
    while (goods.length < 3) {
      const cand = pool.filter(g => !goods.includes(g));
      if (!cand.length) break;
      goods.push(pickW(rnd, cand, g => GOODS[g].kind === 'crop' ? 1 : 1.5));
    }
    const target = 30 * Math.pow(L, 1.5);
    const crates = goods.map(g => {
      let n = qtyFor(s, g, target * lerp(0.8, 1.2, rnd()), 2, 20, 2);
      if (gentle) n = Math.max(2, Math.round(n / 2));
      n = Math.min(n, Math.max(2, Math.floor(s.cellar.cap * 0.5)));
      return { g, n, done: false };
    });
    s.ferry = { here: true, crates, backAt: 0, loads: s.ferry ? s.ferry.loads : 0, paid: 0 };
    emit('ferryIn', {});
  }
  function fillCrate(s, k, now) {
    const f = s.ferry; if (!f || !f.here) return { ok: false };
    const c = f.crates[k]; if (!c || c.done) return { ok: false };
    if (have(s, c.g) < c.n) return { ok: false, err: 'short' };
    take(s, c.g, c.n); c.done = true; s.stats.crates = (s.stats.crates || 0) + 1;
    const coins = Math.round(2 * val(c.g) * c.n);
    s.coins += coins; s.stats.coinsEarned += coins; f.paid += coins;
    emit('crate', { k, coins });
    addXP(s, Math.ceil(val(c.g) * c.n / 3), now);
    if (f.crates.every(x => x.done)) {
      const bonus = Math.round(f.paid * 0.5), h = projDone(s, 'lantern') ? 2 : 1;
      s.coins += bonus; s.hearts += h; s.stats.coinsEarned += bonus;
      s.stats.ferryLoads++; s.stats.ferryBest = Math.max(s.stats.ferryBest, bonus);
      f.loads++; f.here = false; f.backAt = now + (projDone(s, 'lantern') ? H : 2 * H);
      emit('ferryFull', { bonus, hearts: h });
      return { ok: true, coins, full: true, bonus, hearts: h };
    }
    return { ok: true, coins };
  }
  function sendFerry(s, now) {
    const f = s.ferry; if (!f || !f.here) return { ok: false };
    f.here = false; f.backAt = now + (projDone(s, 'lantern') ? H : 2 * H);
    emit('ferryOut', {});
    return { ok: true };
  }

  // ------------------------------------------------------------------ CSA box (L4, daily)
  function csaEnsure(s, now) {
    if (s.level < 4) return;
    const d = dayNum(now);
    if (d <= s.csa.day) return; // only ever moves forward (clock-back safe)
    const rnd = seeded(d * 7919 + s.level * 31 + 17);
    const P = Object.keys(producible(s)).filter(g => s.unl[g] != null);
    const pool = P.slice().sort();
    const slots = [];
    while (slots.length < 4 && pool.length) {
      const i = Math.floor(rnd() * pool.length), g = pool.splice(i, 1)[0];
      const n = qtyFor(s, g, 16 * Math.pow(s.level, 1.5), 2, 8, 1.5);
      slots.push({ g, n, done: false });
    }
    s.csa.day = d; s.csa.slots = slots; s.csa.done = false; s.csa.level = s.level;
    emit('csaNew', {});
  }
  function csaStreakNow(s, now) {
    const d = dayNum(now), c = s.csa;
    if (c.lastDay >= d - 1) return c.streak;
    if (c.lastDay === d - 2 && d - 1 - c.rain >= 7) return c.streak; // rain check still available
    return 0;
  }
  function fillCsa(s, k, now) {
    const c = s.csa, sl = c.slots[k];
    if (!sl || sl.done || c.done) return { ok: false };
    if (have(s, sl.g) < sl.n) return { ok: false, err: 'short' };
    take(s, sl.g, sl.n); sl.done = true; s.stats.csaSlots++;
    emit('csaSlot', { k });
    if (c.slots.every(x => x.done)) {
      c.done = true;
      const d = dayNum(now);
      if (d > c.lastDay) {
        if (c.lastDay === d - 1) c.streak++;
        else if (c.lastDay === d - 2 && d - 1 - c.rain >= 7) { c.streak++; c.rain = d - 1; }
        else c.streak = 1;
        c.lastDay = d;
      }
      c.best = Math.max(c.best || 0, c.streak);
      const value = c.slots.reduce((a, x) => a + x.n * val(x.g), 0);
      const coins = Math.round(3 * value), h = c.streak >= 7 ? 3 : c.streak >= 3 ? 2 : 1;
      s.coins += coins; s.hearts += h; s.stats.csaBoxes++; s.stats.coinsEarned += coins;
      emit('csaDone', { coins, hearts: h, streak: c.streak });
      addXP(s, Math.ceil(value / 2), now);
      return { ok: true, done: true, coins, hearts: h };
    }
    return { ok: true };
  }

  // ------------------------------------------------------------------ Market Day (L5): the skill mode
  // spawn gap start/end (s), patience start/end (s). From Level 8 customers sometimes come in pairs.
  const MD = { need: 12, dur: 60, spots: 3, cool: 30 * M, ramp: [1.3, 0.7, 2.6, 1.5], rampT: 25, cap: 30, pairLvl: 8 };
  // goods held back from the stall by default: what tickets, ferry crates, today's CSA box and the current town project need
  function mdAvail(s, g, incl, res) { const h = have(s, g); return incl ? h : Math.max(0, h - ((res || reserved(s))[g] || 0)); }
  function mdKept(s) { const r = reserved(s); let n = 0; for (const g in s.cellar.items) n += Math.min(have(s, g), r[g] || 0); return n; }
  function mdCap(s) { return MD.cap + (projDone(s, 'bandstand') ? 6 : 0); }
  function mdShelf(s, incl) {
    const r = reserved(s);
    const gs = Object.keys(s.cellar.items).filter(g => mdAvail(s, g, incl, r) > 0);
    gs.sort((a, b) => mdAvail(s, b, incl, r) * val(b) - mdAvail(s, a, incl, r) * val(a));
    return gs.slice(0, 6);
  }
  // what actually goes on the stall: available counts, trimmed (largest first) to the stall's capacity
  function mdLoad(s, goods, incl) {
    const r = reserved(s);
    const shelf = goods.map(g => ({ g, n: mdAvail(s, g, incl, r) })).filter(x => x.n > 0).slice(0, 6);
    let tot = shelf.reduce((a, x) => a + x.n, 0); const cap = mdCap(s);
    while (tot > cap) { let big = shelf[0]; shelf.forEach(x => { if (x.n > big.n) big = x; }); big.n--; tot--; }
    return shelf;
  }
  function mdStock(s, incl) { const r = reserved(s); let n = 0; for (const g in s.cellar.items) n += mdAvail(s, g, incl, r); return Math.min(n, mdCap(s)); }
  function mdCanOpen(s, now, incl) {
    if (s.level < 5) return { ok: false, err: 'locked' };
    if (now < s.market.cool) return { ok: false, err: 'cool', left: s.market.cool - now };
    if (mdStock(s, incl) < MD.need) return { ok: false, err: 'stock' };
    return { ok: true };
  }
  function mdStart(s, now, shelfGoods, incl) {
    const shelf = mdLoad(s, shelfGoods || mdShelf(s, incl), incl);
    const total = shelf.reduce((a, x) => a + x.n, 0);
    if (s.level < 5 || total < MD.need) return null;
    const first = s.market.runs === 0;
    return {
      t: 0, dur: MD.dur + (projDone(s, 'bandstand') ? 15 : 0), shelf, cust: [null, null, null],
      nextSpawn: 0.6, streak: 0, best: 0, served: 0, take: 0, tips: 0, xp: 0, walked: 0, wrong: 0, base: 0,
      first, over: false, soldOut: false, seed: (s.rng ^ 0x9e3779b9) >>> 0, cid: 0, tipsOn: projDone(s, 'bandstand'), level: s.level,
    };
  }
  function mdRand(run) { const [a, r] = mulberry(run.seed); run.seed = a; return r; }
  function mdRamp(run) {
    const T = (typeof globalThis !== 'undefined' && globalThis.__RAMPT) || MD.rampT;
    const k = clamp((run.first ? run.t - 20 : run.t) / T, 0, 1);
    const R = (typeof globalThis !== 'undefined' && globalThis.__RAMP) || MD.ramp;
    let gap = lerp(R[0], R[1], k), pat = lerp(R[2], R[3], k);
    if (run.first && run.t < 20) { gap = 2.2; pat = 7; }
    return { gap, pat };
  }
  function mdDemand(run) { const d = {}; run.cust.forEach(c => { if (c && c.state !== 'leave' && c.state !== 'happy') d[c.g] = (d[c.g] || 0) + 1; }); return d; }
  function mdPickGood(run, except) {
    const dem = mdDemand(run);
    const cands = run.shelf.filter(x => x.n - (dem[x.g] || 0) > 0 && x.g !== except);
    const pool = cands.length ? cands : run.shelf.filter(x => x.n > 0);
    if (!pool.length) return null;
    // prefer goods nobody is already asking for, so the shelf is used across the board
    const x = pickW(() => mdRand(run), pool, x => (dem[x.g] ? 0.35 : 1) * (0.6 + Math.min(x.n, 8) / 8));
    return x.g;
  }
  function mdStep(run, dt) {
    if (run.over) return [];
    const ev = [];
    run.t += dt;
    const R = mdRamp(run);
    // customers
    run.cust.forEach((c, k) => {
      if (!c) return;
      c.a += dt;
      if (c.state === 'walk' || c.state === 'wait') {
        // their good sold out: swap the bubble and refill patience
        const sh = run.shelf.find(x => x.g === c.g);
        if (!sh || sh.n <= 0) { const g = mdPickGood(run, c.g); if (g) { c.g = g; c.pat = c.patMax; ev.push({ type: 'swap', k }); } }
      }
      if (c.state === 'walk' && c.a >= 0.45) { c.state = 'wait'; c.a = 0; }
      else if (c.state === 'wait') {
        c.pat -= dt;
        if (c.pat <= 0) { c.state = 'leave'; c.a = 0; run.streak = 0; run.walked++; ev.push({ type: 'walk', k }); }
      } else if ((c.state === 'leave' || c.state === 'happy') && c.a >= 0.5) run.cust[k] = null;
    });
    // spawn
    if (run.t >= run.nextSpawn && run.t < run.dur - 0.8) {
      const free = []; run.cust.forEach((c, k) => { if (!c) free.push(k); });
      if (free.length) {
        const pair = free.length >= 2 && !run.first && (run.level || 0) >= MD.pairLvl && run.t > 8 && mdRand(run) < 0.3;
        for (let j = 0; j < (pair ? 2 : 1); j++) {
          const g = mdPickGood(run); if (!g) break;
          const fi = Math.floor(mdRand(run) * free.length), k = free.splice(fi, 1)[0];
          run.cust[k] = { id: ++run.cid, g, pat: R.pat, patMax: R.pat, state: 'walk', a: 0, look: Math.floor(mdRand(run) * 6) };
          ev.push({ type: 'spawn', k });
        }
        run.nextSpawn = run.t + R.gap * (pair ? 1.6 : 1) * lerp(0.85, 1.15, mdRand(run));
      }
    }
    if (run.t >= run.dur) { run.t = run.dur; run.over = true; ev.push({ type: 'end' }); }
    return ev;
  }
  function mdServe(s, run, idx) {
    if (run.over) return { ok: false };
    const sh = run.shelf[idx]; if (!sh || sh.n <= 0) return { ok: false, err: 'empty' };
    let best = -1, bp = Infinity;
    run.cust.forEach((c, k) => { if (c && (c.state === 'wait' || c.state === 'walk') && c.g === sh.g && c.pat < bp) { bp = c.pat; best = k; } });
    if (best < 0) { run.streak = 0; run.wrong++; return { ok: false, err: 'nobody' }; }
    sh.n--; take(s, sh.g, 1);
    run.streak++; run.best = Math.max(run.best, run.streak);
    const mult = mdMult(run.streak);
    const pay = Math.round(val(sh.g) * mult); run.base += val(sh.g);
    let tip = 0; if (run.tipsOn && run.streak % 5 === 0) tip = val(sh.g);
    run.take += pay + tip; run.tips += tip; run.served++; run.xp += val(sh.g) / 10;
    s.coins += pay + tip; s.stats.coinsEarned += pay + tip;
    const c = run.cust[best]; c.state = 'happy'; c.a = 0;
    if (run.shelf.every(x => x.n <= 0)) { run.over = true; run.soldOut = true; }
    return { ok: true, k: best, pay, tip, mult, streak: run.streak };
  }
  // pay multiplier: x1.0 on the first serve of a streak, +0.05 each, x2.0 from the 21st
  function mdMult(streak) { return 1 + 0.05 * Math.min(Math.max(0, streak - 1), 20); }
  // hearts reward accuracy, not volume: 12 served = 1, best streak 15 = 2, no walk-aways with 20+ served = 3
  const MDH = { one: 12, streak: 15, clean: 20 };
  function mdHearts(run) {
    if (run.served < MDH.one) return 0;
    if (run.served >= MDH.clean && run.walked === 0) return 3;
    return run.best >= MDH.streak ? 2 : 1;
  }
  function mdEnd(s, run, now) {
    let bonus = 0; if (run.soldOut) { bonus = Math.round(run.take * 0.1); s.coins += bonus; s.stats.coinsEarned += bonus; }
    const d = dayNum(now);
    let h = mdHearts(run); const dbl = h > 0 && d > s.market.lastHeartDay;
    if (dbl) { h *= 2; s.market.lastHeartDay = d; }
    s.hearts += h;
    const total = run.take + bonus;
    const isBest = total > s.market.best;
    s.market.best = Math.max(s.market.best, total); s.market.bestStreak = Math.max(s.market.bestStreak, run.best);
    s.market.runs++; s.market.cool = now + MD.cool;
    const xpCap = Math.ceil(0.4 * (s.level >= MAX_LEVEL ? 3000 : xpNeed(s.level)));
    const res = { take: total, bonus, served: run.served, best: run.best, walked: run.walked, hearts: h, raw: mdHearts(run), doubled: dbl, isBest, xp: Math.min(xpCap, Math.ceil(run.xp)) };
    emit('mdEnd', res);
    addXP(s, res.xp, now);
    return res;
  }

  // ------------------------------------------------------------------ town projects
  function projVisible(s, k) { return s.level >= PROJECTS[k].lvl; }
  function projNeeds(s, k) {
    const P = PROJECTS[k], p = s.projects[k], out = [];
    if (P.coins) out.push({ what: 'coins', need: P.coins, got: p.coins });
    out.push({ what: 'hearts', need: P.hearts, got: p.hearts });
    for (const g in P.goods) out.push({ what: g, need: P.goods[g], got: p.goods[g] || 0 });
    if (P.feast) out.push({ what: 'feast', need: P.feast, got: feastCount(p) });
    return out;
  }
  function feastCount(p) { return Object.keys(p.feast || {}).filter(g => p.feast[g] >= 3).length; }
  function projReady(s, k) { return projNeeds(s, k).every(n => n.got >= n.need); }
  function donate(s, k, what, now) {
    const P = PROJECTS[k], p = s.projects[k];
    if (!P || p.done || !projVisible(s, k)) return { ok: false };
    // projects are built in order
    if (k > 0 && !s.projects[k - 1].done) return { ok: false, err: 'order' };
    let n = 0;
    if (what === 'coins') { n = Math.min(P.coins - p.coins, s.coins); s.coins -= n; p.coins += n; }
    else if (what === 'hearts') { n = Math.min(P.hearts - p.hearts, s.hearts); s.hearts -= n; p.hearts += n; }
    else if (what === 'feast') {
      if (!P.feast) return { ok: false };
      p.feast = p.feast || {};
      for (const g of PRODUCTS) {
        if (feastCount(p) >= P.feast) break;
        const got = p.feast[g] || 0; if (got >= 3) continue;
        const give = Math.min(3 - got, have(s, g));
        if (got + give >= 3) { take(s, g, give); p.feast[g] = got + give; n += give; }
      }
    } else if (P.goods[what] != null) { n = Math.min(P.goods[what] - (p.goods[what] || 0), have(s, what)); if (n > 0) { take(s, what, n); p.goods[what] = (p.goods[what] || 0) + n; } }
    if (n <= 0) return { ok: false, err: 'none' };
    emit('donate', { k, what, n });
    if (projReady(s, k)) {
      p.done = true; p.doneAt = now;
      emit('project', { k, id: P.id });
      if (P.id === 'festival') { s.festival = true; emit('festival', {}); }
      if (P.id === 'hall') s.orders.forEach((sl, i) => { if (i === 0 && sl.o) { sl.o = null; sl.at = now; } });
    }
    return { ok: true, n };
  }

  // ------------------------------------------------------------------ cellar actions
  function cellarUpCost(s) { const n = s.cellar.lvl + 1; return n < CELLAR.length ? CELLAR[n][1] : Infinity; }
  function upgradeCellar(s) {
    const c = cellarUpCost(s); if (!isFinite(c)) return { ok: false, err: 'max' };
    if (s.coins < c) return { ok: false, err: 'coins' };
    s.coins -= c; s.cellar.lvl++; s.cellar.cap = CELLAR[s.cellar.lvl][0];
    emit('cellarUp', { cap: s.cellar.cap });
    return { ok: true };
  }
  function sell(s, g, n) {
    n = Math.min(n, have(s, g)); if (n <= 0) return { ok: false };
    take(s, g, n); const c = Math.round(0.5 * val(g) * n); s.coins += c;
    emit('sell', { good: g, n, coins: c });
    return { ok: true, coins: c };
  }
  // goods promised elsewhere: open tickets, ferry crates, today's CSA box, the current town project
  function reserved(s) {
    const w = {}; const addW = (g, n) => { if (n > 0) w[g] = (w[g] || 0) + n; };
    s.orders.forEach(sl => sl.o && sl.o.lines.forEach(l => addW(l.g, l.n)));
    if (s.ferry && s.ferry.here) s.ferry.crates.forEach(c => !c.done && addW(c.g, c.n));
    if (!s.csa.done) s.csa.slots.forEach(c => !c.done && addW(c.g, c.n));
    const k = s.projects.findIndex(p => !p.done); if (k >= 0) for (const g in PROJECTS[k].goods) addW(g, PROJECTS[k].goods[g] - (s.projects[k].goods[g] || 0));
    return w;
  }
  function wanted(s) {
    const w = reserved(s); const addW = (g, n) => w[g] = (w[g] || 0) + n;
    RECIPES.forEach(r => { if (s.shops[r.shop].built && r.lvl <= s.level) for (const g in r.inp) addW(g, r.inp[g] * 2); });
    for (const kk in ANIMALS) addW(ANIMALS[kk].eats, ANIMALS[kk].eatN * s.pens[kk].length * 2);
    return w;
  }
  function extras(s) { const w = wanted(s), out = {}; let n = 0, coins = 0; for (const g in s.cellar.items) { const x = have(s, g) - Math.max(4, w[g] || 0); if (x > 0) { out[g] = x; n += x; coins += Math.round(0.5 * val(g) * x); } } return { goods: out, n, coins }; }
  function sellExtras(s) { const e = extras(s); if (!e.n) return { ok: false }; for (const g in e.goods) take(s, g, e.goods[g]); s.coins += e.coins; emit('sell', { n: e.n, coins: e.coins }); return { ok: true, n: e.n, coins: e.coins }; }
  function hireFarmhand(s) {
    if (s.farmhand === 0) { if (s.level < 10 || s.coins < 3000) return { ok: false }; s.coins -= 3000; s.farmhand = 1; }
    else if (s.farmhand === 1) { if (s.level < 14 || s.coins < 15000) return { ok: false }; s.coins -= 15000; s.farmhand = 2; }
    else return { ok: false };
    emit('farmhand', { lvl: s.farmhand });
    return { ok: true };
  }

  // ------------------------------------------------------------------ tick (cheap; call every frame)
  function tick(s, now) {
    for (const id in s.shops) {
      const w = s.shops[id];
      if (w.queue.length && w.queue.some(q => q.doneAt <= now)) {
        const done = w.queue.filter(q => q.doneAt <= now).sort((a, b) => a.doneAt - b.doneAt);
        w.queue = w.queue.filter(q => q.doneAt > now);
        done.forEach(it => { w.shelf.push(it.r); emit('ready', { shop: id, r: it.r }); });
      }
    }
    resizeBoard(s, now);
    s.orders.forEach((sl, k) => {
      if (!sl.o && now >= sl.at) { sl.o = genOrder(s, now, k); emit('order', { k }); }
      if (sl.o && sl.o.rush && now > sl.o.rush) sl.o.rush = 0;
    });
    if (s.level >= 7 && !s.ferry) dockFerry(s, now, true);
    if (s.ferry && !s.ferry.here && now >= s.ferry.backAt) dockFerry(s, now, false);
    csaEnsure(s, now);
  }
  function nbCond(s, id) {
    const st = s.stats;
    switch (id) {
      case 'pick6': return (st.harv.radish || 0) >= 6;
      case 'order1': return st.orders >= 1;
      case 'plantWheat': return (st.plant.wheat || 0) >= 1;
      case 'oven': return s.shops.oven.built;
      case 'bread2': return (st.made.bread || 0) >= 2;
      case 'orders3': return st.orders >= 3;
      case 'beds2': return st.bedsBought >= 2;
      case 'hen': return s.pens.hens.length >= 1;
      case 'egg': return (st.got.egg || 0) >= 1;
      case 'cornbread': return (st.made.cornbread || 0) >= 1;
      case 'csa': return st.csaSlots >= 1;
      case 'tree': return s.trees.some(t => t.kind === 'apple');
      case 'sprinkler': return s.tiles.some((t, i) => t.kind === 'sprinkler' && neighbors(i).filter(j => s.tiles[j].kind === 'bed').length >= 3);
      case 'market': return s.market.runs >= 1;
      case 'awning': return s.projects[0].done;
      case 'cider': return (st.made.cider || 0) >= 1;
      case 'cow': return s.pens.cows.length >= 1;
      case 'butter': return (st.made.butter || 0) >= 1;
      case 'crate': return (st.crates || 0) >= 1;
      case 'hive': return helperCount(s, 'hive') >= 1;
      case 'csaBox': return st.csaBoxes >= 1;
      case 'kitchen': return s.shops.kitchen.built;
      case 'oven2': return s.projects[1].done;
      case 'maple': return s.trees.some(t => t.kind === 'maple');
      case 'creemee': return (st.made.mcreemee || 0) >= 1;
    }
    return false;
  }
  function nbProgress(s) {
    const id = NOTEBOOK[s.notebook] && NOTEBOOK[s.notebook].id, st = s.stats;
    switch (id) {
      case 'pick6': return [Math.min(6, st.harv.radish || 0), 6];
      case 'bread2': return [Math.min(2, st.made.bread || 0), 2];
      case 'orders3': return [Math.min(3, st.orders), 3];
      case 'beds2': return [Math.min(2, st.bedsBought), 2];
    }
    return null;
  }
  function notebookCheck(s, now) {
    let n = 0;
    while (s.notebook < NOTEBOOK.length && nbCond(s, NOTEBOOK[s.notebook].id) && n < 3) {
      const step = NOTEBOOK[s.notebook]; s.notebook++; s.coins += step.gift; n++;
      emit('notebook', { step: s.notebook - 1, gift: step.gift, done: s.notebook >= NOTEBOOK.length });
    }
  }

  // ------------------------------------------------------------------ away / offline
  function clampTimers(s, now) {
    s.tiles.forEach(t => {
      if (t.kind === 'bed' && t.crop && t.readyAt - now > CROP[t.crop].t) { t.readyAt = now + CROP[t.crop].t * (t.f || 1); t.plantedAt = now; }
      if (t.kind === 'hive' && t.honeyAt - now > HELPERS.hive.honeyT) t.honeyAt = now + HELPERS.hive.honeyT;
    });
    s.trees.forEach(t => { if (t.kind && t.readyAt - now > TREES[t.kind].every) t.readyAt = now + TREES[t.kind].every; });
    for (const k in s.pens) s.pens[k].forEach(a => { if (a.readyAt != null && a.readyAt - now > ANIMALS[k].t) a.readyAt = now + ANIMALS[k].t; });
    for (const id in s.shops) s.shops[id].queue.forEach(q => { const dur = recipeTime(s, q.r); if (q.doneAt - now > dur) { q.startAt = now; q.doneAt = now + dur; } });
    if (s.ferry && !s.ferry.here && s.ferry.backAt - now > 2 * H) s.ferry.backAt = now + 2 * H;
    if (s.market.cool - now > MD.cool) s.market.cool = now + MD.cool;
    s.orders.forEach(sl => { if (!sl.o && sl.at - now > 2 * M) sl.at = now + 2 * M; if (sl.o && sl.o.rush && sl.o.rush - now > 5 * M) sl.o.rush = now + 5 * M; });
  }
  function catchUp(s, now) {
    const from = s.savedAt || now;
    const rep = { away: 0, ripe: 0, made: {}, animals: {}, hand: {}, handN: 0, ferry: false, csa: false, trees: 0, honey: 0 };
    if (now < from) { clampTimers(s, now); s.savedAt = now; return rep; }
    const away = now - from; rep.away = away;
    // natural timers: count what finished while away
    s.tiles.forEach(t => { if (t.kind === 'bed' && t.crop && t.readyAt > from && t.readyAt <= now) { rep.ripe++; rep.ripeCrop = t.crop; } if (t.kind === 'hive' && t.honeyAt > from && t.honeyAt <= now) rep.honey++; });
    s.trees.forEach(t => { if (t.kind && t.readyAt > from && t.readyAt <= now) rep.trees++; });
    for (const id in s.shops) s.shops[id].queue.forEach(q => { if (q.doneAt <= now) rep.made[q.r] = (rep.made[q.r] || 0) + 1; });
    for (const k in s.pens) s.pens[k].forEach(a => { if (a.readyAt != null && a.readyAt > from && a.readyAt <= now) rep.animals[ANIMALS[k].makes] = (rep.animals[ANIMALS[k].makes] || 0) + 1; });
    if (s.ferry && !s.ferry.here && s.ferry.backAt > from && s.ferry.backAt <= now) rep.ferry = true;
    if (s.level >= 4 && dayNum(now) > s.csa.day) rep.csa = true;
    tick(s, now); // shops move to shelves, ferry docks, CSA box rolls
    if (s.farmhand && away >= 5 * M) farmhandRun(s, from, Math.min(now, from + 12 * H), s.farmhand === 2 ? 6 : 3, rep);
    rep.ripe = 0; s.tiles.forEach(t => { if (t.kind === 'bed' && t.crop && t.readyAt <= now && (t.plantedAt || 0) < now && t.readyAt > from - 1) { rep.ripe++; rep.ripeCrop = t.crop; } });
    s.savedAt = now;
    return rep;
  }
  function farmhandRun(s, from, end, cycles, rep) {
    const gain = (g, n) => { rep.hand[g] = (rep.hand[g] || 0) + n; rep.handN += n; };
    // beds: process harvests in time order so the cellar limit is fair across beds
    const cnt = {}; let stop = false;
    for (let guard = 0; guard < 1000 && !stop; guard++) {
      let bi = -1, bt = Infinity;
      s.tiles.forEach((t, i) => { if (t.kind === 'bed' && t.crop && t.readyAt <= end && (cnt[i] || 0) < cycles && t.readyAt < bt) { bt = t.readyAt; bi = i; } });
      if (bi < 0) break;
      const t = s.tiles[bi], y = bedYield(s, bi), crop = t.crop;
      if (cellarFree(s) < y) { stop = true; break; }
      add(s, crop, y); s.stats.harv[crop] = (s.stats.harv[crop] || 0) + y; gain(crop, y); cnt[bi] = (cnt[bi] || 0) + 1;
      const at = t.readyAt;
      if (s.coins >= CROP[crop].seed) { s.coins -= CROP[crop].seed; const f = sprinkF(s, bi); Object.assign(t, { plantedAt: at, readyAt: at + CROP[crop].t * f, f }); s.stats.planted++; }
      else { t.crop = null; delete t.readyAt; delete t.plantedAt; }
    }
    // pens
    for (const k in s.pens) {
      const A = ANIMALS[k];
      s.pens[k].forEach(a => {
        for (let c = 0; c < cycles; c++) {
          if (a.readyAt == null || a.readyAt > end) break;
          if (cellarFree(s) < 1) break;
          add(s, A.makes, 1); gain(A.makes, 1); const at = a.readyAt; a.readyAt = null;
          if (have(s, A.eats) >= A.eatN) { take(s, A.eats, A.eatN); a.readyAt = at + A.t; }
        }
      });
    }
    // workshop shelves
    for (const id in s.shops) {
      const w = s.shops[id];
      while (w.shelf.length && cellarFree(s) >= 1) { const g = w.shelf.shift(); add(s, g, 1); s.stats.made[g] = (s.stats.made[g] || 0) + 1; gain(g, 1); if (!s.firsts[g]) s.firsts[g] = end; }
    }
  }

  // ------------------------------------------------------------------ save / load / migrate
  const MIGRATIONS = {
    // v0 (prototype shape): { coins, level, xp, beds:[tileIdx], items:{...} } -> v1
    1: o => {
      const s = newGame(o.savedAt || 0, 777);
      s.coins = o.coins || 0; s.level = o.level || 1; s.xp = o.xp || 0;
      if (Array.isArray(o.beds)) { s.tiles.forEach((t, i) => { s.tiles[i] = { kind: 'sod' }; }); o.beds.forEach(i => { if (i >= 0 && i < NT) s.tiles[i] = { kind: 'bed', crop: null }; }); }
      s.cellar.items = Object.assign({}, o.items || {});
      for (let L = 1; L <= s.level; L++) markUnlocks(s, L, 0);
      s.notebook = NOTEBOOK.length; s.tut = 99;
      s.v = 1; return s;
    },
  };
  function fillDefaults(o, d) {
    for (const k in d) {
      if (o[k] === undefined || o[k] === null && d[k] !== null) o[k] = deep(d[k]);
      else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && typeof o[k] === 'object' && !Array.isArray(o[k])) fillDefaults(o[k], d[k]);
    }
    return o;
  }
  function migrate(o, now) {
    let v = typeof o.v === 'number' ? o.v : 0;
    while (v < VERSION) { v++; o = MIGRATIONS[v](o); o.v = v; }
    const def = newGame(now || 0, 1);
    fillDefaults(o, def);
    if (!Array.isArray(o.tiles) || o.tiles.length !== NT) o.tiles = def.tiles;
    if (!Array.isArray(o.trees) || o.trees.length !== 4) o.trees = def.trees;
    if (!Array.isArray(o.projects) || o.projects.length !== PROJECTS.length) o.projects = def.projects;
    if (!Array.isArray(o.orders) || !o.orders.length) o.orders = def.orders;
    o.cellar.cap = CELLAR[clamp(o.cellar.lvl | 0, 0, CELLAR.length - 1)][0];
    return o;
  }
  function serialize(s, now) { s.savedAt = now; return JSON.stringify(s); }
  function parse(str, now) {
    try { const o = JSON.parse(str); if (!o || typeof o !== 'object') throw new Error('bad'); return { ok: true, s: migrate(o, now) }; }
    catch (e) { return { ok: false, s: newGame(now, (now % 100000) | 0) }; }
  }

  // ------------------------------------------------------------------ formatting
  function fmtNum(n) { n = Math.round(n); if (n < 10000) return n.toLocaleString('en-US'); if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'k'; return (n / 1e6).toFixed(2).replace(/0$/, '') + 'M'; }
  function fmtTime(ms) {
    let sec = Math.max(0, Math.ceil(ms / 1000));
    if (sec < 60) return '0:' + String(sec).padStart(2, '0');
    if (sec < 3600) return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    return h + 'h ' + String(m).padStart(2, '0') + 'm';
  }

  const IA = {
    VERSION, COLS, ROWS, NT, D, CROP, RECIPE, SHOP, SHOP_RECIPES, PRODUCTS, MD, MIGRATIONS,
    emit, drain, rand, seeded, dayNum, neighbors, isHelper, adjKind, sprinkF, bedYield, projDone, val,
    cellarCount, cellarFree, have, add, take, hasAll,
    newGame, unlocksAt, producible, xpNeed, addXP,
    bedCount, bedCost, bedCostN, plusTiles, nextBedTile, bedState, plant, seedCost, harvest, buyBed,
    helperCount, helperCost, placeHelper, canMoveHelper, moveHelper, rescale, honeyReady, collectHoney,
    treeSlotOpen, buyTree, pickTree,
    animalCost, buyAnimal, penInfo, tapPen,
    recipeTime, slotCost, buildShop, upgradeShop, queueRecipe, collectShop,
    boardSize, genOrder, qtyCap, orderMet, deliver, trashOrder, orderEligible,
    dockFerry, fillCrate, sendFerry,
    csaEnsure, csaStreakNow, fillCsa,
    mdShelf, mdCanOpen, mdStart, mdStep, mdServe, mdEnd, mdHearts, mdRamp, mdMult, mdAvail, mdKept, mdLoad, mdStock, mdCap, MDH, quickLine,
    projVisible, projNeeds, projReady, donate, feastCount,
    cellarUpCost, upgradeCellar, sell, hireFarmhand, extras, sellExtras, wanted, reserved,
    tick, notebookCheck, nbProgress, catchUp, clampTimers,
    migrate, serialize, parse, fillDefaults, fmtNum, fmtTime,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = IA;
  else root.IA = IA;
})(typeof window !== 'undefined' ? window : globalThis);
