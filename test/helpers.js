'use strict';

const EventEmitter = require('node:events');
const { loadConfig } = require('../src/config');
const { createQuizService } = require('../src/services/quiz');

function testConfig(overrides = {}) {
  return { ...loadConfig({ ADMIN_TOKEN: 'token-de-teste' }), stepPauseMs: 0, sendTimeoutMs: 500, ...overrides };
}

function silentLogger() {
  const errors = [];
  const lines = [];
  return {
    info: (m) => lines.push(m),
    warn: (m) => lines.push(m),
    error: (m, c) => errors.push({ codigo: c, mensagem: m }),
    recentErrors: () => errors,
    lines,
  };
}

/** WhatsApp falso: permite simular pronto/indisponível, número sem WhatsApp, falha de envio e confirmações. */
function fakeWhatsApp({ ready = true, hasWhatsApp = true, failSend = false } = {}) {
  const wa = new EventEmitter();
  wa.sent = [];
  wa.ready = ready;
  wa.isReady = () => wa.ready;
  wa.status = () => ({ estado: wa.ready ? 'ready' : 'disconnected', pronto: wa.ready, aguardandoQr: false, ultimoErro: null });
  wa.getQrDataUrl = async () => null;
  wa.restart = async () => {};
  wa.resolveNumber = async (digits) => (hasWhatsApp ? `${digits}@c.us` : null);
  wa.sendText = async (chatId, text) => {
    if (failSend) throw new Error('falha simulada 5516991234567');
    wa.sent.push({ chatId, text });
    return { messageId: `msg-${wa.sent.length}` };
  };
  return wa;
}

/** Joga uma partida completa. `acertos` = quantas respostas corretas dar (as demais são erradas). */
function playQuiz(quiz, acertos = 8) {
  const game = quiz.start();
  const session = quiz.getSession(game.sessionId);
  game.perguntas.forEach((p, i) => {
    const correta = session.questions[i].correta;
    const errada = (correta + 1) % 4;
    quiz.answer(game.sessionId, p.id, i < acertos ? correta : errada);
  });
  return game.sessionId;
}

async function waitForJob(sender, jobId, { timeout = 3000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const job = sender.getJob(jobId);
    if (job && job.estado !== 'processando') return job;
    if (Date.now() - t0 > timeout) throw new Error('job não terminou a tempo');
    await new Promise((r) => setTimeout(r, 5));
  }
}

module.exports = { testConfig, silentLogger, fakeWhatsApp, playQuiz, waitForJob, createQuizService };
