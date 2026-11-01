#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
PIN="3104d0d23d9081e5eea68840e0470ebcbcd6517f"
echo "== REA × Jev : préparation =="
command -v git >/dev/null || { echo "Git est requis."; exit 1; }
command -v node >/dev/null || { echo "Node.js est requis (>= 22.23.4)."; exit 1; }
node -e 'const [a,b,c]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&(b<23||(b===23&&c<4))))){console.error("Node trop ancien pour REA actuel :",process.versions.node);process.exit(1)}'
command -v npm >/dev/null || { echo "npm est requis."; exit 1; }
if [ ! -e vendor/rea-jev/.claude-plugin/plugin.json ]; then
  mkdir -p vendor
  if [ -e vendor/rea-jev ]; then echo "vendor/rea-jev existe mais est incomplet."; exit 1; fi
  git clone --no-checkout --depth 1 https://github.com/juan-viox/rea-jev.git vendor/rea-jev
  git -C vendor/rea-jev fetch --depth 1 origin "$PIN"
  git -C vendor/rea-jev checkout --detach "$PIN"
fi
ACTUAL="$(git -C vendor/rea-jev rev-parse HEAD)"
[ "$ACTUAL" = "$PIN" ] || { echo "Version REA–Jev non conforme au pin : $ACTUAL"; exit 1; }
echo "Plugin REA–Jev installé : $ACTUAL"
if command -v claude >/dev/null; then
  claude --version
else
  echo "Claude Code introuvable. Installation recommandée : npm install -g @anthropic-ai/claude-code"
  echo "L'authentification Claude Code reste nécessaire et peut être payante."
fi
if command -v java >/dev/null && command -v javac >/dev/null; then
  if ! bash scripts/install-android.sh; then
    echo "Installation du moteur APK impossible ; les autres formats restent disponibles."
  fi
else
  echo "Installer un JDK complet 17+ pour les APK, puis lancer : bash scripts/install-android.sh"
fi
echo "Analyse native profonde : installer Ghidra 12.1.x et définir GHIDRA_INSTALL_DIR."
echo "Au premier démarrage de l'agent, REA 6.5.0 sera installé via le mécanisme npx du plugin."
echo "Démarrage : npm start"
