'use strict';

// Testa a máquina de estados do serviço de WhatsApp com um cliente falso (não abre navegador nem conecta).
const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const { testConfig, silentLogger } = require('./helpers');

let WhatsAppService;
try {
  ({ WhatsAppService } = require('../src/services/whatsapp'));
} catch (e) {
  test('WhatsAppService (ignorado: dependências não instaladas — rode "npm install")', { skip: String(e.message) }, () => {});
}

if (WhatsAppService) {
  function fakeClient({ initFails = false } = {}) {
    const c = new EventEmitter();
    c.destroyed = false;
    c.initialize = async () => { if (initFails) throw new Error('Chrome não encontrado'); };
    c.destroy = async () => { c.destroyed = true; };
    c.getNumberId = async (n) => (n.endsWith('0000') ? null : { _serialized: `${n}@c.us` });
    c.sendMessage = async () => ({ id: { _serialized: 'ABC123' } });
    return c;
  }

  const make = (opts = {}, cfg = {}) => {
    const client = fakeClient(opts);
    const logger = silentLogger();
    const svc = new WhatsAppService({ config: testConfig({ whatsappEnabled: true, ...cfg }), logger, clientFactory: () => client });
    return { svc, client, logger };
  };

  test('ciclo de estados: starting → qr → authenticated → ready → disconnected', async () => {
    const { svc, client, logger } = make();
    assert.equal(svc.state, 'starting');
    await svc.start();
    client.emit('qr', 'CODIGO-QR-SECRETO');
    assert.equal(svc.state, 'qr');
    assert.equal(svc.isReady(), false);
    assert.equal(svc.status().aguardandoQr, true);
    const png = await svc.getQrDataUrl();
    assert.match(png, /^data:image\/png;base64,/);
    client.emit('authenticated');
    assert.equal(svc.state, 'authenticated');
    assert.equal(await svc.getQrDataUrl(), null); // QR some depois de autenticar
    client.emit('ready');
    assert.equal(svc.isReady(), true);
    client.emit('disconnected', 'NAVIGATION');
    assert.equal(svc.isReady(), false);
    assert.equal(svc.state, 'disconnected');
    // o QR nunca vai para o log nem para o status público
    assert.ok(!JSON.stringify([logger.lines, logger.recentErrors(), svc.status()]).includes('CODIGO-QR-SECRETO'));
    await svc.stop();
    assert.equal(client.destroyed, true);
  });

  test('envio e consulta só funcionam quando pronto; repassa confirmações (ack)', async () => {
    const { svc, client } = make();
    await svc.start();
    await assert.rejects(svc.sendText('x@c.us', 'oi'), { codigo: 'WHATSAPP_INDISPONIVEL' });
    await assert.rejects(svc.resolveNumber('5516991234567'), { codigo: 'WHATSAPP_INDISPONIVEL' });
    client.emit('ready');
    assert.equal(await svc.resolveNumber('5516991234567'), '5516991234567@c.us');
    assert.equal(await svc.resolveNumber('5516990000000'), null);
    assert.deepEqual(await svc.sendText('x@c.us', 'oi'), { messageId: 'ABC123' });
    const acks = [];
    svc.on('ack', (id, ack) => acks.push([id, ack]));
    client.emit('message_ack', { id: { _serialized: 'ABC123' } }, 2);
    assert.deepEqual(acks, [['ABC123', 2]]);
    await svc.stop();
  });

  test('falha ao iniciar (ex.: Chrome ausente) vira estado "error" sem derrubar o processo', async () => {
    const { svc, logger } = make({ initFails: true });
    await svc.start(); // não lança
    assert.equal(svc.state, 'error');
    assert.match(svc.lastError, /Chrome não encontrado/);
    assert.equal(svc.isReady(), false);
    assert.ok(logger.recentErrors().length >= 1);
    await svc.stop();
  });

  test('falha de autenticação é registrada', async () => {
    const { svc, client } = make();
    await svc.start();
    client.emit('auth_failure', 'sessão inválida');
    assert.equal(svc.state, 'auth_failure');
    assert.equal(svc.isReady(), false);
    await svc.stop();
  });

  test('WHATSAPP_ENABLED=false: estado "disabled" e nenhum cliente criado', async () => {
    let created = 0;
    const svc = new WhatsAppService({
      config: testConfig({ whatsappEnabled: false }), logger: silentLogger(), clientFactory: () => { created += 1; return fakeClient(); },
    });
    await svc.start();
    assert.equal(svc.state, 'disabled');
    assert.equal(created, 0);
    assert.equal(svc.isReady(), false);
  });
}
