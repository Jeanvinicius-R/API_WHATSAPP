// "Back-end simulado" para a versão estática (GitHub Pages).
// Responde, dentro do navegador, às mesmas rotas que o servidor Express — com o mesmo formato de resposta —
// para o front-end funcionar sem servidor. NADA é enviado a lugar nenhum e nenhuma mensagem real é disparada.
// Em modo servidor (npm start) este arquivo nem é carregado.

let salarios = null;
let validation = null;
const jobs = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rid = (n = 9) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const err = (status, codigo, mensagem) => ({ status, data: { erro: { codigo, mensagem } } });

async function load() {
  if (salarios) return;
  const [s, v] = await Promise.all([
    fetch('data/salarios.json').then((r) => r.json()),
    import('./validation.mjs'),
  ]);
  salarios = s; validation = v;
}

const ETAPAS = [
  ['requisicao', 'Requisição iniciada'], ['dados', 'Dados recebidos'], ['numero', 'Número validado'],
  ['mensagem', 'Mensagem selecionada'], ['integracao', 'Integração acionada'], ['resultado', 'Resultado retornado'],
];

function newJob(requisicao) {
  const id = rid();
  const job = {
    id, criadoEm: Date.now(), estado: 'processando', simulado: true,
    etapas: ETAPAS.map(([eid, rotulo]) => ({ id: eid, rotulo, status: 'pendente', em: null, detalhe: null })),
    entrega: { estado: 'nao-aplicavel', ack: null },
    http: { metodo: 'POST', rota: '/api/mensagem/enviar', status: 202 },
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
    dados: 'SIMULADO — consentimento presente',
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
  const { telefone, apelido, consentimento } = body;
  if (consentimento !== true) return err(400, 'CONSENTIMENTO_OBRIGATORIO', 'Marque a caixa de consentimento para receber a mensagem.');
  const tel = validation.normalizeBrazilianMobile(telefone);
  if (!tel.ok) return err(422, 'NUMERO_INVALIDO', tel.motivo);
  const nick = validation.sanitizeNickname(apelido);
  if (!nick.ok) return err(422, 'APELIDO_INVALIDO', nick.motivo);
  const job = newJob({ apelido: nick.value, telefone: validation.maskForDisplay(tel.digits), consentimento: true });
  runJob(job);
  return { status: 202, data: { jobId: job.id, simulado: true, status: 'aceito' } };
}

function simulate() {
  const job = newJob({ apelido: 'Visitante', telefone: '+55 16 9****-0000', consentimento: true });
  runJob(job);
  return { status: 202, data: { jobId: job.id, simulado: true, status: 'aceito' } };
}

export async function staticApi(path, { method = 'GET', body } = {}) {
  await load();
  const p = path.split('?')[0];
  if (p === '/api/status') return { status: 200, data: { modo: 'simulado', estatico: true, envioDisponivel: true, epoch: 1 } };
  if (p === '/api/salarios') return { status: 200, data: salarios };
  if (p === '/api/mensagem/enviar' && method === 'POST') return submit(body);
  if (p === '/api/demo/simular' && method === 'POST') return simulate();
  if (p.startsWith('/api/mensagem/envio/')) {
    const job = jobs.get(decodeURIComponent(p.split('/').pop()));
    if (!job) return err(404, 'ENVIO_NAO_ENCONTRADO', 'Envio não encontrado.');
    const { criadoEm, ...publico } = job;
    return { status: 200, data: JSON.parse(JSON.stringify(publico)) };
  }
  return err(404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.');
}
