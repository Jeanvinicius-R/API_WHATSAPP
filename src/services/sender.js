'use strict';

const crypto = require('node:crypto');
const {
  normalizeBrazilianMobile, sanitizeNickname, maskForLog, maskForDisplay,
} = require('../validation');
const {
  MENSAGENS_ALEATORIAS, MENSAGENS_POR_CLASSIFICACAO,
} = require('../data/mensagens');

const ETAPAS = [
  { id: 'requisicao', rotulo: 'Requisição iniciada' },
  { id: 'dados', rotulo: 'Dados recebidos' },
  { id: 'numero', rotulo: 'Número validado' },
  { id: 'mensagem', rotulo: 'Mensagem selecionada' },
  { id: 'integracao', rotulo: 'Integração acionada' },
  { id: 'resultado', rotulo: 'Resultado retornado' },
];

const pick = (list, random) => list[Math.floor(random() * list.length)];
const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** Erro de domínio com status HTTP e código estável para o front-end. */
class SendError extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

/** Monta o texto — 100% controlado pelo servidor. O visitante só pode influenciar o apelido (validado). */
function buildMessage({ apelido, acertos, total, classificacao, random = Math.random }) {
  const saudacao = apelido ? `Olá, ${apelido}! 👋` : 'Olá! 👋';
  const motivadora = pick(MENSAGENS_ALEATORIAS, random);
  const especifica = pick(MENSAGENS_POR_CLASSIFICACAO[classificacao.id], random);
  return [
    `${saudacao} Aqui é a *BACK-END EXPERIENCE* — Feira de Profissões 2026.`,
    '',
    `${classificacao.emoji} Você acertou *${acertos} de ${total}* no quiz e conquistou o título:`,
    `*${classificacao.titulo}*`,
    '',
    especifica,
    '',
    motivadora,
    '',
    '_Mensagem enviada uma única vez, a seu pedido, pelo servidor que você acabou de ver funcionando. Não enviaremos outras. Os títulos do quiz são apenas uma brincadeira._',
  ].join('\n');
}

/**
 * Orquestra o envio do resultado: validações síncronas (respondem com 4xx/5xx na hora)
 * e um pipeline assíncrono cujos estados são os REAIS (consultáveis via GET /api/quiz/envio/:id).
 */
function createSender({ config, whatsapp, quiz, logger, now = Date.now, random = Math.random }) {
  // Estado de execução (tudo em memória — nada é gravado em disco).
  const state = {
    demo: !!config.demoMode,
    epoch: 1,
    iniciouEm: now(),
    contadores: { enviados: 0, simulados: 0, falhas: 0, bloqueados: 0 },
  };
  const hashSecret = crypto.randomBytes(32); // novo a cada execução: os hashes não são reversíveis nem persistidos
  const porNumero = new Map(); // hash -> quantidade reservada
  const janelaHora = []; // timestamps de envios aceitos (limite global por hora)
  const jobs = new Map();
  const jobPorMensagem = new Map(); // messageId -> job (para acompanhar confirmações de entrega)

  const hashNumber = (digits) => crypto.createHmac('sha256', hashSecret).update(digits).digest('hex');

  whatsapp?.on?.('ack', (messageId, ack) => {
    const job = jobPorMensagem.get(messageId);
    if (!job || job.simulado) return;
    if (ack >= 3) job.entrega = { estado: 'lida', ack };
    else if (ack === 2) job.entrega = { estado: 'entregue', ack };
    else if (ack === 1) job.entrega = { estado: 'aceita-pelo-servidor', ack };
    else if (ack === -1) job.entrega = { estado: 'erro', ack };
    job.atualizadoEm = now();
  });

  function cleanupJobs() {
    const limit = now() - config.jobTtlMs;
    for (const [id, j] of jobs) {
      if (j.criadoEm < limit) {
        jobs.delete(id);
        if (j.messageId) jobPorMensagem.delete(j.messageId);
      }
    }
  }

  const canSendForReal = () => !state.demo && whatsapp?.isReady?.();

  function newJob({ simulado, apelido, acertos, total, numeroExibicao }) {
    const id = crypto.randomBytes(9).toString('base64url');
    const t = now();
    const job = {
      id,
      criadoEm: t,
      atualizadoEm: t,
      simulado,
      estado: 'processando',
      etapas: ETAPAS.map((e) => ({ ...e, status: 'pendente', em: null, detalhe: null })),
      entrega: { estado: simulado ? 'nao-aplicavel' : 'aguardando', ack: null },
      http: { metodo: 'POST', rota: '/api/quiz/enviar-resultado', status: 202 },
      requisicao: { // apenas dados não sensíveis, exibidos no painel técnico
        sessionId: null,
        apelido: apelido || null,
        telefone: numeroExibicao,
        consentimento: true,
      },
      resposta: null,
      erro: null,
      acertos, total,
      messageId: null,
      hashNumero: null,
      reservado: false,
    };
    jobs.set(id, job);
    return job;
  }

  const etapa = (job, id) => job.etapas.find((e) => e.id === id);
  function mark(job, id, status, detalhe = null) {
    const e = etapa(job, id);
    e.status = status;
    e.em = now() - job.criadoEm;
    if (detalhe) e.detalhe = detalhe;
    job.atualizadoEm = now();
  }

  function fail(job, id, err) {
    const status = err.codigo === 'WHATSAPP_INDISPONIVEL' ? 503 : (err.status || 502);
    mark(job, id, 'erro', friendly(err)); // nunca expõe a mensagem interna da biblioteca ao navegador
    job.erro = { codigo: err.codigo || 'FALHA_ENVIO', mensagem: friendly(err) };
    logger.error(`detalhe interno do envio ${job.id}: ${String(err.message).replace(/\d{8,}/g, '***').slice(0, 200)}`, 'DETALHE');
    job.http = { ...job.http, status };
    job.estado = 'falhou';
    job.resposta = { status, corpo: { erro: job.erro } };
    // Falhou antes de a biblioteca aceitar o envio: libera a reserva para o visitante tentar de novo.
    if (job.reservado && !job.messageId) release(job);
    state.contadores.falhas += 1;
    logger.error(`envio ${job.id} falhou na etapa "${id}" (${job.erro.codigo})`, job.erro.codigo);
  }

  function friendly(err) {
    switch (err.codigo) {
      case 'NUMERO_SEM_WHATSAPP': return 'Não encontramos WhatsApp nesse número. Confira o DDD e os dígitos.';
      case 'WHATSAPP_INDISPONIVEL': return 'O WhatsApp está indisponível no momento. Peça ajuda a um apresentador.';
      case 'TEMPO_ESGOTADO': return 'O envio demorou demais. Tente novamente em instantes.';
      default: return 'Não foi possível enviar agora. Tente novamente ou peça ajuda a um apresentador.';
    }
  }

  function release(job) {
    if (!job.reservado || !job.hashNumero) return;
    const n = porNumero.get(job.hashNumero) || 0;
    if (n <= 1) porNumero.delete(job.hashNumero); else porNumero.set(job.hashNumero, n - 1);
    const i = janelaHora.indexOf(job.criadoEm);
    if (i >= 0) janelaHora.splice(i, 1);
    job.reservado = false;
    const s = job.sessao;
    if (s) s.envioIniciado = false;
  }

  async function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new SendError(504, 'TEMPO_ESGOTADO', 'Tempo esgotado')), ms);
    });
    try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer); }
  }

  /** Pipeline assíncrono. Cada etapa só é marcada como "ok" depois da confirmação correspondente. */
  async function run(job, ctx) {
    const pause = () => sleep(config.stepPauseMs);
    let atual = 'requisicao';
    try {
      mark(job, 'requisicao', 'ok', 'POST recebido pelo servidor Express');
      await pause();

      atual = 'dados';
      mark(job, 'dados', 'ok', 'Corpo JSON lido, consentimento presente, pontuação conferida no servidor');
      await pause();

      // --- Número ---
      atual = 'numero';
      mark(job, 'numero', 'executando');
      let chatId = null;
      if (job.simulado) {
        await sleep(Math.max(config.stepPauseMs, 150));
        mark(job, 'numero', 'ok', 'SIMULADO — formato validado; não consultamos o WhatsApp');
      } else {
        chatId = await withTimeout(whatsapp.resolveNumber(ctx.digits), config.sendTimeoutMs);
        if (!chatId) throw new SendError(422, 'NUMERO_SEM_WHATSAPP', 'Número sem WhatsApp');
        mark(job, 'numero', 'ok', 'Formato brasileiro válido e número encontrado no WhatsApp');
      }
      await pause();

      // --- Mensagem ---
      atual = 'mensagem';
      mark(job, 'mensagem', 'executando');
      const texto = buildMessage({
        apelido: ctx.apelido, acertos: job.acertos, total: job.total,
        classificacao: ctx.classificacao, random,
      });
      mark(job, 'mensagem', 'ok', `Texto escolhido pelo servidor (${texto.length} caracteres)`);
      await pause();

      // --- Integração ---
      atual = 'integracao';
      mark(job, 'integracao', 'executando');
      if (job.simulado) {
        await sleep(Math.max(config.stepPauseMs, 300));
        mark(job, 'integracao', 'ok', 'SIMULADO — nenhuma mensagem foi enviada');
      } else {
        const { messageId } = await withTimeout(whatsapp.sendText(chatId, texto), config.sendTimeoutMs);
        job.messageId = messageId;
        if (messageId) jobPorMensagem.set(messageId, job);
        mark(job, 'integracao', 'ok', 'Envio aceito pela biblioteca whatsapp-web.js (ainda não é confirmação de entrega)');
      }
      await pause();

      // --- Resultado ---
      atual = 'resultado';
      job.estado = 'concluido';
      job.http = { ...job.http, status: 200 };
      job.resposta = {
        status: 200,
        corpo: job.simulado
          ? { ok: true, simulado: true, mensagem: 'Envio simulado concluído.' }
          : { ok: true, mensagem: 'Envio aceito. A entrega depende do WhatsApp do destinatário.' },
      };
      mark(job, 'resultado', 'ok', job.simulado ? 'SIMULADO — fluxo concluído sem envio real' : 'Resposta devolvida ao navegador');
      if (job.simulado) state.contadores.simulados += 1; else state.contadores.enviados += 1;
      logger.info(`envio ${job.id} concluído (${job.simulado ? 'simulado' : 'real'}) para ${ctx.mascara}`);
    } catch (err) {
      fail(job, atual, err instanceof SendError ? err : Object.assign(err, { status: err.status || 502 }));
    }
  }

  /**
   * Valida e inicia o envio. Retorna { status, body } — 4xx/5xx imediatos quando algo está errado,
   * ou 202 com o jobId quando o pipeline foi iniciado.
   */
  function submit({ sessionId, telefone, apelido, consentimento }) {
    cleanupJobs();
    const bloqueio = (status, codigo, mensagem) => {
      state.contadores.bloqueados += 1;
      return { status, body: { erro: { codigo, mensagem } } };
    };

    if (consentimento !== true) {
      return bloqueio(400, 'CONSENTIMENTO_OBRIGATORIO', 'Marque a caixa de consentimento para receber a mensagem.');
    }
    const s = quiz.getSession(sessionId);
    if (!s) return bloqueio(404, 'SESSAO_NAO_ENCONTRADA', 'Quiz não encontrado ou expirado. Jogue novamente.');
    const res = quiz.result(sessionId);
    if (res.status !== 200) return bloqueio(res.status, res.codigo, res.mensagem);
    if (s.envioIniciado) return bloqueio(409, 'ENVIO_JA_SOLICITADO', 'O resultado desta partida já foi enviado.');

    const tel = normalizeBrazilianMobile(telefone);
    if (!tel.ok) return bloqueio(422, 'NUMERO_INVALIDO', tel.motivo);
    const nick = sanitizeNickname(apelido);
    if (!nick.ok) return bloqueio(422, 'APELIDO_INVALIDO', nick.motivo);

    if (!canSendForReal() && !state.demo) {
      return bloqueio(503, 'WHATSAPP_INDISPONIVEL',
        'O envio por WhatsApp está indisponível agora. Peça ajuda a um apresentador.');
    }

    // No modo demonstração nada é enviado, então os limites de envio real não se aplicam.
    const h = hashNumber(tel.digits);
    if (!state.demo && (porNumero.get(h) || 0) >= config.maxSendsPerNumber) {
      return bloqueio(429, 'LIMITE_NUMERO', 'Esse número já recebeu o limite de mensagens permitido neste evento.');
    }
    const t = now();
    while (janelaHora.length && janelaHora[0] < t - 3_600_000) janelaHora.shift();
    if (!state.demo && janelaHora.length >= config.maxSendsPerHour) {
      return bloqueio(429, 'LIMITE_GLOBAL', 'Muitos envios na última hora. Tente novamente em alguns minutos.');
    }

    // Reserva (anti-duplicidade): 1 envio por partida e N por número.
    porNumero.set(h, (porNumero.get(h) || 0) + 1);
    s.envioIniciado = true;

    const simulado = state.demo;
    const job = newJob({
      simulado, apelido: nick.value, acertos: res.body.acertos, total: res.body.total,
      numeroExibicao: maskForDisplay(tel.digits),
    });
    janelaHora.push(job.criadoEm);
    job.requisicao.sessionId = `${sessionId.slice(0, 6)}…`;
    job.hashNumero = h;
    job.reservado = true;
    job.sessao = s;

    // Em modo demo ninguém recebe nada, então não consome cota do número.
    if (simulado) release(job);

    run(job, {
      digits: tel.digits, apelido: nick.value,
      classificacao: res.body.classificacao, mascara: maskForLog(tel.digits),
    });
    return { status: 202, body: { jobId: job.id, simulado, status: 'aceito' } };
  }

  /** Fluxo de demonstração da seção "Demonstração": sempre simulado, sem número e sem WhatsApp. */
  function simulate() {
    cleanupJobs();
    const job = newJob({
      simulado: true, apelido: 'Visitante', acertos: 7, total: config.quizSize,
      numeroExibicao: '+55 16 9****-0000',
    });
    job.requisicao.sessionId = 'demo…';
    run(job, {
      digits: '5516900000000', apelido: 'Visitante',
      classificacao: quiz.classify(7), mascara: 'demo',
    });
    return { status: 202, body: { jobId: job.id, simulado: true, status: 'aceito' } };
  }

  function publicJob(job) {
    return {
      id: job.id,
      estado: job.estado,
      simulado: job.simulado,
      etapas: job.etapas.map(({ id, rotulo, status, em, detalhe }) => ({ id, rotulo, status, em, detalhe })),
      entrega: job.entrega,
      http: job.http,
      requisicao: job.requisicao,
      resposta: job.resposta,
      erro: job.erro,
      duracaoMs: job.atualizadoEm - job.criadoEm,
    };
  }

  const getJob = (id) => {
    cleanupJobs();
    const j = typeof id === 'string' ? jobs.get(id) : undefined;
    return j ? publicJob(j) : null;
  };

  return {
    submit, simulate, getJob, state, ETAPAS,
    setDemo: (on) => { state.demo = !!on; },
    resetExperience: () => { state.epoch += 1; return state.epoch; },
    canSendForReal,
  };
}

module.exports = { createSender, buildMessage, ETAPAS, SendError };
