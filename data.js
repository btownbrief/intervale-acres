/* Intervale Acres: every content table as plain objects. Loaded in the browser (global IA_DATA) and in node (require). */
(function (root) {
  'use strict';

  // Every good: display name, base value in coins, kind ('crop' | 'tree' | 'animal' | 'hive' | 'product').
  const GOODS = {
    radish:     { name: 'Radish',        v: 3,   kind: 'crop' },
    wheat:      { name: 'Wheat',         v: 5,   kind: 'crop' },
    corn:       { name: 'Corn',          v: 8,   kind: 'crop' },
    carrot:     { name: 'Carrot',        v: 14,  kind: 'crop' },
    tomato:     { name: 'Tomato',        v: 24,  kind: 'crop' },
    strawberry: { name: 'Strawberry',    v: 40,  kind: 'crop' },
    pumpkin:    { name: 'Pumpkin',       v: 80,  kind: 'crop' },
    sunflower:  { name: 'Sunflower',     v: 220, kind: 'crop' },
    garlic:     { name: 'Garlic',        v: 600, kind: 'crop' },
    apple:      { name: 'Apple',         v: 12,  kind: 'tree' },
    maple:      { name: 'Maple jug',     v: 60,  kind: 'tree' },
    egg:        { name: 'Egg',           v: 22,  kind: 'animal' },
    milk:       { name: 'Milk',          v: 40,  kind: 'animal' },
    honey:      { name: 'Honey',         v: 90,  kind: 'hive' },
    bread:      { name: 'Bread',         v: 18,  kind: 'product' },
    cornbread:  { name: 'Cornbread',     v: 60,  kind: 'product' },
    donut:      { name: 'Cider donut',   v: 135, kind: 'product' },
    pie:        { name: 'Pumpkin pie',   v: 275, kind: 'product' },
    cider:      { name: 'Cider',         v: 60,  kind: 'product' },
    switchel:   { name: 'Switchel',      v: 185, kind: 'product' },
    butter:     { name: 'Butter',        v: 62,  kind: 'product' },
    cheddar:    { name: 'Cheddar',       v: 140, kind: 'product' },
    aged:       { name: 'Aged cheddar',  v: 420, kind: 'product' },
    salsa:      { name: 'Salsa',         v: 80,  kind: 'product' },
    jam:        { name: 'Berry jam',     v: 125, kind: 'product' },
    kettle:     { name: 'Kettle corn',   v: 120, kind: 'product' },
    granola:    { name: 'Honey granola', v: 160, kind: 'product' },
    mcreemee:   { name: 'Maple creemee', v: 145, kind: 'product' },
    bcreemee:   { name: 'Berry creemee', v: 120, kind: 'product' },
  };

  const S = 1000, M = 60 * S, H = 60 * M;

  // Crops, in seed-tray order. t = grow time (ms), seed = coins per bed.
  const CROPS = [
    { id: 'radish',     lvl: 1,  t: 20 * S,  seed: 1 },
    { id: 'wheat',      lvl: 2,  t: 45 * S,  seed: 2 },
    { id: 'corn',       lvl: 3,  t: 90 * S,  seed: 3 },
    { id: 'carrot',     lvl: 4,  t: 3 * M,   seed: 5 },
    { id: 'tomato',     lvl: 6,  t: 6 * M,   seed: 8 },
    { id: 'strawberry', lvl: 8,  t: 12 * M,  seed: 12 },
    { id: 'pumpkin',    lvl: 10, t: 30 * M,  seed: 20 },
    { id: 'sunflower',  lvl: 12, t: 2 * H,   seed: 40 },
    { id: 'garlic',     lvl: 14, t: 8 * H,   seed: 80 },
  ];

  const TREES = {
    apple: { id: 'apple', name: 'Apple tree',  lvl: 5, cost: 150, first: 2 * M, every: 4 * M,  yield: 3, good: 'apple' },
    maple: { id: 'maple', name: 'Sugar maple', lvl: 9, cost: 400, first: 5 * M, every: 10 * M, yield: 1, good: 'maple' },
  };
  const TREE_SLOT_LVL = [5, 5, 9, 13];

  const ANIMALS = {
    hens: { id: 'hens', name: 'Hen coop', one: 'hen', lvl: 3, eats: 'corn',  eatN: 1, makes: 'egg',  t: 2 * M, costs: [60, 150, 300] },
    cows: { id: 'cows', name: 'Pasture',  one: 'cow', lvl: 6, eats: 'wheat', eatN: 2, makes: 'milk', t: 5 * M, costs: [300, 700, 1500] },
  };

  const HELPERS = {
    sprinkler: { id: 'sprinkler', name: 'Sprinkler', lvl: 5, costs: [350, 900, 2200], speed: 0.75 },
    hive:      { id: 'hive',      name: 'Beehive',   lvl: 7, costs: [500, 1400, 3500], yield: 3, honeyT: 15 * M },
  };

  const SHOPS = [
    { id: 'oven',     name: 'Bake Oven',     lvl: 2, cost: 30 },
    { id: 'press',    name: 'Cider Press',   lvl: 5, cost: 250 },
    { id: 'creamery', name: 'Creamery',      lvl: 6, cost: 400 },
    { id: 'kitchen',  name: 'Farm Kitchen',  lvl: 8, cost: 800 },
    { id: 'creemee',  name: 'Creemee Stand', lvl: 9, cost: 1200 },
  ];

  const RECIPES = [
    { id: 'bread',     shop: 'oven',     lvl: 2,  inp: { wheat: 2 },                      t: 30 * S },
    { id: 'cornbread', shop: 'oven',     lvl: 4,  inp: { corn: 2, egg: 1 },               t: 2 * M },
    { id: 'donut',     shop: 'oven',     lvl: 7,  inp: { wheat: 1, cider: 1, egg: 1 },    t: 4 * M },
    { id: 'pie',       shop: 'oven',     lvl: 11, inp: { pumpkin: 1, egg: 1, butter: 1 }, t: 15 * M },
    { id: 'cider',     shop: 'press',    lvl: 5,  inp: { apple: 3 },                      t: 3 * M },
    { id: 'switchel',  shop: 'press',    lvl: 10, inp: { cider: 1, maple: 1 },            t: 6 * M },
    { id: 'butter',    shop: 'creamery', lvl: 6,  inp: { milk: 1 },                       t: 2 * M },
    { id: 'cheddar',   shop: 'creamery', lvl: 8,  inp: { milk: 2 },                       t: 10 * M },
    { id: 'aged',      shop: 'creamery', lvl: 12, inp: { cheddar: 1 },                    t: 4 * H },
    { id: 'salsa',     shop: 'kitchen',  lvl: 8,  inp: { tomato: 2, radish: 1 },          t: 3 * M },
    { id: 'jam',       shop: 'kitchen',  lvl: 8,  inp: { strawberry: 2 },                 t: 5 * M },
    { id: 'kettle',    shop: 'kitchen',  lvl: 10, inp: { corn: 2, maple: 1 },             t: 4 * M },
    { id: 'granola',   shop: 'kitchen',  lvl: 11, inp: { wheat: 2, honey: 1 },            t: 6 * M },
    { id: 'mcreemee',  shop: 'creemee',  lvl: 9,  inp: { milk: 1, maple: 1 },             t: 2 * M },
    { id: 'bcreemee',  shop: 'creemee',  lvl: 10, inp: { milk: 1, strawberry: 1 },        t: 2 * M },
  ];

  // XP needed to go from level L to L+1 (index = L). Level 20 is the cap.
  const LEVELS = [0, 15, 100, 130, 110, 170, 380, 520, 660, 690, 800, 880, 1800, 2800, 4200, 5600, 6600, 7400, 8200, 9000];
  const MAX_LEVEL = 20;

  const CELLAR = [ // [cap, cost to reach it]
    [60, 0], [85, 80], [110, 250], [140, 700], [190, 1800], [250, 4500], [320, 11000], [400, 24000],
  ];

  const PROJECTS = [
    { id: 'awning',   name: 'Farmstand Awning',     lvl: 4,  coins: 300,   hearts: 2,  goods: { bread: 6 },                         perk: 'Orders pay +10%' },
    { id: 'oven2',    name: 'Community Bake Oven',  lvl: 7,  coins: 1500,  hearts: 5,  goods: { cornbread: 6, carrot: 10 },         perk: 'Bake Oven 25% faster' },
    { id: 'cart',     name: 'Bike Path Cart',       lvl: 9,  coins: 4000,  hearts: 8,  goods: { cider: 8, butter: 6 },              perk: 'New tickets arrive at once' },
    { id: 'lantern',  name: 'Dock Lantern',         lvl: 11, coins: 9000,  hearts: 12, goods: { cheddar: 6, jam: 6 },               perk: 'Ferry back in 1 h, 2 Hearts a load' },
    { id: 'bandstand',name: 'Bandstand',            lvl: 13, coins: 20000, hearts: 18, goods: { mcreemee: 10, switchel: 6 },        perk: 'Market Day +15 s and tips' },
    { id: 'hall',     name: 'Winter Market Hall',   lvl: 15, coins: 45000, hearts: 25, goods: { aged: 4, pie: 6, granola: 6 },      perk: 'Golden Orders pay 3x' },
    { id: 'festival', name: 'Harvest Festival',     lvl: 16, coins: 0,     hearts: 40, goods: { garlic: 8, sunflower: 8 }, feast: 12, perk: 'The finale' },
  ];

  // Invented neighbourhood groups (never businesses or people).
  const SENDERS = [
    'Old North End potluck', 'Hill Section brunch', 'Bike path picnic', 'South End studio lunch',
    'Lakeside book club', 'New North End block party', 'Waterfront sunset crowd', 'School bake sale',
    'Riverside cookout', 'Snow-day stew night', 'Ferry dock lunch run', 'Choir practice snacks',
    'Community garden swap', 'Pine Street movers', 'Rink-side bake table', 'Library story hour',
  ];

  // Farm Notebook: the first-15-minutes goal ladder. gift = coins paid on completion.
  const NOTEBOOK = [
    { id: 'pick6',     text: 'Pick 6 radishes',          gift: 10 },
    { id: 'order1',    text: 'Fill your first order',     gift: 10 },
    { id: 'plantWheat',text: 'Plant wheat',               gift: 12 },
    { id: 'oven',      text: 'Build the Bake Oven',       gift: 15 },
    { id: 'bread2',    text: 'Bake 2 loaves',             gift: 20 },
    { id: 'orders3',   text: 'Fill 3 orders',             gift: 25 },
    { id: 'beds2',     text: 'Buy 2 more beds',           gift: 30 },
    { id: 'hen',       text: 'Reach Level 3, buy a hen',  gift: 30 },
    { id: 'egg',       text: 'Feed the hen, get an egg',  gift: 40 },
    { id: 'cornbread', text: 'Bake cornbread',            gift: 50 },
    { id: 'csa',       text: 'Fill a CSA box slot',       gift: 60 },
    { id: 'tree',      text: 'Plant an apple tree',       gift: 70 },
    { id: 'sprinkler', text: 'Sprinkler by 3 beds',       gift: 90 },
    { id: 'market',    text: 'Play a Market Day',         gift: 120 },
    { id: 'awning',    text: 'Build the Farmstand Awning',gift: 150 },
    // chapter 2: the rest of the first hour
    { id: 'cider',     text: 'Press some cider',          gift: 160 },
    { id: 'cow',       text: 'Buy a cow',                 gift: 180 },
    { id: 'butter',    text: 'Churn butter',              gift: 200 },
    { id: 'crate',     text: 'Load a ferry crate',        gift: 220 },
    { id: 'hive',      text: 'Place a beehive',           gift: 250 },
    { id: 'csaBox',    text: 'Pack a whole CSA box',      gift: 280 },
    { id: 'kitchen',   text: 'Build the Farm Kitchen',    gift: 300 },
    { id: 'oven2',     text: 'Build the Community Bake Oven', gift: 350 },
    { id: 'maple',     text: 'Plant a sugar maple',       gift: 400 },
    { id: 'creemee',   text: 'Make a maple creemee',      gift: 450 },
  ];

  const DATA = { GOODS, CROPS, TREES, TREE_SLOT_LVL, ANIMALS, HELPERS, SHOPS, RECIPES, LEVELS, MAX_LEVEL, CELLAR, PROJECTS, SENDERS, NOTEBOOK, S, M, H };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.IA_DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
