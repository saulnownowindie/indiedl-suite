#!/usr/bin/env bash
# Instalador de MusoSoup para Arch Linux (y otras distros).
# Uso:  ./instalar_arch.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="${PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/MusoSoup}"
PYTHON="${PYTHON:-python3}"

log() { printf '\n== %s\n' "$*"; }

command -v "$PYTHON" >/dev/null 2>&1 || {
  echo "No encontré $PYTHON. Instalá Python primero." >&2
  exit 1
}

log "Destino: $PREFIX"
mkdir -p "$PREFIX"

# ── Dependencias del sistema ────────────────────────────────────────────
if command -v pacman >/dev/null 2>&1; then
  log "Dependencias del sistema (pacman / Arch)"
  sudo pacman -S --needed --noconfirm \
    python python-pip tk xdg-utils fontconfig ttf-liberation ttf-dejavu \
    libreoffice-fresh || true
elif command -v dnf >/dev/null 2>&1; then
  log "Dependencias del sistema (dnf)"
  sudo dnf install -y python3 python3-pip python3-tkinter xdg-utils \
    fontconfig liberation-sans-fonts dejavu-sans-fonts libreoffice || true
elif command -v apt >/dev/null 2>&1; then
  log "Dependencias del sistema (apt)"
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3 python3-pip python3-tk python3-venv \
    xdg-utils fonts-liberation fonts-dejavu libreoffice || true
fi

if ! command -v soffice >/dev/null 2>&1; then
  echo "AVISO: LibreOffice no está instalado. La conversión de .doc no funcionará."
fi

# ── Copia de la app ─────────────────────────────────────────────────────
log "Copiando la aplicación"
cp -a "$REPO"/musosoup_diario.py "$REPO"/musosoup_ui.py "$PREFIX/"
cp -a "$REPO"/requirements.txt "$PREFIX/requirements.txt"

# ── Entorno virtual ─────────────────────────────────────────────────────
log "Entorno virtual"
if [ ! -x "$PREFIX/venv/bin/python" ]; then
  "$PYTHON" -m venv "$PREFIX/venv"
fi
"$PREFIX/venv/bin/python" -m pip install --quiet --upgrade pip
"$PREFIX/venv/bin/python" -m pip install --quiet -r "$PREFIX/requirements.txt"

# ── Acceso en el menú ───────────────────────────────────────────────────
log "Acceso en el menú"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$APPS"
cat > "$APPS/musosoup.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=Indie Now MusoSoup
Comment=Consolidador de lanzamientos del día
Exec=$PREFIX/venv/bin/python $PREFIX/musosoup_diario.py
Icon=text-x-generic
Terminal=false
Categories=Office;TextEditor;
EOD
update-desktop-database "$APPS" 2>/dev/null || true

cat <<EOF

Listo. MusoSoup quedó en:
  $PREFIX

Abrilo desde el menú ("Indie Now MusoSoup") o con:
  $PREFIX/venv/bin/python $PREFIX/musosoup_diario.py

También podés usar el repo directamente:
  ./ejecutar.sh

Desinstalar:
  rm -rf "$PREFIX" "$APPS/musosoup.desktop"
EOF
