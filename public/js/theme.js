// Aplica o tema salvo antes da página aparecer (evita "piscar" de claro para escuro).
// Escuro é o padrão. A escolha fica só neste navegador (localStorage).
(function () {
  var tema = 'dark';
  try { tema = localStorage.getItem('tema') === 'light' ? 'light' : 'dark'; } catch (e) { /* sem armazenamento: usa o padrão */ }
  document.documentElement.setAttribute('data-theme', tema);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema === 'light' ? '#ffffff' : '#070709');
})();
