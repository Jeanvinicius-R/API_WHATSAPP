'use strict';

const crypto = require('node:crypto');
const { PERGUNTAS } = require('../data/perguntas');
const { CLASSIFICACOES } = require('../data/mensagens');

const shuffle = (list, random = Math.random) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function classify(acertos) {
  return CLASSIFICACOES.find((c) => acertos >= c.min && acertos <= c.max) || CLASSIFICACOES[0];
}

/**
 * O servidor é a fonte da verdade do quiz: sorteia perguntas, embaralha alternativas,
 * confere as respostas e calcula a pontuação. O navegador nunca informa a própria nota.
 */
function createQuizService({ config, now = Date.now, random = Math.random, bank = PERGUNTAS } = {}) {
  const sessions = new Map();
  const MAX_SESSIONS = 5000;

  // Mistura de dificuldade: 3 fáceis, 3 médias, 2 difíceis (para quizSize = 8), em ordem crescente.
  function pickQuestions() {
    const plan = [[1, 3], [2, 3], [3, 2]];
    const picked = [];
    for (const [nivel, qtd] of plan) {
      const pool = shuffle(bank.filter((p) => p.nivel === nivel), random);
      picked.push(...pool.slice(0, qtd));
    }
    // Se o banco for pequeno demais para o plano, completa com o que sobrar.
    if (picked.length < config.quizSize) {
      const rest = shuffle(bank.filter((p) => !picked.includes(p)), random);
      picked.push(...rest.slice(0, config.quizSize - picked.length));
    }
    return picked.slice(0, config.quizSize);
  }

  function cleanup() {
    const limit = now() - config.sessionTtlMs;
    for (const [id, s] of sessions) if (s.criadaEm < limit) sessions.delete(id);
  }

  function start() {
    cleanup();
    if (sessions.size >= MAX_SESSIONS) {
      const err = new Error('Muitos quizzes em andamento. Tente novamente em instantes.');
      err.status = 503; err.codigo = 'SERVIDOR_OCUPADO';
      throw err;
    }
    const id = crypto.randomBytes(16).toString('hex');
    const questions = pickQuestions().map((p) => {
      const opcoes = shuffle(p.opcoes.map((texto, i) => ({ texto, correta: i === 0 })), random);
      return {
        id: p.id,
        nivel: p.nivel,
        enunciado: p.enunciado,
        explicacao: p.explicacao,
        opcoes: opcoes.map((o) => o.texto),
        correta: opcoes.findIndex((o) => o.correta),
      };
    });
    sessions.set(id, {
      id, questions, respostas: new Map(), criadaEm: now(), envioIniciado: false,
    });
    return {
      sessionId: id,
      total: questions.length,
      perguntas: questions.map((p) => ({
        id: p.id, nivel: p.nivel, enunciado: p.enunciado, opcoes: p.opcoes,
      })),
    };
  }

  function getSession(id) {
    cleanup();
    return typeof id === 'string' ? sessions.get(id) : undefined;
  }

  function answer(sessionId, perguntaId, escolha) {
    const s = getSession(sessionId);
    if (!s) return { status: 404, codigo: 'SESSAO_NAO_ENCONTRADA', mensagem: 'Quiz não encontrado ou expirado. Comece uma nova partida.' };
    const p = s.questions.find((x) => x.id === perguntaId);
    if (!p) return { status: 422, codigo: 'PERGUNTA_INVALIDA', mensagem: 'Pergunta inválida.' };
    if (!Number.isInteger(escolha) || escolha < 0 || escolha >= p.opcoes.length) {
      return { status: 422, codigo: 'ALTERNATIVA_INVALIDA', mensagem: 'Alternativa inválida.' };
    }
    if (s.respostas.has(p.id)) {
      return { status: 409, codigo: 'JA_RESPONDIDA', mensagem: 'Essa pergunta já foi respondida.' };
    }
    const acertou = escolha === p.correta;
    s.respostas.set(p.id, { escolha, acertou });
    return {
      status: 200,
      body: {
        acertou,
        correta: p.correta,
        explicacao: p.explicacao,
        acertos: acertosDe(s),
        respondidas: s.respostas.size,
        total: s.questions.length,
      },
    };
  }

  const acertosDe = (s) => [...s.respostas.values()].filter((r) => r.acertou).length;

  function result(sessionId) {
    const s = getSession(sessionId);
    if (!s) return { status: 404, codigo: 'SESSAO_NAO_ENCONTRADA', mensagem: 'Quiz não encontrado ou expirado. Comece uma nova partida.' };
    if (s.respostas.size < s.questions.length) {
      return { status: 409, codigo: 'QUIZ_INCOMPLETO', mensagem: 'Responda todas as perguntas para ver o resultado.' };
    }
    const acertos = acertosDe(s);
    const total = s.questions.length;
    const c = classify(acertos);
    return {
      status: 200,
      body: {
        acertos, total,
        percentual: Math.round((acertos / total) * 100),
        classificacao: { id: c.id, titulo: c.titulo, emoji: c.emoji, resumo: c.resumo },
      },
    };
  }

  return { start, answer, result, getSession, classify, size: () => sessions.size, bankSize: () => bank.length };
}

module.exports = { createQuizService, classify, shuffle };
