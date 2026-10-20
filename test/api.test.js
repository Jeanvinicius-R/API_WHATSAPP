'use strict';

// Testes de integração HTTP (precisam das dependências instaladas: npm install).
const test = require('node:test');
const assert = require('node:assert/strict');
const { testConfig, silentLogger, fakeWhatsApp, waitForJob } = require('./helpers');

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

  const envio = (extra = {}) => ({ telefone: '(16) 99123-4567', apelido: 'Ana', consentimento: true, ...extra });

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

  test('fluxo completo pela API: envio → acompanhamento dos estados', async () => {
    const t = await boot();
    try {
      const bad = await t.call('/api/mensagem/enviar', { method: 'POST', body: envio({ consentimento: false }) });
      assert.equal(bad.status, 400);
      assert.equal(bad.json.erro.codigo, 'CONSENTIMENTO_OBRIGATORIO');

      const ok = await t.call('/api/mensagem/enviar', { method: 'POST', body: envio() });
      assert.equal(ok.status, 202);
      const job = await waitForJob(t.sender, ok.json.jobId);
      assert.equal(job.estado, 'concluido');
      const viaHttp = await t.call(`/api/mensagem/envio/${ok.json.jobId}`);
      assert.equal(viaHttp.status, 200);
      assert.ok(!viaHttp.text.includes('991234567'));
      assert.equal(t.wa.sent.length, 1);

      const again = await t.call('/api/mensagem/enviar', { method: 'POST', body: envio() });
      assert.equal(again.status, 429);
      assert.equal((await t.call('/api/mensagem/envio/inexistente')).status, 404);
    } finally { await t.close(); }
  });

  test('rate limit do endpoint de envio e JSON inválido', async () => {
    const t = await boot({ config: { sendRateLimitPerMinute: 2 } });
    try {
      const codes = [];
      for (let i = 0; i < 4; i++) {
        const r = await t.call('/api/mensagem/enviar', { method: 'POST', body: { telefone: '1', consentimento: true } });
        codes.push(r.status);
      }
      assert.deepEqual(codes, [422, 422, 429, 429]);

      const res = await fetch(`${t.base}/api/mensagem/enviar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{quebrado' });
      assert.ok([400, 429].includes(res.status));
    } finally { await t.close(); }
  });

  test('JSON inválido devolve erro amigável', async () => {
    const t = await boot();
    try {
      const res = await fetch(`${t.base}/api/mensagem/enviar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{quebrado' });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).erro.codigo, 'JSON_INVALIDO');
    } finally { await t.close(); }
  });

  test('envio bloqueado com WhatsApp desconectado (HTTP 503) e funciona no modo demo', async () => {
    const wa = fakeWhatsApp({ ready: false });
    const t = await boot({ wa });
    try {
      assert.equal((await t.call('/api/status')).json.envioDisponivel, false);
      const r = await t.call('/api/mensagem/enviar', { method: 'POST', body: envio() });
      assert.equal(r.status, 503);
      assert.equal(r.json.erro.codigo, 'WHATSAPP_INDISPONIVEL');
      assert.equal(wa.sent.length, 0);

      t.sender.setDemo(true);
      assert.equal((await t.call('/api/status')).json.modo, 'simulado');
      const sim = await t.call('/api/demo/simular', { method: 'POST', body: {} });
      assert.equal(sim.status, 202);
      assert.equal((await waitForJob(t.sender, sim.json.jobId)).simulado, true);
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
