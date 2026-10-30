// ========================
// /api/upload: o painel envia fotos e vídeos para o R2
//
// Arquivo pequeno (foto, capa): PUT ?key=...                       → envia de uma vez
// Arquivo grande (vídeo), em pedaços (a Cloudflare recebe no máximo 100 MB por pedido):
//   POST ?acao=iniciar&key=...                         → { uploadId }
//   PUT  ?acao=parte&key=...&uploadId=...&n=1          → { n, etag }   (um por pedaço)
//   POST ?acao=concluir&key=...&uploadId=...  [{n, etag}...]
//   POST ?acao=cancelar&key=...&uploadId=...
// ========================
import { CHAVE_MIDIA } from '../_lib/trabalhos.js';
import { erro } from './_middleware.js';

const TIPOS = { jpg: 'image/jpeg', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4' };

// arquivos novos têm nome único (o painel nunca reaproveita), então o navegador pode guardar por 1 ano
const CACHE = 'public, max-age=31536000, immutable';

function metadados(key) {
  return { contentType: TIPOS[key.split('.').pop()], cacheControl: CACHE };
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const acao = url.searchParams.get('acao');
  if (!CHAVE_MIDIA.test(key)) return erro(400, 'Nome de arquivo inválido.');

  if (request.method === 'PUT' && !acao) {
    await env.MIDIA.put(key, request.body, { httpMetadata: metadados(key) });
    return Response.json({ key });
  }

  if (request.method === 'POST' && acao === 'iniciar') {
    const envio = await env.MIDIA.createMultipartUpload(key, { httpMetadata: metadados(key) });
    return Response.json({ uploadId: envio.uploadId });
  }

  const uploadId = url.searchParams.get('uploadId');
  if (!uploadId) return erro(400, 'Envio não encontrado.');
  const envio = env.MIDIA.resumeMultipartUpload(key, uploadId);

  if (request.method === 'PUT' && acao === 'parte') {
    const n = Number(url.searchParams.get('n'));
    if (!Number.isInteger(n) || n < 1 || n > 10000) return erro(400, 'Pedaço inválido.');
    const parte = await envio.uploadPart(n, request.body);
    return Response.json({ n: parte.partNumber, etag: parte.etag });
  }

  if (request.method === 'POST' && acao === 'concluir') {
    const partes = await request.json();
    const obj = await envio.complete(partes.map(function (p) { return { partNumber: p.n, etag: p.etag }; }));
    return Response.json({ key, tamanho: obj.size });
  }

  if (request.method === 'POST' && acao === 'cancelar') {
    await envio.abort();
    return Response.json({ ok: true });
  }

  return erro(405, 'Ação inválida.');
}
