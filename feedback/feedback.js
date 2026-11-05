// ========================
// PÁGINA DE DEPOIMENTO (/feedback)
// Manda pro /feedback/enviar, que guarda como pendente até aprovar no painel.
// ========================

const form = document.getElementById('feedback');
const erro = document.getElementById('form-error');
const botao = document.getElementById('enviar');
const texto = document.getElementById('texto');
const contador = document.getElementById('contador');
const aberto = Date.now(); // robô envia na hora; gente leva alguns segundos

texto.addEventListener('input', function () {
  contador.textContent = texto.value.length + ' / 500';
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  erro.textContent = '';

  const valor = function (id) { return document.getElementById(id).value.trim(); };
  if (!valor('nome')) return falhar('Coloque seu nome.', 'nome');
  if (valor('texto').length < 10) return falhar('Escreva um pouco mais sobre como foi.', 'texto');
  if (!document.getElementById('autorizo').checked) return falhar('Marque a autorização para publicar.', 'autorizo');

  botao.disabled = true;
  botao.textContent = 'Enviando…';
  try {
    const res = await fetch('/feedback/enviar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nome: valor('nome'),
        negocio: valor('negocio'),
        texto: valor('texto'),
        autorizo: true,
        site: valor('site'),
        tempo: Date.now() - aberto
      })
    });
    const dados = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(dados.erro || 'Não consegui enviar. Tente de novo.');

    form.hidden = true;
    document.getElementById('feedback-ok').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    falhar(err.message.indexOf('fetch') >= 0 ? 'Sem conexão. Tente de novo.' : err.message);
  }
  botao.disabled = false;
  botao.textContent = 'Enviar depoimento';
});

function falhar(mensagem, campo) {
  erro.textContent = mensagem;
  if (campo) document.getElementById(campo).focus();
}
