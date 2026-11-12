# Indie Now — Subtítulos

Genera subtítulos desde un guion con Whisper/Parakeet y los inserta en
DaVinci Resolve: SRT, pista de subtítulos, plantilla Text+ y traducción.

## Instalar (Windows)

```bat
INSTALAR.bat
```

El instalador:

- crea/reutiliza `%LOCALAPPDATA%\IndieDL\venv`;
- instala `requirements.txt` (faster-whisper, ctranslate2, av, tokenizers…);
- copia la app a `%LOCALAPPDATA%\IndieDL\subs`;
- agrega `SubsSaul.py` al menú **Fusion → Scripts → Edit** de Resolve;
- crea el acceso directo **Indie Now Subtítulos**.

## Ejecutar

- Desde Resolve: **Fusion → Scripts → Edit → SubsSaul**.
- O con **Iniciar Subtitulos.bat** / el acceso directo.

Necesita Resolve abierto, con un proyecto y una timeline.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `app/subtitulos.py` | Lógica principal (Whisper/Parakeet, alineación, SRT, Resolve) |
| `app/subtitulos_ui.py` | Interfaz |
| `app/indie_ui.py` | Kit visual |
| `app/cortes.py` | Conexión con Resolve y transcripción (usada por `verificar.py`) |
| `app/verificar.py` / `app/verificacion.py` | Verificación de la timeline |
| `app/mezcla_audio.py` | Mezcla/extracción de audio |
| `app/traduccion_google.py` | Traducción de subtítulos |
| `app/SubsSaul.py` | Lanzador para el menú de Resolve |
| `tests/` | Tests de alineación y traducción |
| `compilar.bat` | Build del ejecutable con PyInstaller |

## Datos locales

La configuración (`subtitulos_config.json`), los logs y los SRT generados no
se versionan. Hay un `app/subtitulos_config.json.example` como referencia.
