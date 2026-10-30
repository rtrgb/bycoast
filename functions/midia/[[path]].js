// ========================
// MÍDIA (só na Cloudflare)
// Entrega /midia/... direto do R2, no mesmo endereço que o site já usa.
// No GitHub Pages esta pasta é ignorada: lá os arquivos saem da pasta midia/ do repositório.
// ========================

// GET baixa o arquivo; HEAD só confere (tamanho, tipo) sem baixar
export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const key = 'midia/' + params.path.join('/');

  // range: o navegador pede o vídeo em pedaços (o Safari só toca vídeo assim)
  // onlyIf: se o navegador já tem o arquivo guardado, responde "não mudou" sem mandar de novo
  const pediuPedaco = request.headers.has('range');
  const obj = await env.MIDIA.get(key, {
    range: pediuPedaco ? request.headers : undefined,
    onlyIf: request.headers,
  });
  if (!obj) return new Response('Não encontrado', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers); // tipo do arquivo (video/mp4, image/jpeg...) e cache, se o painel definiu
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=86400');

  // sem corpo = o onlyIf bateu: o navegador já tem a versão atual
  if (!('body' in obj)) return new Response(null, { status: 304, headers });

  const body = request.method === 'HEAD' ? null : obj.body;

  if (pediuPedaco && obj.range) {
    const start = obj.range.offset ?? obj.size - obj.range.suffix;
    const length = obj.range.length ?? obj.size - start;
    headers.set('content-range', 'bytes ' + start + '-' + (start + length - 1) + '/' + obj.size);
    headers.set('content-length', String(length));
    return new Response(body, { status: 206, headers });
  }

  headers.set('content-length', String(obj.size));
  return new Response(body, { headers });
}
