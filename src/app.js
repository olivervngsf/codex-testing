/* Godox V100C round-head speedlite — interactive controller emulation.
   No hardware link exists from a browser, so this faithfully reproduces the
   rear-panel behaviour: modes, power in 1/10-stop steps, zoom, HSS, the 2.4G
   wireless system, modeling lamp and a real test-flash that lights the room. */

const ZOOMS = [28, 35, 50, 70, 80, 105];
const GROUPS = ['A', 'B', 'C', 'D', 'E'];
const MODES = ['TTL', 'M', 'MULTI'];
const ROLES = ['OFF', 'MASTER', 'SLAVE'];
const GN_BASE = 76;          // guide number at full power, ISO 100, 105mm (metres)
const RECYCLE_FULL = 1.5;    // seconds to recycle from a full dump

const state = {
  mode: 'M',
  role: 'OFF',
  power: 0,        // 0..90 = tenths of a stop below full (0 = 1/1, 90 = 1/256)
  comp: 0,         // -9..9 thirds of an EV (TTL)
  zoomAuto: false,
  zoomIdx: ZOOMS.length - 1,
  hss: false,
  curtain: '1ST',
  channel: 1,
  group: 0,
  wid: 0,          // 0 = OFF, otherwise 1..99
  modelOn: false,
  modelLevel: 50,
  beep: true,
  freq: 10,        // Hz (MULTI)
  times: 10,       // flashes (MULTI)
  battery: 100,
  cursor: 0,
  charging: false,
};

const $ = (id) => document.getElementById(id);

/* ---------- power maths (Godox-style 1/10-stop display) ---------- */
function powerInfo(v) {
  const stops = v / 10;                       // stops below full power
  const whole = Math.floor(stops + 1e-9);
  const frac = stops - whole;
  let fraction, decimal;
  if (frac < 1e-9) {
    fraction = 2 ** whole;
    decimal = 0;
  } else {
    fraction = 2 ** (whole + 1);              // base fraction the decimal builds on
    decimal = Math.round((1 - frac) * 10) / 10;
  }
  const ratio = 1 / 2 ** stops;               // light energy vs full
  return {
    fraction,
    decimal,
    ratio,
    gn: GN_BASE * Math.sqrt(ratio),
    recycle: Math.max(0.05, RECYCLE_FULL * ratio),
    frac: `1/${fraction}`,
    sub: `+${decimal.toFixed(1)} EV`,
  };
}

/* ---------- fields the rocker can step through, per mode ---------- */
function fields() {
  if (state.mode === 'TTL') return ['comp', 'zoom', 'channel', 'group'];
  if (state.mode === 'MULTI') return ['power', 'freq', 'times', 'zoom'];
  return ['power', 'zoom', 'channel', 'group'];
}

const fieldMeta = {
  power: () => ['POWER', powerInfo(state.power).frac],
  comp: () => ['TTL', fmtComp(state.comp)],
  zoom: () => ['ZOOM', state.zoomAuto ? 'AUTO' : `${ZOOMS[state.zoomIdx]}mm`],
  channel: () => ['CH', String(state.channel)],
  group: () => ['GP', GROUPS[state.group]],
  freq: () => ['Hz', String(state.freq)],
  times: () => ['TIMES', String(state.times)],
};

function fmtComp(thirds) {
  const ev = thirds / 3;
  const sign = ev > 0 ? '+' : ev < 0 ? '-' : '±';
  return `${sign}${Math.abs(ev).toFixed(1)} EV`;
}

/* ---------- mutating a field via the rocker ▲ / ▼ ---------- */
function step(dir) {
  const f = fields()[state.cursor];
  switch (f) {
    case 'power': state.power = clamp(state.power + dir, 0, 90); break;
    case 'comp': state.comp = clamp(state.comp + dir, -9, 9); break;
    case 'zoom':
      if (state.zoomAuto && dir < 0) { state.zoomAuto = false; state.zoomIdx = ZOOMS.length - 1; }
      else if (!state.zoomAuto && dir > 0 && state.zoomIdx === ZOOMS.length - 1) state.zoomAuto = true;
      else if (!state.zoomAuto) state.zoomIdx = clamp(state.zoomIdx + dir, 0, ZOOMS.length - 1);
      break;
    case 'channel': state.channel = clamp(state.channel + dir, 1, 32); break;
    case 'group': state.group = clamp(state.group + dir, 0, GROUPS.length - 1); break;
    case 'freq': state.freq = clamp(state.freq + dir, 1, 199); break;
    case 'times': state.times = clamp(state.times + dir, 1, 100); break;
  }
  render();
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n)));

/* ---------- rendering ---------- */
function render() {
  const p = powerInfo(state.power);

  // LCD top pills
  $('lcdWireless').textContent = state.role === 'OFF'
    ? '2.4G OFF'
    : `2.4G ${state.role[0]}·CH${state.channel}·${GROUPS[state.group]}`;
  $('lcdHss').textContent = state.hss ? 'HSS 1/8000' : 'SYNC 1/250';
  $('lcdHss').classList.toggle('hot', state.hss);
  $('lcdBeep').textContent = state.beep ? '♪ ON' : '♪ OFF';

  // LCD main
  $('lcdMode').textContent = state.mode;
  if (state.mode === 'TTL') {
    $('lcdPower').textContent = 'TTL';
    $('lcdSub').textContent = fmtComp(state.comp);
  } else if (state.mode === 'MULTI') {
    $('lcdPower').textContent = p.frac;
    $('lcdSub').textContent = `${state.freq}Hz × ${state.times}`;
  } else {
    $('lcdPower').textContent = p.frac;
    $('lcdSub').textContent = p.decimal ? p.sub : `GN ${Math.round(p.gn)}`;
  }
  $('lcd').classList.toggle('charging', state.charging);

  // LCD bottom: navigable fields with cursor highlight
  const fs = fields();
  if (state.cursor >= fs.length) state.cursor = 0;
  $('lcdBottom').innerHTML = fs.map((f, i) => {
    const [label, value] = fieldMeta[f]();
    return `<span class="tok ${i === state.cursor ? 'sel' : ''}"><i>${label}</i>${value}</span>`;
  }).join('');

  // Side panel: mode segment
  $('modeSeg').innerHTML = MODES.map((m) =>
    `<button class="${state.mode === m ? 'on' : ''}" data-mode="${m}">${m}</button>`).join('');

  // Power / comp / multi visibility
  $('powerGroup').hidden = state.mode === 'TTL';
  $('compGroup').hidden = state.mode !== 'TTL';
  $('multiGroup').hidden = state.mode !== 'MULTI';

  $('powerRange').value = state.power;
  $('powerOut').textContent = p.decimal ? `${p.frac} ${p.sub}` : p.frac;
  $('powerHint').textContent =
    `${p.fraction === 1 && !p.decimal ? 'Full power' : 'Output ' + Math.round(p.ratio * 100) + '%'} · GN ${Math.round(p.gn)} (ISO 100, ${state.zoomAuto ? '105' : ZOOMS[state.zoomIdx]}mm)`;

  $('compRange').value = state.comp;
  $('compOut').textContent = fmtComp(state.comp);

  $('freqRange').value = state.freq;
  $('freqOut').textContent = `${state.freq} Hz`;
  $('timesRange').value = state.times;
  $('timesOut').textContent = String(state.times);

  // Zoom
  $('zoomAuto').classList.toggle('on', state.zoomAuto);
  $('zoomRange').max = String(ZOOMS.length - 1);
  $('zoomRange').value = state.zoomIdx;
  $('zoomRange').disabled = state.zoomAuto;
  $('zoomOut').textContent = state.zoomAuto ? `AUTO (${ZOOMS[state.zoomIdx]}mm)` : `${ZOOMS[state.zoomIdx]}mm`;

  // HSS + curtain
  setToggle($('hssToggle'), state.hss);
  $('curtainSeg').innerHTML = ['1ST', '2ND'].map((c) =>
    `<button class="${state.curtain === c ? 'on' : ''}" data-curtain="${c}">${c === '1ST' ? '1st curtain' : '2nd curtain'}</button>`).join('');

  // Wireless
  $('roleSeg').innerHTML = ROLES.map((r) =>
    `<button class="${state.role === r ? 'on' : ''}" data-role="${r}">${r}</button>`).join('');
  const wlDisabled = state.role === 'OFF';
  ['chanRange', 'groupRange', 'idRange'].forEach((id) => { $(id).disabled = wlDisabled; });
  $('chanRange').value = state.channel;
  $('chanOut').textContent = String(state.channel);
  $('groupRange').value = state.group;
  $('groupOut').textContent = GROUPS[state.group];
  $('idRange').value = state.wid;
  $('idOut').textContent = state.wid === 0 ? 'OFF' : String(state.wid).padStart(2, '0');

  // Modeling lamp
  setToggle($('modelToggle'), state.modelOn);
  $('modelRange').value = state.modelLevel;
  $('modelRange').disabled = !state.modelOn;
  $('modelOut').textContent = `${state.modelLevel}%`;
  $('modelingGlow').style.opacity = state.modelOn ? state.modelLevel / 130 : 0;

  // Sound / recycle
  setToggle($('beepToggle'), state.beep);
  $('recycleHint').textContent = `Recycle time at this power ≈ ${p.recycle.toFixed(2)}s`;
  $('fireBtn').disabled = state.charging;
  $('fireBtn').textContent = state.charging ? '… recycling' : '⚡ Fire test flash';

  // Battery
  $('batteryFill').style.width = `${state.battery}%`;
  $('batteryFill').style.background = state.battery > 40 ? '#34d399' : state.battery > 15 ? '#fbbf24' : '#f87171';
  $('batteryLabel').textContent = `${Math.round(state.battery)}%`;
}

function setToggle(el, on) {
  el.classList.toggle('on', on);
  el.setAttribute('aria-checked', String(on));
}

/* ---------- firing the flash ---------- */
let audioCtx;
function beep(freq = 1760, ms = 90) {
  if (!state.beep) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = 0.04;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch (_) { /* audio not available */ }
}

function pop(ratio) {
  const burst = $('burst');
  const tube = $('tube');
  const intensity = Math.min(1, 0.25 + ratio * 0.75);
  burst.style.transition = 'none';
  burst.style.opacity = String(intensity);
  tube.classList.add('fired');
  // force reflow then fade out
  void burst.offsetWidth;
  burst.style.transition = 'opacity .45s ease-out';
  burst.style.opacity = '0';
  setTimeout(() => tube.classList.remove('fired'), 120);
}

function fire() {
  if (state.charging || state.battery <= 0) return;
  const p = powerInfo(state.power);
  const effRatio = state.mode === 'TTL' ? 0.5 * 2 ** (state.comp / 9) : p.ratio;

  if (state.mode === 'MULTI') {
    const interval = 1000 / state.freq;
    let n = 0;
    const id = setInterval(() => {
      pop(effRatio * 0.6);
      beep(2200, 30);
      drain(effRatio * 0.4);
      if (++n >= state.times) clearInterval(id);
    }, interval);
  } else {
    pop(effRatio);
    drain(effRatio);
  }

  // recycle lock
  const recycle = Math.max(0.1, RECYCLE_FULL * effRatio * (state.battery < 20 ? 1.8 : 1));
  state.charging = true;
  render();
  setTimeout(() => {
    state.charging = false;
    beep(2640, 60); // ready tone
    render();
  }, recycle * 1000);
}

function drain(ratio) {
  state.battery = clamp(state.battery - ratio * 1.2, 0, 100);
}

/* ---------- wiring ---------- */
function cycle(arr, cur, key) {
  const i = (arr.indexOf(cur) + 1) % arr.length;
  state[key] = arr[i];
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;

  if (b.dataset.action) {
    switch (b.dataset.action) {
      case 'inc': step(+1); return;
      case 'dec': step(-1); return;
      case 'next': state.cursor = (state.cursor + 1) % fields().length; render(); return;
      case 'prev': state.cursor = (state.cursor - 1 + fields().length) % fields().length; render(); return;
      case 'test': fire(); return;
      case 'mode': cycle(MODES, state.mode, 'mode'); state.cursor = 0; render(); return;
      case 'wireless': cycle(ROLES, state.role, 'role'); render(); return;
      case 'zoom': state.zoomAuto = !state.zoomAuto; render(); return;
      case 'hss': state.hss = !state.hss; render(); return;
      case 'model': state.modelOn = !state.modelOn; render(); return;
      case 'beep': state.beep = !state.beep; render(); return;
    }
  }
  if (b.dataset.mode) { state.mode = b.dataset.mode; state.cursor = 0; render(); }
  if (b.dataset.curtain) { state.curtain = b.dataset.curtain; render(); }
  if (b.dataset.role) { state.role = b.dataset.role; render(); }
  if (b.id === 'zoomAuto') { state.zoomAuto = !state.zoomAuto; render(); }
  if (b.id === 'hssToggle') { state.hss = !state.hss; render(); }
  if (b.id === 'modelToggle') { state.modelOn = !state.modelOn; render(); }
  if (b.id === 'beepToggle') { state.beep = !state.beep; render(); }
  if (b.id === 'fireBtn') fire();
});

// sliders
const bind = (id, fn) => $(id).addEventListener('input', (e) => { fn(Number(e.target.value)); render(); });
bind('powerRange', (v) => { state.power = v; });
bind('compRange', (v) => { state.comp = v; });
bind('freqRange', (v) => { state.freq = v; });
bind('timesRange', (v) => { state.times = v; });
bind('zoomRange', (v) => { state.zoomIdx = v; state.zoomAuto = false; });
bind('chanRange', (v) => { state.channel = v; });
bind('groupRange', (v) => { state.group = v; });
bind('idRange', (v) => { state.wid = v; });
bind('modelRange', (v) => { state.modelLevel = v; });

// keyboard shortcuts mirror the rocker
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const map = {
    ArrowUp: () => step(+1),
    ArrowDown: () => step(-1),
    ArrowRight: () => { state.cursor = (state.cursor + 1) % fields().length; render(); },
    ArrowLeft: () => { state.cursor = (state.cursor - 1 + fields().length) % fields().length; render(); },
  };
  if (map[e.key]) { e.preventDefault(); map[e.key](); }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fire(); }
});

render();
