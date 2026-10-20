'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { createSender } = require('./services/sender');
const { createPublicRouter } = require('./routes/public');
const { createAdminRouter } = require('./routes/admin');

/**
 * Monta o app Express. Todas as dependências são injetadas para permitir testes sem WhatsApp real.
 */
function createApp({ config, whatsapp, logger }) {
  const sender = createSender({ config, whatsapp, logger });
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(express.json({ limit: '2kb' }));

  // Limite geral da API (todos os visitantes usam o mesmo computador, então é generoso).
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: { codigo: 'MUITAS_REQUISICOES', mensagem: 'Muitas requisições. Aguarde alguns segundos.' } },
  }));

  const sendLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.sendRateLimitPerMinute,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: { codigo: 'MUITAS_REQUISICOES', mensagem: 'Muitos envios em pouco tempo. Aguarde um minuto.' } },
  });

  app.use('/api', createPublicRouter({ sender, sendLimiter }));
  app.use('/admin', createAdminRouter({ config, whatsapp, sender, logger }));

  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', maxAge: 0 }));

  app.use('/api', (req, res) => {
    res.status(404).json({ erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada.' } });
  });

  // Tratamento central de erros (JSON inválido, payload grande etc.) — sem vazar detalhes internos.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) logger.error(`erro não tratado: ${String(err.message).replace(/\d{8,}/g, '***')}`, 'HTTP_500');
    const codigo = err.type === 'entity.parse.failed' ? 'JSON_INVALIDO'
      : err.type === 'entity.too.large' ? 'PAYLOAD_GRANDE'
        : err.codigo || (status >= 500 ? 'ERRO_INTERNO' : 'REQUISICAO_INVALIDA');
    const conhecido = !!err.codigo; // erros de domínio lançados por nós têm mensagem segura
    const mensagem = status >= 500 && !conhecido
      ? 'Erro interno. Tente novamente.'
      : (conhecido ? err.message : 'Requisição inválida.');
    res.status(status).json({ erro: { codigo, mensagem } });
  });

  return { app, sender };
}

module.exports = { createApp };
