#!/bin/sh
# Publica o código do site e do painel na Cloudflare (bycoast.com.br).
# Fotos, vídeos e a lista de trabalhos NÃO passam por aqui: isso é pelo painel.
#
# Como usar (na pasta do projeto):
#   sh scripts/publicar.sh
set -e
cd "$(dirname "$0")/.."

sh scripts/build.sh
npx wrangler@4.156.0 pages deploy --branch main
