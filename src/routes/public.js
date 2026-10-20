'use strict';

const express = require('express');
const QRCode = require('qrcode');
const salarios = require('../data/salarios.json');
const { TEXTO_INICIAL } = require('../data/motor');

/** Rotas públicas (usadas pela interface). Nada aqui expõe o QR Code de autenticação, credenciais ou números de visitantes. */
function createPublicRouter({ sender, whatsapp, atendimento }) {
  const router = express.Router();

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

  // QR Code que abre uma conversa com o WhatsApp do evento, com a mensagem inicial já escrita.
  let qrCache = { link: null, dataUrl: null };
  router.get('/mensagem/qr', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      if (sender.state.demo) return res.json({ disponivel: false, motivo: 'demo' });
      const numero = whatsapp.ownNumber();
      if (!numero) return res.json({ disponivel: false, motivo: 'whatsapp' });
      const link = `https://wa.me/${numero}?text=${encodeURIComponent(TEXTO_INICIAL)}`;
      if (qrCache.link !== link) {
        qrCache = { link, dataUrl: await QRCode.toDataURL(link, { margin: 2, width: 480, errorCorrectionLevel: 'M' }) };
      }
      return res.json({ disponivel: true, qr: qrCache.dataUrl, texto: TEXTO_INICIAL, numero: `+${numero}` });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/mensagem/ao-vivo', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(atendimento.aoVivo());
  });

  return router;
}

module.exports = { createPublicRouter };
