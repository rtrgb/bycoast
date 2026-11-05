// ========================
// DEPOIMENTOS NO R2
// Quem manda pela página /feedback cai em "pendentes" (um arquivo por depoimento).
// Só depois que o Diogo aprova no painel ele vai para o depoimentos.json, que o site lê.
// ========================

export const CHAVE = 'depoimentos.json';
export const PASTA_PENDENTES = 'depoimentos-pendentes/';
export const MAX_PENDENTES = 50; // trava contra spam: acima disso, a página pede pra tentar depois

export const LIMITE = { nome: 60, negocio: 60, texto: 500 };

// id = momento do envio + um pedaço aleatório, ex.: 1793905972000-k3x9q2
export const ID = /^[0-9]{13}-[a-z0-9]{6}$/;

export function novoId() {
  const aleatorio = Array.from(crypto.getRandomValues(new Uint8Array(6)), function (b) {
    return 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36];
  }).join('');
  return Date.now() + '-' + aleatorio;
}

// confere um depoimento e devolve { dep } limpo ou { erro }
export function limpar(d) {
  if (!d || typeof d !== 'object') return { erro: 'Formato inválido.' };
  const nome = texto(d.nome, LIMITE.nome);
  const negocio = texto(d.negocio, LIMITE.negocio);
  const fala = texto(d.texto, LIMITE.texto);
  if (!nome) return { erro: 'Coloque seu nome.' };
  if (fala.length < 10) return { erro: 'Escreva um pouco mais sobre como foi.' };
  return { dep: { nome, negocio, texto: fala } };
}

// lista aprovada que o painel manda (reordenar, tirar do site)
export function validarLista(lista) {
  if (!Array.isArray(lista)) return { erro: 'Formato inválido.' };
  const ids = new Set();
  const deps = [];
  for (const d of lista) {
    if (!d || !ID.test(d.id) || ids.has(d.id)) return { erro: 'Avaliação inválida.' };
    ids.add(d.id);
    const { dep, erro } = limpar(d);
    if (erro) return { erro };
    deps.push(Object.assign({ id: d.id }, dep, { data: dataValida(d.data) }));
  }
  return { deps };
}

export function dataValida(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : '';
}

// tira espaços sobrando e quebras de linha repetidas, e corta no tamanho máximo
function texto(valor, max) {
  if (typeof valor !== 'string') return '';
  return valor.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
