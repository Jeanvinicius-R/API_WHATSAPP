'use strict';

const express = require('express');
const salarios = require('../data/salarios.json');

/** Rotas públicas (usadas pela interface). Nada aqui expõe QR Code, credenciais ou números completos. */
function createPublicRouter({ sender, sendLimiter }) {
  const router = express.Router();
  const send = (res, r) => res.status(r.status).json(r.body);

  router.get('/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      modo: sender.state.demo ? 'simulado' : 'real',
      envioDisponivel: sender.state.demo || sender.canSendForReal(),
      epoch: sender.state.epoch,
    });
  });

  router.get('/salarios', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(salarios);
  });

  router.post('/mensagem/enviar', sendLimiter, (req, res) => {
    const { telefone, apelido, consentimento } = req.body || {};
    send(res, sender.submit({ telefone, apelido, consentimento }));
  });

  router.get('/mensagem/envio/:jobId', (req, res) => {
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
