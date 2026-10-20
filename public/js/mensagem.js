// Cena 4 · Mensagem: QR Code que abre a página /m.html no celular do visitante + analogia do motor + visitas ao vivo.
import { $, api, h, icon, sleep, reducedMotion } from './util.js';

const ETAPAS = [
  { ic: 'smartphone', nome: 'Painel', dica: 'você lê o QR Code', legenda: '📱 Painel: o celular e a tela, a parte que dá para ver (front-end).' },
  { ic: 'zap', nome: 'Acelerador', dica: 'a requisição', legenda: '🦶 Acelerador: seu pedido sai do celular e viaja pela internet até o servidor.' },
  { ic: 'cpu', nome: 'Motor', dica: 'o back-end', legenda: '⚙️ Motor: o back-end confere as regras e decide o que fazer.' },
  { ic: 'database', nome: 'Tanque', dica: 'os dados', legenda: '⛽ Tanque: o banco de dados guarda o que o motor precisa para trabalhar.' },
  { ic: 'check-circle', nome: 'Velocímetro', dica: 'a resposta', legenda: '📟 Velocímetro: a resposta volta para a sua tela. Pronto!' },
];

let ctxRef;
let timer = null;
let running = false;
let nodes = [];

function setCaption(texto) {
  $('#motorCaption').textContent = texto;
}

async function runMotor() {
  if (running) return;
  running = true;
  $('#motorRun').disabled = true;
  nodes.forEach((n) => n.classList.remove('on', 'done'));
  for (let i = 0; i < ETAPAS.length; i++) {
    nodes[i].classList.add('on');
    setCaption(ETAPAS[i].legenda);
    await sleep(reducedMotion() ? 300 : 1300);
    nodes[i].classList.replace('on', 'done');
  }
  running = false;
  $('#motorRun').disabled = false;
}

function renderQr(info) {
  const box = $('#qrBox');
  box.textContent = '';
  $('#qrNumero').textContent = '';
  if (info?.disponivel) {
    box.append(h('img', { src: info.qr, alt: 'QR Code que abre a explicação do back-end no celular', width: 480, height: 480 }));
    $('#qrNumero').textContent = info.alcance === 'local'
      ? 'Atenção: o servidor só aceita este computador. Defina HOST=0.0.0.0 no .env para os celulares abrirem o link.'
      : `Sem conseguir ler? Digite no navegador: ${info.link}`;
    return;
  }
  const motivo = info?.estatico
    ? 'O QR Code aparece na versão do evento, com o servidor ligado. Aqui você pode ver o caminho do pedido ao lado.'
    : 'Não achei o endereço do notebook na rede. Conecte-o ao Wi-Fi ou defina PUBLIC_URL no .env.';
  box.append(h('div', { class: 'qr-off' }, icon('globe'), h('p', {}, motivo)));
}

function renderLive(data) {
  $('#liveTotal').textContent = String(data?.total ?? 0);
  const list = $('#liveList');
  list.textContent = '';
  for (const r of data?.recentes || []) {
    const hora = new Date(r.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    list.append(h('li', { class: 'respondido' }, h('span', {}, `Visitante #${r.n}`), h('small', {}, `${hora} · abriu o QR Code`)));
  }
}

async function refresh() {
  const [qr, live] = await Promise.all([api('/api/mensagem/qr'), api('/api/mensagem/ao-vivo')]);
  if (qr.status === 200) renderQr(qr.data);
  if (live.status === 200) renderLive(live.data);
}

export function init(ctx) {
  ctxRef = ctx;
  const motor = $('#motor');
  nodes = ETAPAS.map((e, i) => {
    const n = h('div', { class: 'motor-node', role: 'listitem' },
      h('div', { class: 'box' }, icon(e.ic)),
      h('b', {}, e.nome),
      h('small', {}, e.dica));
    motor.append(n);
    if (i < ETAPAS.length - 1) motor.append(h('i', { class: 'motor-link', 'aria-hidden': 'true' }));
    return n;
  });
  $('#motorRun').addEventListener('click', runMotor);
}

export function onEnter() {
  refresh();
  clearInterval(timer);
  timer = setInterval(refresh, 3000);
}

export function onLeave() {
  clearInterval(timer);
  timer = null;
}

export function reset() {
  running = false;
  $('#motorRun').disabled = false;
  nodes.forEach((n) => n.classList.remove('on', 'done'));
  setCaption('Toque em “Ligar o motor” para ver o caminho do seu pedido.');
}
