'use strict';

/**
 * Gera a versão estática (GitHub Pages) em `_site/`.
 *
 * No Pages não existe servidor Node nem WhatsApp. O mesmo front-end roda com um "back-end simulado"
 * dentro do navegador (public/js/static-api.js). Este script junta tudo o que ele precisa a partir das
 * MESMAS fontes do servidor (sem duplicar dados à mão):
 *   _site/                      cópia de public/
 *   _site/data/salarios.json    dados salariais (de src/data)
 *   _site/js/validation.mjs     src/validation.js convertido para módulo ES
 *   _site/index.html            marcado com <meta name="be-mode" content="static">
 *
 * Uso: node scripts/build-pages.js [pastaDeSaida]
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function build(outDir = path.join(ROOT, '_site')) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'public'), outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'data'), { recursive: true });

  fs.copyFileSync(path.join(ROOT, 'src', 'data', 'salarios.json'), path.join(outDir, 'data', 'salarios.json'));

  // Reaproveita a validação do servidor no navegador (CommonJS -> ES module).
  const src = fs.readFileSync(path.join(ROOT, 'src', 'validation.js'), 'utf8');
  if (!/module\.exports = \{[^}]*\};/.test(src)) throw new Error('src/validation.js: formato de exportação inesperado');
  const esm = src.replace(/'use strict';\n/, '').replace(/module\.exports = \{([^}]*)\};/, 'export {$1};');
  fs.writeFileSync(path.join(outDir, 'js', 'validation.mjs'), `// GERADO por scripts/build-pages.js a partir de src/validation.js — não edite.\n${esm}`);

  const indexPath = path.join(outDir, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('<meta name="be-mode" content="server">')) throw new Error('index.html sem a marca be-mode');
  fs.writeFileSync(indexPath, html.replace('<meta name="be-mode" content="server">', '<meta name="be-mode" content="static">'));

  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
  return outDir;
}

if (require.main === module) {
  const out = build(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(`Versão estática gerada em ${out}`);
}

module.exports = { build };
