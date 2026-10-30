#!/bin/sh
# Monta a pasta dist/ que vai para a Cloudflare Pages: o site sem a pasta midia/
# (fotos e vídeos ficam no R2; a Pages aceita no máximo 25 MB por arquivo).
#
# Como usar (na pasta do projeto):
#   sh scripts/build.sh
set -e
cd "$(dirname "$0")/.."

rm -rf dist
mkdir dist
cp -R index.html trabalhos.json css js img dist/
