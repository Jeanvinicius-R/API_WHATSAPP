'use strict';

const crypto = require('node:crypto');
const { GATILHO, MENSAGENS_MOTOR } = require('../data/motor');

const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/**
 * Responde automaticamente a quem leu o QR Code e enviou a mensagem pré-escrita.
 *
 * Privacidade: nada vai para disco; o contato é guardado só como hash (segredo novo a cada execução)
 * para responder uma vez por pessoa, e a tela mostra apenas "Visitante #N".
 */
function createAtendimento({ config, whatsapp, sender, logger, now = Date.now, pauseMs = 1500 }) {
  const secret = crypto.randomBytes(32);
  const hash = (id) => crypto.createHmac('sha256', secret).update(id).digest('hex');
  const atendidos = new Map(); // hash -> respostas já enviadas
  const janelaHora = [];
  const recentes = [];
  const state = { total: 0 };

  function allowed(chatId) {
    const t = now();
    while (janelaHora.length && t - janelaHora[0] > 3_600_000) janelaHora.shift();
    if (janelaHora.length >= config.maxSendsPerHour) return false;
    return (atendidos.get(hash(chatId)) || 0) < config.maxSendsPerNumber;
  }

  async function handle({ chatId, body, fromMe, tipo } = {}) {
    if (fromMe || !chatId || tipo !== 'chat') return;
    if (!/@(c\.us|lid)$/.test(chatId)) return; // ignora grupos, status e listas de transmissão
    if (!GATILHO.test(String(body || ''))) return;
    if (sender.state.demo || !whatsapp.isReady()) return;
    if (!allowed(chatId)) { sender.state.contadores.bloqueados += 1; return; }

    const h = hash(chatId);
    atendidos.set(h, (atendidos.get(h) || 0) + 1); // reserva antes de enviar (evita duplicar)
    janelaHora.push(now());
    const n = ++state.total;
    const item = { n, em: new Date(now()).toISOString(), estado: 'respondendo' };
    recentes.unshift(item);
    recentes.length = Math.min(recentes.length, 8);

    try {
      for (let i = 0; i < MENSAGENS_MOTOR.length; i++) {
        if (i) await sleep(pauseMs);
        await whatsapp.sendText(chatId, MENSAGENS_MOTOR[i]);
      }
      item.estado = 'respondido';
      sender.state.contadores.enviados += 1;
    } catch (err) {
      item.estado = 'falhou';
      sender.state.contadores.falhas += 1;
      logger.error(`falha ao responder visitante #${n}: ${String(err.message).replace(/\d{8,}/g, '***')}`, 'ATENDIMENTO');
    }
  }

  function start() {
    whatsapp.on('incoming', (msg) => {
      handle(msg).catch((err) => logger.error(`atendimento: ${String(err.message).replace(/\d{8,}/g, '***')}`, 'ATENDIMENTO'));
    });
  }

  function aoVivo() {
    return { total: state.total, recentes: recentes.map(({ n, em, estado }) => ({ n, em, estado })) };
  }

  return { start, handle, aoVivo };
}

module.exports = { createAtendimento };
