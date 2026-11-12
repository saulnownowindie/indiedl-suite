#!/usr/bin/env bash
# Desinstala la suite completa de Indie Now (CachyOS/Arch).
set -euo pipefail

DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
APPS="$DATA/applications"
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"

echo "Se van a borrar:"
echo "  $DATA/IndieDL"
echo "  $DATA/Subs-Now"
echo "  $DATA/MusoSoup"
echo "  $APPS/indiedl.desktop  $APPS/indiesub.desktop  $APPS/musosoup.desktop"
echo "  $BIN/indiedl  $BIN/subs-now  $BIN/musosoup"
echo
echo "Ojo: también se borran las configuraciones y cachés de las tres apps."
read -r -p "¿Confirmás? [s/N] " resp
if [ "${resp:-N}" != "s" ] && [ "${resp:-N}" != "S" ]; then
  echo "Cancelado."
  exit 0
fi

rm -rf "$DATA/IndieDL" "$DATA/Subs-Now" "$DATA/MusoSoup"
rm -f "$APPS/indiedl.desktop" "$APPS/indiesub.desktop" "$APPS/musosoup.desktop"
rm -f "$BIN/indiedl" "$BIN/subs-now" "$BIN/musosoup"
update-desktop-database "$APPS" 2>/dev/null || true
echo "Listo. La extensión del navegador se quita desde chrome://extensions."
