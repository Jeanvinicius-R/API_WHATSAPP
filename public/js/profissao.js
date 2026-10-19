// Cena 2 · Profissão: responsabilidades interativas + simulador de login (apenas animação).
import { $, h, icon, sleep, reducedMotion } from './util.js';

const RESPONSABILIDADES = [
  { id: 'servidores', ic: 'server', t: 'Servidores', d: 'Programas que ficam “de plantão” esperando pedidos. Cada vez que você abre um app, algum servidor responde. Back-end é decidir como ele atende, quantos atende e como não cair.' },
  { id: 'apis', ic: 'plug', t: 'APIs', d: 'Os “cardápios” que o aplicativo usa para pedir coisas ao servidor: listar pedidos, criar cadastro, consultar saldo. Quem projeta esse cardápio é o back-end.' },
  { id: 'bancos', ic: 'database', t: 'Bancos de dados', d: 'Onde ficam usuários, produtos, pedidos e mensagens. O back-end organiza, consulta e protege essas informações.' },
  { id: 'auth', ic: 'key', t: 'Autenticação', d: 'Confirmar quem é você (login, biometria, código) e o que você pode fazer. Sem isso, qualquer pessoa veria os dados de qualquer outra.' },
  { id: 'seguranca', ic: 'shield', t: 'Segurança', d: 'Proteger senhas, validar tudo que chega e evitar ataques. Nunca confiar cegamente no que vem de fora é regra número um.' },
  { id: 'regras', ic: 'layers', t: 'Regras de negócio', d: 'As “leis” do sistema: frete grátis acima de X, limite de saque, desconto para cliente antigo. O back-end garante que elas sejam cumpridas sempre.' },
  { id: 'integracoes', ic: 'globe', t: 'Integrações', d: 'Conversar com outros sistemas: pagamento, correios, e-mail, WhatsApp. Esta própria experiência integra um WhatsApp real!' },
  { id: 'processamento', ic: 'cpu', t: 'Processamento', d: 'Calcular, converter, gerar relatórios e processar filas em segundo plano, sem deixar o usuário esperando.' },
  { id: 'escala', ic: 'trending', t: 'Escala e desempenho', d: 'Fazer o sistema continuar rápido quando milhares de pessoas usam ao mesmo tempo: cache, índices, balanceamento e monitoramento.' },
];

// Etapas do simulador. `on` indica qual elemento do mini-fluxo acende; `log` é o que o “servidor” escreveria.
const FLUXO = ['Front-end', 'Servidor', 'Back-end', 'Banco', 'Servidor', 'Front-end'];
const PASSOS = (ok) => [
  { t: 'O front-end envia os dados', s: 'O navegador monta uma requisição POST com usuário e senha (via HTTPS) e dispara.', on: 0, log: ['t-cmd', 'POST /api/login  {"usuario": "visitante", "senha": "••••••••"}'] },
  { t: 'O servidor recebe a requisição', s: 'A API identifica a rota, lê o corpo da mensagem e passa para o código responsável.', on: 1, log: ['t-ok', '[api] requisição recebida · rota /api/login'] },
  { t: 'O back-end valida as informações', s: 'Confere se os campos existem, se o formato está certo e se não há excesso de tentativas.', on: 2, log: ['t-ok', '[auth] campos presentes · formato ok · tentativas dentro do limite'] },
  { t: 'O sistema consulta os dados', s: 'Busca o usuário no banco e compara o hash da senha — a senha em si nunca é guardada.', on: 3, log: ['t-key', '[db] SELECT hash FROM usuarios WHERE usuario = $1  →  1 linha'] },
  { t: 'O servidor retorna uma resposta', s: ok ? 'Credenciais conferem: devolve 200 OK com um token de sessão.' : 'Hash não confere: devolve 401 Unauthorized, sem dizer qual campo errou.', on: 4, log: ok ? ['t-ok', 'HTTP 200 OK  {"token": "eyJhbGciOi…"}'] : ['t-bad', 'HTTP 401 Unauthorized  {"erro": "credenciais inválidas"}'] },
  { t: 'O front-end apresenta o resultado', s: ok ? 'Você vê a tela inicial da sua conta.' : 'Você vê “usuário ou senha incorretos” e pode tentar de novo.', on: 5, log: [ok ? 't-ok' : 't-bad', ok ? '✔ Login concluído' : '✘ Login recusado'] },
];

let busy = false;

function buildMiniFlow() {
  const box = $('#simFlow');
  box.textContent = '';
  FLUXO.forEach((n, i) => {
    box.append(h('span', { dataset: { i } }, n));
    if (i < FLUXO.length - 1) box.append(h('i', {}, '→'));
  });
}

function buildSteps(list) {
  const ol = $('#simSteps');
  ol.textContent = '';
  list.forEach((p, i) => ol.append(h('li', { class: 'step', dataset: { i } },
    h('span', { class: 'n' }, i + 1), h('div', {}, h('b', {}, p.t), h('small', {}, p.s)), h('span', { class: 't' }))));
}

async function run(ok) {
  if (busy) return;
  busy = true;
  const passos = PASSOS(ok);
  buildSteps(passos);
  const log = $('#simLog');
  log.textContent = '';
  log.className = '';
  $('#simLogin').disabled = true;
  $('#simLoginFail').disabled = true;
  const t0 = performance.now();
  for (let i = 0; i < passos.length; i++) {
    const li = $(`#simSteps .step[data-i="${i}"]`);
    li.classList.add('running');
    document.querySelectorAll('#simFlow span').forEach((s) => s.classList.toggle('on', Number(s.dataset.i) === passos[i].on));
    await sleep(reducedMotion() ? 200 : 850);
    li.classList.replace('running', passos[i].log[0] === 't-bad' ? 'erro' : 'ok');
    li.querySelector('.t').textContent = `${Math.round(performance.now() - t0)} ms`;
    log.append(h('div', { class: passos[i].log[0] }, passos[i].log[1]));
  }
  $('#simLogin').disabled = false;
  $('#simLoginFail').disabled = false;
  busy = false;
}

export function init() {
  const grid = $('#respGrid');
  RESPONSABILIDADES.forEach((r) => {
    const b = h('button', { class: 'resp', 'aria-pressed': 'false', onclick: () => select(r.id) },
      h('span', { class: 'ico' }, icon(r.ic)), h('b', {}, r.t));
    b.dataset.id = r.id;
    grid.append(b);
  });
  buildMiniFlow();
  buildSteps(PASSOS(true));
  $('#simLogin').addEventListener('click', () => run(true));
  $('#simLoginFail').addEventListener('click', () => run(false));
}

function select(id) {
  const r = RESPONSABILIDADES.find((x) => x.id === id);
  document.querySelectorAll('.resp').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  const d = $('#respDetail');
  d.textContent = '';
  d.append(h('b', {}, `${r.t}: `), r.d);
}

export function reset() {
  busy = false;
  document.querySelectorAll('.resp').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  $('#respDetail').textContent = 'Escolha um item acima para ver como ele aparece no dia a dia.';
  buildSteps(PASSOS(true));
  $('#simLog').textContent = 'Clique em “Entrar” para ver o que o servidor faria.';
  $('#simLog').className = 't-mut';
  document.querySelectorAll('#simFlow span').forEach((s) => s.classList.remove('on'));
  $('#simLogin').disabled = false;
  $('#simLoginFail').disabled = false;
}
