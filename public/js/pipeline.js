// "O QUE ACONTECE POR TRÁS DO BOTÃO?" — visualização do fluxo REAL do back-end.
// Cada etapa só aparece como concluída quando o servidor (GET /api/mensagem/envio/:id) a reporta como "ok".
import { $, h, icon, api, sleep } from './util.js';

const NODES = [
  { id: 'nav', t: 'NAVEGADOR', ic: 'monitor' },
  { id: 'api', t: 'API EXPRESS', ic: 'server' },
  { id: 'val', t: 'VALIDAÇÃO', ic: 'shield' },
  { id: 'wa', t: 'INTEGRAÇÃO WHATSAPP', ic: 'plug' },
  { id: 'dest', t: 'DESTINATÁRIO', ic: 'smartphone' },
];
const STEP_NODE = { requisicao: 1, dados: 1, numero: 2, mensagem: 2, integracao: 3, resultado: 4 };
const STEP_LABELS = [
  ['requisicao', 'Requisição iniciada'], ['dados', 'Dados recebidos'], ['numero', 'Número validado'],
  ['mensagem', 'Mensagem selecionada'], ['integracao', 'Integração acionada'], ['resultado', 'Resultado retornado'],
];
const HTTP_TEXT = {
  0: 'Sem conexão', 200: 'OK', 201: 'Created', 202: 'Accepted', 400: 'Bad Request', 404: 'Not Found', 409: 'Conflict',
  422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway',
  503: 'Service Unavailable', 504: 'Gateway Timeout',
};
// Em qual etapa uma recusa imediata (4xx/5xx) do servidor "para" o fluxo.
const FAIL_STEP = {
  MUITAS_REQUISICOES: 'requisicao', SEM_CONEXAO: 'requisicao', JSON_INVALIDO: 'requisicao', PAYLOAD_GRANDE: 'requisicao',
  CONSENTIMENTO_OBRIGATORIO: 'dados', APELIDO_INVALIDO: 'dados',
  NUMERO_INVALIDO: 'numero', LIMITE_NUMERO: 'numero', LIMITE_GLOBAL: 'numero',
  WHATSAPP_INDISPONIVEL: 'integracao',
};

/** Pinta JSON com cores usando apenas nós de texto (sem innerHTML). */
function jsonNodes(obj) {
  const text = JSON.stringify(obj, null, 2);
  const out = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(h('span', { class: m[2] ? 't-key' : 't-str' }, m[1]), m[2] || '');
    else out.push(h('span', { class: 't-ok' }, m[0]));
    last = re.lastIndex;
  }
  out.push(text.slice(last));
  return out;
}

const statusClass = (s) => (s >= 500 || s === 0 ? 's5' : s >= 400 ? 's4' : 's2');

export function createPipeline(root, { title = 'O QUE ACONTECE POR TRÁS DO BOTÃO?' } = {}) {
  root.textContent = '';
  const badge = h('span', { class: 'badge', hidden: true });
  const nodes = NODES.map((n) => h('div', { class: 'pf-node', dataset: { id: n.id } }, h('div', { class: 'b' }, icon(n.ic)), h('span', {}, n.t)));
  const links = NODES.slice(1).map(() => h('div', { class: 'pf-link' }));
  const flow = h('div', { class: 'pipe-flow', 'aria-hidden': 'true' });
  nodes.forEach((n, i) => { flow.append(n); if (links[i]) flow.append(links[i]); });

  const stepEls = {};
  const steps = h('ol', { class: 'steps', 'aria-live': 'polite' });
  STEP_LABELS.forEach(([id, label], i) => {
    const t = h('span', { class: 't' });
    const small = h('small', {}, 'Aguardando…');
    stepEls[id] = { li: h('li', { class: 'step' }, h('span', { class: 'n' }, i + 1), h('div', {}, h('b', {}, label), small), t), small, t };
    steps.append(stepEls[id].li);
  });

  const delivery = h('div', { class: 'delivery', hidden: true, 'aria-live': 'polite' });
  const reqPre = h('pre', {}, h('span', { class: 't-mut' }, 'Aguardando o envio…'));
  const resPre = h('pre', {}, h('span', { class: 't-mut' }, 'Aguardando o envio…'));
  const reqLine = h('div', { class: 'http-line' }, h('span', { class: 'method' }, 'POST'), h('span', {}, '/api/mensagem/enviar'));
  const resLine = h('div', { class: 'http-line' }, h('span', { class: 't-mut' }, 'Resposta do servidor'));

  root.append(
    h('div', { class: 'pipe-title' }, h('h3', { style: { margin: 0 } }, title), badge),
    flow, steps, delivery,
    h('div', { class: 'api-split', style: { marginTop: '1rem' } },
      h('div', { class: 'terminal' }, h('div', { class: 'bar' }, h('i', { class: 'dot' }), h('i', { class: 'dot' }), h('i', { class: 'dot' }), h('span', {}, ' requisição HTTP')), h('div', { style: { padding: '.8rem 1rem 0' } }, reqLine), reqPre),
      h('div', { class: 'terminal' }, h('div', { class: 'bar' }, h('i', { class: 'dot' }), h('i', { class: 'dot' }), h('i', { class: 'dot' }), h('span', {}, ' resposta HTTP')), h('div', { style: { padding: '.8rem 1rem 0' } }, resLine), resPre)),
  );

  function setBadge(simulado) {
    badge.hidden = false;
    badge.className = `badge ${simulado ? 'sim' : 'ok'}`;
    badge.textContent = simulado ? 'SIMULADO — nenhuma mensagem real' : 'ENVIO REAL via WhatsApp';
  }

  function paintNodes(job) {
    const state = NODES.map(() => 'pending');
    NODES.forEach((_, i) => {
      const mine = job.etapas.filter((e) => STEP_NODE[e.id] === i);
      if (i === 0) {
        const r = job.etapas.find((e) => e.id === 'requisicao');
        if (r.status === 'erro') state[0] = job.http.status === 0 ? 'fail' : 'done';
        else state[0] = r.status === 'ok' ? 'done' : 'active';
      } else if (i === 4) {
        const res = job.etapas.find((e) => e.id === 'resultado');
        const ent = job.entrega?.estado;
        if (res.status === 'erro') state[4] = 'fail';
        else if (res.status === 'ok' && (ent === 'entregue' || ent === 'lida' || job.simulado)) state[4] = 'done';
        else if (res.status === 'ok') state[4] = 'active';
      } else if (mine.some((e) => e.status === 'erro')) state[i] = 'fail';
      else if (mine.some((e) => e.status === 'executando')) state[i] = 'active';
      else if (mine.every((e) => e.status === 'ok')) state[i] = 'done';
      else if (mine.some((e) => e.status === 'ok')) state[i] = 'active';
    });
    nodes.forEach((n, i) => { n.className = `pf-node ${state[i] === 'pending' ? '' : state[i] === 'fail' ? 'fail' : state[i]}`; });
    links.forEach((l, i) => {
      l.className = `pf-link ${state[i] === 'done' && state[i + 1] === 'done' ? 'done' : state[i + 1] === 'active' ? 'on' : state[i] === 'done' && state[i + 1] === 'fail' ? '' : ''}`;
    });
  }

  function paintDelivery(job) {
    const e = job.entrega?.estado;
    const done = job.estado === 'concluido';
    delivery.hidden = !done && job.estado !== 'falhou';
    if (delivery.hidden) return;
    delivery.className = 'delivery';
    let msg;
    if (job.estado === 'falhou') msg = 'Nenhuma mensagem foi enviada.';
    else if (e === 'nao-aplicavel') msg = 'Simulação: nenhuma mensagem foi enviada, então não há entrega a confirmar.';
    else if (e === 'entregue') { msg = '✓✓ Entregue ao aparelho do destinatário (confirmação técnica do WhatsApp).'; delivery.classList.add('good'); }
    else if (e === 'lida') { msg = '✓✓ Entregue e aberta pelo destinatário (confirmação técnica do WhatsApp).'; delivery.classList.add('good'); }
    else if (e === 'aceita-pelo-servidor') msg = '✓ O WhatsApp recebeu a mensagem. Aguardando chegar ao aparelho…';
    else if (e === 'erro') { msg = 'O WhatsApp reportou erro na entrega.'; delivery.classList.add('warn'); }
    else if (e === 'sem-confirmacao') { msg = 'Envio aceito pela biblioteca, mas ainda sem confirmação técnica de entrega. Confira no celular.'; delivery.classList.add('warn'); }
    else msg = 'Envio aceito pela biblioteca. Aguardando a confirmação de entrega do WhatsApp…';
    delivery.textContent = '';
    delivery.append(h('b', {}, 'Entrega: '), msg);
  }

  const api_ = {
    reset() {
      badge.hidden = true;
      Object.values(stepEls).forEach(({ li, small, t }) => { li.className = 'step'; small.textContent = 'Aguardando…'; t.textContent = ''; });
      nodes.forEach((n) => { n.className = 'pf-node'; });
      links.forEach((l) => { l.className = 'pf-link'; });
      delivery.hidden = true;
      reqPre.textContent = ''; reqPre.append(h('span', { class: 't-mut' }, 'Aguardando o envio…'));
      resPre.textContent = ''; resPre.append(h('span', { class: 't-mut' }, 'Aguardando o envio…'));
      resLine.textContent = ''; resLine.append(h('span', { class: 't-mut' }, 'Resposta do servidor'));
    },
    showRequest(body, simulado) {
      setBadge(simulado);
      reqPre.textContent = '';
      reqPre.append(...jsonNodes(body));
    },
    showPostResponse(status, body) {
      resLine.textContent = '';
      resLine.append(h('span', { class: `status-badge ${statusClass(status)}` }, `${status || '—'} ${HTTP_TEXT[status] || ''}`.trim()), h('span', { class: 't-mut' }, 'resposta imediata do POST'));
      resPre.textContent = '';
      resPre.append(...jsonNodes(body));
    },
    showFinal(job) {
      const st = job.http.status;
      resLine.textContent = '';
      resLine.append(h('span', { class: `status-badge ${statusClass(st)}` }, `${st} ${HTTP_TEXT[st] || ''}`.trim()), h('span', { class: 't-mut' }, 'resultado final do processamento'));
      resPre.textContent = '';
      resPre.append(...jsonNodes({ estado: job.estado, http: st, corpo: job.resposta?.corpo ?? null }));
    },
    update(job) {
      setBadge(job.simulado);
      job.etapas.forEach((e) => {
        const el = stepEls[e.id];
        el.li.className = `step ${e.status === 'executando' ? 'running' : e.status === 'ok' ? 'ok' : e.status === 'erro' ? 'erro' : ''}`;
        el.small.textContent = e.detalhe || (e.status === 'executando' ? 'Em andamento…' : e.status === 'ok' ? 'Concluída.' : 'Aguardando…');
        el.t.textContent = e.em !== null && e.em !== undefined ? `${e.em} ms` : '';
      });
      paintNodes(job);
      paintDelivery(job);
    },
    /** Recusa imediata (4xx/5xx) — monta um estado coerente com o que o servidor realmente disse. */
    showSyncFailure(status, data, simulado) {
      const codigo = data?.erro?.codigo || 'SEM_CONEXAO';
      const failId = FAIL_STEP[codigo] || (status >= 500 ? 'integracao' : 'dados');
      const failIdx = STEP_LABELS.findIndex(([id]) => id === failId);
      const etapas = STEP_LABELS.map(([id, rotulo], i) => ({
        id, rotulo, em: null, detalhe: null,
        status: i < failIdx ? 'ok' : i === failIdx ? 'erro' : 'pendente',
      }));
      etapas[failIdx].detalhe = data?.erro?.mensagem || 'Falha.';
      api_.update({ simulado, etapas, entrega: { estado: 'nao-aplicavel' }, http: { status }, estado: 'falhou' });
    },
  };
  return api_;
}

/**
 * Executa um envio completo contra a API e narra cada estado real na interface.
 * `post` deve devolver { status, data } do POST inicial.
 */
export async function runAndTrack(pipe, { requestPreview, simulado, post, onJob }) {
  pipe.reset();
  pipe.showRequest(requestPreview, simulado);
  pipe.update({
    simulado, estado: 'processando', entrega: { estado: 'aguardando' }, http: { status: 0 },
    etapas: STEP_LABELS.map(([id, rotulo]) => ({ id, rotulo, status: id === 'requisicao' ? 'executando' : 'pendente', em: null, detalhe: id === 'requisicao' ? 'Enviando ao servidor…' : null })),
  });
  const { status, data } = await post();
  pipe.showPostResponse(status, data);
  if (status !== 202) {
    pipe.showSyncFailure(status, data, simulado);
    return { ok: false, status, erro: data?.erro };
  }

  const jobId = data.jobId;
  let failures = 0;
  let job = null;
  // 1) acompanha o processamento
  for (;;) {
    const r = await api(`/api/mensagem/envio/${encodeURIComponent(jobId)}`);
    if (r.status !== 200) {
      if (++failures > 6) return { ok: false, status: r.status, erro: r.data?.erro };
      await sleep(500);
      continue;
    }
    job = r.data;
    pipe.update(job);
    onJob?.(job);
    if (job.estado !== 'processando') break;
    await sleep(300);
  }
  pipe.showFinal(job);

  // 2) envio real: acompanha a confirmação técnica de entrega por até 20 s
  if (job.estado === 'concluido' && !job.simulado) {
    const limit = Date.now() + 20_000;
    while (!['entregue', 'lida', 'erro'].includes(job.entrega.estado) && Date.now() < limit) {
      await sleep(1000);
      const r = await api(`/api/mensagem/envio/${encodeURIComponent(jobId)}`);
      if (r.status === 200) { job = r.data; pipe.update(job); }
    }
    if (!['entregue', 'lida', 'erro'].includes(job.entrega.estado)) {
      job = { ...job, entrega: { ...job.entrega, estado: 'sem-confirmacao' } };
      pipe.update(job);
    }
  }
  return { ok: job.estado === 'concluido', job };
}
