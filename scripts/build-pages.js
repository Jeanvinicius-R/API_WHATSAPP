'use strict';

/**
 * Gera a versão estática (GitHub Pages) em `_site/`.
 *
 * No Pages não existe servidor Node nem WhatsApp. O mesmo front-end roda com um "back-end simulado"
 * dentro do navegador (public/js/static-api.js). Este script junta tudo o que ele precisa a partir das
 * MESMAS fontes do servidor (sem duplicar dados à mão):
 *   _site/                      cópia de public/
 *   _site/data/salarios.json    dados salariais (de src/data)
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
