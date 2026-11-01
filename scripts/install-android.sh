#!/usr/bin/env bash
# Install exactly the headless JADX engine pinned in REA's Android guide.
set -euo pipefail
command -v java >/dev/null && command -v javac >/dev/null || {
  echo "Un JDK complet 17+ (java et javac) est nécessaire. Exemple Ubuntu : sudo apt-get install openjdk-21-jdk"
  exit 1
}
command -v curl >/dev/null || { echo "curl requis"; exit 1; }
DIR="$HOME/.local/share/rea/android"
NAME="jadx-headless-mcp-0.7.1-all.jar"
SHA="6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75"
mkdir -p "$DIR"
check() {
  if command -v sha256sum >/dev/null; then
    printf '%s  %s\n' "$SHA" "$DIR/$NAME" | sha256sum -c --status
  else
    printf '%s  %s\n' "$SHA" "$DIR/$NAME" | shasum -a 256 -c >/dev/null
  fi
}
if [ -e "$DIR/$NAME" ]; then
  check || { echo "JAR existant différent du SHA attendu ; intervention nécessaire."; exit 1; }
else
  TMP="$(mktemp "$DIR/.jadx.XXXXXX")"
  trap 'rm -f "$TMP"' EXIT
  curl -fL --retry 2 --connect-timeout 10 --max-time 180 -o "$TMP" "https://github.com/1013503897/jadx-headless-mcp/releases/download/v0.7.1/$NAME"
  mv "$TMP" "$DIR/$NAME"
  check || { rm -f "$DIR/$NAME"; echo "La vérification SHA256 du JAR a échoué."; exit 1; }
  trap - EXIT
fi
echo "JADX vérifié : $DIR/$NAME"
echo "REA_JADX_MCP_JAR est détecté automatiquement par le serveur REA × Jev."
