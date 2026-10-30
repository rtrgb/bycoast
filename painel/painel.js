// ========================
// PAINEL DO BYCOAST
// Edita a lista de trabalhos e envia fotos/vídeos para o R2.
// Nada muda no site até apertar "Publicar".
// ========================

// mesmas categorias do js/main.js (a ordem aqui é a ordem no seletor)
const CATEGORIAS = {
  automotivo: 'Automotivo',
  nautica: 'Náutica',
  eventos: 'Eventos',
  gastronomia: 'Gastronomia',
  negocios: 'Negócios'
};

const FOTO_GRANDE = 2000;     // lado maior da foto no site
const THUMB_LARGURA = 800;    // largura da miniatura (galeria)
const VIDEO_MAX = 2048;       // lado maior aceito no vídeo (1080p = 1920; um pouco de folga)
const VIDEO_MAX_MB = 1500;    // acima disso, quase certo que não foi exportado em 1080p
const PEDACO = 20 * 1024 * 1024; // vídeo vai em pedaços de 20 MB

let works = [];       // a lista como está no painel (pode ter alterações não publicadas)
let versao = null;    // versão publicada que o painel carregou
let aberto = null;    // trabalho aberto no editor (ou null = lista)
let sujo = false;     // tem alteração não publicada?
let enviando = 0;     // arquivos ainda subindo

const conteudo = document.getElementById('conteudo');
const voltar = document.getElementById('voltar');
const aviso = document.getElementById('aviso');
const barra = document.getElementById('publicar');
const barraTexto = document.getElementById('publicar-texto');
const publicarBtn = document.getElementById('publicar-btn');

// ========================
// UTILITÁRIOS
// ========================

function esc(text) {
  return String(text || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// "Reforma lancha 26 pés" → "reforma-lancha-26-pes" (mesmo jeito do scripts/atualizar.mjs)
function slug(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function contagem(midias) {
  const fotos = midias.filter(function (m) { return m.tipo !== 'video'; }).length;
  const videos = midias.length - fotos;
  const partes = [];
  if (fotos) partes.push(fotos + (fotos === 1 ? ' foto' : ' fotos'));
  if (videos) partes.push(videos + (videos === 1 ? ' vídeo' : ' vídeos'));
  return partes.join(' · ') || 'vazio';
}

let avisoTimer = null;

function avisar(texto, tipo) {
  aviso.textContent = texto;
  aviso.className = 'aviso ' + (tipo || '');
  aviso.hidden = false;
  clearTimeout(avisoTimer);
  if (tipo === 'ok') avisoTimer = setTimeout(function () { aviso.hidden = true; }, 4000);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// pedido para o servidor do painel; erro vira exceção com a mensagem em português
async function api(caminho, opcoes) {
  opcoes = opcoes || {};
  opcoes.headers = Object.assign({ 'x-painel': '1' }, opcoes.headers);
  const res = await fetch('/api/' + caminho, opcoes);
  const dados = await res.json().catch(function () { return {}; });
  if (res.status === 401) throw new Error('Sua sessão expirou. Recarregue a página para entrar de novo.');
  if (!res.ok) throw new Error(dados.erro || 'Algo deu errado (' + res.status + '). Tente de novo.');
  return dados;
}

// envio com progresso (o fetch não informa quanto já subiu; o XMLHttpRequest sim)
function enviar(url, corpo, aoProgredir) {
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', '/api/' + url);
    xhr.setRequestHeader('x-painel', '1');
    xhr.responseType = 'json';
    xhr.upload.onprogress = function (e) { if (aoProgredir) aoProgredir(e.loaded); };
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else reject(new Error((xhr.response && xhr.response.erro) || 'Falha no envio (' + xhr.status + ').'));
    };
    xhr.onerror = function () { reject(new Error('Sem conexão. Tente de novo.')); };
    xhr.send(corpo);
  });
}

function marcarSujo() {
  sujo = true;
  atualizarBarra();
}

function atualizarBarra() {
  barra.hidden = !sujo && !enviando;
  publicarBtn.disabled = enviando > 0;
  barraTexto.textContent = enviando
    ? 'Enviando ' + enviando + (enviando === 1 ? ' arquivo…' : ' arquivos…')
    : 'Alterações não publicadas';
}

// ========================
// CARREGAR E PUBLICAR
// ========================

async function carregar() {
  try {
    const dados = await api('trabalhos');
    works = dados.works;
    versao = dados.versao;
    mostrarLista();
  } catch (e) {
    conteudo.innerHTML = '<p class="carregando">' + esc(e.message) + '</p>';
  }
}

publicarBtn.addEventListener('click', async function () {
  const semMidia = works.find(function (w) { return !w.midias.length; });
  if (semMidia) {
    avisar('"' + semMidia.titulo + '" está sem fotos ou vídeos. Adicione alguma ou apague o trabalho antes de publicar.', 'erro');
    return;
  }

  publicarBtn.disabled = true;
  publicarBtn.textContent = 'Publicando…';
  try {
    const res = await api('trabalhos', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ works: works, versao: versao })
    });
    versao = res.versao;
    sujo = false;
    avisar('Publicado! O site já está atualizado.', 'ok');
  } catch (e) {
    avisar(e.message, 'erro');
  }
  publicarBtn.textContent = 'Publicar';
  atualizarBarra();
});

// fechar a aba com coisa não publicada: o navegador pergunta antes
window.addEventListener('beforeunload', function (e) {
  if (sujo || enviando) e.preventDefault();
});

// ========================
// LISTA DE TRABALHOS
// ========================

function mostrarLista() {
  aberto = null;
  voltar.hidden = true;

  conteudo.innerHTML =
    '<h1>Trabalhos</h1>' +
    '<p class="dica">A ordem aqui é a ordem no site. Toque num trabalho para editar.</p>' +
    '<form class="novo" id="novo">' +
    '<input id="novo-titulo" placeholder="Nome do novo trabalho" autocomplete="off" />' +
    '<button class="btn" type="submit">Criar</button>' +
    '</form>' +
    '<ul class="trabalhos">' +
    works.map(function (w, i) {
      const capa = w.midias[0];
      return (
        '<li class="trabalho">' +
        '<button class="trabalho-abrir" data-abrir="' + i + '">' +
        (capa ? '<img src="/' + esc(capa.thumb) + '" alt="" loading="lazy" />' : '<img alt="" />') +
        '<span class="trabalho-texto"><b>' + esc(w.titulo) + '</b>' +
        '<small>' + esc([CATEGORIAS[w.categoria], contagem(w.midias)].filter(Boolean).join(' · ')) + '</small></span>' +
        '</button>' +
        '<span class="ordem">' +
        '<button class="mini" data-mover="' + i + '" data-dir="-1" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="mini" data-mover="' + i + '" data-dir="1" aria-label="Descer"' + (i === works.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '</span>' +
        '</li>'
      );
    }).join('') +
    '</ul>';

  document.getElementById('novo').addEventListener('submit', function (e) {
    e.preventDefault();
    const titulo = document.getElementById('novo-titulo').value.trim();
    if (!titulo) return;

    // o id vira o endereço do link compartilhado (#id/2): não muda depois de criado
    const base = slug(titulo) || 'trabalho';
    let id = base;
    for (let n = 2; works.some(function (w) { return w.id === id; }); n++) id = base + '-' + n;

    // trabalho novo entra no começo (mais recente primeiro)
    works.unshift({ id: id, titulo: titulo, categoria: '', local: '', cliente: '', midias: [] });
    marcarSujo();
    abrir(0);
  });
}

conteudo.addEventListener('click', function (e) {
  const abrirBtn = e.target.closest('[data-abrir]');
  if (abrirBtn) abrir(Number(abrirBtn.dataset.abrir));

  const moverBtn = e.target.closest('[data-mover]');
  if (moverBtn) {
    const i = Number(moverBtn.dataset.mover);
    trocar(works, i, i + Number(moverBtn.dataset.dir));
    marcarSujo();
    mostrarLista();
  }
});

function trocar(lista, i, j) {
  if (j < 0 || j >= lista.length) return;
  const item = lista.splice(i, 1)[0];
  lista.splice(j, 0, item);
}

voltar.addEventListener('click', function () {
  mostrarLista();
  window.scrollTo(0, 0);
});

// ========================
// EDITOR DE UM TRABALHO
// ========================

function abrir(index) {
  aberto = works[index];
  voltar.hidden = false;
  const w = aberto;

  conteudo.innerHTML =
    '<div class="campos">' +
    '<div class="largo"><label for="f-titulo">Título</label><input id="f-titulo" data-campo="titulo" value="' + esc(w.titulo) + '" /></div>' +
    '<div><label for="f-categoria">Categoria</label><select id="f-categoria" data-campo="categoria">' +
    '<option value="">Escolha…</option>' +
    Object.keys(CATEGORIAS).map(function (c) {
      return '<option value="' + c + '"' + (w.categoria === c ? ' selected' : '') + '>' + CATEGORIAS[c] + '</option>';
    }).join('') +
    '</select></div>' +
    '<div><label for="f-local">Cidade</label><input id="f-local" data-campo="local" value="' + esc(w.local) + '" placeholder="Balneário Camboriú" /></div>' +
    '<div class="largo"><label for="f-cliente">Cliente (aparece em "Quem já atendeu")</label><input id="f-cliente" data-campo="cliente" value="' + esc(w.cliente) + '" placeholder="Opcional" /></div>' +
    '</div>' +

    '<div class="secao"><h2>Fotos e vídeos</h2>' +
    '<label class="btn btn-arquivo">' +
    '+ Adicionar<input type="file" id="arquivos" accept="image/*,video/mp4,video/quicktime,.mp4,.mov,.m4v" multiple hidden /></label>' +
    '</div>' +
    '<p class="dica">A primeira é a capa. Vídeos: exporte em 1080p, MP4 (H.264).</p>' +
    '<ul class="midias" id="midias"></ul>' +

    '<div class="perigo"><button class="btn btn-perigo" id="apagar-trabalho">Apagar este trabalho</button></div>';

  desenharMidias();
  window.scrollTo(0, 0);

  conteudo.querySelectorAll('[data-campo]').forEach(function (campo) {
    campo.addEventListener('input', function () {
      w[campo.dataset.campo] = campo.value;
      marcarSujo();
    });
  });

  document.getElementById('arquivos').addEventListener('change', function (e) {
    Array.from(e.target.files).forEach(function (file) { adicionar(w, file); });
    e.target.value = ''; // deixa escolher o mesmo arquivo de novo
  });

  document.getElementById('apagar-trabalho').addEventListener('click', function () {
    if (!confirm('Apagar "' + w.titulo + '" e todas as fotos e vídeos dele? Depois de publicar, não dá para desfazer.')) return;
    works.splice(works.indexOf(w), 1);
    marcarSujo();
    mostrarLista();
  });
}

// envios em andamento, por trabalho (aparecem no fim da grade até terminar)
const fila = new Map();

function desenharMidias() {
  const lista = document.getElementById('midias');
  if (!lista || !aberto) return;
  const w = aberto;
  const pendentes = fila.get(w.id) || [];

  if (!w.midias.length && !pendentes.length) {
    lista.innerHTML = '<li class="vazio">Nenhuma foto ou vídeo ainda. Toque em "+ Adicionar".</li>';
    return;
  }

  lista.innerHTML = w.midias.map(function (m, i) {
    return (
      '<li class="midia">' +
      '<img src="/' + esc(m.thumb) + '" alt="" loading="lazy" />' +
      (i === 0 ? '<span class="selo selo-capa">CAPA</span>' : (m.tipo === 'video' ? '<span class="selo">▶ ' + esc(m.duracao || 'vídeo') + '</span>' : '')) +
      '<div class="midia-acoes">' +
      '<button class="mini" data-midia="' + i + '" data-dir="-1" aria-label="Para trás"' + (i === 0 ? ' disabled' : '') + '>←</button>' +
      '<button class="mini" data-midia="' + i + '" data-dir="1" aria-label="Para frente"' + (i === w.midias.length - 1 ? ' disabled' : '') + '>→</button>' +
      '<button class="mini apagar" data-apagar="' + i + '" aria-label="Tirar do trabalho">✕</button>' +
      '</div>' +
      '</li>'
    );
  }).join('') + pendentes.map(function (p) {
    return (
      '<li class="midia enviando' + (p.erro ? ' falhou' : '') + '" id="envio-' + p.n + '">' +
      (p.preview ? '<img src="' + p.preview + '" alt="" />' : '') +
      '<div class="midia-progresso"><span>' + esc(p.erro || p.etapa) + '</span>' +
      (p.erro ? '' : '<div class="barra"><i style="width:' + Math.round(p.progresso * 100) + '%"></i></div>') +
      '</div>' +
      (p.erro ? '<div class="midia-acoes no-topo"><button class="mini apagar" data-descartar="' + p.n + '" aria-label="Descartar">✕</button></div>' : '') +
      '</li>'
    );
  }).join('');
}

conteudo.addEventListener('click', function (e) {
  if (!aberto) return;
  const w = aberto;

  const mover = e.target.closest('[data-midia]');
  if (mover) {
    const i = Number(mover.dataset.midia);
    trocar(w.midias, i, i + Number(mover.dataset.dir));
    marcarSujo();
    desenharMidias();
  }

  const apagar = e.target.closest('[data-apagar]');
  if (apagar && confirm('Tirar esta mídia do trabalho?')) {
    w.midias.splice(Number(apagar.dataset.apagar), 1);
    marcarSujo();
    desenharMidias();
  }

  const descartar = e.target.closest('[data-descartar]');
  if (descartar) {
    const pendentes = fila.get(w.id) || [];
    fila.set(w.id, pendentes.filter(function (p) { return p.n !== Number(descartar.dataset.descartar); }));
    desenharMidias();
  }
});

// ========================
// ENVIAR FOTOS E VÍDEOS
// ========================

let contador = 0;

async function adicionar(w, file) {
  const ehVideo = file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name);
  const p = { n: ++contador, etapa: 'Preparando…', progresso: 0, preview: null, erro: null };
  if (!fila.has(w.id)) fila.set(w.id, []);
  fila.get(w.id).push(p);
  enviando++;
  atualizarBarra();
  desenharMidias();

  // nome único: o navegador pode guardar o arquivo por 1 ano sem medo de mostrar versão velha
  const base = 'midia/' + w.id + '/' + (slug(file.name.replace(/\.[^.]+$/, '')).slice(0, 40) || 'midia') +
    '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  try {
    const midia = ehVideo ? await enviarVideo(file, base, p) : await enviarFoto(file, base, p);
    w.midias.push(midia);
    fila.set(w.id, fila.get(w.id).filter(function (x) { return x !== p; }));
    marcarSujo();
  } catch (e) {
    p.erro = file.name + ': ' + e.message;
  }

  if (p.preview && !p.erro) URL.revokeObjectURL(p.preview);
  enviando--;
  atualizarBarra();
  desenharMidias();
}

function progresso(p, valor, etapa) {
  p.progresso = valor;
  if (etapa) {
    p.etapa = etapa;
    desenharMidias();
    return;
  }
  // só a barra anda: recriar a grade inteira a cada pedacinho faria as fotos piscarem
  const barraEl = document.querySelector('#envio-' + p.n + ' .barra i');
  if (barraEl) barraEl.style.width = Math.round(valor * 100) + '%';
}

// ---------- fotos: o navegador redimensiona antes de enviar ----------

async function enviarFoto(file, base, p) {
  // createImageBitmap já gira a foto de celular conforme a orientação gravada nela
  const img = await createImageBitmap(file).catch(function () { return null; });
  if (!img) throw new Error('não consegui abrir esta foto. Envie em JPG.');

  const grande = await jpeg(img, FOTO_GRANDE, null, 0.85);
  const thumb = await jpeg(img, null, THUMB_LARGURA, 0.78);
  p.preview = URL.createObjectURL(thumb.blob);
  progresso(p, 0, 'Enviando foto…');

  const total = grande.blob.size + thumb.blob.size;
  await enviar('upload?key=' + encodeURIComponent(base + '-thumb.jpg'), thumb.blob);
  await enviar('upload?key=' + encodeURIComponent(base + '.jpg'), grande.blob, function (n) {
    progresso(p, (thumb.blob.size + n) / total);
  });

  return { tipo: 'foto', src: base + '.jpg', thumb: base + '-thumb.jpg', w: grande.w, h: grande.h };
}

// desenha a imagem (foto ou quadro de vídeo) num canvas e gera um JPG.
// ladoMax limita o lado maior; larguraMax limita só a largura. Nunca aumenta
function jpeg(fonte, ladoMax, larguraMax, qualidade) {
  const w0 = fonte.videoWidth || fonte.width;
  const h0 = fonte.videoHeight || fonte.height;
  const escala = Math.min(1, ladoMax ? ladoMax / Math.max(w0, h0) : larguraMax / w0);
  const w = Math.round(w0 * escala);
  const h = Math.round(h0 * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fonte, 0, 0, w, h);

  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (blob) resolve({ blob: blob, w: w, h: h });
      else reject(new Error('não consegui gerar a imagem.'));
    }, 'image/jpeg', qualidade);
  });
}

// ---------- vídeos: vão como vieram (sem perder qualidade) ----------

async function enviarVideo(file, base, p) {
  if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
    throw new Error('vídeo muito grande (' + Math.round(file.size / 1024 / 1024) + ' MB). Exporte em 1080p.');
  }
  if (await ehHevc(file)) {
    throw new Error('este vídeo está em HEVC, que não abre em todo navegador. Exporte em MP4 (H.264).');
  }

  const video = await abrirVideo(file);
  if (Math.max(video.videoWidth, video.videoHeight) > VIDEO_MAX) {
    throw new Error('vídeo em ' + video.videoWidth + '×' + video.videoHeight + '. Exporte em 1080p para não travar no celular.');
  }

  // capa: um quadro a 30% do vídeo (o começo costuma ser tela preta ou título)
  const inicio = Math.round(video.duration * 0.3 * 10) / 10;
  await irPara(video, inicio);
  const poster = await jpeg(video, FOTO_GRANDE, null, 0.85);
  const thumb = await jpeg(video, null, THUMB_LARGURA, 0.78);
  URL.revokeObjectURL(video.src);
  p.preview = URL.createObjectURL(thumb.blob);
  progresso(p, 0, 'Enviando vídeo…');

  const ext = (file.name.match(/\.(mp4|mov|m4v)$/i) || [, 'mp4'])[1].toLowerCase();
  const key = base + '.' + ext;
  await enviar('upload?key=' + encodeURIComponent(base + '-thumb.jpg'), thumb.blob);
  await enviar('upload?key=' + encodeURIComponent(base + '.jpg'), poster.blob);
  await enviarGrande(file, key, function (n) { progresso(p, n / file.size); });

  const s = Math.round(video.duration);
  return {
    tipo: 'video', src: key, poster: base + '.jpg', thumb: base + '-thumb.jpg',
    duracao: Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'),
    inicio: inicio, w: poster.w, h: poster.h
  };
}

// HEVC aparece como "hvc1" ou "hev1" na descrição do vídeo, que fica no começo
// (exportado para web) ou no fim do arquivo. Basta procurar essas letras
async function ehHevc(file) {
  const trecho = 4 * 1024 * 1024;
  const partes = [file.slice(0, trecho), file.slice(Math.max(0, file.size - trecho))];
  for (const parte of partes) {
    const texto = new TextDecoder('latin1').decode(await parte.arrayBuffer());
    if (texto.includes('hvc1') || texto.includes('hev1')) return true;
  }
  return false;
}

function abrirVideo(file) {
  return new Promise(function (resolve, reject) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    // loadedmetadata (e não loadeddata): o iPhone não carrega o vídeo antes de alguém dar play
    video.onloadedmetadata = function () { resolve(video); };
    video.onerror = function () { reject(new Error('este vídeo não abre no navegador. Exporte em MP4 (H.264).')); };
    video.src = URL.createObjectURL(file);
  });
}

function irPara(video, segundos) {
  return new Promise(function (resolve) {
    setTimeout(resolve, 8000); // se o navegador nunca avisar, segue com o quadro que tiver
    video.onseeked = function () {
      // espera o quadro estar de fato pronto para desenhar (no iPhone faz diferença)
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(function () { resolve(); });
      else setTimeout(resolve, 100);
    };
    video.currentTime = segundos;
  });
}

// arquivo grande vai em pedaços de 20 MB (a Cloudflare aceita até 100 MB por pedido)
async function enviarGrande(file, key, aoProgredir) {
  const k = 'upload?key=' + encodeURIComponent(key);
  if (file.size <= PEDACO) {
    await enviar(k, file, aoProgredir);
    return;
  }

  const { uploadId } = await api(k + '&acao=iniciar', { method: 'POST' });
  const k2 = k + '&uploadId=' + encodeURIComponent(uploadId);
  const partes = [];
  try {
    for (let n = 1, inicio = 0; inicio < file.size; n++, inicio += PEDACO) {
      const pedaco = file.slice(inicio, inicio + PEDACO);
      partes.push(await enviar(k2 + '&acao=parte&n=' + n, pedaco, function (x) { aoProgredir(inicio + x); }));
    }
    await api(k2 + '&acao=concluir', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(partes)
    });
  } catch (e) {
    api(k2 + '&acao=cancelar', { method: 'POST' }).catch(function () {});
    throw e;
  }
}

carregar();
