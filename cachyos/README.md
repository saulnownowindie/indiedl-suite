# Indie Now Suite — CachyOS / Arch Linux

Esta carpeta instala la suite completa en **CachyOS** (y cualquier Arch Linux
con `pacman`). Usa las versiones **actuales** de cada app y les aplica parches
de compatibilidad en el momento de instalar; los archivos de Windows del repo
no se tocan.

## Instalación

```bash
cd cachyos
./instalar_todo.sh
```

Eso instala, en orden:

| App | Destino | Lanzador |
|---|---|---|
| Indie Now DL | `~/.local/share/IndieDL` | `indiedl` / menú |
| Indie Now Subtítulos | `~/.local/share/Subs-Now` | `subs-now` / menú |
| MusoSoup | `~/.local/share/MusoSoup` | `musosoup` / menú |

También podés instalar solo una:

```bash
./descargador/instalar.sh
./subs/instalar.sh
./musosoup/instalar.sh
```

## Qué instala en el sistema

Con `pacman`:

- `python`, `tk`, `ffmpeg`, `xdg-utils`, `xdg-user-dirs`, `desktop-file-utils`
- `fontconfig`, `ttf-liberation`, `ttf-dejavu`, `noto-fonts`
- `kdialog` (diálogos nativos de KDE; opcional)
- `libreoffice-fresh` (solo para MusoSoup, para convertir `.doc` viejos)

Cada app crea su propio `venv` dentro de su carpeta en `~/.local/share`.

## Qué parchea cada app

### Descargador (`descargador/parche.py`)

- Rutas XDG (`~/.local/share/IndieDL`, `~/.cache/IndieDL`) en vez de
  `%LOCALAPPDATA%`.
- Protocolo `ytdl://` → `.desktop` + `xdg-mime` en vez del registro de Windows
  (incluye `indiedl.py --register-only`).
- Perfiles de navegador para cookies: Helium, Chrome, Chromium, Brave, Edge,
  Firefox y Zen.
- `os.startfile` → `xdg-open`.
- Fuentes de Windows → Liberation/DejaVu/Noto.
- `DPAPI` (cifrado de cookies de Instagram) → guardado directo con permisos
  del usuario en Linux.
- Diálogos nativos con `kdialog` (KDE) o `zenity` (GTK), con vuelta a Tkinter.

### Subtítulos (`subs/parche.py`)

- DPI y barra de título oscura → no-op fuera de Windows.
- Rutas de scripting de Resolve → `/opt/resolve/Developer/Scripting` y
  `/opt/resolve/libs/Fusion/fusionscript.so`.
- `os.startfile` → `xdg-open`.
- Fuentes → Liberation/DejaVu/Noto.
- CUDA: agrega `lib/` de los paquetes NVIDIA y `LD_LIBRARY_PATH` en Linux.

### MusoSoup (`musosoup/instalar.sh`)

No necesita parche: la versión actual ya es multiplataforma.

- La interfaz usa fuentes con fallback a Liberation/DejaVu/Noto.
- `.doc` antiguos se convierten con `soffice` (LibreOffice).
- `pywin32` está marcado como dependencia solo de Windows.

## Notas

- **DaVinci Resolve en Linux**: la app de subtítulos necesita Resolve
  instalado en `/opt/resolve` y abierto con un proyecto y una timeline.
  El menú *Fusion → Scripts* de Resolve en Linux es distinto al de Windows;
  por eso el lanzador es independiente (`subs-now`).
- **Python**: CachyOS trae Python reciente (3.13+). Si `pip` no encuentra
  wheels para `torch`/`onnxruntime`, instalá una versión anterior con
  `pyenv` o esperá los wheels nuevos. La app de subtítulos es la más
  sensible a esto.
- **Extensión del navegador**: después de instalar el descargador, cargala
  desde `chrome://extensions` → *Modo de desarrollador* → *Cargar
  descomprimida* → `~/.local/share/IndieDL/browser-extension`.

## Desinstalar

```bash
./desinstalar_todo.sh
```

O por app:

```bash
./descargador/desinstalar.sh
./subs/desinstalar.sh
./musosoup/desinstalar.sh
```

## Estructura

```
cachyos/
├─ instalar_todo.sh
├─ desinstalar_todo.sh
├─ common/
│  └─ plat_compat.py      Capa Windows/Linux compartida
├─ descargador/
│  ├─ instalar.sh
│  ├─ desinstalar.sh
│  └─ parche.py
├─ subs/
│  ├─ instalar.sh
│  ├─ desinstalar.sh
│  └─ parche.py
└─ musosoup/
   ├─ instalar.sh
   └─ desinstalar.sh
```

> Los instaladores usan `pacman` si está disponible y caen a `dnf`/`apt`
> en otras distros.
