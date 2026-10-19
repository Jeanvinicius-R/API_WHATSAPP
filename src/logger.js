'use strict';

/**
 * Logger mínimo. Mantém um buffer circular dos últimos erros para a área administrativa.
 * REGRA: nunca passe números de telefone completos ou QR Codes para cá — use maskForLog().
 */
function createLogger({ maxErrors = 50, out = console } = {}) {
  const recentErrors = [];
  const stamp = () => new Date().toISOString();

  return {
    info: (msg) => out.log(`[${stamp()}] INFO  ${msg}`),
    warn: (msg) => out.warn(`[${stamp()}] WARN  ${msg}`),
    error: (msg, codigo = 'ERRO') => {
      out.error(`[${stamp()}] ERROR ${codigo}: ${msg}`);
      recentErrors.unshift({ em: stamp(), codigo, mensagem: String(msg).slice(0, 300) });
      if (recentErrors.length > maxErrors) recentErrors.pop();
    },
    recentErrors: () => recentErrors.slice(),
  };
}

module.exports = { createLogger };
