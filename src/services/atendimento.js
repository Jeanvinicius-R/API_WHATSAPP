'use strict';

/**
 * Contador de visitantes que abriram a página do QR Code (/m.html).
 *
 * Privacidade: não guarda IP, número nem nada que identifique alguém. O IP só é usado, em memória,
 * para contar uma visita por aparelho a cada 10 minutos (evita inflar o contador recarregando a página).
 */
function createAtendimento({ now = Date.now, janelaMs = 10 * 60 * 1000 } = {}) {
  const vistos = new Map(); // ip -> instante da última contagem
  const recentes = [];
  const state = { total: 0 };

  function registrar(ip) {
    const t = now();
    for (const [k, v] of vistos) if (t - v > janelaMs) vistos.delete(k);
    if (vistos.has(ip)) return { contou: false, total: state.total };
    vistos.set(ip, t);
    state.total += 1;
    recentes.unshift({ n: state.total, em: new Date(t).toISOString() });
    recentes.length = Math.min(recentes.length, 8);
    return { contou: true, total: state.total };
  }

  function aoVivo() {
    return { total: state.total, recentes: recentes.map((r) => ({ ...r })) };
  }

  return { registrar, aoVivo };
}

module.exports = { createAtendimento };
