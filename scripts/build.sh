#!/bin/sh
# Monta a pasta dist/ que vai para a Cloudflare Pages: o site, o painel e a página /feedback, sem a pasta midia/
# e sem o trabalhos.json (os dois ficam no R2, onde o painel consegue mexer).
#
# Como usar (na pasta do projeto):
#   sh scripts/build.sh
set -e
cd "$(dirname "$0")/.."

rm -rf dist
mkdir dist
cp -R index.html css js img painel feedback dist/
