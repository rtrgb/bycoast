// ========================
// /api/depoimentos: o painel vê os pendentes, aprova, recusa e organiza os do site.
// Aqui tudo vale na hora (não espera o botão "Publicar" dos trabalhos).
// ========================
import { CHAVE, PASTA_PENDENTES, MAX_PENDENTES, ID, validarLista } from '../_lib/depoimentos.js';
import { erro } from './_middleware.js';

export async function onRequestGet({ env }) {
  const [aprovados, pendentes] = await Promise.all([lerAprovados(env), lerPendentes(env)]);
  return Response.json({ aprovados: aprovados.lista, versao: aprovados.versao, pendentes });
}

// { acao: 'aprovar' | 'recusar', id }
export async function onRequestPost({ request, env }) {
  const corpo = await request.json().catch(function () { return null; });
  if (!corpo || !ID.test(corpo.id)) return erro(400, 'Avaliação inválida.');
  const chave = PASTA_PENDENTES + corpo.id + '.json';

  if (corpo.acao === 'recusar') {
    await env.MIDIA.delete(chave);
    return Response.json({ ok: true });
  }

  if (corpo.acao !== 'aprovar') return erro(400, 'Ação inválida.');
  const obj = await env.MIDIA.get(chave);
  if (!obj) return erro(404, 'Essa avaliação já foi aprovada ou recusada. Recarregue a página.');
  const dep = await obj.json();

  // o aprovado entra no começo da lista (mais recente primeiro)
  const atual = await lerAprovados(env);
  const lista = [dep].concat(atual.lista.filter(function (d) { return d.id !== dep.id; }));
  const salvo = await salvar(env, lista, atual.versao);
  if (!salvo) return erro(409, 'As avaliações mudaram em outro lugar. Recarregue a página.');
  await env.MIDIA.delete(chave);
  return Response.json({ versao: salvo.etag });
}

// salva a lista do site inteira (reordenar, tirar do site). Recusa se mudou desde que o painel abriu
export async function onRequestPut({ request, env }) {
  const corpo = await request.json().catch(function () { return null; });
  if (!corpo) return erro(400, 'Formato inválido.');
  const { deps, erro: problema } = validarLista(corpo.lista);
  if (problema) return erro(400, problema);

  const salvo = await salvar(env, deps, corpo.versao);
  if (!salvo) return erro(409, 'As avaliações mudaram em outro lugar. Recarregue a página.');
  return Response.json({ versao: salvo.etag });
}

async function lerAprovados(env) {
  const obj = await env.MIDIA.get(CHAVE);
  return { lista: obj ? await obj.json() : [], versao: obj ? obj.etag : null };
}

async function lerPendentes(env) {
  const { objects } = await env.MIDIA.list({ prefix: PASTA_PENDENTES, limit: MAX_PENDENTES });
  const deps = await Promise.all(objects.map(async function (o) {
    const obj = await env.MIDIA.get(o.key);
    return obj ? obj.json().catch(function () { return null; }) : null;
  }));
  return deps.filter(Boolean).sort(function (a, b) { return a.id < b.id ? 1 : -1; }); // mais novo primeiro
}

// grava só se ninguém salvou no meio do caminho (versao = etag que o painel leu; null = ainda não existe)
async function salvar(env, lista, versao) {
  const atual = await env.MIDIA.head(CHAVE);
  if ((atual ? atual.etag : null) !== (versao || null)) return null;
  return env.MIDIA.put(CHAVE, JSON.stringify(lista, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    onlyIf: atual ? { etagMatches: atual.etag } : undefined
  });
}
