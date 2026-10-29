// ========================
// CONFIGURAÇÃO
// Número do WhatsApp só com dígitos e DDI, ex.: '5547999999999'
// Vazio = o WhatsApp abre e o cliente escolhe o contato
// ========================
const WHATSAPP = '5547992019065';

// ========================
// CARREGAR FOTOS DO JSON
// ========================
const siteReady = fetch('photos.json')
  .then(function (res) { return res.json(); })
  .then(function (photos) {
    renderGrid(photos);
    initFilters();
    initLightbox(photos);
    return waitImages(3);
  })
  .catch(function () {
    document.querySelector('.grid').innerHTML =
      '<p class="note">Não consegui carregar o photos.json. Abra com o Live Server, não direto pelo arquivo.</p>';
  });

runIntro(siteReady);

// espera as primeiras fotos da galeria carregarem (ou darem erro)
function waitImages(count) {
  const imgs = Array.from(document.querySelectorAll('.photo-item img')).slice(0, count);
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
  setTimeout(function () { pronto = true; }, 5000); // segurança: nunca prende mais que 5s

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

function renderGrid(photos) {
  const grid = document.querySelector('.grid');

  grid.innerHTML = photos.map(function (photo, i) {
    const tag = photo.type === 'video' ? '<span class="tag">&#9654; ' + (photo.duracao || 'vídeo') + '</span>' : '';
    return (
      '<div class="photo-item" data-index="' + i + '" data-category="' + photo.category + '">' +
      '<img src="' + photo.url + '" alt="' + photo.alt + '" loading="lazy" />' +
      tag +
      '</div>'
    );
  }).join('');
}

// ========================
// FILTROS
// ========================
function initFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  const items = document.querySelectorAll('.photo-item');

  // esconde o botão de categorias que ainda não têm foto
  const categories = new Set(Array.from(items).map(function (item) { return item.dataset.category; }));

  buttons.forEach(function (btn) {
    const filter = btn.dataset.filter;
    if (filter !== 'todos' && !categories.has(filter)) btn.hidden = true;

    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      items.forEach(function (item) {
        const show = filter === 'todos' || item.dataset.category === filter;
        item.classList.toggle('hidden', !show);
      });
    });
  });
}

// ========================
// LIGHTBOX (foto ampliada)
// ========================

// respeita quem ligou "reduzir movimento" no sistema
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// true = tem mouse, false = só toque (celular)
const canHover = window.matchMedia('(hover: hover)').matches;

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const CATEGORIAS = { oficina: 'Oficina', nautica: 'Náutica', eventos: 'Eventos' };

// anima com a Web Animations API e devolve uma promessa que resolve no fim
// fill 'forwards' segura o último quadro (usado quando o elemento vai sumir)
function animate(el, frames, options) {
  return el.animate(frames, {
    duration: reduceMotion ? 0 : options.duration,
    delay: reduceMotion ? 0 : (options.delay || 0),
    easing: EASE,
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

function initLightbox(photos) {
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
  const closeBtn = document.getElementById('lightbox-close');
  const grid = document.querySelector('.grid');

  let visible = [];               // índices das fotos visíveis no filtro atual
  let current = 0;                // posição dentro de "visible"
  let el = null;                  // <img> ou <video> que está na tela
  let renderId = 0;               // evita que trocas rápidas se atropelem
  let zoom = { s: 1, x: 0, y: 0 }; // escala e deslocamento da foto ampliada
  let dragX = 0;                  // quanto a foto foi arrastada pro lado
  let idleTimer = null;

  // item da galeria que corresponde a uma posição
  function itemOf(pos) {
    return grid.querySelector('.photo-item[data-index="' + visible[pos] + '"]');
  }

  // ---------- conteúdo ----------

  // vídeo com arquivo: mostra o player. Senão, mostra a imagem
  function render(photo) {
    if (photo.type === 'video' && photo.video) {
      media.innerHTML = '<video src="' + photo.video + '" poster="' + photo.url + '" controls playsinline></video>';
    } else {
      media.innerHTML = '<img src="' + photo.url + '" alt="' + photo.alt + '" draggable="false" />';
    }
    el = media.firstElementChild;
    zoom = { s: 1, x: 0, y: 0 };
    dragX = 0;
    lightbox.classList.remove('zoomed');
  }

  // espera a foto carregar, pra saber o tamanho final dela na tela
  function ready(element) {
    if (element.tagName === 'IMG') return element.decode().catch(function () {});
    return new Promise(function (resolve) {
      element.addEventListener('loadedmetadata', resolve, { once: true });
      setTimeout(resolve, 300);
    });
  }

  function updateInfo(photo) {
    counter.innerHTML = '<b>' + pad(current + 1) + '</b> / ' + pad(visible.length);
    category.textContent = CATEGORIAS[photo.category] || photo.category;
    local.textContent = photo.local || '';
    localWrap.hidden = !photo.local;
    type.textContent = '▶ ' + (photo.duracao || 'vídeo');
    type.hidden = photo.type !== 'video';
    title.textContent = photo.alt;

    // categoria/local e título entram subindo, um depois do outro
    const from = { opacity: 0, transform: 'translateY(8px)' };
    const to = { opacity: 1, transform: 'none' };
    animate(meta, [from, to], { duration: 450, delay: 80 });
    animate(title, [from, to], { duration: 450, delay: 160 });
  }

  // fundo: uma camada nova com a foto desfocada aparece por cima da anterior
  function setAmbient(photo) {
    const layer = document.createElement('div');
    layer.className = 'ambient-layer';
    layer.style.backgroundImage = 'url("' + photo.url + '")';
    ambient.appendChild(layer);
    animate(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: 600 }).then(function () {
      if (!layer.isConnected) return;
      // remove as camadas antigas que ficaram embaixo
      while (ambient.firstElementChild !== layer) ambient.firstElementChild.remove();
    });
  }

  function buildThumbs() {
    thumbs.innerHTML = visible.map(function (index, pos) {
      const photo = photos[index];
      return (
        '<button class="thumb" data-pos="' + pos + '" aria-label="' + photo.alt + '">' +
        '<img src="' + photo.url + '" alt="" draggable="false" />' +
        '</button>'
      );
    }).join('');
  }

  // marca a miniatura atual, esconde a original na galeria e pré-carrega as vizinhas
  function sync() {
    Array.from(thumbs.children).forEach(function (thumb, pos) {
      thumb.classList.toggle('current', pos === current);
    });
    thumbs.children[current].scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth'
    });

    // a miniatura na galeria fica vazia: é dali que a foto sai e pra onde volta
    grid.querySelectorAll('.is-source').forEach(function (item) { item.classList.remove('is-source'); });
    itemOf(current).classList.add('is-source');

    // pré-carrega a anterior e a próxima, pra troca não ter espera
    [current - 1, current + 1].forEach(function (pos) {
      const photo = photos[visible[(pos + visible.length) % visible.length]];
      new Image().src = photo.url;
    });
  }

  // ---------- abrir, trocar, fechar ----------

  function open(index) {
    visible = Array.from(grid.querySelectorAll('.photo-item:not(.hidden)'))
      .map(function (item) { return Number(item.dataset.index); });
    current = visible.indexOf(index);
    const photo = photos[index];
    const from = itemOf(current).querySelector('img').getBoundingClientRect();

    lightbox.classList.add('active');
    lightbox.classList.toggle('single', visible.length < 2);
    document.body.classList.add('no-scroll'); // trava a página de trás
    buildThumbs();
    render(photo);
    updateInfo(photo);
    setAmbient(photo);
    sync();
    wake();
    lightbox.focus({ preventScroll: true }); // teclado (Esc, setas) já funciona

    // força o navegador a desenhar o estado "fechado" antes, pra transição do CSS acontecer
    void lightbox.offsetWidth;
    lightbox.classList.add('open');

    // a foto cresce do lugar da miniatura até o centro
    const element = el;
    element.style.opacity = '0';
    ready(element).then(function () {
      if (element !== el) return;
      element.style.opacity = '';
      const to = element.getBoundingClientRect();
      animate(element, [{ transform: rectTransform(to, from) }, { transform: 'none' }], { duration: 500 });
    });
  }

  // troca de foto. dir: 1 = próxima (entra pela direita), -1 = anterior
  function show(pos, dir) {
    pos = (pos + visible.length) % visible.length;
    if (pos === current) return;
    current = pos;
    const photo = photos[visible[current]];
    const id = ++renderId;
    const old = el;
    el = null;

    updateInfo(photo);
    setAmbient(photo);
    sync();

    // a foto atual sai pro lado...
    const leave = old ? animate(old, [
      { transform: old.style.transform || 'none', opacity: 1 },
      { transform: 'translateX(' + (dragX - dir * 100) + 'px)', opacity: 0 }
    ], { duration: 180, fill: 'forwards' }) : Promise.resolve();

    leave.then(function () {
      if (id !== renderId) return; // já trocou de novo no meio do caminho
      // ...e a nova entra pelo outro
      render(photo);
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

    const item = itemOf(current);
    const target = item.querySelector('img').getBoundingClientRect();
    const onScreen = target.bottom > 0 && target.top < window.innerHeight;
    let done = Promise.resolve();

    if (el && onScreen) {
      // a foto volta pro lugar da miniatura, saindo de onde estiver (arrastada ou com zoom)
      const now = el.getBoundingClientRect();
      el.classList.remove('zoom-anim');
      el.style.transform = '';
      const base = el.getBoundingClientRect();
      done = animate(el, [
        { transform: rectTransform(base, now) },
        { transform: rectTransform(base, target) }
      ], { duration: 420, fill: 'forwards' });
    } else if (el) {
      done = animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
    }

    done.then(function () {
      lightbox.classList.remove('active');
      document.body.classList.remove('no-scroll');
      media.innerHTML = ''; // para o vídeo ao fechar
      ambient.innerHTML = '';
      el = null;
      item.classList.remove('is-source');
    });
  }

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

    if (gesture.axis === 'x' && visible.length > 1) {
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
    if (!cancelled && g.axis === 'x' && Math.abs(dx) > 60 && visible.length > 1) {
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
    const item = e.target.closest('.photo-item');
    if (item && !lightbox.classList.contains('active')) open(Number(item.dataset.index));
  });

  document.getElementById('lightbox-prev').addEventListener('click', function () {
    show(current - 1, -1);
  });

  document.getElementById('lightbox-next').addEventListener('click', function () {
    show(current + 1, 1);
  });

  closeBtn.addEventListener('click', close);

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

// link do WhatsApp no footer abre a conversa direto
document.getElementById('footer-whatsapp').href = 'https://wa.me/' + WHATSAPP;

// ========================
// NAVEGAÇÃO ao rolar
// ========================
const nav = document.getElementById('nav');
window.addEventListener('scroll', function () {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });
