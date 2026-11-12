# Indie Now Suite

Suite de herramientas de escritorio de **Indie Now** para preparar material
audiovisual:

| Carpeta | Herramienta | Para qué sirve |
|---|---|---|
| `descargador/` | **Indie Now DL** | Descarga videos, audios e imágenes de YouTube, Instagram, TikTok, X/Twitter y Pinterest, con extensión de navegador (`ytdl://`). |
| `subs/` | **Indie Now Subtítulos** | Genera subtítulos desde un guion con Whisper/Parakeet y los inserta en DaVinci Resolve (SRT, plantilla, traducción). |
| `musosoup/` | **MusoSoup Guiones** | Consolida los ZIP y documentos del día de MusoSoup en un único Word ordenado. |
| `docs/` | Documentación | Instrucciones editoriales para guiones de reels. |

> Este repo reúne las tres apps en su estado actual. El corte automático
> (`Cortes-Auto`) **no** está incluido: vive aparte y no es parte de esta suite.

## Instalación rápida (Windows 10/11)

Cada herramienta tiene su propio instalador. Se pueden instalar todas en el
mismo equipo; comparten el entorno virtual de `%LOCALAPPDATA%\IndieDL\venv`
(excepto MusoSoup, que usa su propio `.venv`).

### 1. Descargador

```bat
descargador\INSTALAR.bat
```

Instala Python (si falta), FFmpeg, las dependencias, la extensión de navegador
y registra el protocolo `ytdl://`. Después se abre con **Iniciar IndieDL.bat**
o con el acceso directo del Escritorio.

### 2. Subtítulos

```bat
subs\INSTALAR.bat
```

Copia la app a `%LOCALAPPDATA%\IndieDL\subs`, instala las dependencias de
Whisper/Parakeet y agrega el lanzador al menú **Fusion → Scripts → Edit** de
DaVinci Resolve (`SubsSaul`).

### 3. MusoSoup

```bat
musosoup\INSTALAR_DESDE_CERO.bat
```

Crea un `.venv` local en `musosoup\` e instala las dependencias. El uso diario
es `musosoup\EJECUTAR_MUSOSOUP_DIARIO.bat`.

También hay un instalador que encadena los tres:

```bat
INSTALAR_TODO.bat
```

## Instalación en CachyOS / Arch Linux (suite completa)

La carpeta `cachyos/` instala **las tres apps** en CachyOS (o cualquier Arch
con `pacman`), usando las versiones actuales y aplicando parches de
compatibilidad en el momento de instalar:

```bash
cd cachyos
./instalar_todo.sh
```

Eso deja:

| App | Destino | Lanzador |
|---|---|---|
| Indie Now DL | `~/.local/share/IndieDL` | `indiedl` / menú |
| Indie Now Subtítulos | `~/.local/share/Subs-Now` | `subs-now` / menú |
| MusoSoup | `~/.local/share/MusoSoup` | `musosoup` / menú |

También se puede instalar solo una:

```bash
cachyos/descargador/instalar.sh
cachyos/subs/instalar.sh
cachyos/musosoup/instalar.sh
```

Los instaladores usan `pacman` (`python`, `tk`, `ffmpeg`, `xdg-utils`,
`xdg-user-dirs`, `desktop-file-utils`, `fontconfig`, `ttf-liberation`,
`ttf-dejavu`, `noto-fonts`, `kdialog`, `libreoffice-fresh`) y caen a
`dnf`/`apt` en otras distros.

Qué adapta cada parche:

- **Descargador**: rutas XDG, `ytdl://` con `.desktop` + `xdg-mime`, cookies
  de Helium/Chrome/Chromium/Brave/Edge/Firefox/Zen, `os.startfile` →
  `xdg-open`, fuentes del sistema y diálogos nativos con `kdialog`/`zenity`.
- **Subtítulos**: Resolve en `/opt/resolve`, `os.startfile` → `xdg-open`,
  fuentes, DPI/título oscuro como no-op y `LD_LIBRARY_PATH` para CUDA.
- **MusoSoup**: ya es multiplataforma; `.doc` viejos se convierten con
  LibreOffice (`soffice`) y `pywin32` solo se instala en Windows.

Detalle completo: [`cachyos/README.md`](cachyos/README.md).

> **Nota:** el descargador y los subtítulos también tienen instaladores para
> Windows 10/11 (los `.bat` de cada carpeta). La app de subtítulos en Linux
> necesita DaVinci Resolve en `/opt/resolve` y abierto con una timeline.

## Estructura

```
indiedl-suite/
├─ descargador/
│  ├─ app/                  indiedl.py, indiedl_core.py, indiedl_ui.py, launcher.pyw
│  ├─ browser-extension/    extensión Chrome/Edge (protocolo ytdl://)
│  ├─ installer/            instalador de Windows
│  ├─ INSTALAR.bat
│  ├─ Iniciar IndieDL.bat
│  └─ requirements.txt
├─ subs/
│  ├─ app/                  subtitulos.py, subtitulos_ui.py, indie_ui.py, cortes.py...
│  ├─ installer/            instalador de Windows
│  ├─ tests/                tests de alineación y traducción
│  ├─ INSTALAR.bat
│  ├─ Iniciar Subtitulos.bat
│  ├─ compilar.bat          build con PyInstaller
│  └─ requirements.txt
├─ musosoup/
│  ├─ musosoup_diario.py    lógica (ZIP, extracción, detección, DOCX)
│  ├─ musosoup_ui.py        interfaz autocontenida
│  ├─ INSTALAR_DESDE_CERO.bat
│  ├─ EJECUTAR_MUSOSOUP_DIARIO.bat
│  ├─ instalar_arch.sh
│  └─ ejecutar.sh
├─ cachyos/                  instalación completa para CachyOS/Arch
│  ├─ instalar_todo.sh
│  ├─ common/plat_compat.py
│  ├─ descargador/          instalar.sh + parche.py
│  ├─ subs/                 instalar.sh + parche.py
│  └─ musosoup/             instalar.sh
├─ docs/
│  └─ instrucciones-guiones.txt
└─ INSTALAR_TODO.bat
```

## Datos que no se versionan

- `config.json`, `musosoup_config.json`, `subtitulos_config.json`
  (configuración local; hay ejemplos `.example.json`).
- Cookies (`*cookies*`, `*.bin`), logs, cachés, `venv/`, `.venv/`,
  `__pycache__/`, SRT generados y documentos Word generados.

Cada app crea su configuración la primera vez que se abre.

## Repos relacionados

- Descargador solo: <https://github.com/saulnownowindie/indiedl>
- Subtítulos solo: <https://github.com/saulnownowindie/subs-now>
- MusoSoup solo: <https://github.com/saulnownowindie/laburo-musosoup-guiones>
