'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const salarios = require('../src/data/salarios.json');

test('dados salariais: toda série tem fonte, link https, período, cargo, moeda e periodicidade', () => {
  assert.match(salarios.atualizadoEm, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(salarios.cambio.dataReferencia, /^\d{4}-\d{2}-\d{2}$/);
  const ids = new Set();
  for (const p of salarios.paises) {
    assert.ok(p.id && p.nome, 'país sem id/nome');
    if (!p.series.length) {
      assert.ok(p.indisponivel, `${p.id} sem séries precisa explicar a ausência`);
      continue;
    }
    for (const s of p.series) {
      assert.ok(!ids.has(s.id), `id duplicado ${s.id}`);
      ids.add(s.id);
      assert.match(s.url, /^https:\/\//, s.id);
      for (const campo of ['fonte', 'ano', 'cargo', 'moeda', 'periodicidade', 'cobertura', 'limitacoes']) {
        assert.ok(s[campo], `${s.id}.${campo}`);
      }
      assert.ok(['mensal', 'anual', 'hora'].includes(s.periodicidade), s.id);
      assert.ok(salarios.cambio.reaisPorUnidade[s.moeda], `${s.id}: sem câmbio para ${s.moeda}`);
      if (s.tipo === 'niveis') {
        assert.deepEqual(Object.keys(s.niveis), ['junior', 'pleno', 'senior']);
        for (const vals of Object.values(s.niveis)) {
          assert.equal(vals.length, s.rotulos.length);
          assert.deepEqual([...vals].sort((a, b) => a - b), vals, `${s.id}: percentis fora de ordem`);
        }
        assert.ok(s.niveis.junior[1] < s.niveis.pleno[1] && s.niveis.pleno[1] < s.niveis.senior[1], `${s.id}: medianas deveriam crescer com o nível`);
      } else {
        assert.ok(s.pontos.length >= 1);
        for (const pt of s.pontos) assert.ok(pt.valor > 0 && pt.rotulo);
      }
    }
  }
});

test('Portugal está sinalizado como sem dado confiável (em vez de número inventado)', () => {
  const pt = salarios.paises.find((p) => p.id === 'pt');
  assert.equal(pt.series.length, 0);
  assert.match(pt.indisponivel, /Não encontramos/);
});

test('comparação só usa mediana, dentro de grupos de fonte homogêneos', () => {
  for (const p of salarios.paises) {
    for (const s of p.series) {
      if (!s.comparacao) continue;
      assert.ok(['oficial', 'pesquisa'].includes(s.comparacao.grupo));
      assert.ok(s.pontos?.some((x) => x.rotulo === 'Mediana'), `${s.id} sem Mediana`);
    }
  }
});
