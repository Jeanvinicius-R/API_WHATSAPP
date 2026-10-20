// Cena 4 · Mensagem: QR Code que abre o WhatsApp do evento + analogia do motor + atendimentos ao vivo.
import { $, api, h, icon, sleep, reducedMotion } from './util.js';

const ETAPAS = [
  { ic: 'smartphone', nome: 'Painel', dica: 'você envia a mensagem', legenda: '📱 Painel: você usa o WhatsApp, a parte que dá para ver (front-end).' },
  { ic: 'zap', nome: 'Acelerador', dica: 'a requisição', legenda: '🦶 Acelerador: seu pedido sai do celular e viaja pela internet até o servidor.' },
  { ic: 'cpu', nome: 'Motor', dica: 'o back-end', legenda: '⚙️ Motor: o back-end confere as regras e decide o que fazer.' },
  { ic: 'database', nome: 'Tanque', dica: 'os dados', legenda: '⛽ Tanque: o banco de dados guarda o que o motor precisa para trabalhar.' },
  { ic: 'check-circle', nome: 'Velocímetro', dica: 'a resposta', legenda: '📟 Velocímetro: a resposta volta para o seu WhatsApp. Pronto!' },
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
    box.append(h('img', { src: info.qr, alt: 'QR Code que abre o WhatsApp com a mensagem pronta', width: 480, height: 480 }));
    $('#qrNumero').textContent = `Sem conseguir ler? Mande “${info.texto}” para ${info.numero}.`;
    return;
  }
  const motivo = info?.estatico
    ? 'O QR Code aparece na versão do evento, com o servidor ligado. Aqui você pode ver o caminho do pedido ao lado.'
    : info?.motivo === 'demo'
      ? 'Modo demonstração: o QR Code fica desligado e nenhuma mensagem é enviada.'
      : 'O WhatsApp do evento ainda não está conectado. Peça ajuda a um apresentador.';
  box.append(h('div', { class: 'qr-off' }, icon('whatsapp'), h('p', {}, motivo)));
}

function renderLive(data) {
  $('#liveTotal').textContent = String(data?.total ?? 0);
  const list = $('#liveList');
  list.textContent = '';
  for (const r of data?.recentes || []) {
    const hora = new Date(r.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const estado = { respondido: 'respondido ✓', respondendo: 'respondendo…', falhou: 'não foi possível responder' }[r.estado] || r.estado;
    list.append(h('li', { class: r.estado }, h('span', {}, `Visitante #${r.n}`), h('small', {}, `${hora} · ${estado}`)));
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
