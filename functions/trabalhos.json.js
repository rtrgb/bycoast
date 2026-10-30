// ========================
// /trabalhos.json (só na Cloudflare): a lista que o site lê, direto do R2.
// Sem cache longo: o que o painel salvar aparece na próxima visita.
// ========================
import { CHAVE } from './_lib/trabalhos.js';

export async function onRequestGet({ request, env }) {
  const obj = await env.MIDIA.get(CHAVE, { onlyIf: request.headers });
  if (!obj) return new Response('[]', { headers: { 'content-type': 'application/json' } });

  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-cache', // o navegador sempre pergunta se mudou (resposta rápida se não mudou)
    etag: obj.httpEtag
  });
  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
}
