# Indie Now — MusoSoup (guiones)

Consolidador de lanzamientos del día de **MusoSoup**: lee los ZIP y los
documentos sueltos de la carpeta del día, detecta artista / lanzamiento / tipo
y genera un único Word ordenado (`LANZAMIENTOS_AAAA-MM-DD.docx`).

## Windows (10/11)

1. Instalá **Python 3.11–3.13** (probado con 3.12) marcando
   **"Add python.exe to PATH"** y **"tcl/tk and IDLE"**.
2. Doble clic en **`INSTALAR_DESDE_CERO.bat`** (solo la primera vez).
3. Uso diario: **`EJECUTAR_MUSOSOUP_DIARIO.bat`** → elegir la carpeta del día →
   Analizar → Generar.

El instalador crea un `.venv` local en esta carpeta e instala
`requirements.txt`. Para abrir el Word final hace falta Microsoft Word o
LibreOffice.

## Arch Linux

```bash
cd musosoup
./instalar_arch.sh
```

Instala las dependencias del sistema con `pacman`, crea el venv en
`~/.local/share/MusoSoup`, instala `requirements.txt` y deja el acceso en el
menú de aplicaciones.

Uso diario:

```bash
./ejecutar.sh
```

El instalador también detecta `dnf` y `apt` para otras distros.

> En Linux la conversión de `.doc` usa **LibreOffice** (`soffice`) como
> fallback; para `.docx`, `.pdf`, `.rtf`, `.txt`, etc. no hace falta nada extra.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `musosoup_diario.py` | Lógica: ZIP, extracción, detección y DOCX |
| `musosoup_ui.py` | Interfaz (autocontenida, no depende de otros `.py`) |
| `INSTALAR_DESDE_CERO.bat` | Instalación completa en Windows |
| `EJECUTAR_MUSOSOUP_DIARIO.bat` | Arranque diario en Windows |
| `instalar_arch.sh` | Instalador para Arch Linux (y otras distros) |
| `ejecutar.sh` | Arranque diario en Linux |
| `requirements.txt` | Dependencias |
| `musosoup_config.example.json` | Ejemplo de configuración |

## Datos locales

`musosoup_config.json`, `musosoup.log`, `musosoup_deps.ok`, `.venv/` y los
`.docx` generados no se versionan. La app crea la configuración sola la primera
vez.
