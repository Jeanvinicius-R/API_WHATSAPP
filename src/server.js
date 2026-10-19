'use strict';

require('dotenv').config();

const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { WhatsAppService } = require('./services/whatsapp');
const { createApp } = require('./app');

const config = loadConfig(process.env, process.argv.slice(2));
const logger = createLogger();
const whatsapp = new WhatsAppService({ config, logger });
const { app } = createApp({ config, whatsapp, logger });

const server = app.listen(config.port, config.host, () => {
  const url = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║          BACK-END EXPERIENCE · 2026          ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`  Experiência (visitantes) : ${url}`);
  console.log(`  Administração (local)    : ${url}/admin`);
  if (config.adminTokenGenerated) {
    console.log(`  Token admin (temporário) : ${config.adminToken}`);
    console.log('  (defina ADMIN_TOKEN no .env para um token fixo)');
  }
  console.log(`  Modo                     : ${config.demoMode ? 'DEMONSTRAÇÃO (nenhuma mensagem real)' : 'REAL (WhatsApp)'}`);
  if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.log(`  ATENÇÃO: servidor acessível pela rede (HOST=${config.host}). A área /admin continua restrita a este computador.`);
  }
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`A porta ${config.port} já está em uso. Feche o outro processo ou altere PORT no .env.`, 'PORTA_OCUPADA');
  } else {
    logger.error(err.message, 'SERVIDOR');
  }
  process.exit(1);
});

// O WhatsApp inicia em segundo plano: a experiência funciona (e o modo demo também) mesmo se ele falhar.
whatsapp.start().catch((err) => logger.error(`WhatsApp não iniciou: ${err.message}`, 'WHATSAPP_ERRO'));

// Falhas inesperadas do navegador interno não devem derrubar a apresentação.
process.on('unhandledRejection', (reason) => {
  logger.error(`promessa rejeitada: ${String(reason?.message || reason).replace(/\d{8,}/g, '***')}`, 'UNHANDLED');
});

const shutdown = async () => {
  logger.info('Encerrando…');
  server.close();
  await whatsapp.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
