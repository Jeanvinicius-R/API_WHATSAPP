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
  for (const f of ['index.html', 'css/style.css', 'js/app.js', 'js/static-api.js', 'data/salarios.json', '.nojekyll']) {
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

test('back-end simulado: status, salários, QR indisponível e rota desconhecida', async () => {
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

    assert.equal((await call('/api/mensagem/qr')).data.disponivel, false);
    assert.deepEqual((await call('/api/mensagem/ao-vivo')).data, { total: 0, recentes: [] });
    assert.equal((await call('/api/mensagem/enviar', 'POST', {})).status, 404);
  } finally {
    global.fetch = realFetch;
  }
});
