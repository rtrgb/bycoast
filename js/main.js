// ========================
// CONFIGURAÇÃO
// ========================

// Número do WhatsApp só com dígitos e DDI, ex.: '5547999999999'
// Vazio = o WhatsApp abre e o cliente escolhe o contato
const WHATSAPP = '5547992019065';

// Vídeo que roda no fundo do topo (curto, sem som, em loop). Ex.: 'midia/hero.mp4'
// Vazio = topo só com texto
const HERO_VIDEO = '';

// categorias do trabalhos.json e o nome que aparece no site (a ordem aqui é a ordem dos filtros)
const CATEGORIAS = {
  automotivo: 'Automotivo',
  nautica: 'Náutica',
  eventos: 'Eventos',
  gastronomia: 'Gastronomia',
  negocios: 'Negócios'
};

// ========================
// UTILITÁRIOS
// ========================

// respeita quem ligou "reduzir movimento" no sistema
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// true = tem mouse, false = só toque (celular)
const canHover = window.matchMedia('(hover: hover)').matches;

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// anima com a Web Animations API e devolve uma promessa que resolve no fim
// fill 'forwards' segura o último quadro (usado quando o elemento vai sumir)
function animate(el, frames, options) {
  return el.animate(frames, {
    duration: reduceMotion ? 0 : options.duration,
    delay: reduceMotion ? 0 : (options.delay || 0),
    easing: options.easing || EASE,
    fill: options.fill || 'backwards'
  }).finished.catch(function () {});
}

// transform que faz a caixa "de" aparecer em cima da caixa "para"
// (funciona porque a foto usa transform-origin no canto 0 0)
function rectTransform(de, para) {
  return 'translate(' + (para.left - de.left) + 'px, ' + (para.top - de.top) + 'px) ' +
    'scale(' + (para.width / de.width) + ', ' + (para.height / de.height) + ')';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

// protege textos do JSON antes de colocar no HTML (ex.: um título com aspas ou &)
function esc(text) {
  return String(text || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// "3 fotos · 1 vídeo"
function contagem(midias) {
  const fotos = midias.filter(function (m) { return m.tipo !== 'video'; }).length;
  const videos = midias.length - fotos;
  const partes = [];
  if (fotos) partes.push(fotos + (fotos === 1 ? ' foto' : ' fotos'));
  if (videos) partes.push(videos + (videos === 1 ? ' vídeo' : ' vídeos'));
  return partes.join(' · ');
}

// ========================
// CARREGAR TRABALHOS DO JSON
// ========================
const heroVideoReady = initHeroVideo();

const siteReady = fetch('trabalhos.json')
  .then(function (res) { return res.json(); })
  .then(function (works) {
    renderGrid(works);
    initFilters();
    initReveal();
    initPreviews();
    initClients(works);
    initLightbox(works);
    return Promise.all([waitImages(1), heroVideoReady]);
  })
  .catch(function () {
    document.querySelector('.grid').innerHTML =
      '<p class="note">Não consegui carregar o trabalhos.json. Abra com o Live Server, não direto pelo arquivo.</p>';
  });

runIntro(siteReady);

// espera as primeiras fotos da galeria carregarem (ou darem erro)
function waitImages(count) {
  const imgs = Array.from(document.querySelectorAll('.work-media img')).slice(0, count);
  return Promise.all(imgs.map(function (img) {
    if (img.complete) return null;
    return new Promise(function (resolve) {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
}

// ========================
// INTRO (tela de entrada)
// O nome aparece, a linha cresce, o contador sobe
// e, com o site pronto, a tela sobe como uma cortina
// ========================
function runIntro(ready) {
  const html = document.documentElement;
  if (!html.classList.contains('intro')) return;

  const intro = document.getElementById('intro');
  const pct = document.getElementById('intro-pct');
  let p = 0;
  let pronto = false;

  document.body.classList.add('no-scroll');

  // pronto = site carregado E a linha terminou de crescer (1,8s)
  const minimo = new Promise(function (resolve) { setTimeout(resolve, 1800); });
  Promise.all([ready, minimo]).then(function () { pronto = true; });
  setTimeout(function () { pronto = true; }, 3000); // segurança: nunca prende mais que 3s

  // o contador sobe aos saltos e espera no 90 até o site estar pronto
  const timer = setInterval(function () {
    p = Math.min(pronto ? 100 : 90, p + Math.random() * 18);
    pct.textContent = pad(Math.round(p));
    if (p >= 100) {
      clearInterval(timer);
      setTimeout(sair, 300);
    }
  }, 90);

  function sair() {
    intro.classList.add('gone');   // cortina sobe
    html.classList.add('revealed'); // topo do site entra
    document.body.classList.remove('no-scroll');
    setTimeout(function () { intro.remove(); }, 1200);
  }
}

// ========================
// VÍDEO NO TOPO
// ========================
function initHeroVideo() {
  if (!HERO_VIDEO) return Promise.resolve();

  const hero = document.querySelector('.hero');
  const video = document.createElement('video');
  video.className = 'hero-video';
  video.src = HERO_VIDEO;
  video.muted = true;       // sem som, senão o navegador não deixa tocar sozinho
  video.loop = true;
  video.playsInline = true;
  video.autoplay = !reduceMotion;
  video.setAttribute('aria-hidden', 'true');
  hero.prepend(video);
  hero.classList.add('has-video');

  // a intro espera o primeiro quadro do vídeo
  return new Promise(function (resolve) {
    video.addEventListener('loadeddata', resolve, { once: true });
    video.addEventListener('error', resolve, { once: true });
  });
}

// ========================
// GALERIA (um card por trabalho)
// ========================
function renderGrid(works) {
  const grid = document.querySelector('.grid');

  grid.innerHTML = works.map(function (work, i) {
    const capa = work.midias[0];
    const meta = [CATEGORIAS[work.categoria] || work.categoria, work.local].filter(Boolean).join(' · ');

    // selo no canto: quantas mídias tem; se for um vídeo só, a duração dele
    let tag = '';
    if (work.midias.length > 1) tag = contagem(work.midias);
    else if (capa.tipo === 'video') tag = '&#9654; ' + esc(capa.duracao || 'vídeo');

    // capa em vídeo: a prévia curta toca por cima da imagem
    const previa = capa.tipo === 'video' && capa.previa
      ? '<video class="work-preview" src="' + esc(capa.previa) + '" muted loop playsinline preload="none"></video>'
      : '';

    return (
      '<article class="work" data-index="' + i + '" data-category="' + esc(work.categoria) + '">' +
      '<div class="work-media">' +
      '<img src="' + esc(capa.thumb) + '" alt="' + esc(work.titulo) + '" loading="lazy"' +
      (capa.w ? ' width="' + capa.w + '" height="' + capa.h + '"' : '') + ' />' +
      previa +
      (tag ? '<span class="tag">' + tag + '</span>' : '') +
      '</div>' +
      '<div class="work-caption">' +
      '<h3>' + esc(work.titulo) + '</h3>' +
      '<p>' + esc(meta) + '</p>' +
      '</div>' +
      '</article>'
    );
  }).join('');
}

// ========================
// FILTROS (os cards se reorganizam deslizando)
// ========================
function initFilters() {
  const items = Array.from(document.querySelectorAll('.work'));
  let filterId = 0;

  // um botão pra cada categoria que tem pelo menos um trabalho
  const usadas = new Set(items.map(function (item) { return item.dataset.category; }));
  document.querySelector('.filters').insertAdjacentHTML('beforeend',
    Object.keys(CATEGORIAS).filter(function (cat) { return usadas.has(cat); }).map(function (cat) {
      return '<button class="filter-btn" data-filter="' + cat + '">' + CATEGORIAS[cat] + '</button>';
    }).join(''));

  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(function (btn) {
    const filter = btn.dataset.filter;

    btn.addEventListener('click', function () {
      if (btn.classList.contains('active')) return;
      buttons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      applyFilter(filter);
    });
  });

  function applyFilter(filter) {
    const id = ++filterId;
    const fits = function (item) { return filter === 'todos' || item.dataset.category === filter; };
    const leaving = items.filter(function (item) { return !item.classList.contains('hidden') && !fits(item); });

    // 1. os que saem somem rápido
    Promise.all(leaving.map(function (item) {
      return animate(item, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 200, fill: 'forwards' });
    })).then(function () {
      if (id !== filterId) return; // clicou em outro filtro no meio

      // 2. guarda onde cada card estava (técnica FLIP: First, Last, Invert, Play)
      const before = new Map();
      items.forEach(function (item) {
        if (!item.classList.contains('hidden')) before.set(item, item.getBoundingClientRect());
      });

      items.forEach(function (item) {
        item.getAnimations().forEach(function (a) { a.cancel(); });
        item.classList.toggle('hidden', !fits(item));
        item.classList.add('in'); // já aparece, sem esperar o efeito de rolagem
      });

      // 3. quem ficou desliza da posição antiga até a nova; quem chegou aparece
      let entrada = 0;
      items.forEach(function (item) {
        if (item.classList.contains('hidden')) return;
        const old = before.get(item);
        if (old) {
          const now = item.getBoundingClientRect();
          animate(item, [
            { transform: 'translate(' + (old.left - now.left) + 'px, ' + (old.top - now.top) + 'px)' },
            { transform: 'none' }
          ], { duration: 600 });
        } else {
          animate(item, [
            { opacity: 0, transform: 'translateY(24px) scale(0.96)' },
            { opacity: 1, transform: 'none' }
          ], { duration: 600, delay: 80 * entrada++ });
        }
      });
    });
  }
}

// ========================
// CARDS APARECEM AO ROLAR
// ========================
function initReveal() {
  const items = document.querySelectorAll('.work');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(function (item) { item.classList.add('in'); });
    return;
  }

  const observer = new IntersectionObserver(function (entries) {
    // os que entram juntos aparecem um logo depois do outro
    let ordem = 0;
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.style.transitionDelay = (ordem++ * 90) + 'ms';
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  items.forEach(function (item) {
    item.classList.add('reveal');
    observer.observe(item);
  });
}

// ========================
// PRÉVIA DOS VÍDEOS NA GALERIA
// Computador: toca com o mouse em cima. Celular: toca quando aparece na tela
// ========================
function initPreviews() {
  const videos = document.querySelectorAll('.work-preview');
  if (!videos.length || reduceMotion) return;

  function play(video) {
    video.play().then(function () { video.classList.add('playing'); }).catch(function () {});
  }

  function stop(video) {
    video.pause();
    video.classList.remove('playing');
  }

  if (canHover) {
    videos.forEach(function (video) {
      const card = video.closest('.work');
      card.addEventListener('mouseenter', function () { play(video); });
      card.addEventListener('mouseleave', function () {
        stop(video);
        video.currentTime = 0;
      });
    });
    return;
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) play(entry.target);
      else stop(entry.target);
    });
  }, { threshold: 0.6 });

  videos.forEach(function (video) { observer.observe(video); });
}

// ========================
// QUEM JÁ ATENDEU (vem do campo "cliente" de cada trabalho)
// ========================
function initClients(works) {
  const names = Array.from(new Set(works.map(function (work) { return (work.cliente || '').trim(); })))
    .filter(Boolean);
  if (!names.length) return; // sem clientes preenchidos, a seção fica escondida

  const list = names.map(function (name) { return '<li>' + esc(name) + '</li>'; }).join('');
  // a lista aparece duas vezes: quando a primeira sai pela esquerda, a segunda já está no lugar
  document.getElementById('clients-track').innerHTML =
    '<ul>' + list + '</ul><ul aria-hidden="true">' + list + '</ul>';
  document.getElementById('clientes').hidden = false;
}

// ========================
// LIGHTBOX (mídias de um trabalho)
// ========================
function initLightbox(works) {
  const lightbox = document.getElementById('lightbox');
  const ambient = document.getElementById('lightbox-ambient');
  const stage = document.getElementById('lightbox-stage');
  const media = document.getElementById('lightbox-media');
  const counter = document.getElementById('lightbox-counter');
  const meta = document.getElementById('lightbox-meta');
  const category = document.getElementById('lightbox-category');
  const localWrap = document.getElementById('lightbox-local-wrap');
  const local = document.getElementById('lightbox-local');
  const type = document.getElementById('lightbox-type');
  const title = document.getElementById('lightbox-title');
  const thumbs = document.getElementById('lightbox-thumbs');
  const grid = document.querySelector('.grid');

  let work = null;                // trabalho aberto
  let card = null;                // card dele na galeria
  let list = [];                  // mídias do trabalho aberto
  let current = 0;                // posição dentro de "list"
  let el = null;                  // <img> ou <video> que está na tela
  let renderId = 0;               // evita que trocas rápidas se atropelem
  let zoom = { s: 1, x: 0, y: 0 }; // escala e deslocamento da foto ampliada
  let dragX = 0;                  // quanto a foto foi arrastada pro lado
  let idleTimer = null;

  function cover() {
    return card.querySelector('.work-media img');
  }

  // ---------- conteúdo ----------

  // mostra a mídia. Foto: aparece a miniatura (já carregada) e troca pela grande quando ela chegar
  function render(m) {
    if (m.tipo === 'video') {
      media.innerHTML = '<video src="' + esc(m.src) + '" poster="' + esc(m.poster || m.thumb) + '" controls playsinline autoplay></video>';
    } else {
      media.innerHTML = '<img src="' + esc(m.thumb || m.src) + '" alt="' + esc(work.titulo) + '" draggable="false" />';
      if (m.thumb && m.src !== m.thumb) {
        const target = media.firstElementChild;
        const full = new Image();
        full.onload = function () { if (target.isConnected) target.src = m.src; };
        full.src = m.src;
      }
    }
    el = media.firstElementChild;
    fit(m);
    zoom = { s: 1, x: 0, y: 0 };
    dragX = 0;
    lightbox.classList.remove('zoomed');
  }

  // calcula o tamanho na tela a partir de w/h do JSON, sem esperar a mídia carregar
  function fit(m) {
    if (!m.w || !m.h) return; // sem medidas: o CSS (max-width/max-height) resolve
    const s = Math.min(media.clientWidth / m.w, media.clientHeight / m.h);
    el.style.width = Math.round(m.w * s) + 'px';
    el.style.height = Math.round(m.h * s) + 'px';
  }

  // categoria, local e título do trabalho (entram subindo, um depois do outro)
  function updateWorkInfo() {
    category.textContent = CATEGORIAS[work.categoria] || work.categoria;
    local.textContent = work.local || '';
    localWrap.hidden = !work.local;
    title.textContent = work.titulo;

    const from = { opacity: 0, transform: 'translateY(8px)' };
    const to = { opacity: 1, transform: 'none' };
    animate(meta, [from, to], { duration: 450, delay: 80 });
    animate(title, [from, to], { duration: 450, delay: 160 });
  }

  // contador e selo de vídeo mudam a cada mídia
  function updateMediaInfo() {
    const m = list[current];
    counter.innerHTML = '<b>' + pad(current + 1) + '</b> / ' + pad(list.length);
    type.textContent = '▶ ' + (m.duracao || 'vídeo');
    type.hidden = m.tipo !== 'video';
  }

  // fundo: uma camada nova com a mídia desfocada aparece por cima da anterior
  function setAmbient(m) {
    const layer = document.createElement('div');
    layer.className = 'ambient-layer';
    layer.style.backgroundImage = 'url("' + (m.thumb || m.poster || m.src) + '")';
    ambient.appendChild(layer);
    animate(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: 600 }).then(function () {
      if (!layer.isConnected) return;
      // remove as camadas antigas que ficaram embaixo
      while (ambient.firstElementChild !== layer) ambient.firstElementChild.remove();
    });
  }

  function buildThumbs() {
    thumbs.innerHTML = list.map(function (m, pos) {
      return (
        '<button class="thumb' + (m.tipo === 'video' ? ' is-video' : '') + '" data-pos="' + pos + '" ' +
        'aria-label="' + (m.tipo === 'video' ? 'Vídeo ' : 'Foto ') + (pos + 1) + '">' +
        '<img src="' + esc(m.thumb || m.poster) + '" alt="" draggable="false" />' +
        '</button>'
      );
    }).join('');
  }

  // marca a miniatura atual e pré-carrega as fotos vizinhas
  function sync() {
    Array.from(thumbs.children).forEach(function (thumb, pos) {
      thumb.classList.toggle('current', pos === current);
    });
    thumbs.children[current].scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth'
    });

    [current - 1, current + 1].forEach(function (pos) {
      const m = list[(pos + list.length) % list.length];
      if (m.tipo !== 'video') new Image().src = m.src;
    });
  }

  // ---------- abrir, trocar, fechar ----------

  function open(index) {
    work = works[index];
    card = grid.querySelector('.work[data-index="' + index + '"]');
    list = work.midias;
    current = 0;
    const from = cover().getBoundingClientRect();

    lightbox.classList.add('active');
    lightbox.classList.toggle('single', list.length < 2);
    document.body.classList.add('no-scroll'); // trava a página de trás
    card.classList.add('is-source');          // a capa fica vazia: é dali que a foto sai
    buildThumbs();
    render(list[0]);
    updateWorkInfo();
    updateMediaInfo();
    setAmbient(list[0]);
    sync();
    wake();
    lightbox.focus({ preventScroll: true }); // teclado (Esc, setas) já funciona

    // força o navegador a desenhar o estado "fechado" antes, pra transição do CSS acontecer
    void lightbox.offsetWidth;
    lightbox.classList.add('open');

    // a capa cresce do lugar dela na galeria até o centro
    const to = el.getBoundingClientRect();
    animate(el, [{ transform: rectTransform(to, from) }, { transform: 'none' }], { duration: 500 });
  }

  // troca de mídia. dir: 1 = próxima (entra pela direita), -1 = anterior
  function show(pos, dir) {
    pos = (pos + list.length) % list.length;
    if (pos === current) return;
    current = pos;
    const m = list[current];
    const id = ++renderId;
    const old = el;
    el = null;

    updateMediaInfo();
    setAmbient(m);
    sync();

    // a mídia atual sai pro lado...
    const leave = old ? animate(old, [
      { transform: old.style.transform || 'none', opacity: 1 },
      { transform: 'translateX(' + (dragX - dir * 100) + 'px)', opacity: 0 }
    ], { duration: 180, fill: 'forwards' }) : Promise.resolve();

    leave.then(function () {
      if (id !== renderId) return; // já trocou de novo no meio do caminho
      // ...e a nova entra pelo outro
      render(m);
      animate(el, [
        { transform: 'translateX(' + (dir * 100) + 'px)', opacity: 0 },
        { transform: 'none', opacity: 1 }
      ], { duration: 320 });
    });
  }

  function close() {
    if (!lightbox.classList.contains('open')) return;
    renderId++; // cancela trocas que ainda iam acontecer
    clearTimeout(idleTimer);
    lightbox.classList.remove('open', 'idle', 'zoomed');
    ambient.style.opacity = '';

    const source = card;
    const target = cover().getBoundingClientRect();
    const onScreen = target.bottom > 0 && target.top < window.innerHeight;
    let done = Promise.resolve();

    if (el && onScreen && current === 0) {
      // a capa volta pro lugar dela, saindo de onde estiver (arrastada ou com zoom)
      const now = el.getBoundingClientRect();
      el.classList.remove('zoom-anim');
      el.style.transform = '';
      const base = el.getBoundingClientRect();
      done = animate(el, [
        { transform: rectTransform(base, now) },
        { transform: rectTransform(base, target) }
      ], { duration: 420, fill: 'forwards' });
    } else if (el) {
      // outra mídia (formato diferente da capa): só some
      done = animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
    }

    done.then(function () {
      lightbox.classList.remove('active');
      document.body.classList.remove('no-scroll');
      media.innerHTML = ''; // para o vídeo ao fechar
      ambient.innerHTML = '';
      el = null;
      source.classList.remove('is-source');
    });
  }

  // girou o celular ou mudou o tamanho da janela: recalcula o tamanho da mídia
  window.addEventListener('resize', function () {
    if (!el || !lightbox.classList.contains('open')) return;
    setZoom(1, 0, 0);
    fit(list[current]);
  });

  // ---------- controles que somem ----------

  // mostra os controles e, no computador, esconde de novo depois de 2s parado
  function wake(keepAwake) {
    lightbox.classList.remove('idle');
    clearTimeout(idleTimer);
    if (canHover && !keepAwake) {
      idleTimer = setTimeout(function () { lightbox.classList.add('idle'); }, 2000);
    }
  }

  lightbox.addEventListener('pointermove', function (e) {
    // com o mouse em cima de um botão, os controles não somem
    if (e.pointerType === 'mouse') wake(e.target.closest('button') !== null);
  });

  // ---------- zoom ----------

  // aplica escala e deslocamento, sem deixar a foto sair da própria moldura
  function setZoom(s, x, y, smooth) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    zoom = { s: s, x: clamp(x, w - s * w, 0), y: clamp(y, h - s * h, 0) };
    el.classList.toggle('zoom-anim', Boolean(smooth));
    el.style.transform = s === 1 ? '' : 'translate(' + zoom.x + 'px, ' + zoom.y + 'px) scale(' + s + ')';
    lightbox.classList.toggle('zoomed', s > 1);
  }

  // canto superior esquerdo da foto sem zoom, em coordenadas da tela
  function origin() {
    const rect = el.getBoundingClientRect();
    return { left: rect.left - zoom.x, top: rect.top - zoom.y };
  }

  // duplo clique: amplia 2,5x mantendo parado o ponto clicado. De novo: volta
  function toggleZoom(px, py) {
    if (el.tagName !== 'IMG') return;
    if (zoom.s > 1) return setZoom(1, 0, 0, true);
    const o = origin();
    const s = 2.5;
    setZoom(s, (px - o.left) * (1 - s), (py - o.top) * (1 - s), true);
  }

  // ---------- gestos (mouse e toque juntos, via Pointer Events) ----------

  const pointers = new Map(); // dedos (ou o mouse) encostados no palco
  let gesture = null;
  let lastTap = 0;

  function pinchPoints() {
    const p = Array.from(pointers.values());
    return {
      dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
      x: (p[0].x + p[1].x) / 2,
      y: (p[0].y + p[1].y) / 2
    };
  }

  function startGesture(x, y) {
    gesture = { x: x, y: y, zx: zoom.x, zy: zoom.y, axis: null, moved: false };
  }

  stage.addEventListener('pointerdown', function (e) {
    // no vídeo, deixa os controles do player funcionarem
    if (!el || e.button !== 0 || e.target.tagName === 'VIDEO') return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && el.tagName === 'IMG') {
      // segundo dedo: começa a pinça
      dragX = 0;
      ambient.style.opacity = '';
      setZoom(zoom.s, zoom.x, zoom.y);
      const p = pinchPoints();
      const o = origin();
      gesture = { pinch: true, dist: p.dist, cx: p.x, cy: p.y, s0: zoom.s, x0: zoom.x, y0: zoom.y, left: o.left, top: o.top };
    } else if (pointers.size === 1) {
      startGesture(e.clientX, e.clientY);
    }
  });

  stage.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId) || !gesture || !el) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesture.pinch) {
      if (pointers.size < 2) return;
      // o ponto que estava entre os dedos continua entre os dedos
      const p = pinchPoints();
      const s = clamp(gesture.s0 * p.dist / gesture.dist, 1, 4);
      const ux = (gesture.cx - gesture.left - gesture.x0) / gesture.s0;
      const uy = (gesture.cy - gesture.top - gesture.y0) / gesture.s0;
      setZoom(s, p.x - gesture.left - s * ux, p.y - gesture.top - s * uy);
      return;
    }

    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 8) return;
    gesture.moved = true;

    // com zoom: arrastar move a foto ampliada
    if (zoom.s > 1) {
      setZoom(zoom.s, gesture.zx + dx, gesture.zy + dy);
      return;
    }

    // sem zoom: decide no começo se o arraste é pro lado ou pra baixo
    if (!gesture.axis) gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';

    if (gesture.axis === 'x' && list.length > 1) {
      dragX = dx;
      el.style.transform = 'translateX(' + dx + 'px)';
    } else if (gesture.axis === 'y') {
      // arrastar pra baixo fecha: o fundo vai sumindo junto
      const down = Math.max(dy, 0);
      el.style.transform = 'translateY(' + down + 'px)';
      ambient.style.transition = 'none';
      ambient.style.opacity = 1 - Math.min(down / 400, 0.7);
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (!gesture || !el) return;

    if (gesture.pinch) {
      // tirou um dedo: o que ficou continua arrastando
      const rest = Array.from(pointers.values())[0];
      if (rest) {
        startGesture(rest.x, rest.y);
        gesture.moved = true;
      } else {
        gesture = null;
      }
      if (zoom.s < 1.1) setZoom(1, 0, 0, true);
      return;
    }

    const g = gesture;
    gesture = null;
    const cancelled = e.type === 'pointercancel';
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;

    if (!g.moved && !cancelled) return tap(e);
    if (zoom.s > 1) return;

    ambient.style.transition = '';
    if (!cancelled && g.axis === 'x' && Math.abs(dx) > 60 && list.length > 1) {
      const dir = dx < 0 ? 1 : -1;
      show(current + dir, dir);
    } else if (!cancelled && g.axis === 'y' && dy > 100) {
      close();
    } else {
      // não arrastou o suficiente: volta pro lugar
      ambient.style.opacity = '';
      const from = el.style.transform || 'none';
      el.style.transform = '';
      dragX = 0;
      animate(el, [{ transform: from }, { transform: 'none' }], { duration: 250 });
    }
  }

  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  // toque/clique simples: fora da foto fecha, dois seguidos na foto dão zoom
  function tap(e) {
    const rect = el.getBoundingClientRect();
    const onPhoto = e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!onPhoto) return close();

    const now = Date.now();
    if (now - lastTap < 300) {
      toggleZoom(e.clientX, e.clientY);
      lastTap = 0;
    } else {
      lastTap = now;
    }
  }

  // ---------- botões e teclado ----------

  grid.addEventListener('click', function (e) {
    const item = e.target.closest('.work');
    if (item && !lightbox.classList.contains('active')) open(Number(item.dataset.index));
  });

  document.getElementById('lightbox-prev').addEventListener('click', function () {
    show(current - 1, -1);
  });

  document.getElementById('lightbox-next').addEventListener('click', function () {
    show(current + 1, 1);
  });

  document.getElementById('lightbox-close').addEventListener('click', close);

  thumbs.addEventListener('click', function (e) {
    const thumb = e.target.closest('.thumb');
    if (!thumb) return;
    const pos = Number(thumb.dataset.pos);
    show(pos, pos > current ? 1 : -1);
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    wake();
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(current - 1, -1);
    if (e.key === 'ArrowRight') show(current + 1, 1);
  });
}

// ========================
// ORÇAMENTO → WHATSAPP
// ========================
const form = document.getElementById('form');
const formError = document.getElementById('form-error');

function value(id) {
  return document.getElementById(id).value.trim();
}

form.addEventListener('submit', function (e) {
  e.preventDefault();
  formError.textContent = '';

  if (!value('nome')) {
    formError.textContent = 'Coloque seu nome para eu saber com quem estou falando.';
    document.getElementById('nome').focus();
    return;
  }

  // data vem como 2026-11-05, vira 05/11/2026
  const data = value('data') ? value('data').split('-').reverse().join('/') : 'a combinar';

  const texto =
    'Olá! Vim pelo site da bycoast.\n\n' +
    'Nome: ' + value('nome') + '\n' +
    'Serviço: ' + value('servico') + '\n' +
    'Cidade: ' + value('cidade') + '\n' +
    'Data: ' + data + '\n\n' +
    value('msg');

  const url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(texto);
  window.open(url, '_blank', 'noopener');
});

// links que abrem a conversa direto (footer e botão flutuante)
const waLink = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Olá! Vim pelo site da bycoast.');
document.getElementById('footer-whatsapp').href = waLink;
document.getElementById('wa-float').href = waLink;

// ========================
// AO ROLAR: fundo do menu e botão do WhatsApp
// ========================
const nav = document.getElementById('nav');
const waFloat = document.getElementById('wa-float');
const hero = document.querySelector('.hero');
const orcamento = document.getElementById('orcamento');

function onScroll() {
  nav.classList.toggle('scrolled', window.scrollY > 40);

  // o botão aparece depois do topo e some quando o formulário de orçamento está na tela
  const passouTopo = hero.getBoundingClientRect().bottom < 0;
  const noFormulario = orcamento.getBoundingClientRect().top < window.innerHeight * 0.8;
  waFloat.classList.toggle('visible', passouTopo && !noFormulario);
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
