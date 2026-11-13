r"""Lanzador de Indie Now - Subtitulos para DaVinci Resolve en Linux/CachyOS.

Sustituye al launcher de Windows (que solo busca ejecutables .exe de Windows)
en la instalacion de Linux. Lo copia cachyos/subs/instalar.sh (o parche.py
cuando se ejecuta suelto) a la carpeta de instalacion.

Uso:
  - Desde Resolve:  Window > Console > ejecutar este archivo, o
  - Directo:        python3 SubsSaul.py

El venv y subtitulos.py se buscan en la MISMA carpeta que este archivo, asi
que no hay rutas absolutas que mantener. Respeta PREFIX del instalador.
Marcador usado por el verificador de parches: indiedl-linux-launcher-v1
"""
import os
import subprocess
import sys
import time
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
SCRIPT = APP_DIR / "subtitulos.py"
LOG = APP_DIR / "lanzador.log"
ERRLOG = APP_DIR / "lanzador_error.log"

MARKER = "indiedl-linux-launcher-v1"


def _log(msg):
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")
    except Exception:
        pass


def _console(msg):
    try:
        print("[Indie Now] " + str(msg))
        sys.stdout.flush()
    except Exception:
        pass


def _avisar(mensaje):
    """Aviso visible aun cuando Resolve no muestra stdout."""
    _console("ERROR: " + mensaje)
    try:
        import tkinter as tk
        from tkinter import messagebox
        raiz = tk.Tk()
        raiz.withdraw()
        messagebox.showerror("Indie Now - Subtitulos", mensaje, parent=raiz)
        raiz.destroy()
    except Exception:
        pass


def _python():
    """Python del venv de la instalacion; si no existe, el que ejecuta esto."""
    for candidato in (APP_DIR / "venv" / "bin" / "python",
                      APP_DIR / ".venv" / "bin" / "python"):
        if candidato.is_file():
            return str(candidato)
    return sys.executable


def _entorno_limpio():
    """Evita que las variables de Python de Resolve rompan el Python del venv."""
    env = os.environ.copy()
    for var in ("PYTHONHOME", "PYTHONPATH", "PYTHONEXECUTABLE", "PYTHONSTARTUP"):
        env.pop(var, None)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def main():
    if not SCRIPT.is_file():
        _log("ERROR: no se encontro " + str(SCRIPT))
        _avisar("No se encontro subtitulos.py en:\n" + str(APP_DIR))
        return 1

    python = _python()
    args = [python, str(SCRIPT)]

    error_file = None
    try:
        ERRLOG.parent.mkdir(parents=True, exist_ok=True)
        if ERRLOG.is_file() and ERRLOG.stat().st_size > 2_000_000:
            with open(ERRLOG, "w", encoding="utf-8"):
                pass
        error_file = open(ERRLOG, "ab")
        error_file.write(
            ("\n===== %s =====\n" % time.strftime("%Y-%m-%d %H:%M:%S")).encode("utf-8"))
        error_file.flush()
    except Exception:
        error_file = None

    _log(f"Lanzando: {args} (cwd={APP_DIR})")
    _console("Abriendo Indie Now - Subtitulos...")
    try:
        proc = subprocess.Popen(
            args,
            cwd=str(APP_DIR),
            env=_entorno_limpio(),
            stdin=subprocess.DEVNULL,
            stdout=error_file if error_file else None,
            stderr=subprocess.STDOUT if error_file else None,
            close_fds=True,
        )
    except Exception as exc:
        _log(f"ERROR al iniciar: {exc!r}")
        _avisar("No se pudo abrir Indie Now - Subtitulos:\n\n%r" % (exc,))
        return 1
    finally:
        if error_file:
            error_file.close()

    _log(f"Proceso iniciado: {proc.pid}")

    # Si se cae en los primeros segundos, avisamos con el error real.
    limite = time.time() + 3.0
    while time.time() < limite and proc.poll() is None:
        time.sleep(0.1)

    if proc.poll() is not None:
        _log(f"El proceso termino al iniciar (codigo {proc.returncode}).")
        _avisar("Indie Now se cerro apenas intento abrir.\nRevisa: " + str(ERRLOG))
        return 1

    _log("Ventana en marcha")
    _console("Indie Now - Subtitulos iniciado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
