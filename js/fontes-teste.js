// ========================
// TESTE DE FONTES (só na branch "fontes")
// Setas no seletor de baixo ou teclas 0 a 6. A escolha fica salva neste navegador.
// Link direto pra uma opção: ?fonte=2
// ========================
(function () {
  const OPCOES = [
    ['Atual', 'Geist + Geist Mono'],
    ['1 · Instrument', 'Instrument Sans + Serif itálico'],
    ['2 · Archivo', 'Archivo + IBM Plex Mono'],
    ['3 · Hanken', 'Hanken Grotesk + DM Mono'],
    ['4 · Schibsted', 'Schibsted Grotesk + JetBrains Mono'],
    ['5 · Bodoni', 'Bodoni Moda + Jost'],
    ['6 · Familjen', 'Familjen Grotesk + Space Mono']
  ];

  let atual = Number(new URLSearchParams(location.search).get('fonte'));
  if (!(atual >= 0 && atual < OPCOES.length)) {
    try { atual = Number(localStorage.getItem('fonte-teste')) || 0; } catch (e) { atual = 0; }
  }

  const barra = document.createElement('div');
  barra.className = 'fontes-teste';
  barra.innerHTML = '<button aria-label="Fonte anterior">‹</button><span></span><button aria-label="Próxima fonte">›</button>';
  document.body.appendChild(barra);
  const [antes, texto, depois] = barra.children;

  function aplicar(i) {
    atual = (i + OPCOES.length) % OPCOES.length;
    if (atual) document.documentElement.dataset.fonte = atual;
    else delete document.documentElement.dataset.fonte;
    texto.innerHTML = OPCOES[atual][0] + '<small>' + OPCOES[atual][1] + '</small>';
    try { localStorage.setItem('fonte-teste', atual); } catch (e) {}
  }

  antes.addEventListener('click', function () { aplicar(atual - 1); });
  depois.addEventListener('click', function () { aplicar(atual + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.target.closest('input, textarea, select')) return;
    if (/^[0-6]$/.test(e.key)) aplicar(Number(e.key));
  });

  aplicar(atual);
})();
