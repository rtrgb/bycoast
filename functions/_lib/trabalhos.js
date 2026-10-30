// ========================
// TRABALHOS NO R2
// O trabalhos.json fica no R2 (não no repositório), assim o painel muda o site sem git push.
// ========================

export const CHAVE = 'trabalhos.json';

// mesmas categorias do js/main.js
export const CATEGORIAS = ['automotivo', 'nautica', 'eventos', 'gastronomia', 'negocios'];

// arquivos aceitos no R2: midia/<trabalho>/<nome>.<ext>
export const CHAVE_MIDIA = /^midia\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|mp4|mov|m4v)$/;

// confere o que o painel mandou e monta uma lista limpa (só os campos que o site usa).
// Devolve { works } ou { erro }
export function validar(lista) {
  if (!Array.isArray(lista)) return { erro: 'Formato inválido.' };

  const ids = new Set();
  const works = [];

  for (const w of lista) {
    if (!w || typeof w !== 'object') return { erro: 'Trabalho inválido.' };
    if (!/^[a-z0-9-]{1,60}$/.test(w.id) || ids.has(w.id)) return { erro: 'Endereço de trabalho inválido ou repetido: ' + w.id };
    ids.add(w.id);

    const titulo = texto(w.titulo, 80);
    if (!titulo) return { erro: 'Todo trabalho precisa de um título.' };
    if (w.categoria && !CATEGORIAS.includes(w.categoria)) return { erro: 'Categoria inválida em "' + titulo + '".' };
    if (!Array.isArray(w.midias) || !w.midias.length) return { erro: '"' + titulo + '" está sem fotos ou vídeos.' };

    const midias = [];
    for (const m of w.midias) {
      const tipo = m && m.tipo === 'video' ? 'video' : 'foto';
      const arquivos = tipo === 'video' ? ['src', 'poster', 'thumb', 'previa'] : ['src', 'thumb'];
      const limpa = { tipo };

      for (const k of arquivos) {
        if (m[k] === undefined || m[k] === '') continue;
        if (!CHAVE_MIDIA.test(m[k])) return { erro: 'Arquivo inválido em "' + titulo + '".' };
        limpa[k] = m[k];
      }
      if (!limpa.src || !limpa.thumb) return { erro: 'Mídia incompleta em "' + titulo + '".' };

      if (tipo === 'video') {
        if (m.duracao) limpa.duracao = texto(m.duracao, 8);
        if (typeof m.inicio === 'number') limpa.inicio = m.inicio;
      }
      if (Number.isInteger(m.w) && Number.isInteger(m.h)) {
        limpa.w = m.w;
        limpa.h = m.h;
      }
      midias.push(limpa);
    }

    works.push({
      id: w.id,
      titulo,
      categoria: w.categoria || '',
      local: texto(w.local, 60),
      cliente: texto(w.cliente, 60),
      midias
    });
  }

  return { works };
}

// todos os arquivos que uma lista usa (pra apagar do R2 o que saiu)
export function arquivosUsados(works) {
  const usados = new Set();
  works.forEach(function (w) {
    w.midias.forEach(function (m) {
      ['src', 'poster', 'thumb', 'previa'].forEach(function (k) { if (m[k]) usados.add(m[k]); });
    });
  });
  return usados;
}

function texto(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}
