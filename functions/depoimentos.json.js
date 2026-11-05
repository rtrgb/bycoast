// ========================
// /depoimentos.json (público): os depoimentos aprovados, direto do R2.
// Só sai nome, negócio e texto (a data fica só no painel).
// ========================
import { CHAVE } from './_lib/depoimentos.js';

export async function onRequestGet({ env }) {
  const obj = await env.MIDIA.get(CHAVE);
  const lista = obj ? await obj.json() : [];
  const publicos = lista.map(function (d) { return { nome: d.nome, negocio: d.negocio, texto: d.texto }; });
  return Response.json(publicos, {
    headers: {
      'cache-control': 'no-cache',
      'access-control-allow-origin': '*' // deixa o Live Server do VS Code ler (é público mesmo)
    }
  });
}
