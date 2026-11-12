#!/usr/bin/env python3
"""Adapta Indie Now DL (versión actual) a Linux/CachyOS.

Uso:  python3 parche.py [carpeta]
      (por defecto, la carpeta donde está este archivo)

Es idempotente: si ya está parcheado, no cambia nada. Los parches son
reemplazos de texto sobre los archivos originales; no tocan la versión de
Windows del repo.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def ensure_import(text: str) -> str:
    """Asegura `import plat_compat as pc` después de los imports base."""
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
    """Aplica una lista de tuplas (patrón, reemplazo, [regex])."""
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
        if n and new_text != text:
            text = new_text
            applied += 1
    return text, applied


def insert_after_docstring(p: Path, func: str, line: str, marker: str) -> bool:
    """Inserta `line` al inicio del cuerpo de `func`, después del docstring."""
    lines = p.read_text(encoding="utf-8").splitlines(keepends=True)
    start = next((i for i, l in enumerate(lines) if l.startswith(func)), None)
    if start is None:
        print(f"  - {p.name}: {func} no encontrado")
        return False
    if any(marker in l for l in lines[start:start + 30]):
        print(f"  - {p.name}: sin cambios (ya parcheado)")
        return False
    j = start + 1
    if j < len(lines) and lines[j].lstrip().startswith('"""'):
        if lines[j].count('"""') < 2:
            j += 1
            while j < len(lines) and '"""' not in lines[j]:
                j += 1
        j += 1
    lines.insert(j, line)
    p.write_text("".join(lines), encoding="utf-8")
    print(f"  ok {p.name}: {func} adaptado a Linux")
    return True


# ─────────────────────────────────────────────────────────────
# indiedl_core.py
# ─────────────────────────────────────────────────────────────
def patch_core(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    orig = text

    subs = [
        # Rutas XDG en lugar de %LOCALAPPDATA%
        ("""APP_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "IndieDL"
CFG_FILE = APP_DIR / "config.json"
LOG_FILE = APP_DIR / "indiedl.log"
TEMP_DIR = APP_DIR / "tmp"
NO_WINDOW = 0x08000000 if os.name == "nt" else 0""",
         """APP_DIR = pc.app_dir("IndieDL")
CFG_FILE = APP_DIR / "config.json"
LOG_FILE = APP_DIR / "indiedl.log"
TEMP_DIR = APP_DIR / "tmp"
NO_WINDOW = pc.NO_WINDOW"""),

        # register(): .desktop + xdg-mime en Linux
        (r"def register\(\):.*?(?=\ndef )",
         "def register():\n"
         "    script = Path(__file__).resolve().with_name('indiedl.py')\n"
         "    if not script.exists():\n"
         "        script = Path(__file__).resolve()\n"
         "    if not pc.register_protocol(script):\n"
         "        log('Registro de protocolo no disponible en este SO.')\n\n",
         True),

        # Perfiles de navegador para cookies (Helium, Chrome, Brave, Firefox, Zen)
        (r"def browser_profile_candidates\(\):.*?(?=\ndef )",
         "def browser_profile_candidates():\n"
         "    return pc.browser_profiles()\n\n",
         True),

        # DPAPI es de Windows: en Linux se guarda el cookie sin cifrar (permisos 600)
        # (se aplica aparte con patch_dpapi, porque el docstring es multilínea)

        # Caché XDG
        ('cache_dir = APP_DIR / "cache"',
         'cache_dir = pc.cache_dir(APP_DIR)'),

        # Carpeta de descarga por defecto (xdg-user-dir VIDEOS)
        ('    "last_dir": "E:\\\\" if os.path.isdir("E:\\\\") else str(Path.home() / "Videos"),',
         '    "last_dir": str(pc.download_dir()),'),

        # No cambiar el directorio de trabajo global
        ("""    try: os.chdir(str(APP_DIR))
    except OSError: pass
    return temp_path""",
         "    return temp_path"),

        # Fuentes del banner halftone
        ("""    for p in ("C:/Windows/Fonts/seguibl.ttf", "C:/Windows/Fonts/ariblk.ttf", "C:/Windows/Fonts/arialbd.ttf",
              "DejaVuSans-Bold.ttf"):""",
         """    _fp = pc.font_file("seguibl.ttf", "ariblk.ttf", "arialbd.ttf")
    for p in ([_fp] if _fp else []):"""),
    ]

    text, n = apply(p.name, text, subs, required_any=True)
    if text != orig:
        text = ensure_import(text)
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: {n} parches")
    else:
        print(f"  - {p.name}: sin cambios")
    insert_after_docstring(p, "def _dpapi_ba(",
                           '    if os.name != "nt":\n        return bytes(data)\n',
                           'if os.name != "nt":')
    return True


# ─────────────────────────────────────────────────────────────
# indiedl_ui.py
# ─────────────────────────────────────────────────────────────
def patch_ui(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    orig = text

    subs = [
        # Abrir carpetas con xdg-open
        ("""    def open_dir(self, p):
        try:
            os.startfile(p)
        except Exception:
            pass""",
         """    def open_dir(self, p):
        pc.open_path(p)"""),

        # Iconos de sitio: fuente del sistema en Linux
        ("""        try:
            font = ImageFont.truetype("C:/Windows/Fonts/seguisym.ttf", 66)
        except Exception:
            try: font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 66)
            except Exception: font = ImageFont.load_default()""",
         """        _fp = pc.font_file("seguisym.ttf", "arial.ttf", "arialbd.ttf")
        try:
            font = ImageFont.truetype(_fp, 66) if _fp else ImageFont.load_default()
        except Exception:
            font = ImageFont.load_default()"""),

        # Diálogos nativos KDE/GTK (kdialog/zenity) con vuelta a Tk
        ('def build_app():\n    ctk.set_appearance_mode("dark")',
         'def build_app():\n    pc.patch_tkinter_dialogs()\n    ctk.set_appearance_mode("dark")'),
    ]

    text, n = apply(p.name, text, subs, required_any=True)
    if text != orig:
        text = ensure_import(text)
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: {n} parches")
    else:
        print(f"  - {p.name}: sin cambios")
    return True


def patch_entry(p: Path) -> bool:
    """`indiedl.py --register-only` también registra en Linux."""
    text = p.read_text(encoding="utf-8")
    orig = text
    subs = [
        ('''        try:
            if os.name == "nt":
                register()
                log("Protocolo ytdl:// registrado por el instalador.")''',
         '''        try:
            register()
            log("Protocolo ytdl:// registrado.")'''),
    ]
    text, n = apply(p.name, text, subs, required_any=True)
    if text != orig:
        p.write_text(text, encoding="utf-8")
        print(f"  ok {p.name}: {n} parches")
    else:
        print(f"  - {p.name}: sin cambios")
    return True


def main() -> int:
    here = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
    print(f"Parcheando Indie Now DL en {here}…\n")
    targets = {
        "indiedl_core.py": patch_core,
        "indiedl_ui.py": patch_ui,
        "indiedl.py": patch_entry,
    }
    for name, fn in targets.items():
        candidate = here / name
        if candidate.exists():
            fn(candidate)
        else:
            print(f"  · {name}: no encontrado (saltando)")
    print("\nListo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
