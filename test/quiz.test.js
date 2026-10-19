'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { testConfig, createQuizService, playQuiz } = require('./helpers');
const { PERGUNTAS } = require('../src/data/perguntas');
const { CLASSIFICACOES, MENSAGENS_ALEATORIAS, MENSAGENS_POR_CLASSIFICACAO } = require('../src/data/mensagens');
const { buildMessage } = require('../src/services/sender');

test('banco tem pelo menos 20 perguntas bem formadas, com ids únicos e 3 níveis', () => {
  assert.ok(PERGUNTAS.length >= 20);
  const ids = new Set(PERGUNTAS.map((p) => p.id));
  assert.equal(ids.size, PERGUNTAS.length);
  for (const p of PERGUNTAS) {
    assert.equal(p.opcoes.length, 4, p.id);
    assert.equal(new Set(p.opcoes).size, 4, `${p.id} tem alternativas repetidas`);
    assert.ok(p.enunciado && p.explicacao, p.id);
    assert.ok([1, 2, 3].includes(p.nivel), p.id);
  }
  for (const n of [1, 2, 3]) assert.ok(PERGUNTAS.filter((p) => p.nivel === n).length >= 3, `nível ${n}`);
});

test('partida: 8 perguntas, 4 alternativas, sem vazar a resposta correta', () => {
  const quiz = createQuizService({ config: testConfig() });
  const game = quiz.start();
  assert.equal(game.total, 8);
  assert.equal(game.perguntas.length, 8);
  assert.equal(new Set(game.perguntas.map((p) => p.id)).size, 8);
  for (const p of game.perguntas) {
    assert.equal(p.opcoes.length, 4);
    assert.equal(p.correta, undefined);
    assert.equal(p.explicacao, undefined);
  }
  assert.ok(!JSON.stringify(game).includes('"correta"'));
});

test('pontuação e classificação para todas as faixas (0 a 8 acertos)', () => {
  const esperado = {
    0: 'explorador', 1: 'explorador', 2: 'explorador', 3: 'aprendiz', 4: 'aprendiz',
    5: 'evolucao', 6: 'evolucao', 7: 'mestre', 8: 'mestre',
  };
  for (let acertos = 0; acertos <= 8; acertos++) {
    const quiz = createQuizService({ config: testConfig() });
    const id = playQuiz(quiz, acertos);
    const r = quiz.result(id);
    assert.equal(r.status, 200);
    assert.equal(r.body.acertos, acertos);
    assert.equal(r.body.total, 8);
    assert.equal(r.body.percentual, Math.round((acertos / 8) * 100));
    assert.equal(r.body.classificacao.id, esperado[acertos], `${acertos} acertos`);
  }
});

test('títulos conforme especificado', () => {
  const t = Object.fromEntries(CLASSIFICACOES.map((c) => [c.id, c.titulo]));
  assert.equal(t.explorador, 'Explorador da Tecnologia');
  assert.equal(t.aprendiz, 'Aprendiz de Back-end');
  assert.equal(t.evolucao, 'Desenvolvedor em Evolução');
  assert.equal(t.mestre, 'Futuro Mestre das APIs');
});

test('não aceita responder duas vezes, alternativa inválida nem resultado incompleto', () => {
  const quiz = createQuizService({ config: testConfig() });
  const game = quiz.start();
  const p = game.perguntas[0];
  assert.equal(quiz.answer(game.sessionId, p.id, 9).status, 422);
  assert.equal(quiz.answer(game.sessionId, p.id, '1').status, 422);
  assert.equal(quiz.answer(game.sessionId, 'inexistente', 0).status, 422);
  assert.equal(quiz.answer('sessao-falsa', p.id, 0).status, 404);
  assert.equal(quiz.answer(game.sessionId, p.id, 0).status, 200);
  assert.equal(quiz.answer(game.sessionId, p.id, 1).status, 409);
  assert.equal(quiz.result(game.sessionId).status, 409);
});

test('a resposta correta só é revelada na resposta e bate com o servidor', () => {
  const quiz = createQuizService({ config: testConfig() });
  const game = quiz.start();
  const s = quiz.getSession(game.sessionId);
  const r = quiz.answer(game.sessionId, game.perguntas[0].id, s.questions[0].correta);
  assert.equal(r.body.acertou, true);
  assert.equal(r.body.correta, s.questions[0].correta);
  assert.ok(r.body.explicacao.length > 10);
});

test('sessões expiram', () => {
  let t = 1_000_000;
  const quiz = createQuizService({ config: testConfig({ sessionTtlMs: 1000 }), now: () => t });
  const game = quiz.start();
  t += 5000;
  assert.equal(quiz.answer(game.sessionId, game.perguntas[0].id, 0).status, 404);
});

test('há pelo menos 15 mensagens aleatórias e mensagens específicas por classificação', () => {
  assert.ok(MENSAGENS_ALEATORIAS.length >= 15);
  assert.equal(new Set(MENSAGENS_ALEATORIAS).size, MENSAGENS_ALEATORIAS.length);
  for (const c of CLASSIFICACOES) assert.ok(MENSAGENS_POR_CLASSIFICACAO[c.id].length >= 2, c.id);
});

test('mensagem inclui apelido, pontuação, classificação e sorteio varia', () => {
  const c = CLASSIFICACOES.find((x) => x.id === 'mestre');
  const msg = buildMessage({ apelido: 'Ana', acertos: 8, total: 8, classificacao: c, random: () => 0 });
  assert.match(msg, /Olá, Ana!/);
  assert.match(msg, /8 de 8/);
  assert.match(msg, /Futuro Mestre das APIs/);
  assert.ok(msg.includes(MENSAGENS_ALEATORIAS[0]));
  const anon = buildMessage({ apelido: null, acertos: 3, total: 8, classificacao: CLASSIFICACOES[1], random: () => 0.99 });
  assert.match(anon, /^Olá! /);
  assert.ok(anon.includes(MENSAGENS_ALEATORIAS.at(-1)));
  const set = new Set();
  for (let i = 0; i < 200; i++) set.add(buildMessage({ apelido: null, acertos: 5, total: 8, classificacao: CLASSIFICACOES[2] }));
  assert.ok(set.size > 10, 'o sorteio deveria produzir variedade');
});
