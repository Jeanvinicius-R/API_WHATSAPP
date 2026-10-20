'use strict';

// Versão estática (GitHub Pages): build + back-end simulado no navegador, testado em Node com fetch simulado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { build } = require('../scripts/build-pages');

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'be-site-'));
build(out);
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"module"}'); // só para o Node tratar os .js do site como ES modules (o navegador não precisa)
test.after(() => fs.rmSync(out, { recursive: true, force: true }));

test('build gera os arquivos necessários e marca o index como estático', () => {
  for (const f of ['index.html', 'css/style.css', 'js/app.js', 'js/static-api.js', 'js/validation.mjs', 'data/salarios.json', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(out, f)), f);
  }
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /<meta name="be-mode" content="static">/);
  assert.ok(!html.includes('content="server"'));
  // caminhos relativos: o site fica em /API_WHATSAPP/ no Pages
  assert.ok(!/(?:src|href)="\/(?:css|js)\//.test(html));
  assert.ok(!fs.existsSync(path.join(out, 'admin')), 'nada da área administrativa vai para o site público');
  assert.ok(!fs.existsSync(path.join(out, '.env')));
});

test('o index.html do servidor continua em modo "server"', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /content="server"/);
});

test('back-end simulado: validações + envio simulado com estados reais da simulação', async () => {
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    const body = fs.readFileSync(path.join(out, String(url)), 'utf8');
    return { json: async () => JSON.parse(body) };
  };
  try {
    const { staticApi } = await import(pathToFileURL(path.join(out, 'js', 'static-api.js')).href);
    const call = (p, method = 'GET', body) => staticApi(p, { method, body });

    const st = await call('/api/status');
    assert.equal(st.data.estatico, true);
    assert.equal(st.data.modo, 'simulado');
    assert.ok((await call('/api/salarios')).data.paises.length >= 4);

    const base = { telefone: '(16) 99123-4567', apelido: 'Ana', consentimento: true };
    assert.equal((await call('/api/mensagem/enviar', 'POST', { ...base, consentimento: false })).status, 400);
    assert.equal((await call('/api/mensagem/enviar', 'POST', { ...base, telefone: '123' })).data.erro.codigo, 'NUMERO_INVALIDO');
    assert.equal((await call('/api/mensagem/enviar', 'POST', { ...base, apelido: '*x*' })).data.erro.codigo, 'APELIDO_INVALIDO');
    const ok = await call('/api/mensagem/enviar', 'POST', base);
    assert.equal(ok.status, 202);
    assert.equal(ok.data.simulado, true);

    let job;
    for (let i = 0; i < 100; i++) {
      job = (await call(`/api/mensagem/envio/${ok.data.jobId}`)).data;
      if (job.estado !== 'processando') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(job.estado, 'concluido');
    assert.equal(job.simulado, true);
    assert.deepEqual(job.etapas.map((e) => e.status), Array(6).fill('ok'));
    assert.ok(job.etapas.every((e) => e.detalhe.startsWith('SIMULADO')));
    assert.equal(job.requisicao.telefone, '+55 16 9****-4567');
    assert.ok(!JSON.stringify(job).includes('991234567'));
    assert.equal(job.entrega.estado, 'nao-aplicavel');

    const demo = (await call('/api/demo/simular', 'POST', {})).data;
    assert.equal(demo.simulado, true);
    assert.equal((await call('/api/mensagem/envio/inexistente')).status, 404);
  } finally {
    global.fetch = realFetch;
  }
});
