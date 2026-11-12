#!/usr/bin/env bash
# Arranque diario de MusoSoup en Linux.
# Usa el venv instalado por instalar_arch.sh; si no existe, cae al python3 del sistema.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="${PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/MusoSoup}"

if [ -x "$PREFIX/venv/bin/python" ]; then
  exec "$PREFIX/venv/bin/python" "$PREFIX/musosoup_diario.py"
fi

exec python3 "$REPO/musosoup_diario.py"
