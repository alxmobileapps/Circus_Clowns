/* Circus Clown — a one-tap circus ball-hopping game.
 * The clown starts standing on a circus ball. More balls of different sizes and speeds roll in.
 * Quick tap = small hop, hold = big jump. Jump onto the coming ball before it bumps the one
 * you are standing on. From 4 points hanging rings of fire swing in (jump through them),
 * from 6 points tiny bouncing balls (never touch them), from 9 two tiny balls in a row,
 * from 11 two rings in a row. Everything speeds up after 5 points, then every 5 points.
 * Clowns are defined in clowns.js.
 */
(() => {
  'use strict';

  // ---------- Canvas & scaling ----------
  const canvas = document.getElementById('game');
  let ctx = canvas.getContext('2d');   // swapped briefly when drawing the share picture
  const GY = 385;             // floor line
  // Portrait: the screen is always VIEW_W logical px wide. The floor sits ~76% down the screen.
  const VIEW_W = 500;
  let viewW = VIEW_W, viewH = 1000, scale = 1, offY = 0, dpr = 1;
  const T = () => -offY;                 // top of the screen, in band coordinates
  const MID = () => -offY + viewH / 2;   // middle of the screen

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    scale = canvas.width / VIEW_W;
    viewW = VIEW_W; viewH = canvas.height / scale;
    offY = Math.max(0, viewH * 0.76 - GY);
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- Saved progress ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  let best = parseInt(store.get('cc_best', '0'), 10) || 0;
  let coins = parseInt(store.get('cc_coins', '0'), 10) || 0;
  let sfxOn = store.get('cc_muted', '0') !== '1';
  let musicOn = store.get('cc_music', '1') === '1';

  // ---------- Clowns ----------
  const FALLBACK = [{ id: 'giggles', name: 'Giggles', price: 0,
    look: { suit: '#e5262f', suit2: '#ffd23a', pattern: 'dots', collar: '#ffffff', shoes: '#2a7de1', wig: 'afro', wigCol: '#ff7a1a', hat: 'cone', hatCol: '#2a7de1', hat2: '#ffd23a' },
    voice: { pitch: 1, cryPitch: 1 }, files: {} }];
  const CLOWNS = (Array.isArray(window.CIRCUS_CLOWNS) && window.CIRCUS_CLOWNS.length ? window.CIRCUS_CLOWNS : FALLBACK)
    .map(b => Object.assign({ price: 0, voice: {}, files: {} }, b, { look: Object.assign({}, b.look) }));
  let owned;
  try { owned = JSON.parse(store.get('cc_owned', '[]')); } catch (e) { owned = []; }
  if (!Array.isArray(owned)) owned = [];
  CLOWNS.forEach(b => { if (!b.price && !owned.includes(b.id)) owned.push(b.id); });
  let selectedId = store.get('cc_clown', CLOWNS[0].id);
  if (!CLOWNS.some(b => b.id === selectedId) || !owned.includes(selectedId)) selectedId = CLOWNS[0].id;
  const clownById = id => CLOWNS.find(b => b.id === id) || CLOWNS[0];
  const curClown = () => clownById(selectedId);
  const saveProgress = () => {
    store.set('cc_coins', String(coins)); store.set('cc_owned', JSON.stringify(owned)); store.set('cc_clown', selectedId);
  };

  // Game-over pictures from clowns.js (optional)
  const images = {};
  function clownImage(b) {
    const src = b.files && b.files.gameOver;
    if (!src) return null;
    if (!images[src]) {
      const im = new Image(); im.onerror = () => { im._bad = true; }; im.src = src; images[src] = im;
    }
    const im = images[src];
    return im.complete && !im._bad && im.naturalWidth ? im : null;
  }

  // ---------- Audio ----------
  let actx = null, noiseBuf = null, sfxBus = null, musicBus = null;
  function ensureAudio() {
    try {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = new AC();
        noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        sfxBus = actx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(actx.destination);
        musicBus = actx.createGain(); musicBus.gain.value = musicOn ? MUSIC_VOL : 0; musicBus.connect(actx.destination);
        preloadClown(curClown());
      }
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }

  // Sound files from clowns.js (optional) — decoded once, reused
  const buffers = {};
  function loadSound(url) {
    if (!url || !actx) return null;
    if (!(url in buffers)) {
      buffers[url] = null;
      fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(a => new Promise((res, rej) => actx.decodeAudioData(a, res, rej)))
        .then(buf => { buffers[url] = buf; })
        .catch(() => { buffers[url] = false; });
    }
    return buffers[url] || null;
  }
  function preloadClown(b) { if (b.files) { loadSound(b.files.oops); loadSound(b.files.cry); clownImage(b); } }
  function playBuffer(buf, vol = 1) {
    const s = actx.createBufferSource(); s.buffer = buf;
    const g = actx.createGain(); g.gain.value = vol; s.connect(g); g.connect(sfxBus); s.start();
    return s;
  }

  function noiseBurst(t, dur, freq, q, vol, type = 'bandpass', dest = sfxBus) {
    const src = actx.createBufferSource(); src.buffer = noiseBuf;
    const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  // Fallback jump sound when a clown has no "Ooops" recording: a quick sung "oo-ps"
  function synthOops(v, t) {
    const p = (v.pitch || 1) * (1 + (Math.random() - 0.5) * 0.05), f0 = 220 * p, d = 0.22;
    const out = actx.createGain(); out.gain.value = 0.45; out.connect(sfxBus);
    const env = actx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.03);
    env.gain.setValueAtTime(0.9, t + d * 0.8); env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const o = actx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.4, t + d * 0.5); o.frequency.linearRampToValueAtTime(f0 * 1.1, t + d);
    [[300, 1, 7], [870, 0.6, 9]].forEach(([f, g, q]) => {
      const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * Math.sqrt(p); bp.Q.value = q;
      const gg = actx.createGain(); gg.gain.value = g * 3; o.connect(bp); bp.connect(gg); gg.connect(env);
    });
    env.connect(out); o.start(t); o.stop(t + d + 0.03);
    noiseBurst(t + d + 0.04, 0.02, 900, 0.8, 0.3);
    noiseBurst(t + d + 0.06, 0.11, 5000, 0.7, 0.14, 'highpass');
  }
  // Built-in cry: sad trombone "wah wah wah waaah"
  function synthCry(v, t0) {
    const cp = v.cryPitch || 1;
    const out = actx.createGain(); out.gain.value = 0.5; out.connect(sfxBus);
    const note = (t, d, f, vib) => {
      const env = actx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.9, t + 0.05);
      env.gain.setValueAtTime(0.8, t + d * 0.75);
      env.gain.exponentialRampToValueAtTime(0.0001, t + d);
      const wah = actx.createBiquadFilter(); wah.type = 'lowpass'; wah.Q.value = 6;
      wah.frequency.setValueAtTime(350, t); wah.frequency.exponentialRampToValueAtTime(1500, t + Math.min(0.18, d * 0.4));
      wah.frequency.exponentialRampToValueAtTime(600, t + d);
      const o = actx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.03, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      if (vib) {
        const l = actx.createOscillator(); l.frequency.value = 5.5;
        const lg = actx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.03, t + d * 0.5);
        l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.05);
        o.frequency.exponentialRampToValueAtTime(f * 0.94, t + d);
      }
      o.connect(wah); wah.connect(env); env.connect(out); o.start(t); o.stop(t + d + 0.05);
    };
    const f0 = 311 * cp;   // E-flat, then down by semitones
    note(t0 + 0.1, 0.36, f0, false);
    note(t0 + 0.5, 0.36, f0 * 0.944, false);
    note(t0 + 0.9, 0.36, f0 * 0.891, false);
    note(t0 + 1.3, 1.25, f0 * 0.841, true);
  }

  let lastOops = null;
  function oopsSound(b = curClown()) {
    if (!sfxOn || !actx) return;
    const buf = loadSound(b.files && b.files.oops);
    if (buf) {   // a new jump cuts off the previous "Ooops"
      if (lastOops) { try { lastOops.stop(); } catch (e) { /* already ended */ } }
      lastOops = playBuffer(buf, 1.1); return;
    }
    synthOops(b.voice || {}, actx.currentTime + 0.005);
  }
  function cry(b = curClown(), withThud = true) {
    if (!sfxOn || !actx) return;
    const t0 = actx.currentTime + 0.02;
    if (withThud) noiseBurst(t0, 0.14, 500, 1.0, 0.45, 'lowpass');
    const buf = loadSound(b.files && b.files.cry);
    if (buf) { playBuffer(buf); return; }
    synthCry(b.voice || {}, t0);
  }
  function thump() {   // ball bumping into ball
    if (!sfxOn || !actx) return;
    const t = actx.currentTime + 0.003;
    noiseBurst(t, 0.1, 320, 1.2, 0.5, 'lowpass');
    const o = actx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    const g = actx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.16);
  }
  function boing() {   // landing on a ball
    if (!sfxOn || !actx) return;
    const t = actx.currentTime + 0.003;
    const o = actx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.09);
    const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.18);
  }
  function ding() {
    if (!sfxOn || !actx) return;
    const t = actx.currentTime + 0.005;
    [1320, 1980].forEach((f, i) => {
      const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.06 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.25);
      o.connect(g); g.connect(sfxBus); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.3);
    });
  }
  function beepBeep() {   // warning for a very fast ball
    if (!sfxOn || !actx) return;
    const t = actx.currentTime + 0.005;
    [0, 0.16, 0.32].forEach(d => {
      const o = actx.createOscillator(); o.type = 'square'; o.frequency.value = 1240;
      const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.09, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.1);
      o.connect(g); g.connect(sfxBus); o.start(t + d); o.stop(t + d + 0.12);
    });
  }
  function boom() {   // the cannon fires, then a whistle as the human cannonball zooms past
    if (!sfxOn || !actx) return;
    const t = actx.currentTime + 0.003;
    noiseBurst(t, 0.35, 380, 0.8, 0.9, 'lowpass');
    const o = actx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const g = actx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.36);
    const w = actx.createOscillator(); w.type = 'triangle';
    w.frequency.setValueAtTime(1500, t + 0.05); w.frequency.exponentialRampToValueAtTime(380, t + 0.6);
    const wg = actx.createGain(); wg.gain.setValueAtTime(0.0001, t + 0.05);
    wg.gain.exponentialRampToValueAtTime(0.07, t + 0.1); wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    w.connect(wg); wg.connect(sfxBus); w.start(t + 0.05); w.stop(t + 0.65);
  }
  function click() {
    if (!sfxOn || !actx) return;
    noiseBurst(actx.currentTime + 0.002, 0.03, 2500, 2, 0.15);
  }

  // ---------- Circus music (original oom-pah march, generated live) ----------
  const MUSIC_VOL = 0.16;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // chord per bar: [bass root, bass fifth, triad]
  const CH = { C: [48, 55, [60, 64, 67]], G: [43, 50, [59, 62, 67]], F: [41, 48, [60, 65, 69]] };
  const PROG = 'C C G G G G C C C C F F C G C C'.split(' ');
  const MEL = [
    [[76, 1], [75, 1], [76, 1], [72, 1]], [[67, 1], [72, 1], [76, 1], [79, 1]],
    [[77, 1], [76, 1], [77, 1], [74, 1]], [[71, 1], [74, 1], [79, 2]],
    [[77, 1], [76, 1], [74, 1], [71, 1]], [[74, 1], [73, 1], [74, 1], [77, 1]],
    [[76, 1], [74, 1], [72, 1], [67, 1]], [[72, 2], [0, 2]],
    [[79, 1], [78, 1], [79, 1], [76, 1]], [[84, 2], [79, 2]],
    [[81, 1], [80, 1], [81, 1], [77, 1]], [[72, 1], [77, 1], [81, 2]],
    [[79, 1], [76, 1], [72, 1], [76, 1]], [[74, 1], [77, 1], [71, 1], [74, 1]],
    [[72, 1], [76, 1], [79, 1], [76, 1]], [[72, 2], [0, 2]]
  ];
  const SLOTS = [];   // 64 eighth-note slots -> melody note starting there
  MEL.forEach((bar, bi) => { let p = 0; bar.forEach(([m, l]) => { SLOTS[bi * 4 + p] = m ? [m, l] : null; p += l; }); });
  let musicActive = false, mNext = 0, mStep = 0;

  function tone(type, freq, t, dur, vol, lpf = 3000, vib = 0) {
    const o = actx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lpf;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (vib) {
      const l = actx.createOscillator(); l.frequency.value = 5.5;
      const lg = actx.createGain(); lg.gain.value = freq * vib; l.connect(lg); lg.connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.02);
    }
    o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function eighth() {
    const k = state === 'play' ? 1 + (speed - 210) / 900 : 1;   // march speeds up with the game
    return 0.18 / k;
  }
  function scheduleStep(step, t) {
    const e = eighth(), slot = step % 64, pos = slot % 4, bar = Math.floor(slot / 4), loop = Math.floor(step / 64);
    const [root, fifth, triad] = CH[PROG[bar]];
    if (pos === 0 || pos === 2) tone('triangle', mtof(pos === 0 ? root : fifth), t, e * 0.9, 0.55, 900);      // tuba "oom"
    else {
      triad.forEach(m => tone('square', mtof(m), t, e * 0.45, 0.07, 1800));                                      // "pah"
      noiseBurst(t, 0.04, 7000, 0.8, 0.05, 'highpass', musicBus);                                                 // cymbal tick
    }
    const n = SLOTS[slot];
    if (n) {
      tone('square', mtof(n[0]), t, e * n[1] * 0.85, 0.11, 2600, 0.006);                                         // calliope
      if (loop % 2 === 1) tone('sine', mtof(n[0] + 12), t, e * n[1] * 0.6, 0.08, 8000);                          // glockenspiel on repeats
    }
  }
  function musicTick() {
    if (!actx || !musicActive) return;
    if (mNext < actx.currentTime) mNext = actx.currentTime + 0.05;
    while (mNext < actx.currentTime + 0.15) { scheduleStep(mStep, mNext); mNext += eighth(); mStep++; }
  }
  setInterval(musicTick, 30);
  function startMusic() {
    if (!actx || musicActive) return;
    musicActive = true; mStep = 0; mNext = actx.currentTime + 0.08;
    musicBus.gain.cancelScheduledValues(actx.currentTime);
    musicBus.gain.setTargetAtTime(musicOn ? MUSIC_VOL : 0, actx.currentTime, 0.05);
  }
  function stopMusic() {
    if (!actx || !musicActive) return;
    musicActive = false;
    musicBus.gain.cancelScheduledValues(actx.currentTime);
    musicBus.gain.setTargetAtTime(0, actx.currentTime, 0.08);
    setTimeout(() => { if (!musicActive && musicBus) musicBus.gain.setTargetAtTime(musicOn ? MUSIC_VOL : 0, actx.currentTime, 0.05); }, 600);
  }


  // ---------- Game state ----------
  const GRAV = 2300, JUMP_V = 860, CUT_V = 200; // let go early = upward speed cut = lower jump
  const MX = 150;                               // the clown always stays at this x
  const MS = 1.25;                              // clown drawing size in the game
  const START_R = 42;                           // the ball the clown starts on
  const BALL_MIN = 31, BALL_MAX = 50;           // ball radius range (Circus Dogs ball = 24)
  const EDGE = 0.8;                             // land within 80% of the ball's radius from its top, or slip off
  const RIM = 6;                                // thickness of a burning ring (collision radius)
  const MINI_R = 11;                            // tiny bouncing ball
  const SPIKY_MIN = 32, SPIKY_MAX = 40, SPIKY_GAP = 65, SPIKE = 7;   // spiky ball size, gap to the ball behind it, spike length
  const CANNON_R = 15;                          // human cannonball (collision radius)
  let state = 'title';       // title | shop | play | dying | over | paused
  let score = 0, speed = 210, time = 0, dist = 0, overT = 0, newBest = false, runCoins = 0;
  let lastHit = null;
  let plats = [], cur = null, hz = [], spawnT = 0, ballDue = false, ballCount = 0, fastSlot = 0, warnT = 0, warned = false, parts = [], tears = [], popups = [];
  const mk = { x: MX, y: GY - START_R * 2, vy: 0, air: false, jt: 0, h0: 0, v0: 0, y0: 0, holding: false, fvx: 0, spin: 0, land: 0 };
  let shopIdx = 0, shopCryT = 0, shopMsg = '', shopMsgT = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  // a big speed jump after 5 points, then one more step every 5 points
  const speedFor = n => n <= 5 ? 210 : Math.min(470, 270 + Math.floor((n - 6) / 5) * 25);

  // ---------- Balls ----------
  // st: 'held' = the one the clown stands on, 'come' = rolling in, 'gone' = knocked away
  const hopH = p => { if (!p.hop) return 0; const u = ((time + p.ph) % p.hop.p) / p.hop.p; return 4 * p.hop.a * u * (1 - u); };
  const ballCY = p => GY - p.r - hopH(p);
  function topAt(p, x) {
    const dx = x - p.x;
    if (Math.abs(dx) >= p.r) return null;
    return ballCY(p) - Math.sqrt(p.r * p.r - dx * dx);
  }
  let lastSpiky = false;
  function spawnBall(forceSpiky) {
    // sizes vary a lot; sometimes very big, sometimes small
    const r = Math.random() < 0.25 ? rand(BALL_MIN, BALL_MIN + 5) : Math.random() < 0.3 ? rand(BALL_MAX - 5, BALL_MAX) : rand(BALL_MIN, BALL_MAX);
    // one very fast ball in every group of 5, at a random spot in the group (never two in a row);
    // the others roll at slightly different speeds
    const fast = nextIsFast();
    ballCount++;
    if (ballCount % 5 === 0) fastSlot = Math.floor(rand(fastSlot === 4 ? 1 : 0, 5));   // pick the spot in the next group
    const spd = fast ? Math.min(680, Math.max(speed * 1.5, 420)) / speed : Math.min(rand(0.9, 1.1), 500 / speed);
    const p = { kind: 'ball', x: viewW + r + 16, r, rot: rand(0, 6), st: 'come', vx: 0, ph: 0, hop: null, spd, fast };
    // a spiky ball sometimes rolls in first, with a normal ball right behind it:
    // never land on the spikes, jump over it onto the ball behind
    const spiky = !fast && (forceSpiky || (!lastSpiky && Math.random() < 0.28));
    lastSpiky = spiky;
    if (spiky) {
      const rs = rand(SPIKY_MIN, SPIKY_MAX);
      const s = { kind: 'ball', x: viewW + rs + 16, r: rs, rot: rand(0, 6), st: 'come', vx: 0, ph: 0, hop: null, spd, fast: false, spiky: true };
      p.x = s.x + 0.8 * r + rs + SPIKY_GAP;      // room for the spikes to pass before the ball behind arrives
      plats.push(s, p);
      return;
    }
    if (!fast && score >= 15 && Math.random() < 0.25) { p.hop = { a: rand(14, 22), p: rand(0.5, 0.66) }; p.ph = rand(0, 1); }
    plats.push(p);
  }
  const nextIsFast = () => ballCount % 5 === fastSlot;
  function touching(a, b) {
    const dx = a.x - b.x, dy = ballCY(a) - ballCY(b), rr = a.r + b.r - 1;
    return dx * dx + dy * dy < rr * rr;
  }
  function knock(p, extra = 240) {
    p.st = 'gone'; p.vx = -(speed + extra);
    const y = ballCY(p);
    for (let i = 0; i < 10; i++) parts.push({ x: p.x + p.r * 0.8, y, vx: rand(-60, 120), vy: rand(-180, -40), life: 0.5, max: 0.5, c: '#fff3a0', r: rand(1.5, 3), star: true });
  }

  // ---------- Obstacles: hanging rings of fire and tiny bouncing balls ----------
  // A ring always fits the clown somewhere between standing on his ball and a big jump.
  // The clown's body spans from 16px to 70px above his feet (at drawing size MS), so a ring
  // with radius R lets his feet pass between cy - R + 76 and cy + R + 10.
  function makeRing(x, spd) {
    const R = rand(52, 66);
    const feetTop = GY - cur.r * 2;                                  // clown's feet when standing
    const need = rand(45, 112);                                      // always hangs above the clown: he must jump
    return { kind: 'ring', x: x + R, cy: feetTop - need - 43, R, rx: R * 0.3, seed: Math.random() * 100, spd, judged: false, passed: false };
  }
  // A tiny ball always reaches the clown at the top of its bounce, at the height of his body,
  // so he can never just stand still and let it pass: he has to jump over it.
  function makeMini(x, spd) {
    const v = speed * spd, feetH = cur.r * 2;                        // clown's feet height above the floor
    const a = feetH + rand(14, 46) - MINI_R;                          // bounce top lands on his legs or body
    const p = rand(0.55, 0.72), arrive = (x - MX) / v;
    let ph = (0.5 * p - (time + arrive)) % p; if (ph < 0) ph += p;    // top of the bounce right at the clown
    return { kind: 'mini', x, r: MINI_R, rot: 0, spd, v, a, p, ph, passed: false };
  }
  const miniY = h => { const u = ((time + h.ph) % h.p) / h.p; return GY - h.r - 4 * h.a * u * (1 - u); };
  // A cannon at the right edge blinks "!" and beeps, then fires a human cannonball straight across at the
  // height of the clown's legs and body, so he always has to jump over it.
  function makeCannon() {
    const feetTop = GY - cur.r * 2;                                  // clown's feet when standing
    const y = feetTop - rand(14, 52);
    return { kind: 'cannon', x: viewW - 40, y, r: CANNON_R, wait: 1.0, fired: false, v: 0, fv: Math.min(700, speed * 1.6 + 90), recoil: 0, passed: false };
  }
  function spawnObstacle(force) {
    // every obstacle can show up from the very first point
    const opts = ['ring', 'mini', 'mini2', 'ring2', 'cannon'];
    if (!force && Math.random() > 0.55) return;
    const kind = force || opts[Math.floor(Math.random() * opts.length)];
    const x = viewW + 40, spd = rand(0.9, 1.15);
    if (kind === 'cannon') { hz.push(makeCannon()); beepBeep(); }
    else if (kind === 'ring') hz.push(makeRing(x, spd));
    else if (kind === 'ring2') {
      const a = makeRing(x, spd), b = makeRing(x, spd);
      b.x = a.x + speed * spd * rand(0.8, 1.0) + a.R + b.R;    // enough time to land between the two
      hz.push(a, b);
    } else if (kind === 'mini') hz.push(makeMini(x, rand(1, 1.25)));
    else { const s = rand(1, 1.2); hz.push(makeMini(x, s), makeMini(x + speed * s * rand(0.5, 0.7) + 30, s)); }
  }
  function addPoint(txt, x, y) {
    const prevSpeed = speedFor(score);
    score++; coins++; runCoins++;
    speed = speedFor(score);
    ding();
    if (txt) popups.push({ x, y, t: 0, txt });
    if (speedFor(score) > prevSpeed) popups.push({ x: viewW / 2, y: T() + 260, t: 0, txt: 'FASTER!', big: true });
    if (score % 5 === 0) saveProgress();
  }

  function reset() {
    score = 0; speed = speedFor(0); newBest = false; runCoins = 0;
    parts = []; tears = []; popups = []; hz = []; ballCount = 0; fastSlot = Math.floor(rand(0, 5)); warnT = 0; warned = false;
    cur = { kind: 'ball', x: MX, r: START_R, rot: 0, st: 'held', vx: 0, ph: 0, hop: null, spd: 1 };
    plats = [cur];
    mk.x = MX; mk.y = GY - START_R * 2; mk.vy = 0; mk.air = false; mk.holding = false; mk.fvx = 0; mk.spin = 0; mk.land = 0;
    spawnT = 0.6; ballDue = true;
  }
  function startRun() { reset(); state = 'play'; startMusic(); }

  function jump() {
    if (mk.air) return;
    mk.air = true; mk.jt = 0; mk.h0 = 0; mk.v0 = JUMP_V; mk.y0 = mk.y; mk.vy = -JUMP_V; mk.holding = true;
    oopsSound();
    for (let i = 0; i < 5; i++) parts.push({ x: mk.x, y: mk.y, vx: rand(-90, 90), vy: rand(-90, -20), life: 0.35, max: 0.35, c: '#fff3a0', r: rand(1.5, 2.5) });
  }
  function landOn(p, y) {
    mk.air = false; mk.y = y; mk.vy = 0; mk.holding = false; mk.land = 0.18;
    boing();
    if (p === cur) return;
    if (cur && cur.st === 'held') knock(cur, 120);
    p.st = 'held'; cur = p;
    const perfect = Math.abs(MX - p.x) < p.r * 0.18;
    addPoint(perfect ? 'PERFECT!' : '+1', MX + 34, y - 82);
    for (let i = 0; i < 14; i++) {
      const a = rand(Math.PI, Math.PI * 2), s = rand(60, 200);
      parts.push({ x: MX, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, c: '#fff3a0', r: rand(1.5, 3), star: true });
    }
    spawnT = rand(0.15, 0.8); ballDue = true;
  }
  function die() {
    state = 'dying'; overT = 0;
    stopMusic(); cry();
    if (navigator.vibrate) { try { navigator.vibrate(120); } catch (e) {} }
    mk.air = false; mk.holding = false;
    mk.vy = lastHit === 'fall' ? 0 : -300; mk.fvx = lastHit === 'fall' ? 0 : -70; mk.spin = 0;
    const burnt = lastHit === 'rim' || lastHit === 'miss';
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2), s = rand(60, 280);
      parts.push({ x: mk.x, y: mk.y - 40, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.8), max: 0.8,
        c: burnt ? (Math.random() < 0.5 ? '#ffb000' : '#ff4d00') : (Math.random() < 0.5 ? '#fff3a0' : '#ffb000'), r: rand(1.5, 3.5), star: !burnt });
    }
    if (score > best) { best = score; newBest = true; store.set('cc_best', String(best)); }
    saveProgress();
  }

  // ---------- Buttons & input ----------
  let buttons = [];   // rebuilt every frame: {x, y, w, h, on}
  const btn = (x, y, w, h, on) => { buttons.push({ x, y, w, h, on }); };

  function openShop() {
    state = 'shop'; shopIdx = Math.max(0, CLOWNS.findIndex(b => b.id === selectedId)); shopCryT = 0;
    startMusic(); CLOWNS.forEach(preloadClown);
  }
  function shopAction() {
    const b = CLOWNS[shopIdx];
    if (owned.includes(b.id)) { selectedId = b.id; saveProgress(); flash(b.name + ' is ready!'); oopsSound(b); return; }
    if (coins >= b.price) {
      coins -= b.price; owned.push(b.id); selectedId = b.id; saveProgress();
      flash('You got ' + b.name + '!'); oopsSound(b); burstAt(viewW / 2, 250, 30);
    } else flash('Score ' + (b.price - coins) + ' more points to unlock');
  }
  function flash(m) { shopMsg = m; shopMsgT = 2.2; }
  function burstAt(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(60, 260);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8, max: 0.8, c: Math.random() < 0.5 ? '#fff3a0' : '#ffb000', r: rand(1.5, 3.5), star: true });
    }
  }

  function onPress(px, py) {
    ensureAudio();
    const x = px / scale, y = py / scale - offY;
    if (px >= 0) {
      for (let i = buttons.length - 1; i >= 0; i--) {
        const b = buttons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.on(); return; }
      }
    }
    if (state === 'title') startRun();
    else if (state === 'play') jump();
    else if (state === 'paused') { state = 'play'; startMusic(); }
    else if (state === 'over' && overT > 0.8) startRun();
  }
  // Letting go early makes a lower jump (tap = small hop, hold = big jump).
  function release() {
    if (!mk.air || !mk.holding) return;
    mk.holding = false;
    const v = mk.v0 - GRAV * mk.jt;
    if (v > CUT_V) {
      mk.h0 = mk.h0 + mk.v0 * mk.jt - 0.5 * GRAV * mk.jt * mk.jt;
      mk.v0 = CUT_V; mk.jt = 0;
    }
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    onPress((e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height);
  }, { passive: false });
  const JUMP_KEYS = ['Space', 'ArrowUp', 'Enter'];
  window.addEventListener('keydown', e => { if (JUMP_KEYS.includes(e.code)) { e.preventDefault(); if (!e.repeat) onPress(-1, -1); } });
  window.addEventListener('keyup', e => { if (JUMP_KEYS.includes(e.code)) release(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state === 'play') { state = 'paused'; musicActive = false; }
      if (actx) actx.suspend().catch(() => {});
    } else if (actx) actx.resume().catch(() => {});
  });

  // ---------- Collision helpers ----------
  function circHit(ax, ay, ar, bx, by, br) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy < (ar + br) * (ar + br); }
  // Same hitbox for every clown (body + head) so no clown is easier than another.
  const clownCircles = () => [{ x: mk.x, y: mk.y - 24 * MS, r: 11 * MS }, { x: mk.x + 5 * MS, y: mk.y - 46 * MS, r: 10 * MS }];
  const feetCircle = () => ({ x: mk.x + 2, y: mk.y - 6 * MS, r: 6 * MS });

  // ---------- Update ----------
  function update(dt) {
    time += dt;
    if (shopMsgT > 0) shopMsgT -= dt;
    if (shopCryT > 0) shopCryT -= dt;
    if (overMsgT > 0) overMsgT -= dt;
    if (mk.land > 0) mk.land -= dt;
    if (warnT > 0) warnT -= dt;
    if (state === 'title' || state === 'shop') {
      dist += 60 * dt; if (cur) cur.rot += dt * 0.8; updateFx(dt); return;
    }
    if (state === 'paused') return;

    if (state === 'play') dist += speed * 0.55 * dt;
    for (const p of plats) {
      if (p.st === 'come') { p.x -= speed * p.spd * dt; p.rot -= speed * p.spd * dt / p.r; }
      else if (p.st === 'held') {
        p.x += (MX - p.x) * Math.min(1, dt * 7);                 // the clown balances it back to the middle
        if (state === 'play') p.rot += speed * 0.55 * dt / p.r;  // the clown "walks" the ball forward
        if (p.hop) { p.hop.a *= Math.exp(-dt * 6); if (p.hop.a < 0.4) p.hop = null; }
      } else { p.x += p.vx * dt; p.rot += p.vx * dt / p.r; }
    }
    plats = plats.filter(p => p.x > -160);
    for (const h of hz) {
      if (h.kind === 'cannon') {
        if (!h.fired) {
          h.wait -= dt;
          if (h.wait <= 0 && state === 'play') {      // BOOM
            h.fired = true; h.v = h.fv; h.recoil = 1; boom();
            for (let i = 0; i < 14; i++) parts.push({ x: h.x - 24, y: h.y + rand(-10, 10), vx: rand(-180, 40), vy: rand(-70, 40), life: 0.7, max: 0.7, c: i % 3 ? '#e8e2dc' : '#ffb000', r: rand(3, 7) });
          }
        } else { h.x -= h.v * dt; h.recoil = Math.max(0, h.recoil - dt * 5); }
        continue;
      }
      const v = h.v || speed * h.spd; h.x -= v * dt; if (h.kind === 'mini') h.rot -= v * dt / h.r;
    }
    hz = hz.filter(h => h.x > -140);

    if (state === 'play') {
      // a rolling ball bumps the ball under the clown
      if (cur && cur.st === 'held') {
        for (const p of plats) {
          if (p.st !== 'come' || !touching(p, cur)) continue;
          thump(); knock(cur);
          if (!mk.air) { lastHit = 'knock'; die(); return; }
          break;
        }
      }
      // what comes next: maybe an obstacle, then the next ball once the obstacles are about to pass
      if (ballDue && !plats.some(p => p.st === 'come')) {
        if (spawnT > 0) { spawnT -= dt; if (spawnT <= 0) spawnObstacle(); }
        else if (hz.every(h => h.x < MX + (h.kind === 'ring' ? -10 : 30))) {
          // a very fast ball is announced with a "!" at the right edge first
          if (nextIsFast() && !warned) { warned = true; warnT = 0.9; beepBeep(); }
          else if (warnT <= 0) { spawnBall(); ballDue = false; warned = false; }
        }
      }

      if (!mk.air) {
        const t = cur ? topAt(cur, mk.x) : null;
        if (t === null) { mk.air = true; mk.jt = 0; mk.h0 = 0; mk.v0 = 0; mk.y0 = mk.y; mk.holding = false; }
        else mk.y = t;
      }
      if (mk.air) {
        mk.jt += dt;
        const yPrev = mk.y;
        const h = mk.h0 + mk.v0 * mk.jt - 0.5 * GRAV * mk.jt * mk.jt;
        mk.vy = -(mk.v0 - GRAV * mk.jt);
        mk.y = mk.y0 - h;
        if (mk.vy >= 0) {
          for (const p of plats) {
            if (p.st === 'gone' || p.spiky) continue;
            const t = topAt(p, mk.x);
            if (t !== null && yPrev <= t + 1.5 && mk.y >= t) {
              if (Math.abs(mk.x - p.x) > p.r * EDGE) { lastHit = 'slip'; die(); return; }
              landOn(p, t); break;
            }
          }
        }
        if (mk.air && mk.y >= GY) { mk.y = GY; lastHit = 'fall'; die(); return; }
        if (mk.air) {
          // ran into the side of a rolling ball
          const cs = clownCircles();
          for (const p of plats) {
            if (p.st !== 'come' || p.spiky) continue;
            const t = topAt(p, mk.x);
            if (t !== null && mk.y <= t + 3) continue;
            const by = ballCY(p);
            if (cs.some(c => circHit(c.x, c.y, c.r, p.x, by, p.r - 3))) { lastHit = 'bump'; die(); return; }
          }
        }
      }

      // obstacles
      const cs = clownCircles(), all = cs.concat([feetCircle()]);
      // spiky balls hurt anywhere on them, spikes included: no landing on one, no touching it
      for (const p of plats) {
        if (!p.spiky || p.st !== 'come') continue;
        const by = ballCY(p), R = p.r + SPIKE;
        if (all.some(c => circHit(c.x, c.y, c.r, p.x, by, R - 1))) { lastHit = 'spike'; die(); return; }
      }
      for (const o of hz) {
        if (o.kind === 'cannon') {
          if (!o.fired) continue;
          if (all.some(c => circHit(c.x, c.y, c.r, o.x, o.y, o.r - 1))) { lastHit = 'cannon'; die(); return; }
          if (!o.passed && o.x + o.r < mk.x - 16) { o.passed = true; addPoint('DODGE +1', mk.x + 20, mk.y - 90); }
        } else if (o.kind === 'ring') {
          for (const c of cs) {
            if (circHit(c.x, c.y, c.r, o.x, o.cy - o.R, RIM) || circHit(c.x, c.y, c.r, o.x, o.cy + o.R, RIM)) { lastHit = 'rim'; die(); return; }
          }
          if (!o.judged && o.x <= mk.x) {
            o.judged = true;
            if (cs.some(c => c.y < o.cy - o.R || c.y > o.cy + o.R)) { lastHit = 'miss'; die(); return; }
          }
          if (!o.passed && o.x + RIM < cs[0].x - cs[0].r) {
            o.passed = true;
            addPoint('RING +1', o.x, o.cy - o.R - 18);
            for (let i = 0; i < 14; i++) {
              const a = rand(0, Math.PI * 2), s = rand(60, 200);
              parts.push({ x: o.x, y: o.cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, c: '#fff3a0', r: rand(1.5, 3), star: true });
            }
          }
        } else {
          const y = miniY(o);
          if (all.some(c => circHit(c.x, c.y, c.r, o.x, y, o.r - 1))) { lastHit = 'mini'; die(); return; }
          if (!o.passed && o.x + o.r < mk.x - 16) { o.passed = true; addPoint('DODGE +1', mk.x + 20, mk.y - 90); }
        }
      }
    }

    if (state === 'dying' || state === 'over') {
      overT += dt;
      if (mk.y < GY || mk.vy < 0) {
        mk.vy += GRAV * dt; mk.y += mk.vy * dt; mk.x += mk.fvx * dt; mk.spin += dt * 9 * (mk.fvx ? -1 : 0);
        if (mk.y >= GY) { mk.y = GY; mk.vy = 0; mk.fvx = 0; mk.spin = 0; }
      }
      if (state === 'dying' && overT > 0.35 && mk.y >= GY) { state = 'over'; }
      if (mk.y >= GY && Math.random() < dt * 7) {
        const side = Math.random() < 0.5 ? -1 : 1;
        tears.push({ x: mk.x + 12 + side * 5, y: mk.y - 42, vx: rand(-30, 70) * side, vy: rand(-90, -30), life: 1.2 });
      }
    }
    updateFx(dt);
  }
  function updateFx(dt) {
    for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }
    parts = parts.filter(p => p.life > 0);
    for (const t of tears) { t.life -= dt; t.x += t.vx * dt; t.y += t.vy * dt; t.vy += 700 * dt; if (t.y > GY) { t.y = GY; t.vy = 0; t.vx = 0; } }
    tears = tears.filter(t => t.life > 0);
    for (const p of popups) { p.t += dt; p.y -= 40 * dt; }
    popups = popups.filter(p => p.t < (p.big ? 1.2 : 0.9));
  }

  const TENT_A = '#f8f2ff', TENT_B = '#b38af2';   // tent stripes: light lavender + light purple
  // ---------- Drawing: circus background ----------
  function drawBackground() {
    const W = viewW;
    const sw = 56, off = (dist * 0.25) % (sw * 2);
    const top = T();
    ctx.fillStyle = TENT_A; ctx.fillRect(0, top, W, viewH);
    ctx.fillStyle = TENT_B;
    for (let x = -off; x < W + sw * 2; x += sw * 2) ctx.fillRect(x, top, sw, viewH);
    let g = ctx.createLinearGradient(0, top, 0, GY);
    g.addColorStop(0, 'rgba(60,20,110,0.45)'); g.addColorStop(0.35, 'rgba(60,20,110,0.04)');
    g.addColorStop(0.8, 'rgba(60,20,110,0.08)'); g.addColorStop(1, 'rgba(60,20,110,0.3)');
    ctx.fillStyle = g; ctx.fillRect(0, top, W, GY - top);

    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [[W * 0.18, W * 0.3], [W * 0.82, W * 0.45]].forEach(([sx, tx], i) => {
      const sway = Math.sin(time * 0.6 + i * 2) * 60;
      const lg = ctx.createLinearGradient(0, top, 0, GY);
      lg.addColorStop(0, 'rgba(255,250,210,0.28)'); lg.addColorStop(1, 'rgba(255,250,210,0.04)');
      ctx.fillStyle = lg; ctx.beginPath();
      ctx.moveTo(sx - 12, top); ctx.lineTo(sx + 12, top);
      ctx.lineTo(tx + sway + 110, GY); ctx.lineTo(tx + sway - 110, GY); ctx.closePath(); ctx.fill();
    });
    ctx.restore();

    const vo = (dist * 0.25) % 80;
    ctx.fillStyle = '#7347c4';
    ctx.fillRect(0, top, W, 22);
    for (let x = -vo - 80; x < W + 80; x += 80) { ctx.beginPath(); ctx.arc(x + 40, top + 22, 40, 0, Math.PI); ctx.fill(); }
    ctx.fillStyle = '#e8b93a';
    for (let x = -vo - 80; x < W + 80; x += 80) { ctx.beginPath(); ctx.arc(x + 40, top + 62, 5, 0, Math.PI * 2); ctx.fill(); }
    for (let x = -vo - 80, i = 0; x < W + 80; x += 40, i++) {
      const on = ((i + Math.floor(time * 3)) % 3) !== 0;
      const bx = x + 20, by = top + 26 + (i % 2 ? 12 : 4);
      if (on) {
        const rg = ctx.createRadialGradient(bx, by, 0, bx, by, 16);
        rg.addColorStop(0, 'rgba(255,230,120,0.9)'); rg.addColorStop(1, 'rgba(255,200,60,0)');
        ctx.fillStyle = rg; ctx.fillRect(bx - 16, by - 16, 32, 32);
      }
      ctx.fillStyle = on ? '#fff6c2' : '#9c7a3a';
      ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
    }

    const ao = (dist * 0.45) % 34;
    ctx.fillStyle = 'rgba(55,25,95,0.8)';
    ctx.fillRect(0, GY - 70, W, 30);
    for (let x = -ao - 34, i = 0; x < W + 34; x += 34, i++) {
      const bob = Math.sin(time * 4 + i * 1.7) * 2;
      const hy = GY - 78 + ((i * 7) % 5) + bob;
      ctx.beginPath(); ctx.arc(x + 17, hy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 17, hy + 20, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
    }

    const co = (dist * 0.7) % 60;
    ctx.fillStyle = '#9466e6'; ctx.fillRect(0, GY - 44, W, 30);
    ctx.fillStyle = '#e8b93a'; ctx.fillRect(0, GY - 44, W, 4); ctx.fillRect(0, GY - 18, W, 4);
    for (let x = -co - 60; x < W + 60; x += 60) {
      ctx.beginPath(); ctx.moveTo(x + 30, GY - 38); ctx.lineTo(x + 38, GY - 29); ctx.lineTo(x + 30, GY - 20); ctx.lineTo(x + 22, GY - 29); ctx.closePath(); ctx.fill();
    }

    g = ctx.createLinearGradient(0, GY - 14, 0, top + viewH);
    g.addColorStop(0, '#c98f4c'); g.addColorStop(1, '#8a5a2b');
    ctx.fillStyle = g; ctx.fillRect(0, GY - 14, W, top + viewH - GY + 14);
    const fo = dist % 97;
    ctx.fillStyle = 'rgba(90,50,20,0.35)';
    for (let x = -fo - 97, i = 0; x < W + 97; x += 97, i++) {
      for (let j = 0; j < 5; j++) {
        const px = x + ((j * 37 + i * 13) % 97), py = GY + 6 + ((j * 23 + i * 11) % Math.max(55, top + viewH - GY - 10));
        ctx.fillRect(px, py, 4, 2);
      }
    }
  }

  // ---- colour helpers ----
  function hexRgb(h) {
    h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }
  const lighten = (c, t) => mix(c, '#ffffff', t), darken = (c, t) => mix(c, '#000000', t);
  const isDark = c => { const [r, g, b] = hexRgb(c); return r * 0.3 + g * 0.59 + b * 0.11 < 70; };
  function tuft(pts, r, fill, LN) {
    ctx.fillStyle = LN; pts.forEach(([x, y, k]) => { ctx.beginPath(); ctx.arc(x, y, r * (k || 1) + 1.2, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = fill; pts.forEach(([x, y, k]) => { ctx.beginPath(); ctx.arc(x, y, r * (k || 1), 0, Math.PI * 2); ctx.fill(); });
  }
  function vgrad(y0, y1, top, bot) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bot); return g; }
  // two-segment leg with an outline, thicker at the top, and a paw
  function limb(x0, y0, a1, l1, a2, l2, w, col, pawCol, LN) {
    const x1 = x0 + Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1;
    const x2 = x1 + Math.sin(a2) * l2, y2 = y1 + Math.cos(a2) * l2;
    const xm = x0 + (x1 - x0) * 0.65, ym = y0 + (y1 - y0) * 0.65;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = LN;
    ctx.lineWidth = w + 2.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineWidth = w + 4.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.stroke();
    ctx.fillStyle = LN; ctx.beginPath(); ctx.ellipse(x2 + 1.6, y2 + 0.4, w * 0.8 + 1.1, w * 0.5 + 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pawCol; ctx.beginPath(); ctx.ellipse(x2 + 1.6, y2, w * 0.8, w * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  function outlinedStroke(path, w, col, LN) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = LN; ctx.lineWidth = w + 2.4; path(); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; path(); ctx.stroke();
  }


  // ---------- Drawing: circus ball (same look as the Circus Dogs ball, bigger) ----------
  function drawBall(b) {
    const hb = hopH(b), y = GY - b.r - hb, sh = 1 - Math.min(0.5, hb / 90);
    ctx.fillStyle = 'rgba(60,25,5,' + (0.35 * sh) + ')'; ctx.beginPath(); ctx.ellipse(b.x + 3, GY + 3, b.r * 0.95 * sh, 7 * sh, 0, 0, Math.PI * 2); ctx.fill();
    if (b.fast && b.st === 'come') {   // speed streaks behind a very fast ball
      ctx.strokeStyle = 'rgba(60,20,110,0.6)'; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const ly = y + i * b.r * 0.55, len = b.r * (1.1 - Math.abs(i) * 0.35) + Math.sin(time * 30 + i) * 4;
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x + b.r * 0.9 + 6, ly); ctx.lineTo(b.x + b.r * 0.9 + 6 + len, ly); ctx.stroke();
      }
    }
    if (b.spiky) {   // dark ball with metal spikes: never land on it
      const gl = ctx.createRadialGradient(b.x, y, b.r * 0.8, b.x, y, b.r + 22);
      gl.addColorStop(0, 'rgba(255,40,40,' + (0.28 + 0.12 * Math.sin(time * 10)) + ')'); gl.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = gl; ctx.fillRect(b.x - b.r - 24, y - b.r - 24, b.r * 2 + 48, b.r * 2 + 48);
      ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#3a0712'; ctx.fillStyle = '#d5dae3';
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = b.rot + i * Math.PI * 2 / n, w = 0.2;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a - w) * (b.r - 2), y + Math.sin(a - w) * (b.r - 2));
        ctx.lineTo(b.x + Math.cos(a) * (b.r + SPIKE), y + Math.sin(a) * (b.r + SPIKE));
        ctx.lineTo(b.x + Math.cos(a + w) * (b.r - 2), y + Math.sin(a + w) * (b.r - 2));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ballAt(b.x, y, b.r, b.rot, ['#2a2233', '#d4202a']);
      return;
    }
    ballAt(b.x, y, b.r, b.rot);
  }
  // cannon on a stand at the right edge of the screen
  function drawCannon(o) {
    const cx = viewW + 6 + o.recoil * 7, y = o.y;
    ctx.fillStyle = 'rgba(60,25,5,0.3)'; ctx.beginPath(); ctx.ellipse(viewW - 18, GY + 3, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
    // stand
    ctx.fillStyle = '#6b3f1d'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(viewW - 34, GY); ctx.lineTo(viewW - 12, y + 12); ctx.lineTo(viewW + 6, y + 12); ctx.lineTo(viewW + 14, GY); ctx.closePath(); ctx.fill(); ctx.stroke();
    // barrel
    const bx0 = cx - 56, bx1 = cx + 40;
    ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#2a1408';
    ctx.fillStyle = '#b3282f'; ctx.beginPath(); ctx.moveTo(bx0, y - 16); ctx.lineTo(bx1, y - 20); ctx.lineTo(bx1, y + 20); ctx.lineTo(bx0, y + 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(bx0 + 20, y - 17, 8, 34); ctx.fillRect(bx0 + 46, y - 18, 8, 36);
    ctx.fillStyle = '#d9d2c6'; ctx.beginPath(); ctx.ellipse(bx0, y, 6, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();   // muzzle ring
    ctx.fillStyle = '#1a0d12'; ctx.beginPath(); ctx.ellipse(bx0, y, 3.5, 13, 0, 0, Math.PI * 2); ctx.fill();
    // wheel
    ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.arc(viewW - 2, y + 20, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1408'; ctx.beginPath(); ctx.arc(viewW - 2, y + 20, 4, 0, Math.PI * 2); ctx.fill();
  }
  // the human cannonball: helmet, goggles, red suit, flying with arms out front
  function drawHuman(o) {
    ctx.save(); ctx.translate(o.x, o.y);
    // speed streaks and a flame trail
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(60,20,110,0.55)'; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) { const len = 34 - Math.abs(i) * 8 + Math.sin(time * 40 + i) * 5; ctx.beginPath(); ctx.moveTo(22, i * 9); ctx.lineTo(22 + len, i * 9); ctx.stroke(); }
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5;
    // scarf
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(4, -7); ctx.quadraticCurveTo(22, -14 + Math.sin(time * 35) * 4, 36, -6 + Math.sin(time * 35 + 1) * 5); ctx.lineTo(30, -1); ctx.quadraticCurveTo(18, -6, 4, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // legs (behind)
    ctx.fillStyle = '#2a7de1';
    ctx.beginPath(); ctx.ellipse(16, 4, 9, 4.5, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(17, 10, 9, 4.5, -0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(25, 5, 4, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(26, 11, 4, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // body
    ctx.fillStyle = '#e5262f'; ctx.beginPath(); ctx.ellipse(4, 2, 15, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-2, -7, 4, 18);
    // arms out front
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-14, -1, 9, 4, -0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-12, 7, 9, 4, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // head with helmet and goggles
    ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(-9, -3, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.arc(-8, -5, 10.5, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#2a1408'; ctx.beginPath(); ctx.ellipse(-14, -3, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-15, -3, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e5262f'; ctx.beginPath(); ctx.arc(-19, 0, 2.6, 0, Math.PI * 2); ctx.fill();   // red nose
    ctx.restore();
  }
  function ballAt(x, y, r, rot, cols = ['#e5262f', '#ffd23a', '#2a7de1', '#ffd23a']) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillRect(-r, -r, r * 2, r * 2);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 1.5, rot + i * Math.PI / 4, rot + (i + 1) * Math.PI / 4); ctx.closePath(); ctx.fill();
    }
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = r < 15 ? 2 : 3; ctx.strokeStyle = '#3a0712'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }
  // tiny bouncing ball (purple/green so it never looks like a ball you can stand on)
  function drawMini(h) {
    const y = miniY(h), up = GY - h.r - y, sh = 1 - Math.min(0.7, up / 160);
    ctx.fillStyle = 'rgba(60,25,5,' + (0.35 * sh) + ')'; ctx.beginPath(); ctx.ellipse(h.x + 2, GY + 3, h.r * sh, 4 * sh, 0, 0, Math.PI * 2); ctx.fill();
    // little warning sparkles around it
    ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 12);
    ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = time * 3 + i * Math.PI / 2, x1 = h.x + Math.cos(a) * (h.r + 4), y1 = y + Math.sin(a) * (h.r + 4);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(h.x + Math.cos(a) * (h.r + 9), y + Math.sin(a) * (h.r + 9)); ctx.stroke();
    }
    ctx.restore();
    ballAt(h.x, y, h.r, h.rot, ['#7a2be2', '#5ef08a']);
  }

  // ---------- Drawing: hanging ring of fire ----------
  function drawFlames(r, front) {
    const n = Math.max(12, Math.round(r.R / 3.2));
    ctx.save();   // normal blending so the flames stay bright on the light tent
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cosA = Math.cos(a);
      if (front ? cosA > 0.05 : cosA <= 0.05) continue;
      const px = r.x - cosA * r.rx, py = r.cy + Math.sin(a) * r.R;
      const fl = 0.6 + 0.4 * Math.sin(time * 14 + i * 2.3 + r.seed);
      const h = (15 + 10 * fl) * (0.8 + 0.2 * Math.sin(i * 5.1 + r.seed));
      const ox = -cosA * 0.4, oy = Math.sin(a) * 0.6 - 0.9;
      const tipX = px + ox * h, tipY = py + oy * h;
      const fg = ctx.createRadialGradient(px, py, 0, px, py, h);
      fg.addColorStop(0, 'rgba(255,240,150,1)'); fg.addColorStop(0.45, 'rgba(255,120,10,0.95)'); fg.addColorStop(1, 'rgba(220,30,0,0.1)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(px - 6, py);
      ctx.quadraticCurveTo(px - 4, (py + tipY) / 2, tipX, tipY);
      ctx.quadraticCurveTo(px + 4, (py + tipY) / 2, px + 6, py);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawRingBack(r) {
    const gl = ctx.createRadialGradient(r.x, r.cy, r.R * 0.6, r.x, r.cy, r.R * 1.6);
    gl.addColorStop(0, 'rgba(255,120,0,0)'); gl.addColorStop(0.5, 'rgba(255,120,0,0.22)'); gl.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = gl; ctx.fillRect(r.x - r.R * 1.6, r.cy - r.R * 1.6, r.R * 3.2, r.R * 3.2);
    // chain up to the top of the tent
    const y0 = T() + 20, y1 = r.cy - r.R - 4;
    ctx.strokeStyle = '#4a4e57'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x, y0); ctx.lineTo(r.x, y1); ctx.stroke();
    ctx.strokeStyle = '#a9adb6'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(r.x - 0.5, y0); ctx.lineTo(r.x - 0.5, y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#e8b93a'; ctx.beginPath(); ctx.arc(r.x, y1, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = '#5a2a10';
    ctx.beginPath(); ctx.ellipse(r.x, r.cy, r.rx, r.R, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    drawFlames(r, false);
  }
  function drawRingFront(r) {
    ctx.lineWidth = 8; ctx.strokeStyle = '#8a3b12';
    ctx.beginPath(); ctx.ellipse(r.x, r.cy, r.rx, r.R, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffb347';
    ctx.beginPath(); ctx.ellipse(r.x, r.cy, r.rx, r.R, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    drawFlames(r, true);
  }

  // ---------- Drawing: clowns ----------
  const INK = '#1b1113', TEAR = 'rgba(120,190,255,0.9)';
  function cpal(L) {
    if (!L._pal) {
      const SU = L.suit || '#e5262f', skin = L.face === 'skin';
      const F = skin ? (L.skin || '#f2c9a0') : '#fff8f0';
      L._pal = { SU, S2: L.suit2 || '#ffd23a', SD: darken(SU, 0.22), LN: darken(SU, 0.6), PA: L.pants || SU, F, FL: skin ? darken(F, 0.45) : '#b9a9a0',
        GL: L.glove || '#ffffff', SH: L.shoes || '#2a7de1', NO: L.nose === undefined ? '#e5262f' : L.nose, MO: L.mouth || '#e5262f',
        EC: L.eyeCol || '#2a7de1', CH: L.cheeks === undefined ? 'rgba(255,110,140,0.45)' : L.cheeks, WG: L.wigCol || '#ff7a1a',
        HC: L.hatCol || '#2a7de1', H2: L.hat2 || '#ffd23a' };
    }
    return L._pal;
  }
  function star(x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  // suit pattern, drawn inside a clip around (cx, cy) with half-size w, h
  function suitPattern(L, P, cx, cy, w, h, k = 1) {
    const c2 = P.S2, x0 = cx - w, y0 = cy - h, x1 = cx + w, y1 = cy + h;
    ctx.fillStyle = c2;
    switch (L.pattern) {
      case 'dots': for (let y = y0, j = 0; y < y1 + 6; y += 7 * k, j++) for (let x = x0 + (j % 2) * 3.5 * k; x < x1 + 6; x += 7 * k) { ctx.beginPath(); ctx.arc(x, y, 1.9 * k, 0, Math.PI * 2); ctx.fill(); } break;
      case 'stripes': for (let x = x0; x < x1; x += 7 * k) ctx.fillRect(x, y0, 3.2 * k, h * 2); break;
      case 'hstripes': for (let y = y0; y < y1; y += 6.5 * k) ctx.fillRect(x0, y, w * 2, 3 * k); break;
      case 'check': for (let y = y0, j = 0; y < y1; y += 5 * k, j++) for (let x = x0 + (j % 2) * 5 * k; x < x1; x += 10 * k) ctx.fillRect(x, y, 5 * k, 5 * k); break;
      case 'diamond':
        for (let y = y0, j = 0; y < y1 + 8; y += 8 * k, j++) for (let x = x0 + (j % 2) * 5 * k; x < x1 + 8; x += 10 * k) {
          ctx.beginPath(); ctx.moveTo(x, y - 4 * k); ctx.lineTo(x + 5 * k, y); ctx.lineTo(x, y + 4 * k); ctx.lineTo(x - 5 * k, y); ctx.closePath(); ctx.fill();
        } break;
      case 'stars': for (let y = y0 + 3, j = 0; y < y1 + 4; y += 8 * k, j++) for (let x = x0 + (j % 2) * 4 * k; x < x1 + 4; x += 8 * k) star(x, y, 2.4 * k, c2); break;
      case 'half': ctx.fillRect(x0, y0, w, h * 2); break;
      case 'confetti': {
        const cols = ['#e5262f', '#2a7de1', '#ffd23a', '#2f9e5b', '#ff6ab2', '#7a2be2'];
        for (let y = y0, j = 0; y < y1 + 4; y += 5 * k, j++) for (let x = x0 + (j % 3) * 2 * k, i = 0; x < x1 + 4; x += 6 * k, i++) {
          ctx.fillStyle = cols[(i * 7 + j * 3) % cols.length]; ctx.save(); ctx.translate(x, y); ctx.rotate((i + j) * 0.9); ctx.fillRect(-1.6 * k, -0.8 * k, 3.2 * k, 1.6 * k); ctx.restore();
        } break;
      }
      case 'patch':
        ctx.fillStyle = c2; ctx.fillRect(cx - w * 0.6, cy - h * 0.1, w * 0.55, h * 0.45);
        ctx.fillStyle = '#7a8a5a'; ctx.fillRect(cx + w * 0.15, cy - h * 0.6, w * 0.4, h * 0.35);
        ctx.strokeStyle = 'rgba(255,240,200,0.7)'; ctx.lineWidth = 0.7 * k; ctx.setLineDash([1.5 * k, 1.5 * k]);
        ctx.strokeRect(cx - w * 0.6, cy - h * 0.1, w * 0.55, h * 0.45); ctx.strokeRect(cx + w * 0.15, cy - h * 0.6, w * 0.4, h * 0.35); ctx.setLineDash([]);
        break;
      default: break;
    }
  }
  function ruffAt(x, y, col, k = 1, rx = 9, ry = 3.4) {
    if (!col) return;
    const LNc = darken(col, 0.35), n = 9;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? col : LNc;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k;
        ctx.beginPath(); ctx.arc(px, py, (pass ? 2.9 : 3.6) * k, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function bowTie(x, y, col, s = 1) {
    ctx.fillStyle = darken(col, 0.3);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7 * s, y - 4.5 * s); ctx.lineTo(x - 7 * s, y + 4.5 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7 * s, y - 4.5 * s); ctx.lineTo(x + 7 * s, y + 4.5 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6 * s, y - 3.5 * s); ctx.lineTo(x - 6 * s, y + 3.5 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6 * s, y - 3.5 * s); ctx.lineTo(x + 6 * s, y + 3.5 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 2 * s, 0, Math.PI * 2); ctx.fill();
  }
  // big clown shoe pointing right; (x, y) = heel on the ground
  function shoe(x, y, col, k = 1, ang = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    ctx.fillStyle = darken(col, 0.5); ctx.beginPath(); ctx.ellipse(5, -3.2, 10.4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(5, -3.4, 9.2, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(8, -5, 3.4, 1.4, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function glove(x, y, col, k = 1) {
    ctx.fillStyle = '#9a8a8a'; ctx.beginPath(); ctx.arc(x, y, 3.9 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.1 * k, 0, Math.PI * 2); ctx.fill();
  }
  function dizzy(x, y, k = 1) {
    for (let i = 0; i < 3; i++) {
      const a = time * 4 + i * Math.PI * 2 / 3, px = x + Math.cos(a) * 13 * k, py = y + Math.sin(a) * 4 * k;
      ctx.save(); ctx.translate(px, py); ctx.rotate(time * 5); star(0, 0, 4 * k, '#ffe14a'); ctx.restore();
    }
  }

  // hats; (x, y) = middle of the hat's base on top of the head. k = size
  function clownHat(L, P, x, y, k = 1, tilt = -0.2, swing = 0) {
    const t = L.hat || 'none';
    if (t === 'none') return;
    const C = P.HC, C2 = P.H2, D = darken(C, 0.4);
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(k, k);
    ctx.lineJoin = 'round';
    if (t === 'cone') {
      ctx.fillStyle = D; ctx.beginPath(); ctx.moveTo(-8.5, 1); ctx.lineTo(1, -19.5); ctx.lineTo(8.5, 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C; ctx.beginPath(); ctx.moveTo(-7.5, 0); ctx.lineTo(1, -18); ctx.lineTo(7.5, 0); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = C2; [-3, -9, -15].forEach(dy => { ctx.beginPath(); ctx.arc(-2 + dy * 0.1, dy, 1.6, 0, Math.PI * 2); ctx.arc(3 + dy * 0.1, dy + 3, 1.3, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
      ctx.fillStyle = darken(C2, 0.3); ctx.beginPath(); ctx.arc(1 + swing, -19.5, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C2; ctx.beginPath(); ctx.arc(1 + swing, -19.5, 2.9, 0, Math.PI * 2); ctx.fill();
    } else if (t === 'top' || t === 'tiny') {
      const s = t === 'tiny' ? 0.6 : 1;
      if (t === 'tiny') ctx.translate(3, 0);
      ctx.scale(s, s);
      ctx.fillStyle = D; ctx.fillRect(-6.5, -15, 13, 15.5); ctx.beginPath(); ctx.ellipse(0, 0, 11, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C; ctx.fillRect(-5.6, -14.2, 11.2, 14); ctx.beginPath(); ctx.ellipse(0, -0.2, 10, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C2; ctx.fillRect(-5.6, -5, 11.2, 2.8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-4.5, -13.5, 2, 12);
    } else if (t === 'bowler' || t === 'flower') {
      ctx.fillStyle = D; ctx.beginPath(); ctx.ellipse(0, 0, 11, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -1, 7.6, 7.4, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C; ctx.beginPath(); ctx.ellipse(0, -1, 6.7, 6.6, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -0.2, 10, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C2; ctx.fillRect(-6.6, -3, 13.2, 2);
      if (t === 'flower') {
        const fx = 3 + swing * 2, fy = -17;
        ctx.strokeStyle = '#2f9e5b'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(2, -6); ctx.quadraticCurveTo(5, -11, fx, fy); ctx.stroke();
        ctx.fillStyle = C2; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + time; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 2.8, fy + Math.sin(a) * 2.8, 2.1, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(fx, fy, 1.7, 0, Math.PI * 2); ctx.fill();
      }
    } else if (t === 'jester') {
      [[-1, C], [1, C2]].forEach(([sd, col]) => {
        const tx = sd * 10 + swing * 2, ty = -10 + Math.sin(time * 4 + sd) * 1.2;
        ctx.fillStyle = darken(col, 0.4); ctx.beginPath(); ctx.moveTo(-6.5, 1); ctx.quadraticCurveTo(sd * 2, -15, tx, ty); ctx.quadraticCurveTo(sd * 2, -6, 6.5, 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.quadraticCurveTo(sd * 2, -13.5, tx, ty); ctx.quadraticCurveTo(sd * 2, -5.5, 5.5, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(tx, ty + 1.5, 2.2, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = C2; ctx.fillRect(-6.5, -2, 13, 2.6);
    } else if (t === 'propeller') {
      ctx.fillStyle = D; ctx.beginPath(); ctx.ellipse(0, 0, 8.2, 7.2, 0, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? C2 : C; ctx.beginPath(); ctx.moveTo(0, 0); ctx.ellipse(0, 0, 7.4, 6.4, 0, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#4a4e57'; ctx.fillRect(-0.6, -9.5, 1.2, 3.5);
      const sp = Math.sin(time * 22);
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(0, -9.8, 8 * Math.abs(sp) + 1, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (t === 'cap') {   // Pierrot skull cap
      ctx.fillStyle = C; ctx.beginPath(); ctx.ellipse(-0.5, 2, 9.6, 8, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    } else if (t === 'beret') {
      ctx.fillStyle = D; ctx.beginPath(); ctx.ellipse(-1, -2, 10.5, 4.4, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C; ctx.beginPath(); ctx.ellipse(-1, -2.4, 9.6, 3.6, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = D; ctx.fillRect(-0.7, -7.5, 1.4, 2.5);
    }
    ctx.restore();
  }

  // wig parts behind the head (side view)
  function wigBack(L, P, hx, hy, k = 1) {
    const w = L.wig || 'none', C = P.WG, D = darken(C, 0.35);
    const puffs = pts => { ctx.fillStyle = D; pts.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill(); }); ctx.fillStyle = C; pts.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }); };
    if (w === 'afro') puffs([[hx - 9, hy + 3, 6], [hx - 10, hy - 4, 6.5], [hx - 6, hy - 10, 6.5], [hx + 1, hy - 12, 6], [hx + 7, hy - 10, 5], [hx - 4, hy + 7, 4.5]]);
    else if (w === 'sides') puffs([[hx - 10, hy - 1, 5.5], [hx - 9, hy + 5, 5], [hx - 5, hy + 8, 4], [hx - 7, hy - 7, 4]]);
    else if (w === 'long') { ctx.fillStyle = D; ctx.beginPath(); ctx.ellipse(hx - 6, hy + 6, 8.5, 15, 0.15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = C; ctx.beginPath(); ctx.ellipse(hx - 6, hy + 6, 7.4, 14, 0.15, 0, Math.PI * 2); ctx.fill(); }
    else if (w === 'spiky') {
      ctx.fillStyle = D;
      for (let i = 0; i < 6; i++) { const a = Math.PI * (0.85 + i * 0.16), bx = hx + Math.cos(a) * 9, by = hy + Math.sin(a) * 9, tx = hx + Math.cos(a) * 18, ty = hy + Math.sin(a) * 18;
        ctx.beginPath(); ctx.moveTo(bx + Math.cos(a + 1.6) * 4, by + Math.sin(a + 1.6) * 4); ctx.lineTo(tx, ty); ctx.lineTo(bx + Math.cos(a - 1.6) * 4, by + Math.sin(a - 1.6) * 4); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = C;
      for (let i = 0; i < 6; i++) { const a = Math.PI * (0.85 + i * 0.16), bx = hx + Math.cos(a) * 9, by = hy + Math.sin(a) * 9, tx = hx + Math.cos(a) * 16.5, ty = hy + Math.sin(a) * 16.5;
        ctx.beginPath(); ctx.moveTo(bx + Math.cos(a + 1.6) * 3, by + Math.sin(a + 1.6) * 3); ctx.lineTo(tx, ty); ctx.lineTo(bx + Math.cos(a - 1.6) * 3, by + Math.sin(a - 1.6) * 3); ctx.closePath(); ctx.fill(); }
    }
  }
  function wigFront(L, P, hx, hy) {
    if (L.wig !== 'curly') return;
    const C = P.WG, D = darken(C, 0.35), pts = [];
    for (let i = 0; i < 7; i++) { const a = Math.PI * (0.95 + i * 0.13); pts.push([hx + Math.cos(a) * 10, hy + Math.sin(a) * 10]); }
    ctx.fillStyle = D; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = C; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill(); });
  }

  // eye make-up around one eye at (ex, ey); k = size
  function eyePaint(L, P, ex, ey, k = 1, front = false) {
    const t = L.eyes || 'arch', C = P.EC;
    ctx.strokeStyle = C; ctx.fillStyle = C; ctx.lineCap = 'round';
    if (t === 'arch') { ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.arc(ex, ey + 1 * k, 4.6 * k, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else if (t === 'cross') { ctx.lineWidth = 1.4 * k; ctx.beginPath(); ctx.moveTo(ex, ey - 6 * k); ctx.lineTo(ex, ey + 6 * k); ctx.moveTo(ex - 5 * k, ey); ctx.lineTo(ex + 5 * k, ey); ctx.stroke(); }
    else if (t === 'star') star(ex, ey, 6 * k, C);
    else if (t === 'diamond') { ctx.beginPath(); ctx.moveTo(ex, ey - 6.5 * k); ctx.lineTo(ex + 4 * k, ey); ctx.lineTo(ex, ey + 6.5 * k); ctx.lineTo(ex - 4 * k, ey); ctx.closePath(); ctx.fill(); }
    else if (t === 'tear') {
      ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(ex - 3 * k, ey - 4 * k); ctx.lineTo(ex + 3 * k, ey - 5 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey + 4 * k); ctx.quadraticCurveTo(ex + 1.8 * k, ey + 7 * k, ex, ey + 8 * k); ctx.quadraticCurveTo(ex - 1.8 * k, ey + 7 * k, ex, ey + 4 * k); ctx.fill();
    }
    if (L.face === 'skin') { // auguste clowns: white around the eyes
      ctx.fillStyle = 'rgba(255,250,244,0.95)'; ctx.beginPath(); ctx.ellipse(ex, ey - 0.5 * k, 3.4 * k, 4 * k, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Side-view head, facing right, centred on (hx, hy). mode: idle | balance | jump | cry | fall
  function clownHead(L, P, hx, hy, mode, vy, noHat = false) {
    const crying = mode === 'cry' || mode === 'fall';
    wigBack(L, P, hx, hy);
    // ear
    ctx.fillStyle = P.FL; ctx.beginPath(); ctx.arc(hx - 2.5, hy + 1.5, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.F; ctx.beginPath(); ctx.arc(hx - 2.5, hy + 1.5, 2.6, 0, Math.PI * 2); ctx.fill();
    // head
    ctx.fillStyle = P.FL; ctx.beginPath(); ctx.arc(hx, hy, 11.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = vgrad(hy - 11, hy + 11, lighten(P.F, 0.4), P.F); ctx.beginPath(); ctx.arc(hx, hy, 10.3, 0, Math.PI * 2); ctx.fill();
    if (L.stubble) { ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, 10.3, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = L.stubble; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(hx + 4, hy + 7, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    wigFront(L, P, hx, hy);
    // eye + make-up
    const ex = hx + 5.5, ey = hy - 2.5;
    eyePaint(L, P, ex, ey);
    if (crying) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ex, ey + 1.5, 2.6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.strokeStyle = TEAR; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(ex, ey + 2); ctx.lineTo(ex + 0.5, ey + 9); ctx.stroke();
    } else {
      const big = mode === 'jump';
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, big ? 2.8 : 2.4, big ? 3.4 : 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex + 0.6, ey + 0.2, 1.6, 2.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1.1, ey - 0.7, 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // cheek
    if (P.CH) { ctx.fillStyle = P.CH; ctx.beginPath(); ctx.arc(hx + 2.5, hy + 4.5, 2.8, 0, Math.PI * 2); ctx.fill(); }
    // painted mouth
    const mx = hx + 6.5, my = hy + 6;
    if (L.face === 'skin') { ctx.fillStyle = 'rgba(255,250,244,0.95)'; ctx.beginPath(); ctx.ellipse(mx, my + 0.5, 5.8, 4.2, 0, 0, Math.PI * 2); ctx.fill(); }
    if (crying) {
      ctx.fillStyle = P.MO; ctx.beginPath(); ctx.ellipse(mx, my + 1, 4.4, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a1e28'; ctx.beginPath(); ctx.ellipse(mx, my + 1.3, 2.6, 1.6 + Math.abs(Math.sin(time * 9)) * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    } else if (mode === 'jump' && vy < -250) {
      ctx.fillStyle = P.MO; ctx.beginPath(); ctx.ellipse(mx + 0.5, my + 0.5, 3.4, 3.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a1e28'; ctx.beginPath(); ctx.ellipse(mx + 0.5, my + 0.7, 1.8, 2.3, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = P.MO; ctx.beginPath(); ctx.moveTo(mx - 5.5, my - 1.5); ctx.quadraticCurveTo(mx, my + 7.5, mx + 4.5, my - 2.5); ctx.quadraticCurveTo(mx, my + 3, mx - 5.5, my - 1.5); ctx.fill();
      ctx.strokeStyle = '#5a1e28'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(mx - 4.5, my - 0.6); ctx.quadraticCurveTo(mx, my + 3.6, mx + 3.8, my - 1.6); ctx.stroke();
    }
    // nose
    if (P.NO) {
      const nb = mode === 'jump' ? 0.4 : 0;
      ctx.fillStyle = darken(P.NO, 0.35); ctx.beginPath(); ctx.arc(hx + 10.5, hy + 1 - nb, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.NO; ctx.beginPath(); ctx.arc(hx + 10.5, hy + 1 - nb, 3.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(hx + 9.4, hy - 0.4, 1.2, 0, Math.PI * 2); ctx.fill();
    } else { ctx.fillStyle = P.FL; ctx.beginPath(); ctx.arc(hx + 10.3, hy + 1.5, 1, 0, Math.PI * 2); ctx.fill(); }
    if (!noHat) clownHat(L, P, hx - 1, hy - 9, 1, -0.22, Math.sin(time * (mode === 'balance' ? 6 : 3)) + (mode === 'jump' ? 1 : 0));
    if (mode === 'cry') dizzy(hx, hy - 18);
  }

  // Side view. Feet at (0,0), facing right. mode: idle | balance | jump | cry | fall
  function drawClown(m, x, y, mode, vy = 0, spin = 0, k = 1) {
    const L = m.look || {}, P = cpal(L);
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    if (spin) { ctx.translate(0, -28); ctx.rotate(spin); ctx.translate(0, 28); }
    if (mode === 'cry') sitClown(L, P); else standClown(L, P, mode, vy);
    ctx.restore();
  }
  function clownBody(L, P, cx, cy, rx, ry, rot) {
    const path = () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); };
    ctx.fillStyle = P.LN; ctx.beginPath(); ctx.ellipse(cx, cy, rx + 1.2, ry + 1.2, rot, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.SU; path(); ctx.fill();
    ctx.save(); path(); ctx.clip();
    suitPattern(L, P, cx, cy, rx + 2, ry + 2);
    ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.beginPath(); ctx.ellipse(cx - rx * 0.5, cy + 2, rx * 0.7, ry, rot, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (L.pompom) [-7, -1, 5].forEach(d => {
      ctx.fillStyle = darken(L.pompom, 0.35); ctx.beginPath(); ctx.arc(cx + rx * 0.72, cy + d, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = L.pompom; ctx.beginPath(); ctx.arc(cx + rx * 0.72, cy + d, 1.9, 0, Math.PI * 2); ctx.fill();
    });
  }
  function sleeve(x0, y0, a1, a2, len, P, col) {
    const x1 = x0 + Math.sin(a1) * len, y1 = y0 + Math.cos(a1) * len;
    const x2 = x1 + Math.sin(a2) * len, y2 = y1 + Math.cos(a2) * len;
    outlinedStroke(() => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); }, 5, col, P.LN);
    glove(x2, y2, P.GL);
  }
  // ---- juggling ----
  function armTo(x0, y0, hx, hy, P, col) {
    const mx = (x0 + hx) / 2, my = (y0 + hy) / 2 + 4.5;          // elbow hangs a little below the line
    outlinedStroke(() => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(mx, my); ctx.lineTo(hx, hy); }, 5, col, P.LN);
    glove(hx, hy, P.GL);
  }
  const JCOL = ['#e5262f', '#2a7de1', '#ffd23a'];
  // one juggled thing, centred on (x, y); i = which of the three, a = spin angle
  function jItem(type, x, y, i, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1.35, 1.35); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const c = JCOL[i % 3], O = 'rgba(40,20,30,0.75)';
    const disc = (r, col) => { ctx.fillStyle = O; ctx.beginPath(); ctx.arc(0, 0, r + 0.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); };
    switch (type) {
      case 'balls': disc(3.4, c); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-1.1, -1.1, 1, 0, Math.PI * 2); ctx.fill(); break;
      case 'pins':
        ctx.rotate(a); ctx.fillStyle = O; ctx.beginPath(); ctx.ellipse(0, 1.6, 2.9, 4.4, 0, 0, Math.PI * 2); ctx.ellipse(0, -3.4, 1.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 1.6, 2.2, 3.7, 0, 0, Math.PI * 2); ctx.ellipse(0, -3.4, 1.1, 1.9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c; ctx.fillRect(-1.6, -1.6, 3.2, 1.3); break;
      case 'rings': ctx.rotate(a * 0.3); ctx.strokeStyle = O; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 4.2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke(); break;
      case 'apples': disc(3.5, '#e0272f'); ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -3.4); ctx.lineTo(0.6, -5.2); ctx.stroke();
        ctx.fillStyle = '#3fae4a'; ctx.beginPath(); ctx.ellipse(1.8, -4.6, 1.6, 0.8, -0.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'stars': ctx.rotate(a); star(0, 0, 5, O); star(0, 0, 4, '#ffd23a'); break;
      case 'eggs': ctx.rotate(a * 0.4); ctx.fillStyle = O; ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 4.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'pies': ctx.rotate(a * 0.3); ctx.fillStyle = '#c98a4a'; ctx.beginPath(); ctx.ellipse(0, 1, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -0.6, 4.4, 2.6, 0, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(0, -2.6, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#e5262f'; ctx.fill(); break;
      case 'hats': ctx.rotate(a * 0.5); ctx.fillStyle = '#1b1113'; ctx.fillRect(-2.6, -5, 5.2, 5); ctx.fillRect(-4.4, -0.6, 8.8, 1.6); ctx.fillStyle = c; ctx.fillRect(-2.6, -1.8, 5.2, 1.2); break;
      case 'flowers': ctx.rotate(a); ctx.fillStyle = c; for (let k = 0; k < 5; k++) { const b = k * Math.PI * 0.4; ctx.beginPath(); ctx.arc(Math.cos(b) * 2.4, Math.sin(b) * 2.4, 1.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, Math.PI * 2); ctx.fill(); break;
      case 'bananas': ctx.rotate(a); ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.arc(0, -2, 4.4, 0.5, Math.PI - 0.5); ctx.stroke();
        ctx.strokeStyle = '#ffd93a'; ctx.lineWidth = 2.4; ctx.stroke(); break;
      case 'cupcakes': ctx.fillStyle = '#e8a04a'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(2.2, 3.6); ctx.lineTo(-2.2, 3.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = ['#ff8ad8', '#7ec8f0', '#fff3c4'][i % 3]; ctx.beginPath(); ctx.ellipse(0, -0.6, 3.6, 2.8, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#e5262f'; ctx.beginPath(); ctx.arc(0, -3.4, 1.1, 0, Math.PI * 2); ctx.fill(); break;
      case 'plates': ctx.scale(Math.max(0.25, Math.abs(Math.cos(a))), 1); ctx.fillStyle = O; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#2a7de1'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.stroke(); break;
      case 'ducks': ctx.rotate(Math.sin(a) * 0.4); ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(0, 1, 4, 2.6, 0, 0, Math.PI * 2); ctx.arc(2, -2, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.moveTo(4, -2.2); ctx.lineTo(6, -1.6); ctx.lineTo(4, -1); ctx.fill(); ctx.fillStyle = '#1b1113'; ctx.beginPath(); ctx.arc(2.6, -2.6, 0.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'donuts': ctx.fillStyle = '#c98a4a'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ff8ad8'; ctx.beginPath(); ctx.arc(0, 0, 3.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = TENT_A; ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, Math.PI * 2); ctx.fill(); break;
      case 'fish': ctx.rotate(a * 0.5); ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.ellipse(0, 0, 3.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-5.6, -2); ctx.lineTo(-5.6, 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1b1113'; ctx.beginPath(); ctx.arc(2, -0.5, 0.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'crystal': ctx.fillStyle = 'rgba(170,215,255,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(80,120,200,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
        star(-1.2, -1.2, 1.6, '#ffffff'); break;
      case 'teacups': ctx.rotate(Math.sin(a) * 0.3); ctx.fillStyle = '#fff'; ctx.strokeStyle = O; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-3.2, -2); ctx.lineTo(3.2, -2); ctx.lineTo(2.2, 2); ctx.lineTo(-2.2, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(3.6, -0.2, 1.3, -1.2, 1.2); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(-2.8, -1, 5.6, 0.9); break;
      case 'socks': ctx.rotate(a); ctx.strokeStyle = O; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 1.5); ctx.lineTo(3, 3); ctx.stroke();
        ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-1.2, -2.5); ctx.lineTo(1.2, -2.5); ctx.stroke(); break;
      case 'dice': ctx.rotate(a); ctx.fillStyle = O; ctx.fillRect(-3.6, -3.6, 7.2, 7.2); ctx.fillStyle = '#fff'; ctx.fillRect(-3, -3, 6, 6);
        ctx.fillStyle = '#1b1113'; [[-1.5, -1.5], [1.5, 1.5], [0, 0]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 0.7, 0, Math.PI * 2); ctx.fill(); }); break;
      case 'lollipops': ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 6); ctx.stroke(); disc(3.2, c);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, 1.8, a, a + 4); ctx.stroke(); break;
      case 'carrots': ctx.rotate(a); ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.moveTo(-1.8, -2.5); ctx.lineTo(1.8, -2.5); ctx.lineTo(0, 4.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3fae4a'; ctx.beginPath(); ctx.ellipse(-0.8, -3.8, 0.8, 1.6, -0.4, 0, Math.PI * 2); ctx.ellipse(0.8, -3.8, 0.8, 1.6, 0.4, 0, Math.PI * 2); ctx.fill(); break;
      case 'bubbles': ctx.fillStyle = 'rgba(200,235,255,0.35)'; ctx.strokeStyle = 'rgba(120,160,230,0.9)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-1.4, -1.4, 0.9, 0, Math.PI * 2); ctx.fill(); break;
      default: break;
    }
    ctx.restore();
  }
  // three things in a shower pattern between the two hands; returns the hand positions
  function juggleState(mode) {
    const T = 1.0, jt = time / T, H = mode === 'jump' ? 44 : 34;
    const A = { x: 14, y: -30 + Math.max(0, Math.sin(jt * Math.PI * 6)) * -2.5 };   // far hand (throws high)
    const B = { x: 25, y: -31 + Math.max(0, -Math.sin(jt * Math.PI * 6)) * -2 };    // near hand (passes low)
    const items = [];
    for (let i = 0; i < 3; i++) {
      const u = (jt + i / 3) % 1;
      if (u < 0.6) { const q = u / 0.6; items.push({ x: A.x + (B.x - A.x) * q, y: A.y - 4 - H * 4 * q * (1 - q), a: u * 9 + i }); }
      else { const q = (u - 0.6) / 0.4; items.push({ x: B.x + (A.x - B.x) * q, y: B.y - 3 - 5 * 4 * q * (1 - q), a: u * 9 + i }); }
    }
    return { A, B, items };
  }
  function standClown(L, P, mode, vy) {
    const sway = mode === 'balance' ? Math.sin(time * 3.2) * 0.32 : 0;
    const squash = mk.land > 0 && state === 'play' ? mk.land * 0.6 : 0;
    ctx.rotate(sway * 0.12); ctx.scale(1 + squash * 0.4, 1 - squash * 0.5);
    const ph = time * 9;
    let nl, fl;
    if (mode === 'balance') { const s = Math.sin(ph) * 0.3; nl = [s + 0.12, s * 0.3 - 0.12]; fl = [-s + 0.12, -s * 0.3 - 0.12]; }
    else if (mode === 'jump' || mode === 'fall') { nl = [1.15, -0.45]; fl = [0.85, -0.65]; }
    else { nl = [0.18, -0.05]; fl = [-0.16, 0.05]; }
    const juggling = mode !== 'fall';
    const J = juggling ? juggleState(mode) : null;
    const na = [2.75, 2.95], fa = [2.5, 2.8];   // arms up while tumbling
    const leg = (x0, a, col, shoeCol) => {
      const l = 7.6, y0 = -18;
      const x1 = x0 + Math.sin(a[0]) * l, y1 = y0 + Math.cos(a[0]) * l, x2 = x1 + Math.sin(a[1]) * l, y2 = y1 + Math.cos(a[1]) * l;
      outlinedStroke(() => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); }, 7, col, P.LN);
      shoe(x2 - 2, y2 + 3, shoeCol, 0.9, mode === 'jump' ? -0.25 : 0);
    };
    const al = 8.5, shX = 3, shY = -33;
    leg(-2, fl, darken(P.PA, 0.18), darken(P.SH, 0.15));
    if (J) armTo(shX - 2, shY, J.A.x, J.A.y, P, P.SD); else sleeve(shX - 2, shY, fa[0], fa[1], al, P, P.SD);
    clownBody(L, P, 0, -25, 11, 12.5, 0.1);
    leg(3, nl, P.PA, P.SH);
    ruffAt(3, -36.5, L.collar === undefined ? '#ffffff' : L.collar, L.ruff || 1);
    if (L.bow) bowTie(6, -35.5, L.bow, 0.85);
    clownHead(L, P, 4.5, -47, mode, vy);
    if (J) {
      armTo(shX + 2, shY, J.B.x, J.B.y, P, P.SU);
      const type = L.juggle || 'balls';
      if (type !== 'none') J.items.forEach((it, i) => jItem(type, it.x, it.y, i, it.a));
    } else sleeve(shX + 2, shY, na[0], na[1], al, P, P.SU);
  }
  function sitClown(L, P) {
    const sob = Math.sin(time * 9) * 0.8;
    const legOut = (x0, col, sc) => {
      outlinedStroke(() => { ctx.beginPath(); ctx.moveTo(x0, -7); ctx.lineTo(x0 + 9, -5); ctx.lineTo(x0 + 16, -4); }, 7, col, P.LN);
      shoe(x0 + 15, -1, sc, 0.9, -1.2);
    };
    legOut(0, darken(P.PA, 0.18), darken(P.SH, 0.15));
    sleeve(0, -22, -0.4, -0.1, 8, P, P.SD);
    clownBody(L, P, 0, -14 + sob * 0.3, 11, 11.5, -0.1);
    legOut(4, P.PA, P.SH);
    ruffAt(4, -25, L.collar === undefined ? '#ffffff' : L.collar, L.ruff || 1);
    if (L.bow) bowTie(7, -24, L.bow, 0.85);
    ctx.save(); ctx.translate(7, -35 + sob); ctx.rotate(-0.3);
    clownHead(L, P, 0, 0, 'cry', 0, true);
    ctx.restore();
    sleeve(5, -22, 0.4, 0.15, 8, P, P.SU);
    clownHat(L, P, -22, 0, 1, -1.2, 0);   // hat fell off
    const type = L.juggle || 'balls';     // the juggled things fell down too
    if (type !== 'none') [[-30, -4], [28, -4], [36, -4]].forEach(([x, y], i) => jItem(type, x, y + Math.abs(Math.sin(time * 6 + i)) * -1.5, i, i * 1.3 + 0.4));
  }

  // Big front-facing crying face for the Game Over card (used when no picture is set)
  function drawCryFace(m, cx, cy, k) {
    const L = m.look || {}, P = cpal(L);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    const sob = Math.sin(time * 9) * 1.2;
    ctx.translate(0, sob * 0.5);
    const w = L.wig || 'none', WG = P.WG, WD = darken(WG, 0.35);
    const puffs = pts => { ctx.fillStyle = WD; pts.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.fill(); }); ctx.fillStyle = WG; pts.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }); };
    if (w === 'afro') puffs([[-30, -4, 14], [30, -4, 14], [-24, -22, 14], [24, -22, 14], [-10, -32, 13], [10, -32, 13], [-30, 14, 11], [30, 14, 11]]);
    else if (w === 'sides') puffs([[-30, 0, 12], [30, 0, 12], [-28, 15, 10], [28, 15, 10]]);
    else if (w === 'long') { ctx.fillStyle = WG; ctx.beginPath(); ctx.ellipse(0, 6, 36, 36, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (w === 'spiky') {
      ctx.fillStyle = WG;
      for (let i = 0; i < 9; i++) { const a = Math.PI * (0.95 + i * 0.138); ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.2) * 24, Math.sin(a - 0.2) * 24); ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); ctx.lineTo(Math.cos(a + 0.2) * 24, Math.sin(a + 0.2) * 24); ctx.closePath(); ctx.fill(); }
    }
    // ears
    [-1, 1].forEach(sd => { ctx.fillStyle = P.FL; ctx.beginPath(); ctx.arc(sd * 27, 6, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.F; ctx.beginPath(); ctx.arc(sd * 27, 6, 5.6, 0, Math.PI * 2); ctx.fill(); });
    // face
    ctx.fillStyle = P.FL; ctx.beginPath(); ctx.arc(0, 2, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = vgrad(-26, 30, lighten(P.F, 0.4), P.F); ctx.beginPath(); ctx.arc(0, 2, 26.5, 0, Math.PI * 2); ctx.fill();
    if (L.stubble) { ctx.save(); ctx.beginPath(); ctx.arc(0, 2, 26.5, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = L.stubble; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(0, 24, 26, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (w === 'curly') puffs([[-20, -20, 7], [-10, -25, 7], [0, -27, 7], [10, -25, 7], [20, -20, 7]]);
    // eye make-up + squeezed-shut eyes
    [-1, 1].forEach(sd => {
      eyePaint(L, P, sd * 10, -4, 2, true);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(sd * 10, -1, 4.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(sd * 16, -12); ctx.lineTo(sd * 5, -15); ctx.stroke();
    });
    if (P.CH) { ctx.fillStyle = P.CH; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * 16, 10, 5.5, 0, Math.PI * 2); ctx.fill(); }); }
    // painted wailing mouth (big frown)
    if (L.face === 'skin') { ctx.fillStyle = 'rgba(255,250,244,0.95)'; ctx.beginPath(); ctx.ellipse(0, 22, 15, 10, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = P.MO; ctx.beginPath();
    ctx.moveTo(-16, 28); ctx.quadraticCurveTo(0, 9, 16, 28); ctx.quadraticCurveTo(0, 21, -16, 28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 22, 8.5, 6.5 + Math.abs(sob), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a1e28'; ctx.beginPath(); ctx.ellipse(0, 22.5, 5.8, 4 + Math.abs(sob), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0607a'; ctx.beginPath(); ctx.ellipse(0, 25 + Math.abs(sob) * 0.6, 3.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    // nose
    if (P.NO) {
      ctx.fillStyle = darken(P.NO, 0.35); ctx.beginPath(); ctx.arc(0, 5, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.NO; ctx.beginPath(); ctx.arc(0, 5, 6.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-2.5, 3, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // tears
    ctx.strokeStyle = 'rgba(110,185,255,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.quadraticCurveTo(-19, 12, -17, 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.quadraticCurveTo(19, 12, 17, 26); ctx.stroke();
    ctx.fillStyle = 'rgba(110,185,255,0.95)';
    for (let i = 0; i < 2; i++) {
      const tt = (time * 1.3 + i * 0.5) % 1;
      [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(sd * (17 + tt * 10), 26 + tt * 34, 2.6, 3.8, 0, 0, Math.PI * 2); ctx.fill(); });
    }
    ruffAt(0, 42, L.collar === undefined ? '#ffffff' : L.collar, (L.ruff || 1) * 1.6, 13, 3.5);
    if (L.bow) bowTie(0, 44, L.bow, 1.6);
    clownHat(L, P, 0, -24, 2, -0.15, Math.sin(time * 3));
    dizzy(0, L.hat && L.hat !== 'none' && L.hat !== 'cap' ? -66 : -40, 1.5);
    ctx.restore();
  }
  // Game Over portrait: the clown's own picture if set in clowns.js, otherwise the drawn face
  function drawPortrait(b, x, y, w, h) {
    const im = clownImage(b);
    if (im) {
      const s = Math.min(w / im.naturalWidth, h / im.naturalHeight);
      const iw = im.naturalWidth * s, ih = im.naturalHeight * s;
      ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2 + Math.sin(time * 9) * 1.5, iw, ih);
    } else drawCryFace(b, x + w / 2, y + h * 0.58, Math.min(w, h) / 130);
  }

  // ---------- Drawing: UI ----------
  const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", Roboto, sans-serif';
  function text(str, x, y, size, col = '#fff', align = 'center', stroke = '#3a0712') {
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y); ctx.fillStyle = col; ctx.fillText(str, x, y);
  }
  function rrect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function coinIcon(x, y, r = 10) {
    ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(x, y + 1.5, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
  }
  function coinLabel(x, y, n, size = 22, align = 'left') {
    ctx.font = `900 ${size}px ${FONT}`;
    const w = ctx.measureText(String(n)).width + size * 1.2;
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    coinIcon(x0 + size * 0.45, y, size * 0.45);
    text(String(n), x0 + size * 1.05, y, size, '#ffe38a', 'left');
  }
  function button(label, x, y, w, h, on, opts = {}) {
    const disabled = !!opts.disabled;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rrect(x, y + 4, w, h, h / 2); ctx.fill();
    ctx.fillStyle = disabled ? '#6b5a5e' : (opts.color || '#e8b93a'); rrect(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = disabled ? '#4d3e42' : '#fff3c4'; ctx.lineWidth = 2.5; rrect(x, y, w, h, h / 2); ctx.stroke();
    text(label, x + w / 2 + (opts.coin ? 12 : 0), y + h / 2 + 1, opts.size || 18, disabled ? '#d9cfd1' : '#3a0712', 'center', disabled ? '#4d3e42' : '#fff3c4');
    if (opts.coin) { ctx.font = `900 ${opts.size || 18}px ${FONT}`; coinIcon(x + w / 2 - ctx.measureText(label).width / 2 - 2, y + h / 2, 9); }
    btn(x, y, w, h, () => { click(); on(); });
  }
  function roundIcon(x, y, draw, on) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; draw();
    btn(x - 24, y - 24, 48, 48, on);
  }
  function drawToggles() {
    const sx = viewW - 36, mx = viewW - 88, y = T() + 34;
    roundIcon(sx, y, () => {
      ctx.beginPath(); ctx.moveTo(sx - 10, y - 5); ctx.lineTo(sx - 4, y - 5); ctx.lineTo(sx + 3, y - 11); ctx.lineTo(sx + 3, y + 11); ctx.lineTo(sx - 4, y + 5); ctx.lineTo(sx - 10, y + 5); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2.5;
      if (!sfxOn) { ctx.beginPath(); ctx.moveTo(sx + 7, y - 6); ctx.lineTo(sx + 14, y + 6); ctx.moveTo(sx + 14, y - 6); ctx.lineTo(sx + 7, y + 6); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(sx + 4, y, 8, -0.8, 0.8); ctx.stroke(); }
    }, () => { sfxOn = !sfxOn; store.set('cc_muted', sfxOn ? '0' : '1'); });
    roundIcon(mx, y, () => {
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(mx - 6, y + 7, 5, 4, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx + 7, y + 4, 5, 4, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(mx - 2, y + 7); ctx.lineTo(mx - 2, y - 10); ctx.lineTo(mx + 11, y - 13); ctx.lineTo(mx + 11, y + 4); ctx.stroke();
      if (!musicOn) { ctx.strokeStyle = '#ff6a4d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - 13, y - 13); ctx.lineTo(mx + 13, y + 13); ctx.stroke(); }
    }, () => {
      musicOn = !musicOn; store.set('cc_music', musicOn ? '1' : '0');
      if (actx) musicBus.gain.setTargetAtTime(musicOn && musicActive ? MUSIC_VOL : 0, actx.currentTime, 0.05);
      if (musicOn && actx && state !== 'dying' && state !== 'over') startMusic();
    });
  }
  function panel(w, h, y) {
    const x = viewW / 2 - w / 2; y = y === undefined ? MID() - h / 2 - 20 : y;
    ctx.fillStyle = 'rgba(30,8,55,0.85)'; ctx.strokeStyle = '#e8b93a'; ctx.lineWidth = 4;
    rrect(x, y, w, h, 22); ctx.fill(); ctx.stroke();
    return { x, y };
  }


  function drawShop() {
    const top = T(), m = MID();
    ctx.fillStyle = 'rgba(22,6,40,0.55)'; ctx.fillRect(0, top, viewW, viewH);
    const cx = viewW / 2, b = CLOWNS[shopIdx];
    const isOwned = owned.includes(b.id), inUse = selectedId === b.id;
    button('BACK', 16, top + 16, 96, 40, () => { state = 'title'; }, { size: 16 });
    text('CLOWN SHOP', cx, top + 110, 44, '#ffb000');
    coinLabel(cx, top + 158, coins, 26, 'center');
    // stage
    const sy = m + 30;   // floor of the stage
    ctx.fillStyle = 'rgba(255,220,150,0.10)'; ctx.beginPath(); ctx.ellipse(cx, sy, 170, 26, 0, 0, Math.PI * 2); ctx.fill();
    const lg = ctx.createRadialGradient(cx, sy - 90, 10, cx, sy - 90, 200);
    lg.addColorStop(0, 'rgba(255,245,200,0.22)'); lg.addColorStop(1, 'rgba(255,245,200,0)');
    ctx.fillStyle = lg; ctx.fillRect(cx - 200, sy - 280, 400, 310);
    if (shopCryT > 0) {
      drawPortrait(b, cx - 90, sy - 220, 180, 210);
    } else {
      ctx.save(); ctx.translate(cx, sy); ctx.scale(2.1, 2.1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(2, 2, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
      ballAt(0, -22, 22, time * 0.6);
      drawClown(b, -1, -44, 'idle');
      ctx.restore();
      if (!isOwned) { // lock badge
        const lx = cx + 100, ly = sy - 180;
        ctx.fillStyle = 'rgba(22,6,40,0.8)'; ctx.beginPath(); ctx.arc(lx, ly, 20, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffe38a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lx, ly - 4, 7, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = '#ffe38a'; rrect(lx - 10, ly - 4, 20, 14, 3); ctx.fill();
      }
    }
    // arrows
    const ay = sy - 90;
    const arrow = (x, dir) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x, ay, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe38a'; ctx.beginPath(); ctx.moveTo(x + dir * 10, ay); ctx.lineTo(x - dir * 7, ay - 12); ctx.lineTo(x - dir * 7, ay + 12); ctx.closePath(); ctx.fill();
      btn(x - 32, ay - 32, 64, 64, () => { click(); shopIdx = (shopIdx + dir + CLOWNS.length) % CLOWNS.length; shopCryT = 0; });
    };
    arrow(40, -1); arrow(viewW - 40, 1);
    // name + status
    ctx.font = `900 34px ${FONT}`;
    text(b.name, cx, sy + 50, Math.min(34, Math.floor(34 * 440 / ctx.measureText(b.name).width)), '#fff');
    const status = inUse ? 'IN USE' : isOwned ? 'OWNED' : null;
    if (status) text(status + '   ' + (shopIdx + 1) + ' / ' + CLOWNS.length, cx, sy + 84, 17, '#ffe9c7');
    else { coinLabel(cx - 30, sy + 84, b.price, 19, 'center'); text((shopIdx + 1) + ' / ' + CLOWNS.length, cx + 50, sy + 84, 17, '#ffe9c7'); }
    // action buttons
    const mw = 314, my = sy + 124;
    if (inUse) button('IN USE', cx - mw / 2, my, mw, 52, () => {}, { disabled: true, size: 20 });
    else if (isOwned) button('USE THIS CLOWN', cx - mw / 2, my, mw, 52, shopAction, { color: '#7fd67a', size: 20 });
    else button('BUY ' + b.price, cx - mw / 2, my, mw, 52, shopAction, { disabled: coins < b.price, coin: true, size: 20 });
    if (shopMsgT > 0) { ctx.globalAlpha = Math.min(1, shopMsgT * 2); text(shopMsg, cx, top + 196, 19, '#fff3a0'); ctx.globalAlpha = 1; }
  }

  // ---------- Share score ----------
  const STORE_URL = 'https://play.google.com/store/apps/details?id=com.alxmobileapps.circusclown';
  const PRIVACY_URL = 'https://claude.ai/artifact/4KKc3PkM1bFsYP9b9wp3js';   // Circus Clown privacy policy
  function shareText() {
    const mon = curClown().name;
    if (score <= 0) return '🤡🎪 I just played Circus Clown! Can you hop across the circus balls?';
    if (newBest) return '🏆 NEW HIGH SCORE! I scored ' + score + ' in Circus Clown with ' + mon + ' 🤡🎪 Can you beat me?';
    return '🤡🎪 I scored ' + score + ' in Circus Clown with ' + mon + '! Can you beat my score?';
  }
  const CapNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  function capPlugin(name) {
    const C = window.Capacitor; if (!C) return null;
    const reg = (window.capacitorExports && window.capacitorExports.registerPlugin) || C.registerPlugin;
    return (C.Plugins && C.Plugins[name]) || (reg ? reg(name) : null);
  }
  function openLink(url) {
    if (CapNative()) { window.location.href = url; return; }   // Capacitor hands external links to the phone
    const w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  }
  const APP_PKGS = {
    facebook: ['com.facebook.katana', 'com.facebook.lite'],
    whatsapp: ['com.whatsapp', 'com.whatsapp.w4b'],
    x: ['com.twitter.android'],
    instagram: ['com.instagram.android'],
    tiktok: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill']
  };
  // One "Share your score" button: the phone's share menu opens with Facebook, TikTok, X,
  // Instagram and WhatsApp first, followed by everything else.
  async function shareScore() {
    if (CapNative()) {
      const P = capPlugin('AppShare'), FS = capPlugin('Filesystem');
      if (P && FS) {
        try {
          const w = await FS.writeFile({ path: 'circus-clown-score.png', data: shareImage().split(',')[1], directory: 'CACHE' });
          await P.chooser({ packages: [].concat(APP_PKGS.facebook, APP_PKGS.tiktok, APP_PKGS.x, APP_PKGS.instagram, APP_PKGS.whatsapp),
                            text: shareText() + ' ' + STORE_URL, path: w.uri, title: 'Share your score' });
          return;
        } catch (e) { /* fall back to the plain share menu */ }
      }
    }
    return shareMore();
  }
  // Square picture of the score card, for the phone's share menu
  function shareImage() {
    const S = 1080, off = document.createElement('canvas'); off.width = off.height = S;
    const saved = ctx; ctx = off.getContext('2d');
    try {
      ctx.fillStyle = TENT_A; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = TENT_B; for (let x = 0; x < S; x += 144) ctx.fillRect(x, 0, 72, S);
      const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(60,20,110,0.5)'); g.addColorStop(0.5, 'rgba(60,20,110,0.08)'); g.addColorStop(1, 'rgba(60,20,110,0.45)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#c98f4c'; ctx.fillRect(0, 820, S, 260);
      text('CIRCUS CLOWN', S / 2, 100, 104, '#ffd23a');
      text(newBest ? 'NEW HIGH SCORE!' : 'I scored', S / 2, 200, 58, newBest ? '#ffe38a' : '#fff');
      text(String(score), S / 2, 312, 150, '#fff');
      ctx.save(); ctx.translate(S / 2, 820); ctx.scale(2.6, 2.6);
      ctx.fillStyle = 'rgba(60,25,5,0.35)'; ctx.beginPath(); ctx.ellipse(3, 2, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
      ballAt(0, -40, 40, 0.3);
      drawClown(curClown(), 0, -80, 'balance'); ctx.restore();
      text('Can you beat me?', S / 2, 910, 56, '#fff');
      text('Get it on Google Play', S / 2, 995, 42, '#ffe38a');
    } finally { ctx = saved; }
    return off.toDataURL('image/png');
  }
  // App icon artwork (1024x1024), used by the build tools only
  function iconImage() {
    const S = 1024, off = document.createElement('canvas'); off.width = off.height = S;
    const saved = ctx; ctx = off.getContext('2d');
    try {
      ctx.fillStyle = TENT_A; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = TENT_B; for (let x = -64; x < S; x += 160) ctx.fillRect(x, 0, 80, S);
      const g = ctx.createRadialGradient(S / 2, S * 0.45, 80, S / 2, S / 2, S * 0.75);
      g.addColorStop(0, 'rgba(255,240,200,0.3)'); g.addColorStop(1, 'rgba(60,20,110,0.4)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#c98f4c'; ctx.fillRect(0, 900, S, 124);
      ctx.save(); ctx.translate(S / 2 + 6, 905); ctx.scale(5.0, 5.0);
      ctx.fillStyle = 'rgba(60,25,5,0.35)'; ctx.beginPath(); ctx.ellipse(3, 2, 36, 6, 0, 0, Math.PI * 2); ctx.fill();
      ballAt(0, -40, 40, 0.3);
      drawClown(CLOWNS[0], -2, -80, 'balance'); ctx.restore();
    } finally { ctx = saved; }
    return off.toDataURL('image/png');
  }
  // Google Play feature graphic (1024 x 500)
  function featureImage() {
    const W = 1024, H = 500, off = document.createElement('canvas'); off.width = W; off.height = H;
    const saved = ctx; ctx = off.getContext('2d');
    try {
      ctx.fillStyle = TENT_A; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = TENT_B; for (let x = -30; x < W; x += 112) ctx.fillRect(x, 0, 56, H);
      const g = ctx.createRadialGradient(W * 0.3, H * 0.35, 60, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(60,20,110,0.45)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7347c4'; ctx.fillRect(0, 404, W, 18);
      ctx.fillStyle = '#c98f4c'; ctx.fillRect(0, 422, W, H - 422);
      const S = 2.3, fy = 422;
      const shadow = (x, r) => { ctx.fillStyle = 'rgba(60,25,5,0.35)'; ctx.beginPath(); ctx.ellipse(x + 3, fy + 3, r * 0.95 * S, 7, 0, 0, Math.PI * 2); ctx.fill(); };
      // clown balancing on a ball
      shadow(600, 40);
      ctx.save(); ctx.translate(600, fy); ctx.scale(S, S); ballAt(0, -40, 40, 0.3); drawClown(CLOWNS[0], 0, -80, 'balance', 0, 0, MS); ctx.restore();
      // ring of fire with a clown jumping through
      const ring = { x: 830, cy: 190, R: 105, rx: 32, seed: 3 };
      drawRingBack(ring);
      ctx.save(); ctx.translate(830, 250); ctx.scale(1.7, 1.7); drawClown(CLOWNS[5] || CLOWNS[1], 0, 0, 'jump', -300, 0, MS); ctx.restore();
      drawRingFront(ring);
      // spiky ball rolling in
      ctx.save(); ctx.translate(948, fy - 1.4 * GY); ctx.scale(1.4, 1.4);
      drawBall({ x: 0, r: 34, rot: 0.4, hop: null, ph: 0, spiky: true, st: 'come' }); ctx.restore();
      text('CIRCUS', 250, 165, 118, '#fff');
      text('CLOWN', 250, 290, 118, '#ffd23a');
    } finally { ctx = saved; }
    return off.toDataURL('image/png');
  }
  async function shareMore() {
    const text = shareText();
    if (CapNative()) {
      const Share = capPlugin('Share'), FS = capPlugin('Filesystem');
      try {
        let files;
        try {
          const w = await FS.writeFile({ path: 'circus-clown-score.png', data: shareImage().split(',')[1], directory: 'CACHE' });
          files = [w.uri];
        } catch (e) { files = undefined; }
        await Share.share({ title: 'Circus Clown', text: text + ' ' + STORE_URL, files, dialogTitle: 'Share your score' });
        return;
      } catch (e) {
        try { await Share.share({ title: 'Circus Clown', text: text + ' ' + STORE_URL, dialogTitle: 'Share your score' }); return; } catch (e2) { /* fall through */ }
      }
    }
    if (navigator.share) { try { await navigator.share({ title: 'Circus Clown', text, url: STORE_URL }); return; } catch (e) { /* cancelled */ } }
    try { await navigator.clipboard.writeText(text + ' ' + STORE_URL); flashOver('Copied! Paste it anywhere.'); } catch (e) { flashOver('Sharing is not available here'); }
  }
  const IS_IOS = !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios');
  // little white poodle, side view facing right, feet on y
  function drawMiniDog(x, y, sc, jump) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    const run = jump ? 0 : Math.sin(time * 16);
    const W = '#fbf8f5', L = '#c9bdb3';
    const puff = (px, py, r) => { ctx.fillStyle = L; ctx.beginPath(); ctx.arc(px, py, r + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = W; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); };
    ctx.lineCap = 'round';
    [[-8, jump ? 0.8 : run * 0.6], [8, jump ? -0.7 : -run * 0.6]].forEach(([lx, a]) => {
      const fx = lx + Math.sin(a) * 7;
      ctx.strokeStyle = L; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(lx, -12); ctx.lineTo(fx, -3); ctx.stroke();
      ctx.strokeStyle = W; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(lx, -12); ctx.lineTo(fx, -3); ctx.stroke();
      puff(fx, -2.5, 2.6);
    });
    puff(-14, -26, 3.4);                                   // tail pom
    ctx.fillStyle = W; ctx.strokeStyle = L; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -15, 11, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    puff(7, -17, 6.5);                                     // chest fluff
    puff(13, -25, 5.5);                                    // head
    ctx.fillStyle = W; ctx.beginPath(); ctx.ellipse(19, -23.5, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    puff(9, -22, 3.6);                                     // ear
    puff(12, -30, 4);                                      // top knot
    ctx.fillStyle = '#ff5c9a'; ctx.beginPath(); ctx.arc(12, -34, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1113'; ctx.beginPath(); ctx.arc(23, -24, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(15.5, -26, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawMiniCat(x, y, sc, jump){
    // cartoon side view facing right, feet on y; big head = cute
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    const run = jump ? 0 : Math.sin(time*16);
    const legA = jump ? 0.9 : run*0.6, legB = jump ? -0.7 : -run*0.6;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    {
      // orange tabby cat: pointy ears, whiskers, long curled tail
      const C = '#f39a3c', D = '#c9692a', O = '#7a3e12', B = '#ffd9a8';
      // legs
      [[-9, legB, D], [7, legA, D], [-6, legA, C], [10, legB, C]].forEach(([lx, a, c]) => {
        const fx = lx + Math.sin(a)*7;
        ctx.strokeStyle = O; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(lx, -12); ctx.lineTo(fx, -2); ctx.stroke();
        ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx, -12); ctx.lineTo(fx, -2); ctx.stroke();
        ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(fx + 1, -1.5, 2.6, 1.6, 0, 0, Math.PI*2); ctx.fill();
      });
      // long tail curling up
      const tw = Math.sin(time*5)*3;
      ctx.strokeStyle = O; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-12, -17); ctx.bezierCurveTo(-22, -18, -24, -30, -18 + tw, -38); ctx.stroke();
      ctx.strokeStyle = C; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-12, -17); ctx.bezierCurveTo(-22, -18, -24, -30, -18 + tw, -38); ctx.stroke();
      // slim body with stripes and a pale belly
      ctx.fillStyle = C; ctx.beginPath(); ctx.ellipse(0, -16, 13, 6.5, 0, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, -16, 13, 6.5, 0, 0, Math.PI*2); ctx.clip();
      ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(1, -10.5, 10, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = D; ctx.lineWidth = 1.8; for (let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(k*4.5 - 1, -23); ctx.lineTo(k*4.5 + 1, -16); ctx.stroke(); }
      ctx.restore();
      // round head
      const hx = 15, hy = -26;
      // ears (pointed, pink inside)
      [[hx - 5, -1], [hx + 3, 1]].forEach(([ex, d]) => {
        ctx.fillStyle = C; ctx.beginPath(); ctx.moveTo(ex - 3.5, hy - 4); ctx.lineTo(ex + d, hy - 13); ctx.lineTo(ex + 4, hy - 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = O; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#ffb3c1'; ctx.beginPath(); ctx.moveTo(ex - 1.5, hy - 5); ctx.lineTo(ex + d*0.7, hy - 10); ctx.lineTo(ex + 2, hy - 5); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = C; ctx.beginPath(); ctx.arc(hx, hy, 7.5, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = D; ctx.lineWidth = 1.5; [-3, 0, 3].forEach(k => { ctx.beginPath(); ctx.moveTo(hx + k, hy - 7); ctx.lineTo(hx + k, hy - 4); ctx.stroke(); });
      // muzzle, nose, eye, whiskers
      ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(hx + 5, hy + 2.5, 3.6, 2.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.moveTo(hx + 7, hy + 0.6); ctx.lineTo(hx + 9.2, hy + 0.6); ctx.lineTo(hx + 8.1, hy + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1a0a'; ctx.beginPath(); ctx.ellipse(hx + 3.5, hy - 2.2, 1.5, 2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#9be37a'; ctx.beginPath(); ctx.ellipse(hx + 3.5, hy - 2.2, 1.5, 2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(hx + 3.8, hy - 2.2, 0.6, 1.7, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,10,0.9)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(hx + 7, hy + 2.5); ctx.lineTo(hx + 14, hy + 0.5); ctx.moveTo(hx + 7, hy + 3); ctx.lineTo(hx + 14, hy + 3.5); ctx.moveTo(hx + 7, hy + 3.4); ctx.lineTo(hx + 13, hy + 6); ctx.stroke();
    }
    ctx.restore();
  }
  // little clownfish, side view facing right, centred on (x, y)
  function drawMiniFish(x, y, sc, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
    const O = '#7a2e08', C = '#ff7a1a', Wt = '#fffaf2';
    const wig = Math.sin(time * 18) * 2;
    ctx.lineJoin = 'round';
    ctx.fillStyle = C; ctx.strokeStyle = O; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-17, -7 + wig); ctx.lineTo(-17, 7 + wig); ctx.closePath(); ctx.fill(); ctx.stroke();   // tail
    ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(2, -13, 7, -6); ctx.closePath(); ctx.fill(); ctx.stroke();               // fin
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 7.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 12, 7.5, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = Wt; [-5, 4].forEach(bx => { ctx.fillRect(bx - 1.6, -9, 3.2, 18); });
    ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 0.8; [-5, 4].forEach(bx => { ctx.strokeRect(bx - 1.6, -9, 3.2, 18); });
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7.5, -1.5, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1010'; ctx.beginPath(); ctx.arc(8, -1.5, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(10, 2, 1.6, 0.2, Math.PI * 0.8); ctx.stroke();
    ctx.restore();
  }
  function miniTank(cx, gy, w, h) {
    ctx.fillStyle = 'rgba(120,200,235,0.55)'; ctx.fillRect(cx - w / 2, gy - h * 0.8, w, h * 0.8);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2, gy - h, w, h);
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(cx - w / 2 - 2, gy - 2, w + 4, 4);
  }

  let overMsg = '', overMsgT = 0;
  function flashOver(m) { overMsg = m; overMsgT = 2.5; }


  // big blinking "!" at the right edge, where the very fast ball will come in
  function drawWarning(t, x, y) {
    if (Math.floor(t * 10) % 3 === 2) return;   // blink
    const pulse = 1.35 + 0.1 * Math.sin(time * 30);
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(25, 19); ctx.lineTo(-25, 19); ctx.closePath(); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#3a0712'; ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(26, 16); ctx.lineTo(-26, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e5262f'; ctx.fillRect(-3.5, -16, 7, 18); ctx.beginPath(); ctx.arc(0, 9, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function render() {
    buttons = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1c0a33'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, offY * scale);
    drawBackground();
    const b = curClown();

    if (state === 'shop') {
      drawShop();
    } else {
      // knocked-away balls first, then the rest, the one under the clown last
      const order = plats.filter(p => p.st === 'gone').concat(plats.filter(p => p.st === 'come'), plats.filter(p => p.st === 'held'));
      for (const p of order) drawBall(p);
      for (const o of hz) { if (o.kind === 'ring') drawRingBack(o); else if (o.kind === 'cannon') drawCannon(o); }
      let mode = 'idle';
      if (state === 'play' || state === 'paused') mode = mk.air ? 'jump' : 'balance';
      else if (state === 'dying' || state === 'over') mode = mk.y >= GY ? 'cry' : 'fall';
      if (mode === 'cry' || mode === 'fall') {
        const sh = Math.max(0.3, 1 - (GY - mk.y) / 220);
        ctx.fillStyle = `rgba(60,25,5,${0.35 * sh})`; ctx.beginPath(); ctx.ellipse(mk.x + 6, GY + 3, 24 * sh, 5 * sh, 0, 0, Math.PI * 2); ctx.fill();
      }
      drawClown(b, mk.x, mk.y, (state === 'title' ? 'idle' : mode), mk.vy, mode === 'fall' ? mk.spin : 0, MS);
      for (const o of hz) { if (o.kind === 'ring') drawRingFront(o); else if (o.kind === 'cannon') { if (o.fired) drawHuman(o); } else drawMini(o); }
      if (warnT > 0 && state === 'play') drawWarning(warnT, viewW - 40, GY - 70);
      for (const o of hz) if (o.kind === 'cannon' && !o.fired && state === 'play') drawWarning(o.wait, viewW - 70, o.y - 62);
    }

    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      if (p.star) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(time * 6); ctx.fillRect(-p.r, -p.r / 3, p.r * 2, p.r * 0.66); ctx.fillRect(-p.r / 3, -p.r, p.r * 0.66, p.r * 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = TEAR;
    for (const t of tears) { ctx.beginPath(); ctx.ellipse(t.x, t.y, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const p of popups) { ctx.globalAlpha = Math.max(0, 1 - p.t / (p.big ? 1.2 : 0.9)); text(p.txt, p.x, p.y, p.big ? 40 : p.txt.length > 3 ? 22 : 28, p.big ? '#ffd23a' : '#fff3a0'); }
    ctx.globalAlpha = 1;

    if (state === 'play' || state === 'paused' || state === 'dying') {
      coinLabel(22, T() + 34, coins, 20);
      text(String(score), viewW / 2, T() + 130, 64);
      text('BEST ' + best, viewW / 2, T() + 180, 20, '#ffe38a');
      if (state === 'play' && score === 0 && best < 3) {   // first-time hint
        const a = 0.6 + 0.4 * Math.sin(time * 5);
        ctx.globalAlpha = a; text('Tap to jump onto the ball!', viewW / 2, T() + 222, 20, '#fff3a0'); ctx.globalAlpha = 1;
      }
    }

    if (state === 'title') {
      const top = T(), ty = Math.max(top + 150, GY - 520);
      coinLabel(22, top + 34, coins, 22);
      if (best > 0) text('BEST ' + best, 22, top + 66, 18, '#ffe38a', 'left');
      const pulse = 1 + Math.sin(time * 3) * 0.04;
      ctx.save(); ctx.translate(viewW / 2, ty); ctx.scale(pulse, pulse);
      text('CIRCUS', 0, -36, 76, '#fff');
      text('CLOWN', 0, 38, 76, '#ffd23a');
      ctx.restore();
      text('Quick tap = small hop.', viewW / 2, ty + 110, 22, '#ffe9c7');
      text('Hold = big jump.', viewW / 2, ty + 140, 22, '#ffe9c7');
      text('Hop onto the rolling balls, jump through', viewW / 2, ty + 172, 18, '#ffe9c7');
      text('the fire rings, dodge the tiny bouncing balls!', viewW / 2, ty + 196, 18, '#ffe9c7');
      if (Math.floor(time * 2) % 2 === 0) text('TAP TO START', viewW / 2, ty + 240, 34, '#fff');
      button('CLOWN SHOP', viewW / 2 - 110, ty + 280, 220, 52, openShop, { size: 22 });
      // privacy policy link (required by Google Play), top row next to the sound controls
      const px = viewW - 88 - 32, py = T() + 34;
      text('Privacy Policy', px, py, 11, '#ffe9c7', 'right');
      ctx.strokeStyle = '#ffe9c7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - 66, py + 9); ctx.lineTo(px, py + 9); ctx.stroke();
      btn(px - 72, py - 20, 76, 40, () => openLink(PRIVACY_URL));
    }
    if (state === 'paused') {
      panel(320, 120);
      text('PAUSED', viewW / 2, MID() - 50, 40);
      text('Tap to continue', viewW / 2, MID() - 2, 22, '#ffe9c7');
    }
    if (state === 'over') {
      const k = Math.min(1, overT / 0.35), e = 1 - Math.pow(1 - k, 3);
      const pc = MID() - 20;
      ctx.save(); ctx.translate(viewW / 2, pc); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.translate(-viewW / 2, -pc);
      ctx.globalAlpha = e;
      const p = panel(480, 316, pc - 150);
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; rrect(p.x + 12, p.y + 12, 170, 226, 16); ctx.fill();
      drawPortrait(b, p.x + 16, p.y + 24, 162, 200);
      const cx = p.x + 332;
      text('GAME OVER', cx, p.y + 40, 38, '#ff6a4d');
      text('Score  ' + score, cx, p.y + 90, 28);
      text((newBest ? 'NEW BEST! ' : 'Best  ') + best, cx, p.y + 124, 20, '#ffe38a');
      coinLabel(cx, p.y + 154, '+' + runCoins, 20, 'center');
      ctx.restore();
      if (overT > 0.8) {
        button('TRY AGAIN', cx - 136, p.y + 184, 140, 44, startRun, { size: 17, color: '#7fd67a' });
        button('SHOP', cx + 14, p.y + 184, 110, 44, openShop, { size: 17 });
        button('SHARE YOUR SCORE', viewW / 2 - 150, p.y + 254, 300, 46, shareScore, { size: 18, color: '#6f9cf0' });
        if (overMsgT > 0) text(overMsg, viewW / 2, p.y + 330, 16, '#fff3a0');
      }
    }
    drawToggles();
  }

  // ---------- Main loop ----------
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - lastT) / 1000); lastT = now;
    for (let i = 0; i < 3; i++) update(dt / 3);   // sub-steps for accurate landings
    render();
    requestAnimationFrame(frame);
  }
  reset();
  requestAnimationFrame(frame);

  // test hook (harmless in production)
  window.__cc = {
    get state() { return state; }, get time() { return time; }, get speed() { return speed; }, get lastHit() { return lastHit; },
    get score() { return score; }, set score(v) { score = v; speed = speedFor(v); },
    get plats() { return plats; }, get hz() { return hz; }, get warnT() { return warnT; }, set ballDue(v) { ballDue = v; }, get cur() { return cur; }, get coins() { return coins; }, set coins(v) { coins = v; }, get buttons() { return buttons; },
    get shopIdx() { return shopIdx; }, set shopIdx(v) { shopIdx = v; shopCryT = 0; }, mk, press: () => onPress(-1, -1), release, startRun, spawnBall, spawnObstacle,
    select: id => { if (!owned.includes(id)) owned.push(id); selectedId = id; },
    tap: (x, y) => onPress(x * scale, (y + offY) * scale), openShop, shareImage: () => shareImage(), iconImage: () => iconImage(), featureImage: () => featureImage(), cryPreview: () => { shopCryT = 99; },
    set spawnT(v) { spawnT = v; }, GY, MX,
    step: (n, dt = 1 / 360) => { for (let i = 0; i < n; i++) update(dt); }, get lastSpiky() { return lastSpiky; }
  };
})();
