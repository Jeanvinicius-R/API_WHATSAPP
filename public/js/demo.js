// Cena 7 · Demonstração: o mesmo pipeline do envio real, porém sempre SIMULADO (sem número, sem WhatsApp).
import { $, api } from './util.js';
import { createPipeline, runAndTrack } from './pipeline.js';

let pipe;
let running = false;

async function run() {
  if (running) return;
  running = true;
  const btn = $('#demoRun');
  btn.disabled = true;
  await runAndTrack(pipe, {
    simulado: true,
    requestPreview: { sessionId: 'demo…', apelido: 'Visitante', telefone: '+55 16 9****-0000', consentimento: true },
    post: () => api('/api/demo/simular', { method: 'POST', body: {} }),
  });
  btn.disabled = false;
  running = false;
}

export function init() {
  pipe = createPipeline($('#demoPipe'));
  $('#demoRun').addEventListener('click', run);
}

export function reset() {
  if (!running) pipe.reset();
}
