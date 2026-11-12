#!/usr/bin/env bash
# Instalador de Indie Now DL para CachyOS / Arch Linux (y otras distros).
# Uso:  ./instalar.sh
#       PREFIX=/otra/ruta ./instalar.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUITE="$(cd "$HERE/../.." && pwd)"
PREFIX="${PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/IndieDL}"
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
  sudo pacman -S --needed --noconfirm python tk ffmpeg xdg-utils \
    xdg-user-dirs desktop-file-utils \
    fontconfig ttf-liberation ttf-dejavu noto-fonts || true
  # Diálogos nativos en KDE (opcional)
  sudo pacman -S --needed --noconfirm kdialog || true
elif command -v dnf >/dev/null 2>&1; then
  log "Dependencias del sistema (dnf)"
  sudo dnf install -y python3 python3-pip python3-tkinter xdg-utils \
    desktop-file-utils xdg-user-dirs \
    fontconfig liberation-sans-fonts dejavu-sans-fonts \
    google-noto-sans-mono-fonts ffmpeg-free || true
elif command -v apt >/dev/null 2>&1; then
  log "Dependencias del sistema (apt)"
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3 python3-pip python3-tk python3-venv \
    ffmpeg xdg-utils desktop-file-utils xdg-user-dirs \
    fonts-liberation fonts-dejavu fonts-noto-mono zenity || true
else
  log "No detecté pacman/dnf/apt. Asegurate de tener Python, Tk, ffmpeg y xdg-utils."
fi

# ── 2. Copiar la app ────────────────────────────────────────
log "Copiando la aplicación"
cp -a "$SUITE/descargador/app/." "$PREFIX/"
cp -a "$SUITE/cachyos/common/plat_compat.py" "$PREFIX/plat_compat.py"
cp -a "$HERE/parche.py" "$PREFIX/parche.py"
rm -rf "$PREFIX/browser-extension"
cp -a "$SUITE/descargador/browser-extension" "$PREFIX/browser-extension"
cp -a "$SUITE/descargador/requirements.txt" "$PREFIX/requirements.txt"

# ── 3. Entorno virtual + dependencias ───────────────────────
log "Entorno virtual"
if [ ! -x "$PREFIX/venv/bin/python" ]; then
  "$PYTHON" -m venv "$PREFIX/venv"
fi
"$PREFIX/venv/bin/python" -m pip install --quiet --upgrade pip
"$PREFIX/venv/bin/python" -m pip install --quiet -r "$PREFIX/requirements.txt"

# ── 4. Parches Linux ────────────────────────────────────────
log "Aplicando parches de Linux"
"$PREFIX/venv/bin/python" "$PREFIX/parche.py" "$PREFIX"

# ── 5. Registrar ytdl:// ────────────────────────────────────
log "Registrando el protocolo ytdl://"
"$PREFIX/venv/bin/python" "$PREFIX/indiedl.py" --register-only || true

# ── 6. Acceso en el menú ────────────────────────────────────
log "Acceso en el menú"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$APPS"
cat > "$APPS/indiedl.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=Indie Now DL
Comment=Descargador de videos, audios e imágenes
Exec="$PREFIX/venv/bin/python" "$PREFIX/indiedl.py" %u
Icon=video-x-generic
Terminal=false
Categories=AudioVideo;
MimeType=x-scheme-handler/ytdl;
EOD
update-desktop-database "$APPS" 2>/dev/null || true
xdg-mime default indiedl.desktop x-scheme-handler/ytdl 2>/dev/null || true

# ── 7. Lanzador en ~/.local/bin ─────────────────────────────
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"
mkdir -p "$BIN"
cat > "$BIN/indiedl" <<EOD
#!/usr/bin/env bash
exec "$PREFIX/venv/bin/python" "$PREFIX/indiedl.py" "\$@"
EOD
chmod +x "$BIN/indiedl"

cat <<EOF

Listo. Indie Now DL quedó en:
  $PREFIX

Abrilo desde el menú ("Indie Now DL") o con:
  $BIN/indiedl

Extensión de Chromium/Helium:
  $PREFIX/browser-extension
  chrome://extensions → Modo de desarrollador → Cargar descomprimida

Desinstalar:
  $HERE/desinstalar.sh
EOF
