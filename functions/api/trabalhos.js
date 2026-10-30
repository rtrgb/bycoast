// ========================
// /api/trabalhos: o painel lê e salva a lista de trabalhos
// ========================
import { CHAVE, validar, arquivosUsados } from '../_lib/trabalhos.js';
import { erro } from './_middleware.js';

export async function onRequestGet({ env }) {
  const obj = await env.MIDIA.get(CHAVE);
  const works = obj ? await obj.json() : [];
  return Response.json({ works, versao: obj ? obj.etag : null });
}

// salva a lista inteira. "versao" é a que o painel carregou: se alguém salvou
// no meio do caminho (outro celular, outra aba), recusa em vez de apagar o trabalho do outro
export async function onRequestPut({ request, env }) {
  const corpo = await request.json().catch(function () { return null; });
  if (!corpo) return erro(400, 'Formato inválido.');

  const { works, erro: problema } = validar(corpo.works);
  if (problema) return erro(400, problema);

  const atual = await env.MIDIA.get(CHAVE);
  const versaoAtual = atual ? atual.etag : null;
  if (corpo.versao !== versaoAtual) {
    return erro(409, 'O site foi alterado em outro lugar depois que você abriu o painel. Recarregue a página.');
  }
  const antes = atual ? await atual.json() : [];

  const salvo = await env.MIDIA.put(CHAVE, JSON.stringify(works, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' }
  });

  // apaga do R2 os arquivos que saíram do site (mídia removida ou trabalho apagado)
  const usados = arquivosUsados(works);
  const sobras = [...arquivosUsados(antes)].filter(function (k) { return !usados.has(k); });
  if (sobras.length) await env.MIDIA.delete(sobras);

  return Response.json({ versao: salvo.etag, apagados: sobras.length });
}
