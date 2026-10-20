'use strict';

const EventEmitter = require('node:events');
const QRCode = require('qrcode');

/**
 * Integração com o WhatsApp via whatsapp-web.js (biblioteca NÃO oficial, automatiza o WhatsApp Web).
 *
 * Estados: disabled | starting | qr | authenticated | ready | disconnected | auth_failure | error
 *
 * Segurança:
 *  - O QR Code bruto fica apenas em memória e só é exposto via getQrDataUrl() (rota /admin protegida).
 *  - O QR Code nunca é escrito no log.
 *  - A sessão fica em .wwebjs_auth/ (LocalAuth), que está no .gitignore.
 */
class WhatsAppService extends EventEmitter {
  constructor({ config, logger, clientFactory } = {}) {
    super();
    this.config = config;
    this.logger = logger;
    this.clientFactory = clientFactory || defaultClientFactory(config);
    this.state = config.whatsappEnabled ? 'starting' : 'disabled';
    this.lastError = null;
    this.client = null;
    this.qr = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.stopping = false;
  }

  isReady() {
    return this.state === 'ready';
  }

  status() {
    return {
      estado: this.state,
      pronto: this.isReady(),
      aguardandoQr: this.state === 'qr',
      ultimoErro: this.lastError,
      tentativasReconexao: this.reconnectAttempts,
    };
  }

  async start() {
    if (!this.config.whatsappEnabled) {
      this.state = 'disabled';
      this.logger.info('WhatsApp desabilitado (WHATSAPP_ENABLED=false).');
      return;
    }
    this.stopping = false;
    this.state = 'starting';
    this.qr = null;
    try {
      this.client = this.clientFactory();
      this._bind(this.client);
      this.logger.info('Iniciando WhatsApp (pode levar até 1 minuto na primeira vez)…');
      await this.client.initialize();
    } catch (err) {
      this._fail('error', err, 'Falha ao iniciar o WhatsApp');
    }
  }

  _bind(client) {
    client.on('qr', (qr) => {
      this.qr = qr; // somente em memória; nunca registrar no log
      this.state = 'qr';
      this.logger.info('WhatsApp aguardando leitura do QR Code (abra /admin neste computador).');
    });
    client.on('authenticated', () => {
      this.qr = null;
      this.state = 'authenticated';
      this.logger.info('WhatsApp autenticado.');
    });
    client.on('auth_failure', (msg) => {
      this._fail('auth_failure', new Error(String(msg || 'Falha de autenticação')), 'WhatsApp: falha de autenticação');
    });
    client.on('ready', () => {
      this.qr = null;
      this.state = 'ready';
      this.lastError = null;
      this.reconnectAttempts = 0;
      this.logger.info('WhatsApp pronto para envio.');
    });
    client.on('disconnected', (reason) => {
      this.qr = null;
      this.state = 'disconnected';
      this.lastError = `Desconectado: ${String(reason || 'motivo desconhecido')}`;
      this.logger.error(this.lastError, 'WHATSAPP_DESCONECTADO');
      this._scheduleReconnect();
    });
    client.on('message', (msg) => {
      try {
        this.emit('incoming', { chatId: msg.from, body: msg.body, fromMe: !!msg.fromMe, tipo: msg.type });
      } catch { /* mensagem recebida nunca deve derrubar o processo */ }
    });
    client.on('message_ack', (msg, ack) => {
      try {
        this.emit('ack', msg?.id?._serialized, ack);
      } catch { /* ack nunca deve derrubar o processo */ }
    });
  }

  _fail(state, err, prefix) {
    this.state = state;
    this.lastError = `${prefix}: ${err.message || err}`.slice(0, 300);
    this.logger.error(this.lastError, state === 'auth_failure' ? 'WHATSAPP_AUTH' : 'WHATSAPP_ERRO');
    if (state === 'error') this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this.stopping || this.reconnectTimer) return;
    if (this.reconnectAttempts >= 5) {
      this.logger.warn('Limite de reconexões automáticas atingido. Use "Reiniciar WhatsApp" na área administrativa.');
      return;
    }
    const delay = Math.min(60_000, 5_000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this._destroyClient();
      await this.start();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  async _destroyClient() {
    const c = this.client;
    this.client = null;
    if (c) {
      try { await c.destroy(); } catch { /* já encerrado */ }
    }
  }

  /** Reinício manual (botão do painel administrativo). */
  async restart() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    await this._destroyClient();
    await this.start();
  }

  async stop() {
    this.stopping = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    await this._destroyClient();
  }

  /** Número do WhatsApp conectado (só dígitos, com DDI) — usado no link/QR Code público. */
  ownNumber() {
    return this.isReady() ? this.client?.info?.wid?.user || null : null;
  }

  /** QR Code como imagem (data URL). Só deve ser chamado por rotas administrativas. */
  async getQrDataUrl() {
    if (this.state !== 'qr' || !this.qr) return null;
    return QRCode.toDataURL(this.qr, { margin: 1, width: 320 });
  }

  /**
   * Confere se o número existe no WhatsApp e devolve o identificador correto (resolve o 9º dígito).
   * Retorna o chatId ("5516...@c.us") ou null se o número não tem WhatsApp.
   */
  async resolveNumber(digits) {
    if (!this.isReady() || !this.client) throw withCode('WHATSAPP_INDISPONIVEL', 'WhatsApp indisponível.');
    const id = await this.client.getNumberId(digits);
    return id?._serialized || null;
  }

  /** Envia texto. "Aceito pela biblioteca" = a Promise resolveu; não significa entrega. */
  async sendText(chatId, text) {
    if (!this.isReady() || !this.client) throw withCode('WHATSAPP_INDISPONIVEL', 'WhatsApp indisponível.');
    const msg = await this.client.sendMessage(chatId, text);
    return { messageId: msg?.id?._serialized || null };
  }
}

function withCode(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

/** Carrega whatsapp-web.js só quando necessário (permite testes e modo demo sem o pacote). */
function defaultClientFactory(config) {
  return () => {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    return new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        executablePath: config.chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    });
  };
}

module.exports = { WhatsAppService };
