#!/usr/bin/env bash
# Desinstala MusoSoup (CachyOS/Arch).
set -euo pipefail

PREFIX="${PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/MusoSoup}"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"

echo "Se va a borrar:"
echo "  $PREFIX"
echo "  $APPS/musosoup.desktop"
echo "  $BIN/musosoup"
echo
read -r -p "¿Confirmás? [s/N] " resp
if [ "${resp:-N}" != "s" ] && [ "${resp:-N}" != "S" ]; then
  echo "Cancelado."
  exit 0
fi

rm -rf "$PREFIX"
rm -f "$APPS/musosoup.desktop" "$BIN/musosoup"
update-desktop-database "$APPS" 2>/dev/null || true
echo "Listo."
