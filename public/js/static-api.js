// "Back-end simulado" para a versão estática (GitHub Pages).
// Responde, dentro do navegador, às mesmas rotas que o servidor Express — com o mesmo formato de resposta —
// para o front-end funcionar sem servidor. NADA é enviado a lugar nenhum e nenhuma mensagem real é disparada.
// Em modo servidor (npm start) este arquivo nem é carregado.

let salarios = null;

async function load() {
  if (salarios) return;
  salarios = await fetch('data/salarios.json').then((r) => r.json());
}

export async function staticApi(path, { method = 'GET', body } = {}) {
  await load();
  const p = path.split('?')[0];
  if (p === '/api/status') return { status: 200, data: { modo: 'simulado', estatico: true, envioDisponivel: true, epoch: 1 } };
  if (p === '/api/salarios') return { status: 200, data: salarios };
  if (p === '/api/mensagem/qr') return { status: 200, data: { disponivel: false, estatico: true } };
  if (p === '/api/mensagem/ao-vivo') return { status: 200, data: { total: 0, recentes: [] } };
  return { status: 404, data: { erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada.' } } };
}
