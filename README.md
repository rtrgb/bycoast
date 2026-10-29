# bycoast

Site de portfólio e pedido de orçamento da bycoast (foto, vídeo, edição e postagem).
HTML, CSS e JavaScript puros, sem build. Mesma estrutura do rtrgb.github.io.

No ar em: https://rtrgb.github.io/bycoast/

## Rodar no VS Code

1. Abra a pasta no VS Code.
2. Instale a extensão **Live Server** (Ritwick Dey).
3. Clique com o botão direito no `index.html` e escolha **Open with Live Server**.

Abrir o `index.html` direto (file://) não funciona, porque o navegador bloqueia o `fetch('trabalhos.json')`.

## Estrutura

```
index.html              estrutura da página
css/style.css           visual (cores e fontes nas variáveis do topo)
js/main.js              intro, galeria, filtros, lightbox, formulário → WhatsApp
trabalhos.json          lista de trabalhos (cada um com suas fotos e vídeos)
midia/                  fotos e vídeos otimizados (gerados pelo script)
scripts/atualizar.mjs   transforma os originais em versões leves pro site
originais/              arquivos brutos do Drive (NÃO vai pro GitHub)
```

## Adicionar trabalhos novos

### Uma vez só: preparar o Mac

```sh
brew install ffmpeg      # pra processar vídeos (fotos já funcionam sem nada)
```

### Toda vez que chegar material novo

1. **Baixe do Drive** e coloque em `originais/`, **uma pasta por trabalho**.
   O nome da pasta vira o título (dá pra mudar depois).

   ```
   originais/
     Reforma lancha 26 pés/
       IMG_1234.HEIC
       IMG_1240.MOV
     Retífica motor V8/
       ...
   ```

2. **Rode o script** no terminal do VS Code:

   ```sh
   node scripts/atualizar.mjs
   ```

   Ele gera as versões leves em `midia/` e coloca o trabalho no `trabalhos.json`.
   Arquivos que já foram processados não são refeitos, então pode rodar quantas vezes quiser.

3. **Complete o `trabalhos.json`** (o script avisa o que falta):

   ```json
   {
     "id": "reforma-lancha-26-pes",
     "titulo": "Reforma de lancha 26 pés",
     "categoria": "nautica",
     "local": "Itajaí",
     "cliente": "Marina Tal",
     "midias": [ ... ]
   }
   ```

   - `categoria`: `oficina`, `nautica` ou `eventos`
   - `cliente`: opcional. Os nomes preenchidos aparecem na seção "Quem já atendeu"
   - `midias`: **a primeira é a capa** do card. Pra trocar a capa, mova a linha pra cima
   - **A ordem dos trabalhos no arquivo é a ordem na galeria** (o script coloca os novos no topo)

4. **Confira** no Live Server.

5. **Publique**:

   ```sh
   git add .
   git commit -m "Adiciona trabalho: Reforma de lancha 26 pés"
   git push
   ```

   Em 1 ou 2 minutos o site no ar atualiza.

### Tirar um trabalho ou uma mídia

Apague o bloco (ou a linha) no `trabalhos.json`. Se quiser, apague também a pasta em `midia/`.

### Vídeos

- O ideal é vídeo curto (até uns 60s). O script comprime e avisa se ainda ficar acima de 50 MB.
- Pra cada vídeo ele gera: o vídeo, uma **prévia de 4s sem som** (toca na galeria), a **capa** e a miniatura.
- A duração (`"duracao": "0:21"`) é preenchida sozinha.

## Configurar

No topo do `js/main.js`:

- `WHATSAPP`: número só com dígitos, com 55 e DDD.
- `HERO_VIDEO`: vídeo do fundo do topo (ex.: `'midia/hero.mp4'`). Curto, sem som, em loop. Vazio = topo só com texto.
- `CATEGORIAS`: nome que aparece no site para cada categoria.

Instagram: link no footer do `index.html`.

## Próximos passos

- [x] Número do WhatsApp
- [x] @ do Instagram (by.coast_)
- [x] Publicar no GitHub Pages
- [x] Organizar por trabalho + script de atualização
- [ ] Trocar os exemplos (picsum) pelos trabalhos reais
- [ ] Vídeo do topo (HERO_VIDEO)
- [ ] Foto real na prévia do link (og:image no index.html)
- [ ] Painel para o dono subir fotos sem mexer no código
