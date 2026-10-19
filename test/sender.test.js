'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSender, buildMessage } = require('../src/services/sender');
const { MENSAGENS_ALEATORIAS } = require('../src/data/mensagens');
const {
  testConfig, silentLogger, fakeWhatsApp, waitForJob,
} = require('./helpers');

const NUMERO = '(16) 99123-4567';

function setup({ wa = fakeWhatsApp(), config = {}, demo = false } = {}) {
  const cfg = testConfig({ demoMode: demo, ...config });
  const logger = silentLogger();
  const sender = createSender({ config: cfg, whatsapp: wa, logger });
  return { wa, cfg, logger, sender };
}

const pedido = (extra = {}) => ({ telefone: NUMERO, apelido: 'Ana', consentimento: true, ...extra });

test('há pelo menos 15 mensagens aleatórias, sem repetição', () => {
  assert.ok(MENSAGENS_ALEATORIAS.length >= 15);
  assert.equal(new Set(MENSAGENS_ALEATORIAS).size, MENSAGENS_ALEATORIAS.length);
});

test('mensagem inclui apelido, usa o sorteio e o texto varia', () => {
  const msg = buildMessage({ apelido: 'Ana', random: () => 0 });
  assert.match(msg, /Olá, Ana!/);
  assert.ok(msg.includes(MENSAGENS_ALEATORIAS[0]));
  const anon = buildMessage({ apelido: null, random: () => 0.99 });
  assert.match(anon, /^Olá! /);
  assert.ok(anon.includes(MENSAGENS_ALEATORIAS.at(-1)));
  const set = new Set();
  for (let i = 0; i < 300; i++) set.add(buildMessage({ apelido: null }));
  assert.ok(set.size > 10, 'o sorteio deveria produzir variedade');
});

test('envio real: valida, escolhe a mensagem, aciona a integração e só então conclui', async () => {
  const { sender, wa, logger } = setup();
  const r = sender.submit(pedido());
  assert.equal(r.status, 202);
  assert.equal(r.body.simulado, false);

  const job = await waitForJob(sender, r.body.jobId);
  assert.equal(job.estado, 'concluido');
  assert.deepEqual(job.etapas.map((e) => e.status), Array(6).fill('ok'));
  assert.equal(job.http.status, 200);
  assert.equal(job.http.rota, '/api/mensagem/enviar');
  assert.equal(job.entrega.estado, 'aguardando'); // aceito pela biblioteca ≠ entregue

  assert.equal(wa.sent.length, 1);
  assert.equal(wa.sent[0].chatId, '5516991234567@c.us');
  assert.match(wa.sent[0].text, /Olá, Ana!/);
  assert.equal(sender.state.contadores.enviados, 1);

  // Confirmações técnicas só chegam pelo evento "ack" do WhatsApp.
  wa.emit('ack', 'msg-1', 1);
  assert.equal(sender.getJob(r.body.jobId).entrega.estado, 'aceita-pelo-servidor');
  wa.emit('ack', 'msg-1', 2);
  assert.equal(sender.getJob(r.body.jobId).entrega.estado, 'entregue');
  wa.emit('ack', 'msg-1', 3);
  assert.equal(sender.getJob(r.body.jobId).entrega.estado, 'lida');

  // privacidade: nem o número completo nem o telefone cru aparecem em logs ou na visão pública do job
  const everything = JSON.stringify([logger.lines, logger.recentErrors(), job]);
  assert.ok(!everything.includes('991234567'));
  assert.ok(!everything.includes('5516991234567'));
  assert.equal(job.requisicao.telefone, '+55 16 9****-4567');
});

test('exige consentimento explícito (somente true)', () => {
  const { sender, wa } = setup();
  for (const consentimento of [false, undefined, 'true', 1, null]) {
    const r = sender.submit(pedido({ consentimento }));
    assert.equal(r.status, 400);
    assert.equal(r.body.erro.codigo, 'CONSENTIMENTO_OBRIGATORIO');
  }
  assert.equal(wa.sent.length, 0);
});

test('rejeita número inválido e apelido inválido', () => {
  const { sender } = setup();
  assert.equal(sender.submit(pedido({ telefone: '123' })).body.erro.codigo, 'NUMERO_INVALIDO');
  assert.equal(sender.submit(pedido({ telefone: '(16) 3412-3456' })).status, 422);
  assert.equal(sender.submit(pedido({ apelido: '*oi*' })).body.erro.codigo, 'APELIDO_INVALIDO');
  assert.equal(sender.submit().status, 400);
});

test('não permite texto arbitrário: campos extras são ignorados e o texto vem do servidor', async () => {
  const { sender, wa } = setup();
  const r = sender.submit({ ...pedido(), mensagem: 'COMPRE AGORA http://golpe.example', texto: 'x' });
  await waitForJob(sender, r.body.jobId);
  assert.ok(!wa.sent[0].text.includes('golpe'));
  assert.ok(MENSAGENS_ALEATORIAS.some((m) => wa.sent[0].text.includes(m)));
});

test('limite de envios por número (mesmo número em formatos diferentes)', async () => {
  const { sender, wa } = setup();
  const r1 = sender.submit(pedido());
  await waitForJob(sender, r1.body.jobId);
  const r2 = sender.submit(pedido({ telefone: '+55 16 991234567' }));
  assert.equal(r2.status, 429);
  assert.equal(r2.body.erro.codigo, 'LIMITE_NUMERO');
  const r3 = sender.submit(pedido({ telefone: '(16) 99888-7766' }));
  assert.equal(r3.status, 202); // outro número continua liberado
  await waitForJob(sender, r3.body.jobId);
  assert.equal(wa.sent.length, 2);
});

test('duplo clique: o segundo pedido do mesmo número, ainda em andamento, é barrado', async () => {
  const { sender, wa } = setup({ config: { stepPauseMs: 20 } });
  const r1 = sender.submit(pedido());
  const r2 = sender.submit(pedido());
  assert.equal(r1.status, 202);
  assert.equal(r2.status, 429);
  await waitForJob(sender, r1.body.jobId);
  assert.equal(wa.sent.length, 1);
});

test('limite global por hora', () => {
  const { sender } = setup({ config: { maxSendsPerHour: 2, maxSendsPerNumber: 5 } });
  const tels = ['(16) 99111-2233', '(16) 99222-3344', '(16) 99333-4455'];
  const codigos = tels.map((telefone) => sender.submit(pedido({ telefone })).status);
  assert.deepEqual(codigos, [202, 202, 429]);
});

test('sem conexão com o WhatsApp: bloqueia o envio e libera quando a conexão volta', async () => {
  const wa = fakeWhatsApp({ ready: false });
  const { sender } = setup({ wa });
  const r = sender.submit(pedido());
  assert.equal(r.status, 503);
  assert.equal(r.body.erro.codigo, 'WHATSAPP_INDISPONIVEL');
  assert.equal(wa.sent.length, 0);
  wa.ready = true;
  const r2 = sender.submit(pedido());
  assert.equal(r2.status, 202);
  assert.equal((await waitForJob(sender, r2.body.jobId)).estado, 'concluido');
});

test('número sem WhatsApp: falha amigável e libera nova tentativa', async () => {
  const wa = fakeWhatsApp({ hasWhatsApp: false });
  const { sender } = setup({ wa });
  const r = sender.submit(pedido());
  const job = await waitForJob(sender, r.body.jobId);
  assert.equal(job.estado, 'falhou');
  assert.equal(job.erro.codigo, 'NUMERO_SEM_WHATSAPP');
  assert.equal(job.http.status, 422);
  assert.equal(job.etapas.find((e) => e.id === 'numero').status, 'erro');
  assert.equal(job.etapas.find((e) => e.id === 'integracao').status, 'pendente'); // nunca marcada como feita
  assert.equal(wa.sent.length, 0);
  wa.resolveNumber = async (d) => `${d}@c.us`;
  const retry = sender.submit(pedido());
  assert.equal(retry.status, 202);
  assert.equal((await waitForJob(sender, retry.body.jobId)).estado, 'concluido');
});

test('falha na biblioteca: erro amigável, sem vazar detalhes nem o número', async () => {
  const wa = fakeWhatsApp({ failSend: true });
  const { sender, logger } = setup({ wa });
  const r = sender.submit(pedido());
  const job = await waitForJob(sender, r.body.jobId);
  assert.equal(job.estado, 'falhou');
  assert.equal(job.http.status, 502);
  assert.equal(job.etapas.find((e) => e.id === 'integracao').status, 'erro');
  assert.equal(job.etapas.find((e) => e.id === 'resultado').status, 'pendente');
  assert.ok(!JSON.stringify(job).includes('falha simulada'));
  assert.ok(!JSON.stringify([logger.lines, logger.recentErrors()]).includes('5516991234567'));
  assert.equal(sender.state.contadores.falhas, 1);
});

test('timeout da integração não trava o fluxo', async () => {
  const wa = fakeWhatsApp();
  wa.sendText = () => new Promise(() => {}); // nunca resolve
  const { sender } = setup({ wa, config: { sendTimeoutMs: 30 } });
  const r = sender.submit(pedido());
  const job = await waitForJob(sender, r.body.jobId);
  assert.equal(job.estado, 'falhou');
  assert.equal(job.erro.codigo, 'TEMPO_ESGOTADO');
  assert.equal(job.http.status, 504);
});

test('modo demonstração: simula todo o fluxo sem tocar no WhatsApp (mesmo desconectado)', async () => {
  const wa = fakeWhatsApp({ ready: false });
  const { sender } = setup({ wa, demo: true });
  const r = sender.submit(pedido());
  assert.equal(r.status, 202);
  assert.equal(r.body.simulado, true);
  const job = await waitForJob(sender, r.body.jobId);
  assert.equal(job.estado, 'concluido');
  assert.equal(job.simulado, true);
  assert.equal(job.entrega.estado, 'nao-aplicavel');
  assert.ok(job.etapas.find((e) => e.id === 'integracao').detalhe.includes('SIMULADO'));
  assert.equal(wa.sent.length, 0);
  assert.equal(sender.state.contadores.simulados, 1);
  assert.equal(sender.state.contadores.enviados, 0);
});

test('modo demonstração não consome nem aplica os limites de envio real', async () => {
  const { sender } = setup({ demo: true, config: { maxSendsPerNumber: 1, maxSendsPerHour: 1 } });
  for (let i = 0; i < 3; i++) {
    const r = sender.submit(pedido());
    assert.equal(r.status, 202, `tentativa ${i + 1}`);
    await waitForJob(sender, r.body.jobId);
  }
  sender.setDemo(false); // ao voltar ao modo real, o número ainda tem a cota intacta
  const real = sender.submit(pedido());
  assert.equal(real.status, 202);
  await waitForJob(sender, real.body.jobId);
});

test('alternar o modo demonstração em tempo de execução', async () => {
  const { sender, wa } = setup();
  sender.setDemo(true);
  const r = sender.submit(pedido());
  assert.equal(r.body.simulado, true);
  await waitForJob(sender, r.body.jobId);
  sender.setDemo(false);
  const r2 = sender.submit(pedido({ telefone: '(16) 99777-1122' }));
  assert.equal(r2.body.simulado, false);
  await waitForJob(sender, r2.body.jobId);
  assert.equal(wa.sent.length, 1);
});

test('simulate(): fluxo sem número é sempre simulado', async () => {
  const { sender, wa } = setup();
  const r = sender.simulate();
  assert.equal(r.status, 202);
  const job = await waitForJob(sender, r.body.jobId);
  assert.equal(job.simulado, true);
  assert.equal(job.estado, 'concluido');
  assert.equal(wa.sent.length, 0);
});

test('reiniciar a experiência incrementa o epoch', () => {
  const { sender } = setup();
  const a = sender.state.epoch;
  assert.equal(sender.resetExperience(), a + 1);
});

test('jobs expiram', () => {
  let t = 1_000_000;
  const cfg = testConfig({ jobTtlMs: 1000 });
  const sender = createSender({ config: cfg, whatsapp: fakeWhatsApp(), logger: silentLogger(), now: () => t });
  const r = sender.simulate();
  assert.ok(sender.getJob(r.body.jobId));
  t += 5000;
  assert.equal(sender.getJob(r.body.jobId), null);
});
