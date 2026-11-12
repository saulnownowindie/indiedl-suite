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

## Instalación en Arch Linux (MusoSoup)

El script de MusoSoup es multiplataforma. En Arch Linux:

```bash
cd musosoup
./instalar_arch.sh
```

El instalador:

- instala las dependencias del sistema con `pacman`
  (`python`, `tk`, `python-pillow`, `fontconfig`, `ttf-liberation`,
  `ttf-dejavu`, `libreoffice-fresh`, `xdg-utils`);
- crea un venv en `~/.local/share/MusoSoup/venv`;
- instala `requirements.txt`;
- deja un acceso en el menú de aplicaciones.

Uso diario:

```bash
./ejecutar.sh
# o desde el menú: "Indie Now MusoSoup"
```

Si usás otra distro, `instalar_arch.sh` también detecta `dnf` (Fedora/Nobara)
y `apt` (Debian/Ubuntu).

> **Nota:** el descargador y la app de subtítulos están pensados para Windows
> (usan `win32com`, `icacls` y la API de Resolve en Windows). MusoSoup es la
> herramienta de esta suite preparada para Linux/Arch.

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
