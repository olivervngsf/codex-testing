const themes = [
  { name: 'Ocean', primary: '#2563eb', accent: '#06b6d4', surface: '#f8fafc', ink: '#0f172a' },
  { name: 'Plum', primary: '#7c3aed', accent: '#ec4899', surface: '#fbf7ff', ink: '#1e1233' },
  { name: 'Forest', primary: '#15803d', accent: '#84cc16', surface: '#f7fdf8', ink: '#102116' },
  { name: 'Sunset', primary: '#ea580c', accent: '#f59e0b', surface: '#fff8ed', ink: '#2b1708' },
];
const fonts = [
  { label: 'Modern Sans', value: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Editorial Serif', value: 'Georgia, Cambria, "Times New Roman", serif' },
  { label: 'Rounded UI', value: 'ui-rounded, "Avenir Next", Nunito, system-ui, sans-serif' },
];
const samples = ['Dashboard', 'CRM', 'Landing'];
const state = { sample: 'Dashboard', theme: { ...themes[0] }, font: fonts[0], radius: 22, density: 1 };
const $ = (id) => document.getElementById(id);

function hexToRgb(hex) { const value = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)); }
function mix(hex, ratio, target = '#ffffff') {
  const a = hexToRgb(hex); const b = hexToRgb(target);
  return `rgb(${a.map((channel, i) => Math.round(channel * (1 - ratio) + b[i] * ratio)).join(', ')})`;
}
function applyTokens() {
  const root = $('app').style;
  root.setProperty('--primary', state.theme.primary);
  root.setProperty('--primary-strong', mix(state.theme.primary, 0.18, '#000000'));
  root.setProperty('--primary-soft', mix(state.theme.primary, 0.86));
  root.setProperty('--accent', state.theme.accent);
  root.setProperty('--accent-soft', mix(state.theme.accent, 0.84));
  root.setProperty('--surface', state.theme.surface);
  root.setProperty('--ink', state.theme.ink);
  root.setProperty('--muted', mix(state.theme.ink, 0.45, '#ffffff'));
  root.setProperty('--radius', `${state.radius}px`);
  root.setProperty('--density', state.density);
  root.setProperty('--font', state.font.value);
}
function renderTabs() { $('tabs').innerHTML = samples.map((item) => `<button class="${state.sample === item ? 'active' : ''}" data-sample="${item}">${item} sample</button>`).join(''); }
function previewHeader(title, tag) { return `<div class="preview-header"><div><span>${tag}</span><h2>${title}</h2></div><button>Export theme</button></div>`; }
function renderPreview() {
  const dashboard = `${previewHeader('Executive dashboard', 'Analytics')}<div class="metric-grid">${[['Revenue', '$128.4K', '+18%'], ['Active users', '24,892', '+9%'], ['Conversion', '8.6%', '+2.1%']].map(([l, v, d]) => `<article class="metric-card"><p>${l}</p><h2>${v}</h2><span>${d}</span></article>`).join('')}</div><div class="content-grid"><article class="chart-card"><h3>Performance overview</h3><div class="bars">${[48,64,42,76,58,88,72].map((h) => `<span style="height:${h}%"></span>`).join('')}</div></article><article class="activity"><h3>Recent activity</h3>${['New campaign launched','Palette approved','Landing page reviewed'].map((i) => `<p>◎ ${i}</p>`).join('')}</article></div>`;
  const crm = `${previewHeader('CRM workspace', 'Pipeline')}<div class="crm-grid">${['Lead qualified', 'Proposal sent', 'Negotiation'].map((stage, index) => `<article class="pipeline"><h3>${stage}</h3>${['Acme Co.', 'Northstar Labs', 'Brightlane'].slice(0, 3 - index).map((name) => `<div class="deal"><span>👥</span><div><b>${name}</b><p>$${(index + 2) * 18}K opportunity</p></div></div>`).join('')}</article>`).join('')}</div>`;
  const landing = `${previewHeader('Launch page', 'Marketing')}<div class="landing-copy"><h2>Build a brand system people can feel in seconds.</h2><p>Use realistic sections, buttons, cards, and badges to judge if your palette works before shipping.</p><button>Start testing ›</button></div><div class="feature-row">${['Accessible contrast','Reusable tokens','Fast decisions'].map((i) => `<span>✓ ${i}</span>`).join('')}</div>`;
  $('preview').className = `preview-shell ${state.sample === 'Landing' ? 'landing' : ''}`;
  $('preview').innerHTML = state.sample === 'CRM' ? crm : state.sample === 'Landing' ? landing : dashboard;
}
function renderControls() {
  $('themeGrid').innerHTML = themes.map((theme) => `<button class="theme-chip ${state.theme.name === theme.name ? 'selected' : ''}" data-theme="${theme.name}"><span class="swatch" style="background:${theme.primary}"></span><span class="swatch" style="background:${theme.accent}"></span>${theme.name}</button>`).join('');
  $('primaryColor').value = state.theme.primary; $('accentColor').value = state.theme.accent;
  $('fontSelect').innerHTML = fonts.map((font) => `<option ${state.font.label === font.label ? 'selected' : ''}>${font.label}</option>`).join('');
  $('radiusRange').value = state.radius; $('densityRange').value = state.density;
  const tokens = [['Primary', state.theme.primary], ['Primary soft', mix(state.theme.primary, 0.86)], ['Accent', state.theme.accent], ['Accent soft', mix(state.theme.accent, 0.84)], ['Surface', state.theme.surface], ['Text', state.theme.ink]];
  $('tokenList').innerHTML = tokens.map(([label, color]) => `<div class="token"><span style="background:${color}"></span><b>${label}</b><code>${color}</code></div>`).join('');
}
function render() { applyTokens(); renderTabs(); renderPreview(); renderControls(); }

document.addEventListener('click', (event) => {
  const sample = event.target.closest('[data-sample]'); if (sample) state.sample = sample.dataset.sample;
  const theme = event.target.closest('[data-theme]'); if (theme) state.theme = { ...themes.find((item) => item.name === theme.dataset.theme) };
  if (sample || theme) render();
});
$('primaryColor').addEventListener('input', (event) => { state.theme = { ...state.theme, name: 'Custom', primary: event.target.value }; render(); });
$('accentColor').addEventListener('input', (event) => { state.theme = { ...state.theme, name: 'Custom', accent: event.target.value }; render(); });
$('fontSelect').addEventListener('change', (event) => { state.font = fonts.find((font) => font.label === event.target.value); render(); });
$('radiusRange').addEventListener('input', (event) => { state.radius = event.target.value; render(); });
$('densityRange').addEventListener('input', (event) => { state.density = event.target.value; render(); });
render();
