// Orquestrador: cenas, navegação, atalhos, tela cheia, modo apresentação, reinício e status do servidor.
import { $, $$, h, hydrateIcons, icon, api, sleep, reducedMotion, countUp, hooks } from './util.js';
import * as hero from './hero.js';
import * as linguagens from './linguagens.js';
import * as salarios from './salarios.js';
import * as mensagem from './mensagem.js';

const SCENES = ['inicio', 'linguagens', 'salarios', 'mensagem'];
const LABELS = { inicio: 'Início', linguagens: 'Linguagens', salarios: 'Salários', mensagem: 'Mensagem' };
const MODULES = { inicio: hero, linguagens, salarios, mensagem };

const ctx = {
  status: { modo: 'real', envioDisponivel: false, epoch: null },
  current: null,
  go,
  reset: resetExperience,
  listeners: new Set(),
  onStatus(fn) { this.listeners.add(fn); },
};

let navigating = false;

function buildChrome() {
  const tabs = $('#tabs');
  SCENES.forEach((id, i) => {
    tabs.append(h('button', {
      class: 'tab', dataset: { scene: id }, title: `${LABELS[id]} (Alt+${i + 1})`,
      onclick: () => go(id),
    }, LABELS[id]));
  });
  const dots = $('#dots');
  SCENES.forEach(() => dots.append(h('i')));
  $('#btnPresent').append(icon('maximize'));
  $('#btnReset').append(icon('rotate'));
}

async function go(id, { instant = false } = {}) {
  if (!SCENES.includes(id) || id === ctx.current || navigating) return;
  navigating = true;
  const from = ctx.current ? $(`#${ctx.current}`) : null;
  const to = $(`#${id}`);
  const forward = !from || SCENES.indexOf(id) > SCENES.indexOf(ctx.current);
  to.style.setProperty('--enter', forward ? '3rem' : '-3rem');
  if (from) {
    from.style.setProperty('--enter', forward ? '-3rem' : '3rem');
    from.classList.remove('active');
  }
  to.scrollTop = 0;
  // força reflow para a transição de entrada partir da posição correta
  void to.offsetWidth;
  to.classList.add('active');
  ctx.current = id;
  history.replaceState(null, '', `#${id}`);
  $$('.tab').forEach((t) => (t.dataset.scene === id ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current')));
  $$('#dots i').forEach((d, i) => d.classList.toggle('on', SCENES[i] === id));
  $('#btnPrev').disabled = SCENES.indexOf(id) === 0;
  $('#btnNext').disabled = SCENES.indexOf(id) === SCENES.length - 1;
  document.title = `${LABELS[id]} · Back-end Experience`;
  $(`.tab[data-scene="${id}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  if (from && MODULES[from.id].onLeave) MODULES[from.id].onLeave(ctx);
  MODULES[id].onEnter?.(ctx);
  await sleep(instant || reducedMotion() ? 0 : 450);
  navigating = false;
}

const step = (d) => {
  const i = SCENES.indexOf(ctx.current) + d;
  if (i >= 0 && i < SCENES.length) go(SCENES[i]);
};

// ----- Tela cheia / modo apresentação -----
async function togglePresentation(force) {
  const on = force ?? !document.body.classList.contains('apresentacao');
  document.body.classList.toggle('apresentacao', on);
  $('#btnPresent').setAttribute('aria-pressed', String(on));
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch { /* navegador pode negar tela cheia; o modo de textos grandes continua */ }
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('apresentacao')) {
    document.body.classList.remove('apresentacao');
    $('#btnPresent').setAttribute('aria-pressed', 'false');
  }
});

// ----- Reinício para o próximo visitante -----
function resetExperience() {
  for (const m of Object.values(MODULES)) m.reset?.(ctx);
  window.scrollTo(0, 0);
  go('inicio');
}

// ----- Status do servidor (modo real/simulado, reinício remoto pelo admin) -----
async function pollStatus() {
  const { status, data } = await api('/api/status');
  if (status !== 200) {
    ctx.status = { ...ctx.status, envioDisponivel: false, offline: true };
  } else {
    const prev = ctx.status.epoch;
    ctx.status = { ...data, offline: false };
    if (prev !== null && prev !== data.epoch) resetExperience(); // admin pediu reinício
  }
  $('#modoChip').hidden = ctx.status.modo !== 'simulado';
  $('#modoChip').textContent = ctx.status.estatico
    ? 'VERSÃO ONLINE · BACK-END SIMULADO · NENHUMA MENSAGEM É ENVIADA'
    : 'MODO DEMONSTRAÇÃO · ENVIOS SIMULADOS';
  ctx.listeners.forEach((fn) => fn(ctx.status));
}

// ----- Teclado -----
document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (e.altKey && /^[1-4]$/.test(e.key)) { e.preventDefault(); go(SCENES[Number(e.key) - 1]); return; }
  if (typing || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') step(1);
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { step(-1); }
  else if (e.key === 'Home') go('inicio');
  else if (e.key.toLowerCase() === 'f') togglePresentation();
  else if (e.key.toLowerCase() === 'r') resetExperience();
});

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (SCENES.includes(id)) go(id);
});

// ----- Inicialização -----
buildChrome();
hydrateIcons();
$('#brandBtn').addEventListener('click', () => go('inicio'));
$('#btnPrev').addEventListener('click', () => step(-1));
$('#btnNext').addEventListener('click', () => step(1));
$('#btnPresent').addEventListener('click', () => togglePresentation());
$('#btnReset').addEventListener('click', () => resetExperience());
$$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

// Versão publicada no GitHub Pages: não há servidor, então o back-end é simulado no navegador.
if (document.querySelector('meta[name="be-mode"]')?.content === 'static') {
  hooks.staticHandler = (await import('./static-api.js')).staticApi;
}

await pollStatus();
for (const [id, m] of Object.entries(MODULES)) m.init?.(ctx, $(`#${id}`));
hydrateIcons();
setInterval(pollStatus, 5000);
const start = location.hash.slice(1);
await go(SCENES.includes(start) ? start : 'inicio', { instant: true });
