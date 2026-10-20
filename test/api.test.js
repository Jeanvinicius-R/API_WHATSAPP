'use strict';

// Testes de integração HTTP (precisam das dependências instaladas: npm install).
const test = require('node:test');
const assert = require('node:assert/strict');
const { testConfig, silentLogger, fakeWhatsApp } = require('./helpers');

let createApp;
try {
  ({ createApp } = require('../src/app'));
} catch (e) {
  test('API HTTP (ignorado: dependências não instaladas — rode "npm install")', { skip: String(e.message) }, () => {});
}

if (createApp) {
  async function boot({ wa = fakeWhatsApp(), config = {} } = {}) {
    const cfg = testConfig(config);
    const logger = silentLogger();
    const { app, sender } = createApp({ config: cfg, whatsapp: wa, logger });
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, { method = 'GET', body, headers = {} } = {}) => {
      const res = await fetch(base + path, {
        method, redirect: 'manual',
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* html/estático */ }
      return { status: res.status, json, text, headers: res.headers };
    };
    return { cfg, logger, wa, sender, server, base, call, close: () => new Promise((r) => server.close(r)) };
  }

  test('status, salários e arquivos estáticos', async () => {
    const t = await boot();
    try {
      const st = await t.call('/api/status');
      assert.equal(st.status, 200);
      assert.equal(st.json.modo, 'real');
      assert.equal(st.json.envioDisponivel, true);
      assert.ok(!st.text.toLowerCase().includes('qr'));

      const sal = await t.call('/api/salarios');
      assert.equal(sal.status, 200);
      assert.ok(sal.json.paises.length >= 4);
      for (const p of sal.json.paises) {
        for (const s of p.series) {
          assert.match(s.url, /^https:\/\//, s.id);
          assert.ok(['mensal', 'anual', 'hora'].includes(s.periodicidade), s.id);
          assert.ok(s.fonte && s.ano && s.cargo && s.moeda, s.id);
        }
      }

      const home = await t.call('/');
      assert.equal(home.status, 200);
      assert.match(home.text, /BACK-END/);
      assert.match(home.headers.get('content-security-policy') || '', /script-src 'self'/);
      assert.equal((await t.call('/api/nao-existe')).status, 404);
      assert.equal((await t.call('/api/quiz/iniciar', { method: 'POST', body: {} })).status, 404); // removido
      assert.equal((await t.call('/.env')).status, 404);
      assert.equal((await t.call('/.wwebjs_auth/session')).status, 404);
    } finally { await t.close(); }
  });

  test('QR Code público: só com WhatsApp conectado, nunca em demonstração, e sem expor autenticação', async () => {
    const wa = fakeWhatsApp();
    wa.ownNumber = () => '5516999990000';
    const t = await boot({ wa });
    try {
      const qr = await t.call('/api/mensagem/qr');
      assert.equal(qr.json.disponivel, true);
      assert.match(qr.json.qr, /^data:image\/png;base64,/);
      assert.equal(qr.json.numero, '+5516999990000');
      assert.match(qr.json.texto, /back-end/i);

      t.sender.setDemo(true);
      assert.deepEqual((await t.call('/api/mensagem/qr')).json, { disponivel: false, motivo: 'demo' });
      t.sender.setDemo(false);

      wa.ownNumber = () => null;
      assert.equal((await t.call('/api/mensagem/qr')).json.motivo, 'whatsapp');
    } finally { await t.close(); }
  });

  test('visitante que envia a mensagem do QR recebe a analogia do motor, uma vez, e aparece ao vivo', async () => {
    const wa = fakeWhatsApp();
    const t = await boot({ wa });
    try {
      assert.equal((await t.call('/api/mensagem/ao-vivo')).json.total, 0);
      wa.emit('incoming', { chatId: '5516991234567@c.us', body: 'Oi! Quero entender o que é back-end 🚗', fromMe: false, tipo: 'chat' });
      for (let i = 0; i < 60 && (await t.call('/api/mensagem/ao-vivo')).json.recentes[0]?.estado !== 'respondido'; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const live = await t.call('/api/mensagem/ao-vivo');
      assert.equal(live.json.total, 1);
      assert.equal(live.json.recentes[0].estado, 'respondido');
      assert.ok(!live.text.includes('991234567'), 'o número do visitante nunca aparece na tela');
      assert.equal(wa.sent.length, 3);
      assert.ok(wa.sent.every((m) => m.chatId === '5516991234567@c.us'));
      assert.match(wa.sent[1].text, /motor do carro/i);
    } finally { await t.close(); }
  });

  test('o antigo envio por número digitado não existe mais', async () => {
    const t = await boot();
    try {
      for (const [p, m] of [['/api/mensagem/enviar', 'POST'], ['/api/demo/simular', 'POST'], ['/api/mensagem/envio/x', 'GET']]) {
        assert.equal((await t.call(p, { method: m, body: m === 'POST' ? {} : undefined })).status, 404, p);
      }
    } finally { await t.close(); }
  });

  test('área administrativa exige token e nunca expõe o QR sem login', async () => {
    const wa = fakeWhatsApp();
    wa.getQrDataUrl = async () => 'data:image/png;base64,QRFALSO';
    const t = await boot({ wa });
    try {
      for (const p of ['/admin/api/status', '/admin/api/qr']) assert.equal((await t.call(p)).status, 401, p);
      for (const p of ['/admin/api/demo', '/admin/api/reiniciar-experiencia', '/admin/api/whatsapp/reiniciar']) {
        assert.equal((await t.call(p, { method: 'POST', body: {} })).status, 401, p);
      }
      assert.equal((await t.call('/admin/api/login', { method: 'POST', body: { token: 'errado' } })).status, 401);
      assert.equal((await t.call('/admin/api/login', { method: 'POST', body: { token: 123 } })).status, 401);
      assert.equal((await t.call('/admin/api/login', { method: 'POST', body: { token: 'errado', origem: 1 }, headers: { Origin: 'http://evil.example' } })).status, 403);

      const login = await t.call('/admin/api/login', { method: 'POST', body: { token: 'token-de-teste' } });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Strict/i);
      const h = { Cookie: cookie.split(';')[0] };

      const st = await t.call('/admin/api/status', { headers: h });
      assert.equal(st.status, 200);
      assert.equal(st.json.whatsapp.pronto, true);
      assert.ok(!JSON.stringify(st.json).includes('adminToken'));

      const qr = await t.call('/admin/api/qr', { headers: h });
      assert.equal(qr.json.qr, 'data:image/png;base64,QRFALSO');

      const epoch0 = (await t.call('/api/status')).json.epoch;
      await t.call('/admin/api/reiniciar-experiencia', { method: 'POST', body: {}, headers: h });
      assert.equal((await t.call('/api/status')).json.epoch, epoch0 + 1);

      await t.call('/admin/api/demo', { method: 'POST', body: { ativo: true }, headers: h });
      assert.equal((await t.call('/api/status')).json.modo, 'simulado');

      // o endpoint público nunca traz QR
      assert.ok(!(await t.call('/api/status')).text.includes('QRFALSO'));
    } finally { await t.close(); }
  });
}
