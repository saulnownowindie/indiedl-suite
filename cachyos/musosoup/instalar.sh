#!/usr/bin/env bash
# Instalador de MusoSoup para CachyOS / Arch Linux.
# Uso:  ./instalar.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUITE="$(cd "$HERE/../.." && pwd)"
PREFIX="${PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/MusoSoup}"
PYTHON="${PYTHON:-python3}"

log() { printf '\n== %s\n' "$*"; }

command -v "$PYTHON" >/dev/null 2>&1 || {
  echo "No encontré $PYTHON. Instalá Python primero." >&2
  exit 1
}

log "Destino: $PREFIX"
mkdir -p "$PREFIX"

# ── 1. Dependencias del sistema ─────────────────────────────
if command -v pacman >/dev/null 2>&1; then
  log "Dependencias del sistema (pacman / CachyOS)"
  sudo pacman -S --needed --noconfirm python tk xdg-utils \
    desktop-file-utils \
    fontconfig ttf-liberation ttf-dejavu noto-fonts || true
  # LibreOffice solo hace falta para convertir .doc antiguos
  sudo pacman -S --needed --noconfirm libreoffice-fresh || true
elif command -v dnf >/dev/null 2>&1; then
  log "Dependencias del sistema (dnf)"
  sudo dnf install -y python3 python3-pip python3-tkinter xdg-utils \
    desktop-file-utils \
    fontconfig liberation-sans-fonts dejavu-sans-fonts libreoffice || true
elif command -v apt >/dev/null 2>&1; then
  log "Dependencias del sistema (apt)"
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3 python3-pip python3-tk python3-venv \
    xdg-utils desktop-file-utils \
    fonts-liberation fonts-dejavu libreoffice || true
else
  log "No detecté pacman/dnf/apt. Asegurate de tener Python, Tk y LibreOffice."
fi

# ── 2. Copiar la app ────────────────────────────────────────
log "Copiando la aplicación"
cp -a "$SUITE/musosoup/musosoup_diario.py" "$SUITE/musosoup/musosoup_ui.py" "$PREFIX/"
cp -a "$SUITE/musosoup/requirements.txt" "$PREFIX/requirements.txt"

# ── 3. Entorno virtual + dependencias ───────────────────────
log "Entorno virtual"
if [ ! -x "$PREFIX/venv/bin/python" ]; then
  "$PYTHON" -m venv "$PREFIX/venv"
fi
"$PREFIX/venv/bin/python" -m pip install --quiet --upgrade pip
"$PREFIX/venv/bin/python" -m pip install --quiet -r "$PREFIX/requirements.txt"

# ── 4. Acceso en el menú ────────────────────────────────────
log "Acceso en el menú"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$APPS"
cat > "$APPS/musosoup.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=Indie Now MusoSoup
Comment=Consolidador de lanzamientos del día
Exec="$PREFIX/venv/bin/python" "$PREFIX/musosoup_diario.py"
Icon=text-x-generic
Terminal=false
Categories=Office;TextEditor;
EOD
update-desktop-database "$APPS" 2>/dev/null || true

# ── 5. Lanzador en ~/.local/bin ─────────────────────────────
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"
mkdir -p "$BIN"
cat > "$BIN/musosoup" <<EOD
#!/usr/bin/env bash
exec "$PREFIX/venv/bin/python" "$PREFIX/musosoup_diario.py" "\$@"
EOD
chmod +x "$BIN/musosoup"

cat <<EOF

Listo. MusoSoup quedó en:
  $PREFIX

Abrilo desde el menú ("Indie Now MusoSoup") o con:
  $BIN/musosoup

En Linux la conversión de .doc usa LibreOffice (soffice).
Desinstalar:
  $HERE/desinstalar.sh
EOF
