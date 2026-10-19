'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const COOKIE = 'be_admin';
const SESSION_MS = 8 * 60 * 60 * 1000;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
      const i = c.indexOf('=');
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    }),
  );
}

/**
 * Área administrativa. Três camadas de proteção:
 *  1. Somente conexões vindas do próprio computador (loopback) — o visitante na rede não chega aqui.
 *  2. Token (ADMIN_TOKEN, definido no .env — nunca no front-end) trocado por cookie de sessão HttpOnly.
 *  3. Cookie SameSite=Strict + verificação de Origin nas operações que alteram estado.
 */
function createAdminRouter({ config, whatsapp, sender, logger }) {
  const router = express.Router();
  const sessions = new Map(); // id -> expira em
  const dir = path.join(__dirname, '..', 'admin');

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!LOOPBACK.has(req.socket.remoteAddress)) {
      return res.status(404).json({ erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada.' } });
    }
    return next();
  });

  router.use((req, res, next) => { // anti-CSRF extra
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.get('origin');
      let hostOrigem = null;
      try { hostOrigem = origin ? new URL(origin).host : null; } catch { hostOrigem = 'invalido'; }
      if (origin && hostOrigem !== req.get('host')) {
        return res.status(403).json({ erro: { codigo: 'ORIGEM_INVALIDA', mensagem: 'Origem não permitida.' } });
      }
    }
    return next();
  });

  // Arquivos da tela de administração (a tela em si não contém dados sensíveis).
  router.get('/', (req, res) => res.sendFile(path.join(dir, 'index.html')));
  router.get('/admin.js', (req, res) => res.sendFile(path.join(dir, 'admin.js')));
  router.get('/admin.css', (req, res) => res.sendFile(path.join(dir, 'admin.css')));

  const loginLimiter = rateLimit({
    windowMs: 60_000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { erro: { codigo: 'MUITAS_TENTATIVAS', mensagem: 'Muitas tentativas. Aguarde um minuto.' } },
  });

  router.post('/api/login', loginLimiter, (req, res) => {
    const token = req.body?.token;
    if (typeof token !== 'string' || !safeEqual(token, config.adminToken)) {
      logger.warn('tentativa de login administrativo recusada');
      return res.status(401).json({ erro: { codigo: 'TOKEN_INVALIDO', mensagem: 'Token inválido.' } });
    }
    const id = crypto.randomBytes(32).toString('hex');
    sessions.set(id, Date.now() + SESSION_MS);
    res.cookie(COOKIE, id, { httpOnly: true, sameSite: 'strict', maxAge: SESSION_MS, path: '/admin' });
    return res.json({ ok: true });
  });

  const requireAuth = (req, res, next) => {
    const id = parseCookies(req.headers.cookie)[COOKIE];
    const exp = id && sessions.get(id);
    if (!exp || exp < Date.now()) {
      if (id) sessions.delete(id);
      return res.status(401).json({ erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Faça login.' } });
    }
    return next();
  };

  router.post('/api/logout', (req, res) => {
    const id = parseCookies(req.headers.cookie)[COOKIE];
    if (id) sessions.delete(id);
    res.clearCookie(COOKIE, { path: '/admin' });
    res.json({ ok: true });
  });

  router.get('/api/status', requireAuth, (req, res) => {
    const wa = whatsapp.status();
    res.json({
      whatsapp: wa,
      habilitado: config.whatsappEnabled,
      modoDemonstracao: sender.state.demo,
      envioPossivel: sender.canSendForReal(),
      epoch: sender.state.epoch,
      contadores: sender.state.contadores,
      iniciouEm: new Date(sender.state.iniciouEm).toISOString(),
      limites: {
        porNumero: config.maxSendsPerNumber,
        porHora: config.maxSendsPerHour,
        porMinutoPorIp: config.sendRateLimitPerMinute,
      },
      erros: logger.recentErrors(),
    });
  });

  router.get('/api/qr', requireAuth, async (req, res, next) => {
    try {
      const qr = await whatsapp.getQrDataUrl();
      res.json({ estado: whatsapp.status().estado, qr });
    } catch (e) { next(e); }
  });

  router.post('/api/demo', requireAuth, (req, res) => {
    const ativo = req.body?.ativo === true;
    sender.setDemo(ativo);
    logger.info(`modo demonstração ${ativo ? 'ATIVADO' : 'desativado'}`);
    res.json({ modoDemonstracao: sender.state.demo });
  });

  router.post('/api/reiniciar-experiencia', requireAuth, (req, res) => {
    const epoch = sender.resetExperience();
    logger.info('experiência visual reiniciada pelo administrador');
    res.json({ epoch });
  });

  router.post('/api/whatsapp/reiniciar', requireAuth, (req, res) => {
    whatsapp.restart().catch((e) => logger.error(String(e.message), 'WHATSAPP_RESTART'));
    res.status(202).json({ ok: true });
  });

  return router;
}

module.exports = { createAdminRouter };
