// Cena 1 · Hero: requisição saindo do dispositivo, passando pelo servidor e banco, e voltando.
import { $, $$, h, api, sleep, reducedMotion, countUp } from './util.js';

const STEPS = [
  { on: 'client', caption: ['Você clica em ', 'Comprar', ' no aplicativo…'], srv: 'aguardando…' },
  { on: 'client', packet: ['pk1', 'fwd', 'POST /pedidos'], caption: ['1 · O navegador envia uma ', 'requisição', ' pela internet'], srv: 'recebendo…' },
  { on: 'server', caption: ['2 · O servidor ', 'valida', ' quem é você e se há estoque'], srv: 'validando…' },
  { on: 'db', packet: ['pk2', 'fwd', 'SELECT estoque'], caption: ['3 · A API ', 'consulta o banco de dados', ''], srv: 'consultando…' },
  { on: 'db', packet: ['pk2', 'back', '3 linhas'], caption: ['4 · O banco ', 'devolve os dados', ' pedidos'], srv: 'processando…' },
  { on: 'client', packet: ['pk1', 'back', '201 Created'], caption: ['5 · A ', 'resposta', ' volta: pedido confirmado!'], srv: 'respondeu ✔' },
];

const TERM_TEXT = [
  ['t-cmd', '$ curl -i -X POST https://api.minhaloja.dev/pedidos\n'],
  ['t-ok', 'HTTP/1.1 201 Created\n'],
  ['t-mut', 'content-type: application/json\n\n'],
  ['t-str', '{ "pedido": 1042, "status": "confirmado" }'],
];

let timer = null;
let typing = 0;
let idx = 0;
let flow;

function setCaption(parts) {
  const cap = $('#heroCaption');
  cap.textContent = '';
  parts.forEach((p, i) => cap.append(i % 2 ? h('b', {}, p) : document.createTextNode(p)));
}

async function movePacket([id, dir, label]) {
  const pk = $(`#${id}`);
  pk.textContent = label;
  pk.classList.toggle('res', dir === 'back');
  pk.style.transition = 'none';
  pk.style.opacity = '1';
  pk.style.left = dir === 'fwd' ? '0%' : '62%';
  void pk.offsetWidth;
  pk.style.transition = '';
  pk.style.left = dir === 'fwd' ? '62%' : '0%';
  await sleep(reducedMotion() ? 0 : 1000);
  pk.style.opacity = '0';
}

function tick() {
  const s = STEPS[idx];
  $$('.node', flow).forEach((n) => n.classList.toggle('on', n.dataset.n === s.on));
  $('#srvSmall').textContent = s.srv;
  setCaption(s.caption);
  if (s.packet) movePacket(s.packet);
  idx = (idx + 1) % STEPS.length;
}

async function typeTerminal(token) {
  const pre = $('#heroTerm');
  pre.textContent = '';
  for (const [cls, text] of TERM_TEXT) {
    const span = h('span', { class: cls });
    pre.append(span);
    for (const ch of text) {
      if (token !== typing) return;
      span.textContent += ch;
      if (!reducedMotion()) await sleep(ch === '\n' ? 140 : 22);
    }
  }
}

async function renderCounters(ctx) {
  const box = $('#heroCounters');
  box.textContent = '';
  const { data } = await api('/api/salarios');
  const paises = (data.paises || []).filter((p) => p.series?.length).length;
  const items = [
    { n: 0, to: 6, l: 'etapas do fluxo da API, acompanhadas em tempo real' },
    { n: 0, to: paises || 4, l: 'países com dados salariais pesquisados' },
    { n: 0, to: ctx?.status?.perguntasNoBanco || 20, l: 'perguntas diferentes no banco do quiz' },
  ];
  items.forEach((it) => {
    const num = h('div', { class: 'n' }, '0');
    box.append(h('div', { class: 'counter' }, num, h('div', { class: 'l' }, it.l)));
    it.el = num; it.suffix = it.plus ? '+' : '';
  });
  renderCounters.items = items;
}

let ready = Promise.resolve();
export function init(ctx) {
  flow = $('#heroFlow');
  ready = renderCounters(ctx);
}

export function onEnter() {
  idx = 0;
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 1900);
  typing += 1;
  const token = typing;
  const loop = async () => {
    while (token === typing) {
      await typeTerminal(token);
      await sleep(5000);
    }
  };
  loop();
  ready.then(() => (renderCounters.items || []).forEach((it) => countUp(it.el, it.to, { suffix: it.suffix })));
}

export function onLeave() {
  clearInterval(timer);
  typing += 1;
}

export function reset() {}
