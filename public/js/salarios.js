// Cena 4 · Mercado e salários. Todos os números vêm de /api/salarios (src/data/salarios.json).
import { $, h, api, fmtMoney } from './util.js';

let data = null;
let countryId = 'br';
let serieId = null;
let showConv = false;

const PER = { mensal: '/mês', anual: '/ano', hora: '/hora' };
const NIVEIS = { junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior' };

/** Converte para um equivalente MENSAL em reais (para comparação de ordem de grandeza). */
function monthlyBRL(value, serie) {
  const f = { mensal: 1, anual: 1 / 12, hora: data.horasPorMes }[serie.periodicidade];
  return value * f * data.cambio.reaisPorUnidade[serie.moeda];
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function barRow(label, value, max, serie, tone) {
  const fill = h('div', { class: `bar-fill ${tone || ''}` }, h('b', {}, `${fmtMoney(value, serie.moeda)}${PER[serie.periodicidade]}`));
  fill.dataset.w = String(Math.max(6, (value / max) * 100));
  const frag = [h('div', { class: 'bar-row' }, h('span', { class: 'lab' }, label), h('div', { class: 'bar-track' }, fill))];
  if (showConv && serie.moeda !== 'BRL') {
    frag.push(h('div', { class: 'bar-row' }, h('span'), h('span', { class: 'bar-conv' },
      `≈ ${fmtMoney(Math.round(monthlyBRL(value, serie)), 'BRL')}/mês · câmbio ${data.cambio.reaisPorUnidade[serie.moeda].toFixed(4).replace('.', ',')} R$/${serie.moeda} em ${fmtDate(data.cambio.dataReferencia)}`)));
  } else if (showConv && serie.periodicidade === 'anual') {
    frag.push(h('div', { class: 'bar-row' }, h('span'), h('span', { class: 'bar-conv' }, `≈ ${fmtMoney(Math.round(value / 12), 'BRL')}/mês`)));
  }
  return frag;
}

function animateBars(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('.bar-fill').forEach((el) => { el.style.width = `${el.dataset.w}%`; });
  }));
}

function renderChart() {
  const country = data.paises.find((p) => p.id === countryId);
  const chart = $('#salChart');
  const source = $('#salSource');
  chart.textContent = '';
  source.textContent = '';

  // seletores de fonte
  const sbox = $('#salSeries');
  sbox.textContent = '';
  if (country.series.length > 1) {
    country.series.forEach((s) => sbox.append(h('button', { class: 'pill sm', 'aria-pressed': String(s.id === serieId), onclick: () => { serieId = s.id; renderChart(); } }, s.titulo)));
  }

  if (!country.series.length) {
    const box = h('div', { class: 'unavailable' },
      h('div', { class: 'big' }, '🔍'), h('h3', {}, 'Dado confiável não encontrado'), h('p', { class: 'mut' }, country.indisponivel));
    (country.consultadasNaoUsadas || []).forEach((c) => box.append(h('p', { class: 'small dim' },
      'Consultada e descartada: ', h('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, c.titulo), ` — ${c.motivo}`)));
    chart.append(box);
    return;
  }

  const serie = country.series.find((s) => s.id === serieId) || country.series[0];
  serieId = serie.id;

  chart.append(h('p', { class: 'small mut' }, `Valores em ${serie.moeda} · periodicidade ${serie.periodicidade} · ${serie.cargo}`));

  if (serie.tipo === 'niveis') {
    const max = Math.max(...Object.values(serie.niveis).flat());
    const tones = ['', 'mid', 'hi'];
    Object.entries(serie.niveis).forEach(([nivel, vals]) => {
      const g = h('div', { class: 'bar-group' }, h('h4', {}, NIVEIS[nivel]));
      vals.forEach((v, i) => g.append(...barRow(serie.rotulos[i], v, max, serie, tones[i])));
      chart.append(g);
    });
  } else {
    const max = Math.max(...serie.pontos.map((p) => p.valor));
    const g = h('div', { class: 'bar-group' }, h('h4', {}, 'Referência geral (sem separação por nível)'));
    serie.pontos.forEach((p, i) => g.append(...barRow(p.rotulo, p.valor, max, serie, ['', 'mid', 'mid', 'hi'][i])));
    chart.append(g);
  }
  animateBars(chart);

  const link = h('a', { href: serie.url, target: '_blank', rel: 'noopener noreferrer' }, serie.fonte);
  source.append(h('div', { class: 'panel src-card', style: { marginTop: '1rem' } },
    h('b', {}, 'Referência da pesquisa'),
    h('dl', {},
      h('dt', {}, 'Fonte'), h('dd', {}, link),
      h('dt', {}, 'Período'), h('dd', {}, serie.ano),
      h('dt', {}, 'Cargo / categoria'), h('dd', {}, serie.cargo),
      h('dt', {}, 'Moeda e periodicidade'), h('dd', {}, `${serie.moeda} · ${serie.periodicidade}`),
      h('dt', {}, 'Cobertura'), h('dd', {}, serie.cobertura)),
    h('p', { class: 'warn' }, `⚠ ${serie.limitacoes}`)));
}

function renderCountries() {
  const box = $('#salCountries');
  box.textContent = '';
  data.paises.forEach((p) => box.append(h('button', {
    class: 'pill', 'aria-pressed': String(p.id === countryId),
    onclick: () => { countryId = p.id; serieId = null; renderCountries(); renderChart(); },
  }, `${p.bandeira} ${p.nome}`)));
}

function renderCompare() {
  const box = $('#salCompare');
  box.textContent = '';
  const grupos = [
    { id: 'oficial', titulo: 'Estatísticas oficiais e registros administrativos' },
    { id: 'pesquisa', titulo: 'Pesquisa autodeclarada (Stack Overflow Developer Survey 2025 · back-end)' },
  ];
  grupos.forEach((g) => {
    const items = [];
    data.paises.forEach((p) => p.series.forEach((s) => {
      if (s.comparacao?.grupo !== g.id) return;
      const ponto = s.pontos.find((x) => x.rotulo === 'Mediana');
      items.push({ label: `${p.bandeira} ${p.nome}`, serie: s, brl: monthlyBRL(ponto.valor, s), nota: s.comparacao.nota });
    }));
    if (!items.length) return;
    const max = Math.max(...items.map((i) => i.brl));
    const grp = h('div', { class: 'bar-group' }, h('h4', {}, g.titulo));
    items.forEach((it) => {
      const fill = h('div', { class: 'bar-fill mid' }, h('b', {}, `≈ ${fmtMoney(Math.round(it.brl), 'BRL')}/mês`));
      fill.dataset.w = String(Math.max(6, (it.brl / max) * 100));
      grp.append(h('div', { class: 'bar-row' }, h('span', { class: 'lab' }, it.label), h('div', { class: 'bar-track' }, fill)),
        h('div', { class: 'bar-row' }, h('span'), h('span', { class: 'bar-conv' }, it.nota)));
    });
    box.append(grp);
  });
  box.append(h('p', { class: 'small dim' }, 'Brasil não aparece no grupo de pesquisa autodeclarada porque não encontramos mediana específica de back-end do Brasil na pesquisa. Portugal não aparece por falta de dado confiável.'));
  animateBars(box);
}

function renderNotes() {
  $('#salDisclaimer').textContent = `${data.aviso} ${data.avisoConversao}`;
  const c = data.cambio;
  $('#salFx').textContent = '';
  $('#salFx').append(`Câmbio usado nas conversões: ${Object.entries(c.reaisPorUnidade).filter(([k]) => k !== 'BRL').map(([k, v]) => `1 ${k} = R$ ${v.toFixed(4).replace('.', ',')}`).join(' · ')} (${fmtDate(c.dataReferencia)}). Fonte: `,
    h('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, c.fonte), `. Dados salariais revisados em ${fmtDate(data.atualizadoEm)}.`);
}

export async function init() {
  const { status, data: d } = await api('/api/salarios');
  if (status !== 200) {
    $('#salChart').append(h('p', { class: 'warn' }, 'Não foi possível carregar os dados salariais agora.'));
    return;
  }
  data = d;
  $('#salConv').addEventListener('change', (e) => { showConv = e.target.checked; renderChart(); });
  renderCountries();
  renderChart();
  renderCompare();
  renderNotes();
}

export function onEnter() {
  if (!data) return;
  renderChart();
  renderCompare();
}

export function reset() {
  if (!data) return;
  countryId = 'br';
  serieId = null;
  showConv = false;
  $('#salConv').checked = false;
  renderCountries();
  renderChart();
}
