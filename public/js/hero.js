// Cena 1 · Início: requisição saindo do dispositivo, passando pelo servidor e banco, e voltando.
import { $, $$, h, sleep, reducedMotion } from './util.js';

const STEPS = [
  { on: 'client', caption: ['Você clica em ', 'Enviar', ' no aplicativo…'], srv: 'aguardando…' },
  { on: 'client', packet: ['pk1', 'fwd', 'POST /mensagem'], caption: ['1 · O navegador envia uma ', 'requisição', ' pela internet'], srv: 'recebendo…' },
  { on: 'server', caption: ['2 · O servidor ', 'valida', ' os dados e as regras'], srv: 'validando…' },
  { on: 'db', packet: ['pk2', 'fwd', 'SELECT dados'], caption: ['3 · A API ', 'consulta o banco de dados', ''], srv: 'consultando…' },
  { on: 'db', packet: ['pk2', 'back', '3 linhas'], caption: ['4 · O banco ', 'devolve os dados', ''], srv: 'processando…' },
  { on: 'client', packet: ['pk1', 'back', '200 OK'], caption: ['5 · A ', 'resposta', ' volta: tudo certo!'], srv: 'respondeu ✔' },
];

let timer = null;
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

export function init() {
  flow = $('#heroFlow');
}

export function onEnter() {
  idx = 0;
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 1900);
}

export function onLeave() {
  clearInterval(timer);
}

export function reset() {}
