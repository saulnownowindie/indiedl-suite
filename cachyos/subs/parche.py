#!/usr/bin/env python3
"""Adapta Indie Now Subtítulos (versión actual) a Linux/CachyOS.

Uso:  python3 parche.py [carpeta]
Es idempotente. No modifica la versión de Windows del repo.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def ensure_import(text: str) -> str:
    if "import plat_compat as pc" in text:
        return text
    lines = text.splitlines(keepends=True)
    last = -1
    for i, line in enumerate(lines[:80]):
        if re.match(r"^(import|from)\s+\S", line):
            last = i
    if last < 0:
        return text
    lines.insert(last + 1, "import plat_compat as pc\n")
    return "".join(lines)


def apply(name: str, text: str, subs: list, required_any: bool = False) -> tuple[str, int]:
    applied = 0
    for item in subs:
        old, new = item[0], item[1]
        is_regex = len(item) > 2 and item[2]
        if is_regex:
            pat = re.compile(old, re.DOTALL)
            new_text, n = pat.subn(new, text)
        else:
            if old in text:
                new_text = text.replace(old, new, 1)
                n = 1
            else:
                new_text, n = text, 0
        if n:
            text = new_text
            applied += 1
    return text, applied


# ─────────────────────────────────────────────────────────────
# subtitulos.py
# ─────────────────────────────────────────────────────────────
def patch_subtitulos(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    orig = text

    subs = [
        # DPI: no-op fuera de Windows
        ("""try:
    import ctypes
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    pass""",
         "import plat_compat as pc\npc.set_dpi_aware()"),

        # Rutas de scripting de Resolve: /opt/resolve en Linux
        ("""def _preparar_resolve():
    prog_data = os.environ.get("PROGRAMDATA", r"C:\\ProgramData")
    api = os.environ.get("RESOLVE_SCRIPT_API") or os.path.join(
        prog_data, "Blackmagic Design", "DaVinci Resolve", "Support", "Developer", "Scripting"
    )
    lib = os.environ.get("RESOLVE_SCRIPT_LIB") or os.path.join(
        os.environ.get("PROGRAMFILES", r"C:\\Program Files"),
        "Blackmagic Design", "DaVinci Resolve", "fusionscript.dll"
    )
    os.environ["RESOLVE_SCRIPT_API"] = api
    os.environ["RESOLVE_SCRIPT_LIB"] = lib
    mod = os.path.join(api, "Modules")
    if mod not in sys.path: sys.path.insert(0, mod)
    try:
        os.add_dll_directory(os.path.dirname(lib))
    except Exception:
        pass""",
         """def _preparar_resolve():
    api, lib = pc.resolve_scripting_paths()
    os.environ["RESOLVE_SCRIPT_API"] = api
    os.environ["RESOLVE_SCRIPT_LIB"] = lib
    mod = os.path.join(api, "Modules")
    if mod not in sys.path: sys.path.insert(0, mod)
    if pc.IS_WIN:
        try:
            os.add_dll_directory(os.path.dirname(lib))
        except Exception:
            pass"""),
    ]

    text, n = apply(p.name, text, subs, required_any=True)
    if text != orig:
        text = ensure_import(text)
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: {n} parches")
    else:
        print(f"  - {p.name}: sin cambios")
    return True


# ─────────────────────────────────────────────────────────────
# subtitulos_ui.py
# ─────────────────────────────────────────────────────────────
def patch_subtitulos_ui(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    orig = text

    subs = [
        ("""    def _abrir_carpeta(self):
        ruta = self.v_srt.get() or self.v_guion.get()
        carpeta = os.path.dirname(ruta) if ruta else os.path.expanduser("~")
        try:
            os.startfile(carpeta)
        except Exception as exc:
            self._log(f"No pude abrir la carpeta: {exc}", "err")""",
         """    def _abrir_carpeta(self):
        ruta = self.v_srt.get() or self.v_guion.get()
        carpeta = os.path.dirname(ruta) if ruta else os.path.expanduser("~")
        pc.open_path(carpeta)"""),
    ]

    text, n = apply(p.name, text, subs, required_any=True)
    if text != orig:
        text = ensure_import(text)
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: {n} parches")
    else:
        print(f"  - {p.name}: sin cambios")
    return True


# ─────────────────────────────────────────────────────────────
# indie_ui.py
# ─────────────────────────────────────────────────────────────
def patch_indie_ui(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    orig = text

    subs = [
        # _font_file → fuentes del sistema (Liberation/DejaVu/Noto)
        ("""def _font_file(*names):
    for name in names:
        path = "C:/Windows/Fonts/" + name
        try:
            with open(path, "rb"):
                return path
        except Exception:
            continue
    return None""",
         """def _font_file(*names):
    import plat_compat as pc
    return pc.font_file(*names)"""),

        # Fallbacks de fuentes en init_fonts
        ('''    F_BLACK = pick("Segoe UI Black", "Arial Black", "Segoe UI", "Arial")
    F_SEMI = pick("Segoe UI Semibold", "Segoe UI", "Arial")
    F_BODY = pick("Segoe UI", "Arial")
    F_MONO = pick("Consolas", "Cascadia Mono", "Courier New")''',
         '''    F_BLACK = pick("Segoe UI Black", "Arial Black", "Liberation Sans",
                   "DejaVu Sans", "Arial")
    F_SEMI  = pick("Segoe UI Semibold", "Liberation Sans", "DejaVu Sans", "Arial")
    F_BODY  = pick("Segoe UI", "Liberation Sans", "DejaVu Sans", "Arial")
    F_MONO  = pick("Consolas", "Cascadia Mono", "Liberation Mono",
                   "DejaVu Sans Mono", "Courier New")'''),
    ]

    text, n = apply(p.name, text, subs, required_any=True)
    if text != orig:
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: {n} parches")
    else:
        print(f"  - {p.name}: sin cambios")
    return True


# ─────────────────────────────────────────────────────────────
# gpu_runtime.py
# ─────────────────────────────────────────────────────────────
def patch_gpu_runtime(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    orig = text

    new_body = '''def preparar_cuda() -> list[str]:
    """Registra librerías CUDA del instalador o de los paquetes NVIDIA."""
    app = _app_dir()
    bases = [app / "cuda-runtime", app.parent / "cuda-runtime"]
    bases.extend(Path(p) / "nvidia" for p in sys.path if p and Path(p).is_dir())
    local = os.environ.get("LOCALAPPDATA")
    if local:
        bases.append(Path(local) / "Programs" / "Python" / "Python312"
                     / "Lib" / "site-packages" / "nvidia")

    rutas = []
    for base in bases:
        if not base.is_dir():
            continue
        if base.name.lower() == "nvidia":
            for sub in base.iterdir():
                if not sub.is_dir() or "cu11" in sub.name.lower():
                    continue
                for libdir in ("bin", "lib"):
                    if (sub / libdir).is_dir():
                        rutas.append(sub / libdir)
        else:
            rutas.append(base)
            rutas.extend(p for p in base.rglob("*") if p.is_dir())
    rutas = list(dict.fromkeys(p for p in rutas if p.is_dir()))
    if not rutas:
        return []
    cargadores = []
    for ruta in rutas:
        try:
            if hasattr(os, "add_dll_directory"):
                cargadores.append(os.add_dll_directory(str(ruta)))
        except (AttributeError, OSError):
            pass
    os.environ["PATH"] = os.pathsep.join(
        [str(p) for p in rutas] + [os.environ.get("PATH", "")])
    if os.name != "nt":
        os.environ["LD_LIBRARY_PATH"] = os.pathsep.join(
            [str(p) for p in rutas] + [os.environ.get("LD_LIBRARY_PATH", "")])
    global _DLL_HANDLES
    _DLL_HANDLES = cargadores
    return [str(p) for p in rutas]

'''
    pat = re.compile(r"def preparar_cuda\(\) -> list\[str\]:.*?(?=\ndef nvidia_info)",
                     re.DOTALL)
    if "Registra librerías CUDA del instalador o de los paquetes NVIDIA." in text:
        print(f"  - {p.name}: sin cambios (ya parcheado)")
    elif pat.search(text):
        text = pat.sub(new_body, text, count=1)
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: preparar_cuda con soporte Linux")
    else:
        print(f"  - {p.name}: sin cambios (patrón no encontrado)")
    return True


# ─────────────────────────────────────────────────────────────
# cortes.py
# ─────────────────────────────────────────────────────────────
def patch_cortes(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    orig = text

    subs = [
        ('''os.environ.setdefault("RESOLVE_SCRIPT_API",
    r"C:\\ProgramData\\Blackmagic Design\\DaVinci Resolve\\Support\\Developer\\Scripting")
os.environ.setdefault("RESOLVE_SCRIPT_LIB",
    r"C:\\Program Files\\Blackmagic Design\\DaVinci Resolve\\fusionscript.dll")
sys.path.append(os.path.join(os.environ["RESOLVE_SCRIPT_API"], "Modules"))''',
         '''import plat_compat as pc
_api, _lib = pc.resolve_scripting_paths()
os.environ.setdefault("RESOLVE_SCRIPT_API", _api)
os.environ.setdefault("RESOLVE_SCRIPT_LIB", _lib)
sys.path.append(os.path.join(os.environ["RESOLVE_SCRIPT_API"], "Modules"))'''),
    ]

    text, n = apply(p.name, text, subs, required_any=True)
    if text != orig:
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: {n} parches")
    else:
        print(f"  - {p.name}: sin cambios")
    return True


# ─────────────────────────────────────────────────────────────
# verificacion.py: fallback XDG en Linux para los reportes de verificación
# ─────────────────────────────────────────────────────────────
def patch_verificacion(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    orig = text
    subs = [
        ('''carpeta = os.path.join(os.environ.get("LOCALAPPDATA",
                                                   os.path.expanduser("~")),
                                   "IndieDL", "verificaciones")''',
         '''if os.name == "nt":
                _base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
            else:
                _base = (os.environ.get("XDG_DATA_HOME")
                         or os.path.join(os.path.expanduser("~"), ".local", "share"))
            carpeta = os.path.join(_base, "IndieDL", "verificaciones")'''),
    ]
    text, n = apply(p.name, text, subs)
    if text != orig:
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: {n} parches (rutas XDG)")
    else:
        print(f"  - {p.name}: sin cambios")
    return True


# ─────────────────────────────────────────────────────────────
# SubsSaul.py: el launcher de Windows busca .exe / pythonw.exe y
# %LOCALAPPDATA%; en Linux no sirve. Se reemplaza por completo.
# ─────────────────────────────────────────────────────────────
def instalar_launcher_linux(here: Path) -> bool:
    destino = here / "SubsSaul.py"
    if destino.exists() and "indiedl-linux-launcher-v1" in destino.read_text(
            encoding="utf-8", errors="replace"):
        print("  - SubsSaul.py: sin cambios (ya es la versión Linux)")
        return True
    fuente = Path(__file__).resolve().with_name("SubsSaul.linux.py")
    if not fuente.is_file():
        print("  ! SubsSaul.linux.py no encontrado: el launcher de Resolve "
              "seguirá siendo el de Windows", file=sys.stderr)
        return False
    destino.write_text(fuente.read_text(encoding="utf-8"), encoding="utf-8")
    print("  ok SubsSaul.py: launcher de Resolve adaptado a Linux")
    return True


# ─────────────────────────────────────────────────────────────
# Verificación estricta: si un patrón dejó de coincidir tras una
# actualización del código Windows, el instalador debe FALLAR y no
# dejar una instalación de Linux a medias y silenciosa.
# ─────────────────────────────────────────────────────────────
REQUERIDO = {
    "subtitulos.py": ["pc.set_dpi_aware()", "pc.resolve_scripting_paths()"],
    "subtitulos_ui.py": ["pc.open_path("],
    "indie_ui.py": ["pc.font_file("],
    "gpu_runtime.py": ["LD_LIBRARY_PATH"],
    "cortes.py": ["pc.resolve_scripting_paths()"],
    "SubsSaul.py": ["indiedl-linux-launcher-v1"],
}

PROHIBIDO = {
    "subtitulos.py": ["ctypes.windll.shcore.SetProcessDpiAwareness",
                      'r"C:\\ProgramData\\Blackmagic Design'],
    "subtitulos_ui.py": ["os.startfile("],
    "indie_ui.py": ['"C:/Windows/Fonts/" + name'],
    "SubsSaul.py": ["pythonw.exe", "LOCALAPPDATA"],
}


def verificar(here: Path) -> list[str]:
    problemas: list[str] = []
    for nombre, marcadores in REQUERIDO.items():
        p = here / nombre
        if not p.is_file():
            problemas.append(f"{nombre}: archivo no encontrado")
            continue
        texto = p.read_text(encoding="utf-8", errors="replace")
        for marca in marcadores:
            if marca not in texto:
                problemas.append(f"{nombre}: falta {marca!r} (parche no aplicado)")
        for marca in PROHIBIDO.get(nombre, []):
            if marca in texto:
                problemas.append(f"{nombre}: sigue presente {marca!r}")
        # Un parche mal aplicado puede dejar el archivo con sintaxis inválida.
        if p.suffix == ".py":
            try:
                compile(texto, str(p), "exec")
            except SyntaxError as exc:
                problemas.append(f"{nombre}: error de sintaxis ({exc})")
    return problemas


def main() -> int:
    here = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
    print(f"Parcheando Indie Now Subtítulos en {here}…\n")
    targets = {
        "subtitulos.py": patch_subtitulos,
        "subtitulos_ui.py": patch_subtitulos_ui,
        "indie_ui.py": patch_indie_ui,
        "gpu_runtime.py": patch_gpu_runtime,
        "cortes.py": patch_cortes,
        "verificacion.py": patch_verificacion,
    }
    for name, fn in targets.items():
        candidate = here / name
        if candidate.exists():
            fn(candidate)
        else:
            print(f"  · {name}: no encontrado (saltando)")
    instalar_launcher_linux(here)

    problemas = verificar(here)
    if problemas:
        print("\nERROR: la conversión a Linux quedó incompleta:", file=sys.stderr)
        for x in problemas:
            print(f"  - {x}", file=sys.stderr)
        print("\nRevisá cachyos/subs/parche.py: cambió el código de Windows "
              "y algún patrón ya no coincide.", file=sys.stderr)
        return 1
    print("\nVerificación: todos los parches aplicados y sintaxis OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
