#!/usr/bin/env bash
# Desinstala Indie Now DL (CachyOS/Arch).
set -euo pipefail

PREFIX="${PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/IndieDL}"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"

echo "Se va a borrar:"
echo "  $PREFIX"
echo "  $APPS/indiedl.desktop"
echo "  $BIN/indiedl"
echo
read -r -p "¿Confirmás? [s/N] " resp
if [ "${resp:-N}" != "s" ] && [ "${resp:-N}" != "S" ]; then
  echo "Cancelado."
  exit 0
fi

rm -rf "$PREFIX"
rm -f "$APPS/indiedl.desktop" "$BIN/indiedl"
update-desktop-database "$APPS" 2>/dev/null || true
echo "Listo. También podés quitar la extensión desde chrome://extensions."
