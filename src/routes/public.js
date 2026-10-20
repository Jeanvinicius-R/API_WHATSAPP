'use strict';

const os = require('node:os');
const express = require('express');
const QRCode = require('qrcode');
const salarios = require('../data/salarios.json');

const VIRTUAL = /vethernet|virtualbox|vmware|vbox|wsl|hyper-v|docker|loopback|tailscale|zerotier/i;

/** IPv4 do notebook na rede local: ignora adaptadores virtuais (VirtualBox, WSL…) e prefere o Wi-Fi. */
function lanAddress(interfaces = os.networkInterfaces()) {
  const candidatos = Object.entries(interfaces)
    .flatMap(([nome, lista]) => (lista || []).map((i) => ({ nome, ...i })))
    .filter((i) => i.family === 'IPv4' && !i.internal && !VIRTUAL.test(i.nome) && !i.address.startsWith('192.168.56.'));
  const wifi = candidatos.find((i) => /wi-?fi|wlan|wireless/i.test(i.nome));
  return (wifi || candidatos[0])?.address || null;
}

/** Rotas públicas (usadas pela interface). Nada aqui expõe o QR Code de autenticação, credenciais ou dados de visitantes. */
function createPublicRouter({ sender, atendimento, config }) {
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

  // QR Code que abre, no celular do visitante, a página que explica o back-end (analogia do motor).
  let qrCache = { link: null, dataUrl: null };
  router.get('/mensagem/qr', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const base = config.publicUrl || (lanAddress() && `http://${lanAddress()}:${config.port}`);
      if (!base) return res.json({ disponivel: false, motivo: 'rede' });
      const link = `${base}/m.html`;
      if (qrCache.link !== link) {
        qrCache = { link, dataUrl: await QRCode.toDataURL(link, { margin: 2, width: 480, errorCorrectionLevel: 'M' }) };
      }
      return res.json({
        disponivel: true,
        qr: qrCache.dataUrl,
        link,
        alcance: config.host === '127.0.0.1' || config.host === 'localhost' ? 'local' : 'rede',
      });
    } catch (err) {
      return next(err);
    }
  });

  // A página /m.html avisa que foi aberta; só alimenta o contador ao vivo.
  router.post('/mensagem/visita', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(atendimento.registrar(req.ip));
  });

  router.get('/mensagem/ao-vivo', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(atendimento.aoVivo());
  });

  return router;
}

module.exports = { createPublicRouter, lanAddress };
