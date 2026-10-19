// Cena 2 · Linguagens: cartões que viram ao toque.
import { $, h } from './util.js';

const LINGUAGENS = [
  { n: 'JavaScript / TypeScript', ic: 'JS', d: 'A linguagem da web. No servidor, roda via Node.js; o TypeScript acrescenta tipos para evitar erros.', ex: 'Esta experiência: o servidor que você está usando é Express, em JavaScript.' },
  { n: 'Python', ic: 'Py', d: 'Sintaxe simples e enorme ecossistema, de APIs a ciência de dados e IA.', ex: 'Back-end de sistemas de análise de dados e serviços de IA.' },
  { n: 'Java', ic: 'Jv', d: 'Madura e muito usada em grandes empresas, bancos e sistemas de alta confiabilidade.', ex: 'Sistemas bancários e de varejo em larga escala.' },
  { n: 'C#', ic: 'C#', d: 'Linguagem da plataforma .NET, usada em sistemas corporativos, APIs e jogos.', ex: 'APIs corporativas hospedadas em nuvem.' },
  { n: 'PHP', ic: 'PHP', d: 'Pensada para a web, está por trás de uma enorme parte dos sites existentes.', ex: 'Lojas virtuais e sites de conteúdo.' },
  { n: 'Go', ic: 'Go', d: 'Criada pelo Google, é rápida, simples e ótima para serviços que atendem muita gente ao mesmo tempo.', ex: 'Serviços de infraestrutura e APIs de alto tráfego.' },
];

function render() {
  const grid = $('#techGrid');
  grid.textContent = '';
  LINGUAGENS.forEach((t) => {
    const btn = h('button', { class: 'tech', 'aria-pressed': 'false', 'aria-label': `${t.n}. Toque para ver um exemplo de uso.` },
      h('div', { class: 'tech-in' },
        h('div', { class: 'tech-face front' }, h('div', { class: 'tech-ic' }, t.ic), h('h4', {}, t.n), h('p', {}, t.d), h('span', { class: 'hint' }, 'Toque para ver um exemplo →')),
        h('div', { class: 'tech-face back' }, h('span', { class: 'ex-l' }, 'Exemplo de uso'), h('h4', {}, t.n), h('p', {}, t.ex), h('span', { class: 'hint' }, '← voltar'))));
    btn.addEventListener('click', () => btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed') !== 'true')));
    grid.append(btn);
  });
}

export function init() { render(); }
export function reset() { render(); }
