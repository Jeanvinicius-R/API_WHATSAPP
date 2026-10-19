'use strict';

const crypto = require('node:crypto');

const toBool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).trim().toLowerCase());
};

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Lê a configuração a partir de variáveis de ambiente.
 * Recebe `env` para facilitar os testes (sem depender de process.env).
 */
function loadConfig(env = process.env, argv = []) {
  const adminTokenGenerated = !env.ADMIN_TOKEN;
  return {
    port: toInt(env.PORT, 3000),
    host: env.HOST || '127.0.0.1',
    adminToken: env.ADMIN_TOKEN || crypto.randomBytes(18).toString('base64url'),
    adminTokenGenerated,
    whatsappEnabled: toBool(env.WHATSAPP_ENABLED, true),
    demoMode: toBool(env.DEMO_MODE, false) || argv.includes('--demo'),
    chromePath: env.CHROME_PATH || undefined,
    maxSendsPerNumber: toInt(env.MAX_SENDS_PER_NUMBER, 1),
    maxSendsPerHour: toInt(env.MAX_SENDS_PER_HOUR, 40),
    sendRateLimitPerMinute: toInt(env.SEND_RATE_LIMIT_PER_MINUTE, 10),
    stepPauseMs: toInt(env.STEP_PAUSE_MS, 450),
    sendTimeoutMs: 30_000,
    sessionTtlMs: 30 * 60 * 1000,
    jobTtlMs: 15 * 60 * 1000,
    quizSize: 8,
  };
}

module.exports = { loadConfig };
