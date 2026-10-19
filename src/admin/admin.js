'use strict';
const $ = (id) => document.getElementById(id);
let timer = null;

async function api(path, options = {}) {
  const res = await fetch(`/admin/api/${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { showLogin(); throw new Error('401'); }
  if (!res.ok) throw new Error((data && data.erro && data.erro.mensagem) || `Erro ${res.status}`);
  return data;
}

function showLogin() {
  clearInterval(timer);
  $('painel').hidden = true;
  $('login').hidden = false;
}

const ESTADOS = {
  disabled: 'Desativado', starting: 'Iniciando…', qr: 'Aguardando QR Code', authenticated: 'Autenticado…',
  ready: 'Conectado', disconnected: 'Desconectado', auth_failure: 'Falha de autenticação', error: 'Erro',
};

async function refresh() {
  try {
    const s = await api('status');
    $('login').hidden = true;
    $('painel').hidden = false;
    const wa = s.whatsapp;
    $('waEstado').textContent = ESTADOS[wa.estado] || wa.estado;
    const ruim = ['error', 'auth_failure', 'disconnected'].includes(wa.estado);
    $('waEstado').className = 'grande ' + (wa.pronto ? 'ok' : (ruim ? 'bad' : ''));
    $('waDetalhe').textContent = wa.ultimoErro || (s.habilitado ? '' : 'WHATSAPP_ENABLED=false');
    $('envioPossivel').textContent = s.envioPossivel ? 'Sim' : 'Não';
    $('envioPossivel').className = 'grande ' + (s.envioPossivel ? 'ok' : 'bad');
    $('modoTexto').textContent = s.modoDemonstracao
      ? 'Modo demonstração ATIVO: envios simulados.'
      : 'Modo real: mensagens são enviadas.';
    $('cEnviados').textContent = s.contadores.enviados;
    $('cSimulados').textContent = s.contadores.simulados;
    $('cFalhas').textContent = s.contadores.falhas;
    $('cBloqueados').textContent = s.contadores.bloqueados;
    $('demoToggle').checked = s.modoDemonstracao;
    $('limites').textContent =
      `Limites: ${s.limites.porNumero} envio(s) por número · ${s.limites.porHora}/hora no total · ` +
      `${s.limites.porMinutoPorIp}/minuto. Início: ${new Date(s.iniciouEm).toLocaleTimeString('pt-BR')}.`;

    const ul = $('erros');
    ul.textContent = '';
    if (!s.erros.length) {
      const li = document.createElement('li');
      li.className = 'mudo';
      li.textContent = 'Nenhum erro.';
      ul.append(li);
    }
    for (const e of s.erros) {
      const li = document.createElement('li');
      li.textContent = `${new Date(e.em).toLocaleTimeString('pt-BR')} · ${e.codigo} · ${e.mensagem}`;
      ul.append(li);
    }

    if (wa.aguardandoQr) {
      const q = await api('qr');
      $('qrCard').hidden = !q.qr;
      if (q.qr) $('qrImg').src = q.qr;
    } else {
      $('qrCard').hidden = true;
      $('qrImg').removeAttribute('src');
    }
  } catch (e) {
    if (e.message !== '401') console.error(e);
  }
}

$('loginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('loginErro').textContent = '';
  try {
    await api('login', { method: 'POST', body: { token: $('token').value } });
    $('token').value = '';
    await refresh();
    timer = setInterval(refresh, 3000);
  } catch (e) {
    $('loginErro').textContent = e.message;
  }
});

$('demoToggle').addEventListener('change', async (ev) => {
  await api('demo', { method: 'POST', body: { ativo: ev.target.checked } });
  refresh();
});

$('btnReset').addEventListener('click', async () => {
  await api('reiniciar-experiencia', { method: 'POST', body: {} });
  const original = 'Reiniciar a experiência visual (todas as telas voltam ao início)';
  $('btnReset').textContent = 'Experiência reiniciada ✔';
  setTimeout(() => { $('btnReset').textContent = original; }, 2000);
});

$('btnReiniciarWa').addEventListener('click', async () => {
  if (confirm('Reiniciar a conexão com o WhatsApp?')) {
    await api('whatsapp/reiniciar', { method: 'POST', body: {} });
    refresh();
  }
});

$('btnSair').addEventListener('click', async () => {
  await api('logout', { method: 'POST', body: {} });
  showLogin();
});

(async () => {
  try {
    await api('status');
    await refresh();
    timer = setInterval(refresh, 3000);
  } catch {
    showLogin();
  }
})();
