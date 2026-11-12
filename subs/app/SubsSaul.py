r"""Lanzador único de Indie Now para DaVinci Resolve (Windows).

Orden de búsqueda:
  1. Ejecutable compilado nuevo (si existe).
  2. Ejecutable viejo (si existe).
  3. Entorno virtual de la app:  IndieDL\venv  o  IndieDL\subs\.venv.
  4. Python del sistema (último recurso).

Deja registro en  subs\lanzador.log  y captura la salida del proceso en
subs\lanzador_error.log, para diagnosticar desde Resolve aunque la app se
abra con pythonw (sin consola).
"""

import os
import subprocess
import sys
import time
from pathlib import Path


APP_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "IndieDL" / "subs"
LOG = APP_DIR / "lanzador.log"
ERRLOG = APP_DIR / "lanzador_error.log"

EXE_NUEVO = APP_DIR / "dist" / "IndieNow-Subtitulos" / "IndieNow-Subtitulos.exe"
EXE_VIEJO = APP_DIR / "IndieNow-Subtitulos-Ancho" / "IndieNow-Subtitulos-Ancho.exe"
SCRIPT = APP_DIR / "subtitulos.py"

PYTHONW_CANDIDATES = [
    APP_DIR.parent / "venv" / "Scripts" / "pythonw.exe",  # instalación actual
    APP_DIR / ".venv" / "Scripts" / "pythonw.exe",        # instalación vieja
    APP_DIR / "venv" / "Scripts" / "pythonw.exe",
    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Python" / "Python312" / "pythonw.exe",
    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Python" / "Python311" / "pythonw.exe",
]


def _log(msg):
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")
    except Exception:
        pass


def _console(msg):
    """Muestra el estado en la consola de Resolve (Window > Console)."""
    try:
        print("[Indie Now] " + str(msg))
        sys.stdout.flush()
    except Exception:
        pass


def _leer_cola(ruta, max_lineas=30):
    try:
        with open(ruta, "rb") as f:
            f.seek(0, os.SEEK_END)
            tam = f.tell()
            f.seek(max(0, tam - 12000))
            texto = f.read().decode("utf-8", "replace")
        lineas = [l.rstrip() for l in texto.splitlines() if l.strip()]
        return "\n".join(lineas[-max_lineas:])
    except Exception:
        return ""


def _avisar(mensaje):
    """Aviso visible incluso cuando este launcher corre sin consola."""
    _console("ERROR: " + mensaje)
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(
            None, mensaje, "Indie Now - Subtítulos", 0x10)
        return
    except Exception:
        pass
    try:
        import tkinter as tk
        from tkinter import messagebox
        raiz = tk.Tk()
        raiz.withdraw()
        try:
            raiz.attributes("-topmost", True)
        except Exception:
            pass
        messagebox.showerror("Indie Now - Subtítulos", mensaje, parent=raiz)
        raiz.destroy()
    except Exception:
        pass


def _pythonw():
    for candidate in PYTHONW_CANDIDATES:
        if candidate.is_file():
            return candidate
    # Si el que ejecuta este script es un Python con Tk, sirve como último recurso.
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        candidate = exe.with_name("pythonw.exe")
        if candidate.is_file():
            return candidate
    return None


def _entorno_limpio():
    """Evita que las variables de Python de Resolve rompan el Python del venv."""
    env = os.environ.copy()
    for var in ("PYTHONHOME", "PYTHONPATH", "PYTHONEXECUTABLE", "PYTHONSTARTUP"):
        env.pop(var, None)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def main():
    if EXE_NUEVO.is_file():
        target, cwd = EXE_NUEVO, EXE_NUEVO.parent
    elif EXE_VIEJO.is_file():
        target, cwd = EXE_VIEJO, EXE_VIEJO.parent
    else:
        pythonw = _pythonw()
        if pythonw and SCRIPT.is_file():
            target, cwd = pythonw, APP_DIR
        else:
            buscados = [EXE_NUEVO, EXE_VIEJO, SCRIPT, *PYTHONW_CANDIDATES]
            detalle = "\n".join(f"  - {p}" for p in buscados)
            _log("ERROR: no se encontró ejecutable ni Python.\n" + detalle)
            _avisar(
                "Indie Now no está instalado o no se encontró cómo iniciarlo.\n\n"
                "Buscado en:\n" + detalle)
            return 1

    args = [str(target)]
    if target == SCRIPT or target.name.lower().startswith("python"):
        args.append(str(SCRIPT))

    # Salida del proceso a un log: pythonw no tiene consola y, sin esto,
    # cualquier error de arranque desaparece sin dejar rastro.
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

    _log(f"Lanzando: {target} (cwd={cwd})")
    _console("Abriendo Indie Now - Subtítulos…")
    try:
        proc = subprocess.Popen(
            args,
            cwd=str(cwd),
            env=_entorno_limpio(),
            stdin=subprocess.DEVNULL,
            stdout=error_file if error_file else None,
            stderr=subprocess.STDOUT if error_file else None,
            close_fds=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except Exception as exc:
        _log(f"ERROR al iniciar: {exc!r}")
        _avisar("No se pudo abrir Indie Now - Subtítulos:\n\n%r" % (exc,))
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
        codigo = proc.returncode
        detalle = _leer_cola(ERRLOG) or _leer_cola(LOG)
        _log(f"El proceso terminó al iniciar (código {codigo}).\n{detalle}")
        mensaje = "Indie Now se cerró apenas intentó abrir (código %s).\n" % codigo
        if detalle:
            mensaje += "\nÚltimas líneas del registro:\n\n" + detalle[-1500:]
        else:
            mensaje += ("\nNo dejó mensaje. Revisá:\n"
                        + str(ERRLOG) + "\n" + str(LOG))
        _avisar(mensaje)
        return 1

    _log(f"Ventana en marcha (proceso {proc.pid})")
    _console("Indie Now - Subtítulos iniciado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
