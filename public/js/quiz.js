// Cena 6 · Quiz. Perguntas, correção e pontuação vêm do servidor; aqui só há interface.
import { $, h, icon, api, sleep, reducedMotion } from './util.js';
import { createPipeline, runAndTrack } from './pipeline.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const LEVELS = { 1: 'Nível fácil', 2: 'Nível médio', 3: 'Nível desafiador' };
const FRASES = {
  explorador: 'Respira: nem todo explorador volta com tesouros, mas todo mundo começou sem saber nada de API. Você acabou de plantar a curiosidade!',
  aprendiz: 'Já deu para sentir o cheiro de código no ar! Mais um tiquinho de prática e você está servindo requisições por aí.',
  evolucao: 'Se o servidor fosse seu, ele já estaria quase sem bugs! Falta só colocar a mão na massa e criar sua primeira API.',
  mestre: 'Cuidado: seu nível de conhecimento está causando sobrecarga nos nossos servidores! Que desempenho!',
};
const CONFETTI = ['#22d3ee', '#34f5a5', '#4c8dff', '#fbbf24', '#9b8cff'];

let root;
let ctxRef;
let state;
let pipe = null;
let sending = false;

const fresh = () => ({ phase: 'intro', session: null, idx: 0, answered: false, acertos: 0, resultado: null, enviado: false });

function view(...nodes) {
  root.textContent = '';
  root.append(...nodes);
  root.closest('.scene').scrollTop = 0;
}

// ---------- Introdução ----------
function renderIntro(msg) {
  state = fresh();
  pipe = null;
  view(
    h('div', { class: 'panel glow', style: { textAlign: 'center', padding: '2.2rem 1.4rem' } },
      h('p', { class: 'eyebrow' }, 'Quiz interativo'),
      h('h2', { class: 'title' }, 'Você entende de ', h('span', { class: 'grad' }, 'back-end?')),
      h('p', { class: 'lead', style: { margin: '0 auto 1.4rem' } }, `${ctxRef.status.tamanhoQuiz || 8} perguntas sorteadas de um banco com ${ctxRef.status.perguntasNoBanco || 20}+ questões, do básico ao desafiador. Sem cronômetro: responda no seu ritmo. No final, você pode receber o resultado no seu WhatsApp!`),
      msg ? h('p', { class: 'form-err', role: 'alert' }, msg) : null,
      h('div', { class: 'btn-row', style: { justifyContent: 'center' } },
        h('button', { class: 'btn btn-primary btn-lg', id: 'quizStart', onclick: start }, h('span', { class: 'ico' }, icon('play')), 'COMEÇAR O QUIZ')),
      h('p', { class: 'small dim', style: { marginTop: '1.2rem' } }, 'Os títulos do final são só uma brincadeira — não avaliam ninguém profissionalmente.')),
  );
}

async function start() {
  const btn = $('#quizStart');
  if (btn) btn.disabled = true;
  const { status, data } = await api('/api/quiz/iniciar', { method: 'POST', body: {} });
  if (status !== 201) {
    renderIntro(data?.erro?.mensagem || 'Não foi possível iniciar o quiz. Chame um apresentador.');
    return;
  }
  state = { ...fresh(), phase: 'question', session: data };
  renderQuestion();
}

// ---------- Pergunta ----------
function renderQuestion() {
  const { session, idx } = state;
  const q = session.perguntas[idx];
  state.answered = false;
  const opts = q.opcoes.map((texto, i) => h('button', {
    class: 'opt', dataset: { i }, onclick: () => answer(i),
    'aria-label': `Alternativa ${LETTERS[i]}: ${texto}`,
  }, h('span', { class: 'k' }, LETTERS[i]), h('span', {}, texto), h('span')));
  view(
    h('div', { class: 'q-top' },
      h('span', { class: 'q-count' }, `Pergunta ${idx + 1} de ${session.total}`),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(session.total), 'aria-valuenow': String(idx) }, h('i', { id: 'qBar' })),
      h('span', { class: `level n${q.nivel}` }, LEVELS[q.nivel])),
    h('h2', { class: 'q-text', id: 'qText' }, q.enunciado),
    h('div', { class: 'options', id: 'qOpts', role: 'group', 'aria-labelledby': 'qText' }, opts),
    h('div', { id: 'qFeedback', 'aria-live': 'polite' }),
  );
  requestAnimationFrame(() => { $('#qBar').style.width = `${(idx / session.total) * 100}%`; });
}

function burst(host) {
  if (reducedMotion()) return;
  for (let i = 0; i < 16; i++) {
    const c = h('span', { class: 'confetti' });
    c.style.left = '1.9rem';
    c.style.top = '50%';
    c.style.background = CONFETTI[i % CONFETTI.length];
    c.style.setProperty('--dx', `${(Math.random() - 0.2) * 260}px`);
    c.style.setProperty('--dy', `${(Math.random() - 0.7) * 200}px`);
    c.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
    host.append(c);
    setTimeout(() => c.remove(), 1100);
  }
}

async function answer(choice) {
  if (state.answered) return;
  state.answered = true;
  const q = state.session.perguntas[state.idx];
  document.querySelectorAll('#qOpts .opt').forEach((b) => { b.disabled = true; });
  const { status, data } = await api('/api/quiz/responder', {
    method: 'POST', body: { sessionId: state.session.sessionId, perguntaId: q.id, escolha: choice },
  });
  if (status !== 200) {
    renderIntro(data?.erro?.mensagem || 'Algo deu errado. Vamos recomeçar?');
    return;
  }
  const opts = [...document.querySelectorAll('#qOpts .opt')];
  opts.forEach((b, i) => {
    if (i === data.correta) b.classList.add('correct');
    else if (i === choice) b.classList.add('wrong');
    else b.classList.add('dim');
  });
  if (data.acertou) { burst(opts[choice]); }
  state.acertos = data.acertos;
  const last = state.idx === state.session.total - 1;
  const next = h('button', { class: 'btn btn-primary btn-lg', id: 'qNext', onclick: () => (last ? finish() : (state.idx += 1, renderQuestion())) },
    last ? 'VER MEU RESULTADO' : 'PRÓXIMA PERGUNTA', h('span', { class: 'ico' }, icon('chevron-right')));
  const fb = $('#qFeedback');
  fb.textContent = '';
  fb.append(h('div', { class: `feedback ${data.acertou ? 'good' : 'bad'}` },
    h('h4', {}, data.acertou ? '✔ Isso aí! Resposta correta.' : '✘ Quase! A resposta certa está destacada.'),
    h('p', { class: 'mut', style: { margin: '0 0 .9rem' } }, data.explicacao), next));
  $('#qBar').style.width = `${((state.idx + 1) / state.session.total) * 100}%`;
  next.focus({ preventScroll: false });
  next.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

// ---------- Resultado ----------
async function finish() {
  const { status, data } = await api(`/api/quiz/resultado/${encodeURIComponent(state.session.sessionId)}`);
  if (status !== 200) { renderIntro(data?.erro?.mensagem || 'Não foi possível calcular o resultado.'); return; }
  state.phase = 'result';
  state.resultado = data;
  const c = data.classificacao;
  const circ = 327;
  const ring = h('div', { class: 'ring' });
  ring.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#34f5a5"/></linearGradient></defs><circle class="bg-c" cx="60" cy="60" r="52"/><circle class="fg-c" cx="60" cy="60" r="52"/></svg>'; // markup estático
  ring.append(h('div', { class: 'center' }, h('span', { class: 'score' }, `${data.acertos}/${data.total}`), h('span', { class: 'pct' }, `${data.percentual}% de acertos`)));
  view(
    h('div', { class: 'panel glow result' },
      h('p', { class: 'eyebrow' }, 'Resultado final'),
      ring,
      h('div', { class: 'rank' }, `${c.emoji} `, h('span', { class: 'grad' }, c.titulo)),
      h('p', { class: 'lead', style: { margin: '.4rem auto 0' } }, c.resumo),
      h('p', { class: 'mut', style: { margin: '.6rem auto 1.2rem', maxWidth: '44rem' } }, FRASES[c.id]),
      h('div', { class: 'btn-row', style: { justifyContent: 'center' } },
        h('button', { class: 'btn btn-primary btn-lg', id: 'btnWhats', onclick: openSend }, h('span', { class: 'ico' }, icon('whatsapp')), 'RECEBER NO WHATSAPP'),
        h('button', { class: 'btn btn-lg', onclick: () => renderIntro() }, h('span', { class: 'ico' }, icon('rotate')), 'JOGAR NOVAMENTE')),
      h('p', { class: 'small dim', style: { marginTop: '1rem' } }, 'Os títulos são apenas lúdicos e não representam uma avaliação profissional.'),
      h('div', { id: 'sendSlot' })),
  );
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ring.querySelector('.fg-c').style.strokeDashoffset = String(circ * (1 - data.percentual / 100));
  }));
}

// ---------- Envio pelo WhatsApp ----------
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

function sendAvailability() {
  const s = ctxRef.status;
  if (s.offline) return { ok: false, text: 'Sem conexão com o servidor. Peça ajuda a um apresentador.' };
  if (!s.envioDisponivel) return { ok: false, text: 'O envio por WhatsApp está indisponível agora. Peça ajuda a um apresentador — você ainda pode ver como funciona na seção Demonstração.' };
  if (s.estatico) return { ok: true, sim: true, text: 'Versão online: o fluxo é simulado no seu navegador. Nenhuma mensagem é enviada e o número não sai do seu aparelho.' };
  if (s.modo === 'simulado') return { ok: true, sim: true, text: 'Modo demonstração: nenhuma mensagem real será enviada — o fluxo é simulado.' };
  return { ok: true, text: '' };
}

function openSend() {
  const slot = $('#sendSlot');
  if (slot.firstChild) { slot.textContent = ''; return; }
  const av = sendAvailability();
  const phone = h('input', { class: 'input', id: 'fTel', type: 'tel', inputmode: 'tel', autocomplete: 'off', placeholder: '(16) 99999-9999', maxlength: '20', 'aria-describedby': 'fErr' });
  phone.addEventListener('input', () => { phone.value = maskPhone(phone.value); });
  const nick = h('input', { class: 'input', id: 'fNick', type: 'text', autocomplete: 'off', maxlength: '20', placeholder: 'Como quer ser chamado(a)?' });
  const consent = h('input', { type: 'checkbox', id: 'fConsent' });
  const err = h('p', { class: 'form-err', id: 'fErr', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary btn-lg', id: 'fSend', type: 'submit' }, h('span', { class: 'ico' }, icon('send')), 'ENVIAR MEU RESULTADO');
  const form = h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); send({ phone, nick, consent, err, submit }); } },
    h('div', { class: 'form-grid' },
      h('div', {}, h('label', { for: 'fTel' }, 'Seu celular (com DDD)'), phone),
      h('div', {}, h('label', { for: 'fNick' }, 'Apelido (opcional)'), nick)),
    h('label', { class: 'consent' }, consent, h('span', {}, 'Concordo em receber ', h('b', {}, 'uma única mensagem automática'), ' neste número com o meu resultado do quiz. O número é usado só para este envio e ', h('b', {}, 'não é armazenado'), '.')),
    err, h('div', { class: 'btn-row', style: { marginTop: '.6rem' } }, submit));
  if (!av.ok) { submit.disabled = true; err.textContent = av.text; }
  pipe = null;
  slot.append(h('div', { class: 'send-panel panel' },
    h('h3', {}, 'Receba seu resultado no WhatsApp'),
    av.sim ? h('p', { class: 'badge sim' }, av.text) : null,
    form,
    h('div', { id: 'pipeSlot', style: { marginTop: '1.2rem' }, hidden: true })));
  phone.focus();
  slot.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

async function send({ phone, nick, consent, err, submit }) {
  if (sending || state.enviado) return;
  err.textContent = '';
  const digits = phone.value.replace(/\D/g, '');
  if (digits.length < 10) { err.textContent = 'Digite o DDD e o número do celular.'; phone.focus(); return; }
  if (!consent.checked) { err.textContent = 'Marque a caixa de consentimento para receber a mensagem.'; consent.focus(); return; }
  const av = sendAvailability();
  if (!av.ok) { err.textContent = av.text; return; }

  sending = true;
  submit.disabled = true;
  const slot = $('#pipeSlot');
  slot.hidden = false;
  if (!pipe) pipe = createPipeline(slot);
  slot.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });

  const body = { sessionId: state.session.sessionId, telefone: phone.value, apelido: nick.value.trim() || undefined, consentimento: true };
  const preview = {
    sessionId: `${state.session.sessionId.slice(0, 6)}…`,
    ...(body.apelido ? { apelido: body.apelido } : {}),
    telefone: previewPhone(phone.value),
    consentimento: true,
  };
  const result = await runAndTrack(pipe, {
    simulado: ctxRef.status.modo === 'simulado',
    requestPreview: preview,
    post: () => api('/api/quiz/enviar-resultado', { method: 'POST', body }),
  });
  sending = false;

  if (result.ok) {
    state.enviado = true;
    err.className = 'form-err';
    err.style.color = 'var(--green)';
    err.textContent = result.job.simulado
      ? 'Simulação concluída! Nenhuma mensagem real foi enviada.'
      : 'Mensagem enviada! Dê uma olhada no seu WhatsApp. 🎉';
    return;
  }
  err.style.color = '';
  err.textContent = result.erro?.mensagem || result.job?.erro?.mensagem || 'Não foi possível enviar. Tente novamente.';
  if (result.erro?.codigo === 'ENVIO_JA_SOLICITADO') state.enviado = true;
  else submit.disabled = false;
}

// ---------- Interface com o app ----------
export function handleKey(e) {
  if (ctxRef?.current !== 'quiz') return;
  if (state.phase !== 'question' || state.answered) return;
  const k = e.key.toLowerCase();
  const i = ['1', '2', '3', '4'].indexOf(k) >= 0 ? Number(k) - 1 : ['a', 'b', 'c', 'd'].indexOf(k);
  if (i >= 0) answer(i);
}

export function onEnter() {
  $('#quizStart')?.focus({ preventScroll: true }); // Enter/Espaço já iniciam o quiz
}

export function init(ctx, section) {
  ctxRef = ctx;
  root = $('#quizRoot', section);
  ctx.onStatus(() => {
    // atualiza o aviso de disponibilidade, caso o painel de envio esteja aberto
    const btn = $('#fSend');
    if (btn && !sending && !state.enviado) {
      const av = sendAvailability();
      btn.disabled = !av.ok;
    }
  });
  renderIntro();
}

export function reset() {
  sending = false;
  renderIntro();
}
