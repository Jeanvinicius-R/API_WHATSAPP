// Cena 5 · Tecnologias: cartões que viram ao toque + trilha "Por onde começar?".
import { $, h, icon } from './util.js';

// ic: "mono:XX" = monograma | nome de ícone SVG
const TECH = [
  // Linguagens
  { c: 'lang', n: 'JavaScript / TypeScript', ic: 'mono:JS', d: 'A linguagem da web. No servidor, roda via Node.js; o TypeScript acrescenta tipos para evitar erros.', ex: 'Esta experiência: o servidor que você está usando é Express, em JavaScript.' },
  { c: 'lang', n: 'Python', ic: 'mono:Py', d: 'Sintaxe simples e enorme ecossistema, de APIs a ciência de dados e IA.', ex: 'Back-end de sistemas de análise de dados e serviços de IA.' },
  { c: 'lang', n: 'Java', ic: 'mono:Jv', d: 'Madura e muito usada em grandes empresas, bancos e sistemas de alta confiabilidade.', ex: 'Sistemas bancários e de varejo em larga escala.' },
  { c: 'lang', n: 'C#', ic: 'mono:C#', d: 'Linguagem da plataforma .NET, usada em sistemas corporativos, APIs e jogos.', ex: 'APIs corporativas hospedadas em nuvem.' },
  { c: 'lang', n: 'PHP', ic: 'mono:PHP', d: 'Pensada para a web, está por trás de uma enorme parte dos sites existentes.', ex: 'Lojas virtuais e sites de conteúdo.' },
  { c: 'lang', n: 'Go', ic: 'mono:Go', d: 'Criada pelo Google, é rápida, simples e ótima para serviços que atendem muita gente ao mesmo tempo.', ex: 'Serviços de infraestrutura e APIs de alto tráfego.' },
  // Bancos
  { c: 'db', n: 'PostgreSQL', ic: 'database', d: 'Banco relacional de código aberto, robusto e cheio de recursos.', ex: 'Guardar clientes, pedidos e pagamentos com integridade.' },
  { c: 'db', n: 'MySQL', ic: 'database', d: 'Banco relacional popular, muito usado em aplicações web.', ex: 'Cadastro de usuários de um site.' },
  { c: 'db', n: 'SQL Server', ic: 'database', d: 'Banco relacional da Microsoft, comum em ambientes corporativos .NET.', ex: 'Sistemas de gestão empresarial.' },
  { c: 'db', n: 'MongoDB', ic: 'layers', d: 'Banco de documentos (parecido com JSON), flexível para dados que mudam de formato.', ex: 'Catálogos de produtos com atributos variados.' },
  { c: 'db', n: 'Redis', ic: 'zap', d: 'Banco em memória, extremamente rápido: ótimo para cache, filas e sessões.', ex: 'Guardar por alguns segundos o resultado de uma consulta cara.' },
  // Ferramentas e conceitos
  { c: 'tool', n: 'Node.js', ic: 'mono:Nd', d: 'Ambiente que executa JavaScript fora do navegador, no servidor.', ex: 'O que roda o servidor desta experiência.' },
  { c: 'tool', n: 'Spring Boot', ic: 'box', d: 'Framework Java que acelera a criação de APIs e serviços prontos para produção.', ex: 'Microsserviços em empresas que usam Java.' },
  { c: 'tool', n: '.NET', ic: 'mono:.N', d: 'Plataforma da Microsoft para criar APIs e aplicações em C#.', ex: 'APIs web com ASP.NET Core.' },
  { c: 'tool', n: 'Docker', ic: 'box', d: 'Empacota a aplicação e suas dependências em contêineres que rodam igual em qualquer lugar.', ex: 'Subir o sistema inteiro com um único comando.' },
  { c: 'tool', n: 'Git', ic: 'branch', d: 'Controle de versão: histórico do código e trabalho em equipe sem bagunça.', ex: 'Voltar a uma versão anterior após um erro.' },
  { c: 'tool', n: 'APIs REST', ic: 'globe', d: 'Padrão para criar APIs sobre HTTP, com rotas e métodos como GET, POST, PUT e DELETE.', ex: 'POST /api/quiz/enviar-resultado — a rota desta experiência.' },
  { c: 'tool', n: 'Cloud Computing', ic: 'cloud', d: 'Usar servidores e serviços de provedores como AWS, Azure ou Google Cloud, pagando pelo uso.', ex: 'Aumentar servidores automaticamente em dia de promoção.' },
  { c: 'tool', n: 'Segurança de aplicações', ic: 'shield', d: 'Boas práticas para proteger dados e usuários: validação, hash de senha, HTTPS, limites de uso.', ex: 'Limitar quantas mensagens um número pode receber.' },
  { c: 'tool', n: 'Testes automatizados', ic: 'check-circle', d: 'Código que verifica se o código funciona, rodando a cada alteração.', ex: 'Garantir que o cálculo da pontuação do quiz está certo.' },
  { c: 'tool', n: 'CI/CD', ic: 'sync', d: 'Automação que testa e publica o sistema a cada mudança aprovada.', ex: 'Publicar uma correção em minutos, com segurança.' },
];

const CATS = [['all', 'Todas'], ['lang', 'Linguagens'], ['db', 'Bancos de dados'], ['tool', 'Ferramentas e conceitos']];

const TRILHA = [
  { t: 'Lógica de programação', s: 'Pensar em passos: variáveis, condições e repetições.' },
  { t: 'Uma linguagem', s: 'Escolha uma (JavaScript, Python, Java…) e pratique.' },
  { t: 'HTTP e APIs', s: 'Entenda requisição, resposta, métodos e códigos.' },
  { t: 'Banco de dados', s: 'SQL, tabelas, chaves e relacionamentos.' },
  { t: 'Git', s: 'Versionar o código e publicar no GitHub.' },
  { t: 'Primeiro projeto', s: 'Uma API simples com banco de dados. Mostre ao mundo!' },
];

let filter = 'all';

function techIcon(ic) {
  if (ic.startsWith('mono:')) return h('div', { class: 'tech-ic' }, ic.slice(5));
  return h('div', { class: 'tech-ic' }, icon(ic));
}

function renderGrid() {
  const grid = $('#techGrid');
  grid.textContent = '';
  TECH.filter((t) => filter === 'all' || t.c === filter).forEach((t) => {
    const btn = h('button', { class: 'tech', 'aria-pressed': 'false', 'aria-label': `${t.n}. Toque para ver um exemplo de uso.` },
      h('div', { class: 'tech-in' },
        h('div', { class: 'tech-face front' }, techIcon(t.ic), h('h4', {}, t.n), h('p', {}, t.d), h('span', { class: 'hint' }, 'Toque para ver um exemplo →')),
        h('div', { class: 'tech-face back' }, h('span', { class: 'ex-l' }, 'Exemplo de uso'), h('h4', {}, t.n), h('p', {}, t.ex), h('span', { class: 'hint' }, '← voltar'))));
    btn.addEventListener('click', () => btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed') !== 'true')));
    grid.append(btn);
  });
}

function renderFilter() {
  const box = $('#techFilter');
  box.textContent = '';
  CATS.forEach(([id, label]) => box.append(h('button', {
    class: 'pill', 'aria-pressed': String(id === filter),
    onclick: () => { filter = id; renderFilter(); renderGrid(); },
  }, label)));
}

function updateTrail() {
  const done = document.querySelectorAll('.trail-step.done').length;
  $('#trailBar').style.width = `${(done / TRILHA.length) * 100}%`;
}

function renderTrail() {
  const box = $('#trail');
  box.textContent = '';
  TRILHA.forEach((s, i) => {
    const el = h('button', { class: 'trail-step', 'aria-pressed': 'false' }, h('span', { class: 'n' }, i + 1), h('b', {}, s.t), h('small', {}, s.s));
    el.addEventListener('click', () => {
      const on = el.classList.toggle('done');
      el.setAttribute('aria-pressed', String(on));
      updateTrail();
    });
    box.append(el);
  });
  updateTrail();
}

export function init() {
  renderFilter();
  renderGrid();
  renderTrail();
}

export function reset() {
  filter = 'all';
  renderFilter();
  renderGrid();
  renderTrail();
}
