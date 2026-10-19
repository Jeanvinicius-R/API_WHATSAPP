// Cena 3 · Rotina: linha do tempo interativa (exemplo, não agenda fixa) + problemas reais.
import { $, h, icon, sleep } from './util.js';

const MOMENTOS = [
  { ic: 'users', t: 'Alinhamento rápido', quando: 'começo do dia', d: 'Reunião curta com a equipe (daily): o que foi feito, o que vem agora e onde há bloqueios. Em muitas equipes dura 15 minutos — em outras nem existe.' },
  { ic: 'code', t: 'Nova funcionalidade', quando: 'manhã', d: 'Transformar uma necessidade (“permitir cupom de desconto”) em código: modelar os dados, escrever as regras e expor tudo por uma rota de API.' },
  { ic: 'plug', t: 'APIs e integrações', quando: 'manhã', d: 'Criar e manter as rotas que o aplicativo consome e conectar serviços externos, como pagamento, e-mail ou mensageria.' },
  { ic: 'database', t: 'Banco de dados', quando: 'meio do dia', d: 'Escrever consultas, ajustar índices e planejar mudanças na estrutura das tabelas sem perder nenhum dado.' },
  { ic: 'bug', t: 'Investigar um bug', quando: 'imprevisto', d: 'Alguém reportou um erro. Ler logs, reproduzir o problema, descobrir a causa e corrigir — e, de preferência, escrever um teste para ele nunca mais voltar.' },
  { ic: 'check-circle', t: 'Testes automatizados', quando: 'o tempo todo', d: 'Programas que checam se o sistema continua funcionando. Rodam a cada mudança e dão segurança para evoluir o código.' },
  { ic: 'eye', t: 'Revisão de código', quando: 'tarde', d: 'Outra pessoa lê o que você escreveu antes de entrar no sistema (code review): pegar erros cedo e aprender uns com os outros.' },
  { ic: 'upload', t: 'Deploy', quando: 'quando está pronto', d: 'Colocar a nova versão no ar, de forma automática (CI/CD) e com plano de volta caso algo dê errado.' },
  { ic: 'activity', t: 'Monitoramento', quando: 'sempre', d: 'Painéis e alertas mostram erros, lentidão e uso de recursos. Quando algo foge do normal, o time é avisado.' },
];

const PROBLEMAS = [
  {
    q: 'Por que o aplicativo não consegue carregar os pedidos?',
    passos: [
      'Começa pelos <b>logs</b> e pelo monitoramento: há erro 500? Lentidão? Timeout?',
      'Reproduz o problema e segue a requisição: API → regra de negócio → banco de dados.',
      'Muitas vezes a causa é uma <b>consulta lenta</b> (falta de índice) ou um serviço externo fora do ar.',
      'Corrige, cria um <b>teste automatizado</b> para esse cenário e faz o deploy com acompanhamento.',
    ],
  },
  {
    q: 'Como garantir que um pagamento não seja processado duas vezes?',
    passos: [
      'Cada tentativa de pagamento recebe uma <b>chave de idempotência</b>: se a mesma chave chegar de novo, o servidor devolve o resultado anterior em vez de cobrar outra vez.',
      'A operação roda numa <b>transação</b> do banco: ou tudo acontece, ou nada acontece.',
      'Uma <b>restrição de unicidade</b> no banco impede registros duplicados mesmo se duas requisições chegarem juntas.',
    ],
  },
  {
    q: 'Como permitir que milhares de pessoas utilizem o sistema simultaneamente?',
    passos: [
      'Coloca <b>várias cópias</b> do servidor atrás de um balanceador de carga (escala horizontal).',
      'Usa <b>cache</b> (como o Redis) para não repetir consultas caras ao banco.',
      'Joga tarefas demoradas para <b>filas</b>, processadas em segundo plano.',
      'Mede tudo com <b>testes de carga</b> e monitoramento, para descobrir o gargalo antes dos usuários.',
    ],
  },
  {
    q: 'Como proteger os dados das pessoas que usam o sistema?',
    passos: [
      'Guarda senhas apenas como <b>hash</b> (bcrypt/Argon2), nunca em texto puro.',
      'Trafega tudo por <b>HTTPS</b> e valida toda entrada para evitar ataques como SQL Injection.',
      'Aplica <b>limites de requisições</b> (rate limiting) e checa permissões em cada rota.',
    ],
  },
];

let selected = 0;
let playing = 0;

function renderTimeline() {
  const tl = $('#timeline');
  tl.textContent = '';
  MOMENTOS.forEach((m, i) => {
    tl.append(h('button', { class: 'tl-item', role: 'tab', 'aria-selected': 'false', dataset: { i }, onclick: () => { playing += 1; select(i); } },
      h('span', { class: 'tl-dot' }, icon(m.ic)), h('span', {}, m.t), h('small', {}, m.quando)));
  });
}

function select(i) {
  selected = i;
  document.querySelectorAll('.tl-item').forEach((el, k) => {
    el.classList.toggle('sel', k === i);
    el.classList.toggle('done', k < i);
    el.setAttribute('aria-selected', String(k === i));
  });
  document.querySelector('.tl-item.sel')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  const m = MOMENTOS[i];
  const box = $('#tlDetail');
  box.textContent = '';
  box.append(h('span', { class: 'level n1' }, `Momento ${i + 1} de ${MOMENTOS.length} · ${m.quando}`), h('h3', {}, m.t), h('p', { class: 'mut' }, m.d));
  $('#tlBar').style.width = `${((i + 1) / MOMENTOS.length) * 100}%`;
}

async function play() {
  const token = ++playing;
  for (let i = 0; i < MOMENTOS.length && token === playing; i++) {
    select(i);
    await sleep(2600);
  }
}

function showProblem(i) {
  document.querySelectorAll('.problem').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  const p = PROBLEMAS[i];
  const box = $('#problemSolution');
  box.textContent = '';
  const ol = h('ol');
  // O conteúdo é estático e escrito neste arquivo; só <b> é interpretado.
  p.passos.forEach((s) => {
    const li = h('li');
    s.split(/(<b>.*?<\/b>)/).forEach((part) => {
      const m = part.match(/^<b>(.*)<\/b>$/);
      if (m) li.append(h('b', {}, m[1])); else if (part) li.append(part);
    });
    ol.append(li);
  });
  box.append(h('h3', {}, 'Como o back-end entra nessa história'), ol);
}

export function init() {
  renderTimeline();
  select(0);
  const list = $('#problemList');
  PROBLEMAS.forEach((p, i) => list.append(h('button', { class: 'problem', 'aria-pressed': 'false', onclick: () => showProblem(i) }, p.q)));
  $('#tlPlay').addEventListener('click', play);
}

export function onLeave() { playing += 1; }

export function reset() {
  playing += 1;
  select(0);
  document.querySelectorAll('.problem').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  const box = $('#problemSolution');
  box.textContent = '';
  box.append(h('p', { class: 'mut' }, 'A explicação aparece aqui.'));
}
