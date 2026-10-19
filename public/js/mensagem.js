// Cena 4 · Mensagem: formulário de envio + "O que acontece por trás do botão?" com os estados reais do back-end.
import { $, api, reducedMotion } from './util.js';
import { createPipeline, runAndTrack } from './pipeline.js';

let ctxRef;
let pipe;
let busy = false;

function maskPhone(raw) {
  let d = raw.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function previewPhone(raw) {
  let d = raw.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.length >= 10 ? `+55 ${d.slice(0, 2)} 9****-${d.slice(-4)}` : '***';
}

function availability() {
  const s = ctxRef.status;
  if (s.offline) return { ok: false, text: 'Sem conexão com o servidor. Peça ajuda a um apresentador.' };
  if (!s.envioDisponivel) return { ok: false, text: 'O envio por WhatsApp está indisponível agora. Peça ajuda a um apresentador — você ainda pode ver o fluxo em “Só simular”.' };
  if (s.estatico) return { ok: true, sim: true, text: 'Versão online: o fluxo é simulado no seu navegador. Nenhuma mensagem é enviada e o número não sai do seu aparelho.' };
  if (s.modo === 'simulado') return { ok: true, sim: true, text: 'Modo demonstração: nenhuma mensagem real será enviada — o fluxo é simulado.' };
  return { ok: true, text: '' };
}

function refreshAvailability() {
  const av = availability();
  const badge = $('#msgModoBadge');
  badge.hidden = !av.sim;
  badge.textContent = av.sim ? av.text : '';
  if (!busy) {
    $('#fSend').disabled = !av.ok;
    const err = $('#fErr');
    if (!av.ok) { err.style.color = ''; err.textContent = av.text; }
    else if (err.textContent === availability.lastBlockedText) err.textContent = '';
  }
  availability.lastBlockedText = av.ok ? null : av.text;
}

function clearForm() {
  $('#fTel').value = '';
  $('#fNick').value = '';
  $('#fConsent').checked = false;
}

function setBusy(on) {
  busy = on;
  $('#fSend').disabled = on || !availability().ok;
  $('#demoRun').disabled = on;
}

async function send() {
  if (busy) return;
  const err = $('#fErr');
  err.style.color = '';
  err.textContent = '';
  const phone = $('#fTel');
  const digits = phone.value.replace(/\D/g, '');
  if (digits.length < 10) { err.textContent = 'Digite o DDD e o número do celular.'; phone.focus(); return; }
  if (!$('#fConsent').checked) { err.textContent = 'Marque a caixa de consentimento para receber a mensagem.'; $('#fConsent').focus(); return; }
  const av = availability();
  if (!av.ok) { err.textContent = av.text; return; }

  setBusy(true);
  const apelido = $('#fNick').value.trim() || undefined;
  const body = { telefone: phone.value, apelido, consentimento: true };
  const preview = { ...(apelido ? { apelido } : {}), telefone: previewPhone(phone.value), consentimento: true };
  $('#msgPipe').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });

  const result = await runAndTrack(pipe, {
    simulado: !!av.sim,
    requestPreview: preview,
    post: () => api('/api/mensagem/enviar', { method: 'POST', body }),
  });
  setBusy(false);

  if (result.ok) {
    err.style.color = 'var(--green)';
    err.textContent = result.job.simulado
      ? 'Simulação concluída! Nenhuma mensagem real foi enviada.'
      : 'Mensagem enviada! Dê uma olhada no seu WhatsApp. 🎉';
    clearForm(); // privacidade: o próximo visitante encontra o formulário limpo
    return;
  }
  err.textContent = result.erro?.mensagem || result.job?.erro?.mensagem || 'Não foi possível enviar. Tente novamente.';
}

async function simulate() {
  if (busy) return;
  setBusy(true);
  $('#fErr').textContent = '';
  await runAndTrack(pipe, {
    simulado: true,
    requestPreview: { apelido: 'Visitante', telefone: '+55 16 9****-0000', consentimento: true },
    post: () => api('/api/demo/simular', { method: 'POST', body: {} }),
  });
  setBusy(false);
}

export function init(ctx) {
  ctxRef = ctx;
  pipe = createPipeline($('#msgPipe'));
  const phone = $('#fTel');
  phone.addEventListener('input', () => { phone.value = maskPhone(phone.value); });
  $('#msgForm').addEventListener('submit', (e) => { e.preventDefault(); send(); });
  $('#demoRun').addEventListener('click', simulate);
  ctx.onStatus(refreshAvailability);
  refreshAvailability();
}

export function onEnter() {
  refreshAvailability();
}

export function reset() {
  if (busy) return;
  clearForm();
  $('#fErr').textContent = '';
  pipe.reset();
  refreshAvailability();
}
