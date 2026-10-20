# bycoast

Site de portfólio e pedido de orçamento da bycoast (foto, vídeo, edição e postagem).
HTML, CSS e JavaScript puros, sem build. Mesma estrutura do rtrgb.github.io.

## Rodar no VS Code

1. Abra a pasta no VS Code.
2. Instale a extensão **Live Server** (Ritwick Dey).
3. Clique com o botão direito no `index.html` e escolha **Open with Live Server**.

Abrir o `index.html` direto (file://) não funciona, porque o navegador bloqueia o `fetch('photos.json')`.

## Estrutura

```
index.html      estrutura da página
css/style.css   visual (cores e fontes nas variáveis do topo)
js/main.js      galeria, filtros, lightbox, formulário → WhatsApp
photos.json     lista de fotos e vídeos da galeria
img/            placeholders (trocar pelas fotos reais)
```

## Adicionar uma foto

Inclua um item no `photos.json`:

```json
{ "url": "https://res.cloudinary.com/.../foto.jpg", "alt": "Descrição", "category": "nautica", "type": "foto", "local": "Itajaí" }
```

- `category`: `oficina`, `nautica` ou `eventos` (o botão de filtro some se a categoria estiver vazia)
- `type`: `foto` ou `video`
- vídeo: preencha `video` com o link do .mp4 e `duracao` (ex. `"0:38"`). `url` vira a capa.

## Configurar

- Número do WhatsApp: constante `WHATSAPP` no topo do `js/main.js` (só dígitos, com 55 e DDD).
- Instagram: link no footer do `index.html`.

## Próximos passos

- [ ] Trocar placeholders por fotos reais (Cloudinary, como no rtrgb.github.io)
- [x] Número do WhatsApp
- [x] @ do Instagram (by.coast_)
- [ ] Publicar no GitHub Pages
- [ ] Painel para o dono subir fotos sem mexer no código
