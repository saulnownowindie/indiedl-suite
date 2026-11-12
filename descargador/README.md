# Indie Now DL — descargador

Descarga videos, audios e imágenes de YouTube, Instagram, TikTok, X/Twitter y
Pinterest, y los deja listos para editar (incluye opción PCM para Resolve).

## Instalar (Windows)

```bat
INSTALAR.bat
```

El instalador crea `%LOCALAPPDATA%\IndieDL\venv`, instala `requirements.txt`,
copia la app y la extensión, registra el protocolo `ytdl://` y crea los
accesos directos.

## Ejecutar

- **Iniciar IndieDL.bat**, o
- el acceso directo **Indie Now DL** del Escritorio.

## Extensión de navegador

Después de instalar:

1. Abrí `chrome://extensions` (o `edge://extensions`).
2. Activá **Modo de desarrollador**.
3. **Cargar descomprimida** → `%LOCALAPPDATA%\IndieDL\browser-extension`.

La extensión agrega una barra en YouTube, Instagram, TikTok, X y Pinterest y
manda las descargas a la app por `ytdl://`.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `app/indiedl.py` | Punto de entrada |
| `app/indiedl_core.py` | Configuración, cookies, descarga y utilidades |
| `app/indiedl_ui.py` | Interfaz CustomTkinter |
| `app/launcher.pyw` | Lanzador (corrige la etiqueta de integridad de Windows) |
| `app/analizar_media.py` | Diagnóstico de un video para Resolve |
| `installer/instalar.ps1` | Instalador automático |
| `browser-extension/` | Extensión Chrome/Edge |

## Datos locales

`config.json`, los cookies y los logs **no** se versionan. La app los crea en
`%LOCALAPPDATA%\IndieDL`. Hay un `config.example.json` como referencia.
