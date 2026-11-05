// ========================
// /feedback/enviar (público): recebe o depoimento da página /feedback.
// Não publica nada: guarda como pendente até o Diogo aprovar no painel.
// Antispam simples: campo escondido que só robô preenche, tempo mínimo na página,
// limite de tamanho e de pendentes.
// ========================
import { PASTA_PENDENTES, MAX_PENDENTES, limpar, novoId } from '../_lib/depoimentos.js';

export async function onRequestPost({ request, env }) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) return erro(415, 'Formato inválido.');
  if (Number(request.headers.get('content-length') || 0) > 4000) return erro(413, 'Texto grande demais.');

  const corpo = await request.json().catch(function () { return null; });
  if (!corpo) return erro(400, 'Formato inválido.');

  // robô: preencheu o campo escondido ou enviou rápido demais. Responde "ok" pra ele não insistir
  if (corpo.site || !(Number(corpo.tempo) >= 3000)) return Response.json({ ok: true });

  if (corpo.autorizo !== true) return erro(400, 'Marque a autorização para publicar.');
  const { dep, erro: problema } = limpar(corpo);
  if (problema) return erro(400, problema);

  const pendentes = await env.MIDIA.list({ prefix: PASTA_PENDENTES, limit: MAX_PENDENTES });
  if (pendentes.objects.length >= MAX_PENDENTES) {
    return erro(429, 'Recebemos muitos depoimentos agora. Tente de novo mais tarde ou mande pelo WhatsApp.');
  }

  const id = novoId();
  const registro = Object.assign({ id }, dep, { data: new Date().toISOString().slice(0, 10) });
  await env.MIDIA.put(PASTA_PENDENTES + id + '.json', JSON.stringify(registro), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' }
  });
  return Response.json({ ok: true });
}

function erro(status, mensagem) {
  return Response.json({ erro: mensagem }, { status });
}
