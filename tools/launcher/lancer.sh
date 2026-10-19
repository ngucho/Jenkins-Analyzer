#!/bin/sh
# Lance Jenkins Analyzer (macOS / Linux) et ouvre le navigateur.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js est introuvable (version 20.19+ requise)."; exit 1; }
exec node serve.mjs --open
