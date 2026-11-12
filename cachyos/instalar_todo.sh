#!/usr/bin/env bash
# Instala la suite completa de Indie Now en CachyOS / Arch Linux.
# Uso:  ./instalar_todo.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================================"
echo "  INDIE NOW SUITE - instalación para CachyOS / Arch"
echo "============================================================"
echo
echo "  1. Descargador  (Indie Now DL)"
echo "  2. Subtítulos   (DaVinci Resolve)"
echo "  3. MusoSoup     (guiones)"
echo

"$HERE/descargador/instalar.sh"
"$HERE/subs/instalar.sh"
"$HERE/musosoup/instalar.sh"

echo
echo "============================================================"
echo "  Listo: las tres herramientas están instaladas."
echo "============================================================"
