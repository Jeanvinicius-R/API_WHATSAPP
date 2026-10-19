'use strict';

const express = require('express');
const salarios = require('../data/salarios.json');

/** Rotas públicas (usadas pela interface). Nada aqui expõe QR Code, credenciais ou números completos. */
function createPublicRouter({ config, whatsapp, quiz, sender, sendLimiter }) {
  const router = express.Router();
  const send = (res, r) => (r.body !== undefined
    ? res.status(r.status).json(r.body)
    : res.status(r.status).json({ erro: { codigo: r.codigo, mensagem: r.mensagem } }));

  router.get('/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const modo = sender.state.demo ? 'simulado' : 'real';
    res.json({
      modo,
      envioDisponivel: sender.state.demo || sender.canSendForReal(),
      epoch: sender.state.epoch,
      perguntasNoBanco: quiz.bankSize(),
      tamanhoQuiz: config.quizSize,
    });
  });

  router.get('/salarios', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(salarios);
  });

  router.post('/quiz/iniciar', (req, res, next) => {
    try { res.status(201).json(quiz.start()); } catch (e) { next(e); }
  });

  router.post('/quiz/responder', (req, res) => {
    const { sessionId, perguntaId, escolha } = req.body || {};
    send(res, quiz.answer(sessionId, perguntaId, escolha));
  });

  router.get('/quiz/resultado/:sessionId', (req, res) => {
    send(res, quiz.result(req.params.sessionId));
  });

  router.post('/quiz/enviar-resultado', sendLimiter, (req, res) => {
    const { sessionId, telefone, apelido, consentimento } = req.body || {};
    send(res, sender.submit({ sessionId, telefone, apelido, consentimento }));
  });

  router.get('/quiz/envio/:jobId', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const job = sender.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ erro: { codigo: 'ENVIO_NAO_ENCONTRADO', mensagem: 'Envio não encontrado ou expirado.' } });
    }
    return res.json(job);
  });

  // Demonstração: percorre todo o pipeline, sempre SIMULADO (sem número, sem WhatsApp).
  router.post('/demo/simular', sendLimiter, (req, res) => {
    send(res, sender.simulate());
  });

  return router;
}

module.exports = { createPublicRouter };
