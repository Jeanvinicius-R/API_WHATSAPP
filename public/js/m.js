// Página aberta pelo QR Code (celular): mostra a analogia do motor do carro, passo a passo, sozinha.
import { $, api, h, icon, sleep, reducedMotion } from './util.js';

const ETAPAS = [
  { ic: 'smartphone', nome: 'Painel e volante', texto: 'O que você vê e toca: telas e botões. É o front-end.' },
  { ic: 'zap', nome: 'Acelerador', texto: 'Ao tocar, seu pedido (a requisição) sai do celular e viaja pela internet até o servidor.' },
  { ic: 'cpu', nome: 'Motor', texto: 'O back-end confere as regras e decide o que fazer. Fica escondido, mas é quem faz tudo andar.' },
  { ic: 'database', nome: 'Tanque de combustível', texto: 'O banco de dados guarda as informações de que o motor precisa para trabalhar.' },
  { ic: 'check-circle', nome: 'Velocímetro', texto: 'A resposta volta para a sua tela, em segundos. Pronto!' },
];

let playing = false;

async function play() {
  if (playing) return;
  playing = true;
  const list = $('#mSteps');
  list.textContent = '';
  $('#mFinal').hidden = true;
  for (let i = 0; i < ETAPAS.length; i++) {
    const e = ETAPAS[i];
    const li = h('li', { class: 'm-step' },
      h('div', { class: 'box' }, icon(e.ic)),
      h('div', {}, h('b', {}, `${i + 1}. ${e.nome}`), h('p', {}, e.texto)));
    list.append(li);
    void li.offsetWidth; // reinicia a transição de entrada
    li.classList.add('in');
    li.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    await sleep(reducedMotion() ? 200 : 1800);
  }
  $('#mFinal').hidden = false;
  $('#mFinal').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  playing = false;
}

$('#mAgain').addEventListener('click', play);

// Avisa o servidor (só alimenta o contador ao vivo da apresentação). Uma vez por aba.
try {
  if (!sessionStorage.getItem('visitou')) {
    sessionStorage.setItem('visitou', '1');
    api('/api/mensagem/visita', { method: 'POST' });
  }
} catch { /* sem sessionStorage: apenas não conta */ }

play();
