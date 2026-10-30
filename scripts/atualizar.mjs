// ========================
// ATUALIZAR TRABALHOS
// Pega as fotos e vídeos de originais/, gera versões leves em midia/
// e atualiza o trabalhos.json.
//
// Como usar (no terminal, na pasta do projeto):
//   node scripts/atualizar.mjs
//
// originais/
//   Reforma lancha 26 pés/     ← uma pasta por trabalho (o nome vira o título)
//     IMG_1234.HEIC
//     IMG_1240.MOV
//
// Fotos usam o "sips", que já vem no Mac.
// Vídeos precisam do ffmpeg:  brew install ffmpeg
// ========================

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGINAIS = join(ROOT, 'originais');
const MIDIA = join(ROOT, 'midia');
const JSON_PATH = join(ROOT, 'trabalhos.json');

const FOTOS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tif', '.tiff'];
const VIDEOS = ['.mp4', '.mov', '.m4v'];

const FOTO_GRANDE = 2000; // lado maior da foto no lightbox
const THUMB_LARGURA = 800;  // largura da miniatura e da prévia na galeria.
                            // Um card tem ~380px; telas Retina mostram o dobro de pixels
const VIDEO_MAX = 1920;   // lado maior do vídeo
const PREVIA_SEG = 4;     // duração da prévia, em segundos
const AVISO_MB = 50;      // o GitHub reclama de arquivos acima de 50 MB (e recusa acima de 100)

// ---------- utilitários ----------

// "Reforma lancha 26 pés" → "reforma-lancha-26-pes"
function slug(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

function temComando(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// precisa (re)gerar? só se o arquivo final não existe ou o original é mais novo
function desatualizado(origem, destino) {
  return !existsSync(destino) || statSync(origem).mtimeMs > statSync(destino).mtimeMs;
}

function mb(arquivo) {
  return statSync(arquivo).size / 1024 / 1024;
}

// caminho que vai no JSON (sempre com /, relativo à raiz do site)
function rel(arquivo) {
  return arquivo.slice(ROOT.length + 1).split('\\').join('/');
}

// ---------- fotos (sips, do próprio Mac) ----------

function medidas(arquivo) {
  const out = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'orientation', arquivo]);
  const w = Number(/pixelWidth: (\d+)/.exec(out)[1]);
  const h = Number(/pixelHeight: (\d+)/.exec(out)[1]);
  const orient = Number((/orientation: (\d+)/.exec(out) || [])[1] || 1);
  // fotos de celular "deitadas" com marcação de giro (5 a 8): o navegador gira, então troca w/h
  return orient >= 5 ? { w: h, h: w } : { w, h };
}

// gera um JPG com o lado maior limitado (nunca aumenta foto pequena)
function jpg(origem, destino, lado, qualidade) {
  if (!desatualizado(origem, destino)) return;
  const { w, h } = medidas(origem);
  run('sips', [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', String(qualidade),
    '-Z', String(Math.min(lado, Math.max(w, h))),
    origem, '--out', destino
  ]);
}

// miniatura: limita a LARGURA (é ela que importa no card), pra vertical não ficar borrada
function thumbJpg(origem, destino) {
  if (!desatualizado(origem, destino)) return;
  const { w, h } = medidas(origem);
  const lado = Math.round(Math.min(THUMB_LARGURA, w) * Math.max(w, h) / w);
  jpg(origem, destino, lado, 78);
}

function processarFoto(origem, pasta, nome) {
  const grande = join(pasta, nome + '.jpg');
  const thumb = join(pasta, nome + '-thumb.jpg');
  jpg(origem, grande, FOTO_GRANDE, 82);
  thumbJpg(origem, thumb);
  const { w, h } = medidas(grande);
  return { tipo: 'foto', src: rel(grande), thumb: rel(thumb), w, h };
}

// ---------- vídeos (ffmpeg) ----------

// limita o lado maior sem distorcer e mantém medidas pares (exigência do H.264)
function escala(lado) {
  return "scale='if(gt(iw,ih),min(" + lado + ",iw),-2)':'if(gt(iw,ih),-2,min(" + lado + ",ih))'";
}

// limita só a largura (usado na prévia da galeria)
function escalaLargura(largura) {
  return "scale='min(" + largura + ",iw)':-2";
}

function segundos(arquivo) {
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arquivo]));
}

function duracao(arquivo) {
  const s = Math.round(segundos(arquivo));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// inicio = segundo de onde saem a capa e a prévia.
// Sem "inicio" no JSON: 30% do vídeo (o começo costuma ser tela preta, título ou fade)
function processarVideo(origem, pasta, nome, inicioJson) {
  const video = join(pasta, nome + '.mp4');
  const previa = join(pasta, nome + '-previa.mp4');
  const poster = join(pasta, nome + '.jpg');
  const thumb = join(pasta, nome + '-thumb.jpg');

  // anota o "inicio" usado; se mudar no JSON, refaz capa e prévia
  const inicio = typeof inicioJson === 'number' ? inicioJson : Math.round(segundos(origem) * 0.3);
  const marca = join(pasta, nome + '.inicio');
  const mudou = !existsSync(marca) || readFileSync(marca, 'utf8') !== String(inicio);

  // vídeo principal: H.264 + AAC, começa a tocar antes de baixar tudo (+faststart).
  // No máximo 3 Mbps: até um vídeo de 2 min fica abaixo dos 50 MB do GitHub
  if (desatualizado(origem, video)) {
    run('ffmpeg', ['-y', '-v', 'error', '-i', origem, '-vf', escala(VIDEO_MAX),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-maxrate', '3M', '-bufsize', '6M', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', video]);
  }

  // prévia da galeria: curta, pequena e sem som
  if (mudou || desatualizado(origem, previa)) {
    run('ffmpeg', ['-y', '-v', 'error', '-ss', String(inicio), '-i', origem, '-t', String(PREVIA_SEG), '-vf', escalaLargura(THUMB_LARGURA),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-an',
      '-movflags', '+faststart', previa]);
  }

  // capa: um quadro do mesmo ponto da prévia
  if (mudou || desatualizado(origem, poster)) {
    run('ffmpeg', ['-y', '-v', 'error', '-ss', String(inicio), '-i', origem, '-frames:v', '1', '-update', '1',
      '-vf', escala(FOTO_GRANDE), '-q:v', '3', poster]);
  }
  if (mudou) rmSync(thumb, { force: true });
  thumbJpg(poster, thumb);
  writeFileSync(marca, String(inicio));

  const { w, h } = medidas(poster);
  return {
    tipo: 'video', src: rel(video), poster: rel(poster), thumb: rel(thumb), previa: rel(previa),
    duracao: duracao(video), inicio, w, h
  };
}

// ---------- trabalhos.json ----------

// mesmo formato do arquivo: campos do trabalho um por linha, cada mídia numa linha só
function formatar(works) {
  const campos = ['id', 'titulo', 'categoria', 'local', 'cliente'];
  const blocos = works.map(function (work) {
    const linhas = campos.map(function (k) { return '    "' + k + '": ' + JSON.stringify(work[k] ?? '') + ','; });
    const extras = Object.keys(work).filter(function (k) { return !campos.includes(k) && k !== 'midias'; });
    extras.forEach(function (k) { linhas.push('    "' + k + '": ' + JSON.stringify(work[k]) + ','); });
    const midias = work.midias.map(function (m) {
      const pares = Object.keys(m).map(function (k) { return JSON.stringify(k) + ': ' + JSON.stringify(m[k]); });
      return '      {' + pares.join(', ') + '}';
    }).join(',\n');
    return '  {\n' + linhas.join('\n') + '\n    "midias": [\n' + midias + '\n    ]\n  }';
  });
  return '[\n' + blocos.join(',\n') + '\n]\n';
}

// ---------- principal ----------

if (!existsSync(ORIGINAIS)) {
  mkdirSync(ORIGINAIS);
  console.log('Criei a pasta originais/. Coloque uma pasta por trabalho dentro dela e rode de novo.');
  process.exit(0);
}

const ffmpeg = temComando('ffmpeg') && temComando('ffprobe');
const works = existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, 'utf8')) : [];
const novos = [];
const avisos = [];

const pastas = readdirSync(ORIGINAIS, { withFileTypes: true })
  .filter(function (d) { return d.isDirectory() && !d.name.startsWith('.'); })
  .map(function (d) { return d.name; })
  .sort(function (a, b) { return a.localeCompare(b, 'pt', { numeric: true }); });

for (const pastaNome of pastas) {
  const id = slug(pastaNome);
  const origemPasta = join(ORIGINAIS, pastaNome);
  const destinoPasta = join(MIDIA, id);
  mkdirSync(destinoPasta, { recursive: true });

  let work = works.find(function (w) { return w.id === id; });
  if (!work) {
    // trabalho novo: entra no começo da lista (mais recente primeiro)
    work = { id, titulo: pastaNome, categoria: '', local: '', cliente: '', midias: [] };
    works.unshift(work);
    novos.push(id);
  }

  const arquivos = readdirSync(origemPasta)
    .filter(function (f) { return !f.startsWith('.'); })
    .sort(function (a, b) { return a.localeCompare(b, 'pt', { numeric: true }); });

  console.log('\n' + pastaNome + ' → midia/' + id + '/');

  for (const arquivo of arquivos) {
    const ext = extname(arquivo).toLowerCase();
    const origem = join(origemPasta, arquivo);
    const nome = slug(basename(arquivo, extname(arquivo)));
    let midia = null;
    const antes = work.midias.find(function (m) { return m.src === rel(join(destinoPasta, nome + (FOTOS.includes(ext) ? '.jpg' : '.mp4'))); });

    try {
      if (FOTOS.includes(ext)) {
        midia = processarFoto(origem, destinoPasta, nome);
      } else if (VIDEOS.includes(ext)) {
        if (!ffmpeg) {
          avisos.push('Pulei ' + pastaNome + '/' + arquivo + ': vídeos precisam do ffmpeg (brew install ffmpeg).');
          continue;
        }
        midia = processarVideo(origem, destinoPasta, nome, antes && antes.inicio);
      } else {
        continue; // outros arquivos são ignorados
      }
    } catch (erro) {
      avisos.push('Erro em ' + pastaNome + '/' + arquivo + ': ' + (erro.stderr || erro.message).toString().trim());
      continue;
    }

    // já existe no JSON? atualiza os dados técnicos e mantém a posição. Senão, entra no fim
    const i = work.midias.findIndex(function (m) { return m.src === midia.src; });
    if (i >= 0) work.midias[i] = Object.assign({}, work.midias[i], midia);
    else work.midias.push(midia);

    ['src', 'previa'].forEach(function (k) {
      if (midia[k] && mb(join(ROOT, midia[k])) > AVISO_MB) {
        avisos.push(midia[k] + ' tem ' + mb(join(ROOT, midia[k])).toFixed(0) + ' MB. Pesado demais pro GitHub: corte o vídeo ou use o Cloudinary.');
      }
    });
    console.log('  ✓ ' + arquivo + ' (' + midia.tipo + ', ' + midia.w + '×' + midia.h + (midia.duracao ? ', ' + midia.duracao : '') + ')');
  }
}

// trabalhos sem nenhuma mídia (ex.: pasta vazia) não entram no site
const finais = works.filter(function (w) { return w.midias.length; });
writeFileSync(JSON_PATH, formatar(finais));

// ---------- resumo ----------

console.log('\ntrabalhos.json atualizado: ' + finais.length + ' trabalhos.');

const incompletos = finais.filter(function (w) { return !w.categoria || !w.local; });
if (incompletos.length) {
  console.log('\nFalta preencher no trabalhos.json (categoria: automotivo, nautica, eventos, gastronomia ou negocios):');
  incompletos.forEach(function (w) {
    const falta = [!w.categoria && 'categoria', !w.local && 'local'].filter(Boolean).join(' e ');
    console.log('  - ' + w.id + ': ' + falta);
  });
}

if (novos.length) console.log('\nNovos: ' + novos.join(', ') + '. Confira o título e a ordem das mídias (a primeira é a capa).');
if (avisos.length) console.log('\nAvisos:\n  - ' + avisos.join('\n  - '));
