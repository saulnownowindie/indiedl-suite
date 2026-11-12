#!/usr/bin/env bash
# Desinstala Indie Now Subtítulos (CachyOS/Arch).
set -euo pipefail

PREFIX="${PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/Subs-Now}"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"

echo "Se va a borrar:"
echo "  $PREFIX"
echo "  $APPS/indiesub.desktop"
echo "  $BIN/subs-now"
echo
read -r -p "¿Confirmás? [s/N] " resp
if [ "${resp:-N}" != "s" ] && [ "${resp:-N}" != "S" ]; then
  echo "Cancelado."
  exit 0
fi

rm -rf "$PREFIX"
rm -f "$APPS/indiesub.desktop" "$BIN/subs-now"
update-desktop-database "$APPS" 2>/dev/null || true
echo "Listo."
