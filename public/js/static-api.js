// "Back-end simulado" para a versão estática (GitHub Pages).
// Responde, dentro do navegador, às mesmas rotas que o servidor Express — com o mesmo formato de resposta —
// para o front-end funcionar sem servidor. NADA é enviado a lugar nenhum e nenhuma mensagem real é disparada.
// Em modo servidor (npm start) este arquivo nem é carregado.

let data = null;
let salarios = null;
let validation = null;
const sessions = new Map();
const jobs = new Map();
const QUIZ_SIZE = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rid = (n = 12) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const shuffle = (list) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const err = (status, codigo, mensagem) => ({ status, data: { erro: { codigo, mensagem } } });

async function load() {
  if (data) return;
  const [d, s, v] = await Promise.all([
    fetch('data/static-data.json').then((r) => r.json()),
    fetch('data/salarios.json').then((r) => r.json()),
    import('./validation.mjs'),
  ]);
  data = d; salarios = s; validation = v;
}

const classify = (acertos) => data.classificacoes.find((c) => acertos >= c.min && acertos <= c.max) || data.classificacoes[0];

function startQuiz() {
  const picked = [];
  for (const [nivel, qtd] of [[1, 3], [2, 3], [3, 2]]) {
    picked.push(...shuffle(data.perguntas.filter((p) => p.nivel === nivel)).slice(0, qtd));
  }
  const questions = picked.slice(0, QUIZ_SIZE).map((p) => {
    const opcoes = shuffle(p.opcoes.map((texto, i) => ({ texto, correta: i === 0 })));
    return { id: p.id, nivel: p.nivel, enunciado: p.enunciado, explicacao: p.explicacao, opcoes: opcoes.map((o) => o.texto), correta: opcoes.findIndex((o) => o.correta) };
  });
  const id = rid(16);
  sessions.set(id, { id, questions, respostas: new Map() });
  return {
    status: 201,
    data: { sessionId: id, total: questions.length, perguntas: questions.map((q) => ({ id: q.id, nivel: q.nivel, enunciado: q.enunciado, opcoes: q.opcoes })) },
  };
}

const acertosDe = (s) => [...s.respostas.values()].filter(Boolean).length;

function answer({ sessionId, perguntaId, escolha } = {}) {
  const s = sessions.get(sessionId);
  if (!s) return err(404, 'SESSAO_NAO_ENCONTRADA', 'Quiz não encontrado. Comece uma nova partida.');
  const q = s.questions.find((x) => x.id === perguntaId);
  if (!q) return err(422, 'PERGUNTA_INVALIDA', 'Pergunta inválida.');
  if (!Number.isInteger(escolha) || escolha < 0 || escolha >= q.opcoes.length) return err(422, 'ALTERNATIVA_INVALIDA', 'Alternativa inválida.');
  if (s.respostas.has(q.id)) return err(409, 'JA_RESPONDIDA', 'Essa pergunta já foi respondida.');
  const acertou = escolha === q.correta;
  s.respostas.set(q.id, acertou);
  return { status: 200, data: { acertou, correta: q.correta, explicacao: q.explicacao, acertos: acertosDe(s), respondidas: s.respostas.size, total: s.questions.length } };
}

function result(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return err(404, 'SESSAO_NAO_ENCONTRADA', 'Quiz não encontrado. Comece uma nova partida.');
  if (s.respostas.size < s.questions.length) return err(409, 'QUIZ_INCOMPLETO', 'Responda todas as perguntas para ver o resultado.');
  const acertos = acertosDe(s);
  const total = s.questions.length;
  const c = classify(acertos);
  return { status: 200, data: { acertos, total, percentual: Math.round((acertos / total) * 100), classificacao: { id: c.id, titulo: c.titulo, emoji: c.emoji, resumo: c.resumo } } };
}

// ---------- Envio SIMULADO (mesmas etapas do servidor) ----------
const ETAPAS = [
  ['requisicao', 'Requisição iniciada'], ['dados', 'Dados recebidos'], ['numero', 'Número validado'],
  ['mensagem', 'Mensagem selecionada'], ['integracao', 'Integração acionada'], ['resultado', 'Resultado retornado'],
];

function newJob(requisicao) {
  const id = rid(9);
  const job = {
    id, criadoEm: Date.now(), estado: 'processando', simulado: true,
    etapas: ETAPAS.map(([eid, rotulo]) => ({ id: eid, rotulo, status: 'pendente', em: null, detalhe: null })),
    entrega: { estado: 'nao-aplicavel', ack: null },
    http: { metodo: 'POST', rota: '/api/quiz/enviar-resultado', status: 202 },
    requisicao, resposta: null, erro: null, duracaoMs: 0,
  };
  jobs.set(id, job);
  return job;
}

async function runJob(job) {
  const t0 = job.criadoEm;
  const mark = (id, status, detalhe) => {
    const e = job.etapas.find((x) => x.id === id);
    e.status = status; e.em = Date.now() - t0; if (detalhe) e.detalhe = detalhe;
    job.duracaoMs = Date.now() - t0;
  };
  const textos = {
    requisicao: 'SIMULADO — requisição tratada no próprio navegador (versão online)',
    dados: 'SIMULADO — consentimento presente e pontuação conferida',
    numero: 'SIMULADO — formato brasileiro validado; nenhum número foi enviado a lugar algum',
    mensagem: 'SIMULADO — a mensagem seria escolhida pelo servidor',
    integracao: 'SIMULADO — nenhuma mensagem foi enviada',
  };
  for (const [id] of ETAPAS.slice(0, 5)) {
    mark(id, 'executando');
    await sleep(id === 'requisicao' ? 150 : 400);
    mark(id, 'ok', textos[id]);
  }
  mark('resultado', 'executando');
  await sleep(300);
  job.estado = 'concluido';
  job.http = { ...job.http, status: 200 };
  job.resposta = { status: 200, corpo: { ok: true, simulado: true, mensagem: 'Envio simulado concluído.' } };
  mark('resultado', 'ok', 'SIMULADO — fluxo concluído sem envio real');
}

function submit(body = {}) {
  const { sessionId, telefone, apelido, consentimento } = body;
  if (consentimento !== true) return err(400, 'CONSENTIMENTO_OBRIGATORIO', 'Marque a caixa de consentimento para receber a mensagem.');
  const r = result(sessionId);
  if (r.status !== 200) return err(r.status, r.data.erro.codigo, r.data.erro.mensagem);
  const tel = validation.normalizeBrazilianMobile(telefone);
  if (!tel.ok) return err(422, 'NUMERO_INVALIDO', tel.motivo);
  const nick = validation.sanitizeNickname(apelido);
  if (!nick.ok) return err(422, 'APELIDO_INVALIDO', nick.motivo);
  const job = newJob({ sessionId: `${sessionId.slice(0, 6)}…`, apelido: nick.value, telefone: validation.maskForDisplay(tel.digits), consentimento: true });
  runJob(job);
  return { status: 202, data: { jobId: job.id, simulado: true, status: 'aceito' } };
}

function simulate() {
  const job = newJob({ sessionId: 'demo…', apelido: 'Visitante', telefone: '+55 16 9****-0000', consentimento: true });
  runJob(job);
  return { status: 202, data: { jobId: job.id, simulado: true, status: 'aceito' } };
}

export async function staticApi(path, { method = 'GET', body } = {}) {
  await load();
  const p = path.split('?')[0];
  if (p === '/api/status') {
    return { status: 200, data: { modo: 'simulado', estatico: true, envioDisponivel: true, epoch: 1, perguntasNoBanco: data.perguntas.length, tamanhoQuiz: QUIZ_SIZE } };
  }
  if (p === '/api/salarios') return { status: 200, data: salarios };
  if (p === '/api/quiz/iniciar' && method === 'POST') return startQuiz();
  if (p === '/api/quiz/responder' && method === 'POST') return answer(body);
  if (p.startsWith('/api/quiz/resultado/')) return result(decodeURIComponent(p.split('/').pop()));
  if (p === '/api/quiz/enviar-resultado' && method === 'POST') return submit(body);
  if (p === '/api/demo/simular' && method === 'POST') return simulate();
  if (p.startsWith('/api/quiz/envio/')) {
    const job = jobs.get(decodeURIComponent(p.split('/').pop()));
    if (!job) return err(404, 'ENVIO_NAO_ENCONTRADO', 'Envio não encontrado.');
    const { criadoEm, ...publico } = job;
    return { status: 200, data: JSON.parse(JSON.stringify(publico)) };
  }
  return err(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.');
}
