// ========================
// CONFIGURAÇÃO
// Número do WhatsApp só com dígitos e DDI, ex.: '5547999999999'
// Vazio = o WhatsApp abre e o cliente escolhe o contato
// ========================
const WHATSAPP = '5547992019065';

// ========================
// CARREGAR FOTOS DO JSON
// ========================
fetch('photos.json')
  .then(function (res) { return res.json(); })
  .then(function (photos) {
    renderGrid(photos);
    initFilters();
    initLightbox(photos);
  })
  .catch(function () {
    document.querySelector('.grid').innerHTML =
      '<p class="note">Não consegui carregar o photos.json. Abra com o Live Server, não direto pelo arquivo.</p>';
  });

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
// LIGHTBOX
// ========================
function initLightbox(photos) {
  const lightbox = document.getElementById('lightbox');
  const media = document.getElementById('lightbox-media');
  const counter = document.getElementById('lightbox-counter');
  const title = document.getElementById('lightbox-title');
  const local = document.getElementById('lightbox-local');

  let visible = [];   // índices das fotos visíveis no filtro atual
  let current = 0;

  function show(pos) {
    current = (pos + visible.length) % visible.length;
    const photo = photos[visible[current]];

    // vídeo com arquivo: mostra o player. Senão, mostra a imagem
    if (photo.type === 'video' && photo.video) {
      media.innerHTML = '<video src="' + photo.video + '" poster="' + photo.url + '" controls playsinline></video>';
    } else {
      media.innerHTML = '<img src="' + photo.url + '" alt="' + photo.alt + '" />';
    }

    counter.textContent = (current + 1) + ' / ' + visible.length;
    title.textContent = photo.alt;
    local.textContent = photo.local;
  }

  function open(index) {
    visible = Array.from(document.querySelectorAll('.photo-item:not(.hidden)'))
      .map(function (item) { return Number(item.dataset.index); });
    show(visible.indexOf(index));
    lightbox.classList.add('active');
    document.body.classList.add('no-scroll'); // trava a página de trás
  }

  function close() {
    lightbox.classList.remove('active');
    document.body.classList.remove('no-scroll');
    media.innerHTML = ''; // para o vídeo ao fechar
  }

  document.querySelector('.grid').addEventListener('click', function (e) {
    const item = e.target.closest('.photo-item');
    if (item) open(Number(item.dataset.index));
  });

  document.getElementById('lightbox-prev').addEventListener('click', function (e) {
    e.stopPropagation();
    show(current - 1);
  });

  document.getElementById('lightbox-next').addEventListener('click', function (e) {
    e.stopPropagation();
    show(current + 1);
  });

  document.getElementById('lightbox-close').addEventListener('click', close);

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  // swipe no celular
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });

  lightbox.addEventListener('touchend', function (e) {
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) < 50) return;
    show(delta < 0 ? current + 1 : current - 1);
  }, { passive: true });
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
