# Como atualizar o site

O site fica em **https://bycoast.com.br**, hospedado na Cloudflare.
São duas coisas separadas:

| O quê | Onde | Quem |
|---|---|---|
| Trabalhos, fotos e vídeos | **bycoast.com.br/painel** | o dono do site, pelo celular |
| Código (visual, textos, funções) | esta pasta + `sh scripts/publicar.sh` | quem programa |

## Conteúdo: pelo painel

1. Abra **bycoast.com.br/painel** e entre com o e-mail (chega um código).
2. Crie um trabalho, ou toque num existente para editar.
3. **+ Adicionar** envia fotos e vídeos. A primeira mídia é a **capa**; as setas mudam a ordem.
4. Aperte **Publicar**. O site atualiza na hora.

Nada muda no site antes de apertar **Publicar**. Apagar uma mídia ou um trabalho e publicar apaga os arquivos de vez.

### Vídeos

- Exporte em **1080p, MP4 (H.264)**, o padrão do CapCut e do Premiere. O vídeo vai como veio, sem perder qualidade.
- O painel recusa 4K e HEVC (alguns navegadores não tocam) e explica como exportar.
- A capa do vídeo sai de 30% da duração (o começo costuma ser tela preta ou título).

### Quem pode entrar

O login é do **Cloudflare Access**: Zero Trust → Access → Applications → *Painel bycoast* → policy `email-login`.
Para liberar outra pessoa, coloque o e-mail dela nessa policy.

## Código: nesta pasta

### Testar no VS Code

1. Instale a extensão **Live Server** (Ritwick Dey).
2. Clique com o botão direito no `index.html` → **Open with Live Server**.

No computador, a lista de trabalhos e as fotos vêm do site no ar (bycoast.com.br), então o que aparece é o conteúdo real.
O painel só funciona no site no ar.

### Publicar

```sh
git add .
git commit -m "O que mudou"
git push                  # guarda no GitHub (backup e histórico)
sh scripts/publicar.sh    # coloca no ar na Cloudflare
```

Mexeu no CSS ou no JS? Troque o número `?v=` nos links do `index.html` (ou do `painel/index.html`),
senão o celular pode juntar o HTML novo com o CSS antigo que ficou guardado.

### Estrutura

```
index.html                  estrutura da página
css/style.css               visual (cores e fontes nas variáveis do topo)
js/main.js                  intro, galeria, filtros, lightbox, compartilhar, formulário → WhatsApp
painel/                     tela do painel
functions/                  servidor na Cloudflare:
  midia/[[path]].js           entrega fotos e vídeos do R2
  trabalhos.json.js           entrega a lista de trabalhos do R2
  api/                        o que o painel usa (login, salvar, enviar arquivos)
wrangler.toml               configuração da Cloudflare (R2 e login)
scripts/build.sh            monta a pasta dist/ que vai para a Cloudflare
scripts/publicar.sh         build + publicar
```

Fotos, vídeos e o `trabalhos.json` ficam no **R2** (Cloudflare → R2 → `bycoast-midia`), não no GitHub.

### Configurar

No topo do `js/main.js`:

- `WHATSAPP`: número só com dígitos, com 55 e DDD.
- `HERO_VIDEO`: vídeo do fundo do topo (ex.: `'midia/hero.mp4'`). Curto, sem som, em loop. Vazio = topo só com texto.
- `CATEGORIAS`: categorias e o nome que aparece no site. Os filtros saem daqui, na mesma ordem.
  Ao mudar, mude também em `painel/painel.js` e `functions/_lib/trabalhos.js`.

Instagram: link no footer do `index.html`.

## Próximos passos

- [ ] Vídeo do topo (HERO_VIDEO)
- [ ] `www.bycoast.com.br` → `bycoast.com.br` (Cloudflare → Rules → Redirect Rules → modelo "Redirect from WWW to root")
- [ ] Publicar sozinho a cada `git push` (ligar a Cloudflare Pages ao GitHub)
