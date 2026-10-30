// ========================
// PORTEIRO DO PAINEL (roda antes de tudo em /api/...)
// O Cloudflare Access faz o login (código no e-mail) e manda junto um "crachá" assinado
// (o cabeçalho Cf-Access-Jwt-Assertion). Aqui conferimos a assinatura do crachá:
// sem ele, ou com ele falsificado, nada do painel funciona.
//
// Configuração (no wrangler.toml, em [vars]):
//   ACCESS_TEAM    endereço do time no Access, ex.: https://bycoast.cloudflareaccess.com
//   ACCESS_AUD     o "Application Audience (AUD) Tag" do app do painel no Access
//   PAINEL_EMAILS  (opcional) e-mails liberados, separados por vírgula
// ========================

export async function onRequest(context) {
  const { request, env } = context;

  // ação que muda algo precisa deste cabeçalho: um site de fora não consegue mandá-lo
  // sem permissão do navegador, então ninguém salva no painel "por tabela"
  if (request.method !== 'GET' && request.headers.get('x-painel') !== '1') {
    return erro(403, 'Pedido sem o cabeçalho do painel.');
  }

  // só para testar no computador (wrangler pages dev), com PAINEL_DEV=1 no arquivo .dev.vars
  if (env.PAINEL_DEV === '1' && new URL(request.url).hostname === 'localhost') {
    context.data.email = 'teste@localhost';
    return context.next();
  }

  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) {
    return erro(503, 'O login do painel ainda não foi configurado.');
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  const dados = token && await verificar(token, env).catch(function () { return null; });
  if (!dados) return erro(401, 'Faça login de novo.');

  if (env.PAINEL_EMAILS) {
    const liberados = env.PAINEL_EMAILS.split(',').map(function (e) { return e.trim().toLowerCase(); });
    if (!liberados.includes(String(dados.email).toLowerCase())) return erro(403, 'Este e-mail não tem acesso.');
  }

  context.data.email = dados.email;
  return context.next();
}

export function erro(status, mensagem) {
  return Response.json({ erro: mensagem }, { status });
}

// ---------- conferir o crachá (JWT assinado com RS256) ----------

async function verificar(token, env) {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const cabecalho = JSON.parse(texto(partes[0]));
  const dados = JSON.parse(texto(partes[1]));
  if (cabecalho.alg !== 'RS256') return null;

  // chaves públicas do Access (a Cloudflare troca de tempos em tempos; guardamos por 1 h)
  const certs = await fetch(env.ACCESS_TEAM + '/cdn-cgi/access/certs', { cf: { cacheTtl: 3600 } })
    .then(function (r) { return r.json(); });
  const jwk = certs.keys.find(function (k) { return k.kid === cabecalho.kid; });
  if (!jwk) return null;

  const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valido = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, bytes(partes[2]),
    new TextEncoder().encode(partes[0] + '.' + partes[1]));
  if (!valido) return null;

  const auds = Array.isArray(dados.aud) ? dados.aud : [dados.aud];
  const agora = Date.now() / 1000;
  if (!auds.includes(env.ACCESS_AUD)) return null;   // crachá de outro app
  if (dados.iss !== env.ACCESS_TEAM) return null;    // emitido por outro time
  if (!(dados.exp > agora)) return null;             // vencido
  return dados;
}

// base64url → bytes / texto
function bytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
}

function texto(b64url) {
  return new TextDecoder().decode(bytes(b64url));
}
