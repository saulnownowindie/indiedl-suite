"""Capa de compatibilidad Windows/Linux. Importar como `import plat_compat as pc`."""
from __future__ import annotations
import os, shutil, subprocess, sys
from pathlib import Path

IS_WIN = os.name == "nt"
NO_WINDOW = 0x08000000 if IS_WIN else 0


# ── Rutas XDG ────────────────────────────────────────────────
def app_dir(name: str = "IndieDL") -> Path:
    if IS_WIN:
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home())
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or (Path.home() / ".local/share"))
    d = base / name
    d.mkdir(parents=True, exist_ok=True)
    return d


def cache_dir(app: Path) -> Path:
    if IS_WIN:
        d = app / "cache"
    else:
        base = Path(os.environ.get("XDG_CACHE_HOME") or (Path.home() / ".cache"))
        d = base / app.name
    d.mkdir(parents=True, exist_ok=True)
    return d


def download_dir() -> Path:
    """Carpeta de descargas por defecto, respetando la del escritorio."""
    if IS_WIN:
        return Path("E:/") if Path("E:/").is_dir() else Path.home() / "Videos"
    try:
        out = subprocess.run(["xdg-user-dir", "VIDEOS"], capture_output=True,
                             text=True, timeout=5).stdout.strip()
        if out and Path(out).is_dir():
            return Path(out)
    except Exception:
        pass
    return Path.home() / "Videos"


def popen_extra() -> dict:
    return {"creationflags": NO_WINDOW} if IS_WIN else {}


# ── Abrir rutas ──────────────────────────────────────────────
def open_path(path: str) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        if IS_WIN:
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


# ── Procesos ─────────────────────────────────────────────────
def list_processes() -> list[str]:
    if IS_WIN:
        try:
            out = subprocess.run(["tasklist", "/FO", "CSV", "/NH"],
                                 capture_output=True, text=True, timeout=20,
                                 creationflags=NO_WINDOW).stdout
            return [ln.split('"')[1] for ln in out.splitlines()
                    if ln.strip().startswith('"')]
        except Exception:
            return []
    try:
        import psutil
        return [p.info["name"] for p in psutil.process_iter(["name"])
                if p.info.get("name")]
    except Exception:
        try:
            out = subprocess.run(["ps", "-eo", "comm="],
                                 capture_output=True, text=True).stdout
            return [ln.strip() for ln in out.splitlines() if ln.strip()]
        except Exception:
            return []


def kill_process(name: str) -> None:
    try:
        if IS_WIN:
            subprocess.run(["taskkill", "/F", "/T", "/IM", name],
                           capture_output=True, timeout=20,
                           creationflags=NO_WINDOW)
        else:
            subprocess.run(["pkill", "-f", name], capture_output=True, timeout=10)
    except Exception:
        pass


# ── DPI / barra de título oscura ─────────────────────────────
def set_dpi_aware() -> None:
    if not IS_WIN:
        return
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass


def apply_dark_titlebar(root) -> None:
    if not IS_WIN:
        return
    try:
        import ctypes
        hwnd = ctypes.windll.user32.GetParent(root.winfo_id()) or root.winfo_id()
        v = ctypes.c_int(1)
        for attr in (20, 19):
            if ctypes.windll.dwmapi.DwmSetWindowAttribute(
                    hwnd, attr, ctypes.byref(v), ctypes.sizeof(v)) == 0:
                break
    except Exception:
        pass


# ── Integridad (Windows only) ────────────────────────────────
def low_integrity() -> bool:
    if not IS_WIN:
        return False
    try:
        import ctypes
        from ctypes import wintypes
        adv = ctypes.WinDLL("advapi32", use_last_error=True)
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.GetCurrentProcess.restype = wintypes.HANDLE
        k32.CloseHandle.argtypes = [wintypes.HANDLE]
        adv.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD,
                                         ctypes.POINTER(wintypes.HANDLE)]
        adv.GetTokenInformation.argtypes = [wintypes.HANDLE, ctypes.c_int,
                                            ctypes.c_void_p, wintypes.DWORD,
                                            ctypes.POINTER(wintypes.DWORD)]
        adv.GetSidSubAuthorityCount.argtypes = [ctypes.c_void_p]
        adv.GetSidSubAuthorityCount.restype = ctypes.POINTER(ctypes.c_ubyte)
        adv.GetSidSubAuthority.argtypes = [ctypes.c_void_p, wintypes.DWORD]
        adv.GetSidSubAuthority.restype = ctypes.POINTER(wintypes.DWORD)
        tok = wintypes.HANDLE()
        if not adv.OpenProcessToken(k32.GetCurrentProcess(), 0x0008,
                                    ctypes.byref(tok)):
            return False
        try:
            need = wintypes.DWORD(0)
            adv.GetTokenInformation(tok, 25, None, 0, ctypes.byref(need))
            buf = ctypes.create_string_buffer(need.value)
            if not adv.GetTokenInformation(tok, 25, buf, need, ctypes.byref(need)):
                return False
            sid = ctypes.c_void_p.from_buffer(buf).value
            count = adv.GetSidSubAuthorityCount(sid).contents.value
            rid = adv.GetSidSubAuthority(sid, count - 1).contents.value
            return rid < 0x2000
        finally:
            k32.CloseHandle(tok)
    except Exception:
        return False


# ── Registro protocolo ytdl:// ───────────────────────────────
def register_protocol(script_path: Path, venv_python: str | None = None) -> bool:
    """En Linux crea un .desktop + asocia el scheme. En Windows usa el registro."""
    if IS_WIN:
        try:
            import winreg
            pyw = venv_python or sys.executable
            cmd = f'"{pyw}" "{script_path}" "%1"'
            base = r"Software\Classes\ytdl"
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as k:
                winreg.SetValueEx(k, "", 0, winreg.REG_SZ, "URL:ytdl Protocol")
                winreg.SetValueEx(k, "URL Protocol", 0, winreg.REG_SZ, "")
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER,
                                  base + r"\shell\open\command") as k:
                winreg.SetValueEx(k, "", 0, winreg.REG_SZ, cmd)
            return True
        except Exception:
            return False
    # Linux: escribir .desktop y llamar xdg-mime
    try:
        py = venv_python or sys.executable
        apps = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "applications"
        apps.mkdir(parents=True, exist_ok=True)
        desktop = apps / "indiedl.desktop"
        desktop.write_text(f"""[Desktop Entry]
Type=Application
Name=Indie Now DL
Comment=Descargador de videos, audios e imágenes
Exec="{py}" "{script_path}" %u
Icon=video-x-generic
Terminal=false
Categories=AudioVideo;
MimeType=x-scheme-handler/ytdl;
""", encoding="utf-8")
        try:
            subprocess.run(["update-desktop-database", str(apps)],
                           capture_output=True, timeout=10)
        except Exception:
            pass
        try:
            subprocess.run(["xdg-mime", "default", "indiedl.desktop",
                            "x-scheme-handler/ytdl"], capture_output=True, timeout=10)
        except Exception:
            pass
        return True
    except Exception:
        return False


# ── DaVinci Resolve ──────────────────────────────────────────
def resolve_scripting_paths() -> tuple[str, str]:
    if IS_WIN:
        prog = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
        api = os.environ.get("RESOLVE_SCRIPT_API") or os.path.join(
            prog, "Blackmagic Design", "DaVinci Resolve", "Support",
            "Developer", "Scripting")
        lib = os.environ.get("RESOLVE_SCRIPT_LIB") or os.path.join(
            os.environ.get("PROGRAMFILES", r"C:\Program Files"),
            "Blackmagic Design", "DaVinci Resolve", "fusionscript.dll")
        return api, lib
    api = os.environ.get("RESOLVE_SCRIPT_API") or "/opt/resolve/Developer/Scripting"
    lib = os.environ.get("RESOLVE_SCRIPT_LIB") or "/opt/resolve/libs/Fusion/fusionscript.so"
    return api, lib


# ── ffmpeg ───────────────────────────────────────────────────
def find_ffmpeg() -> str | None:
    p = shutil.which("ffmpeg")
    if p:
        return p
    if IS_WIN:
        try:
            app = app_dir("IndieDL")
            for c in (app / "ffmpeg.exe", app / "bin" / "ffmpeg.exe"):
                if c.is_file():
                    return str(c)
        except Exception:
            pass
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def find_ffprobe(ffmpeg: str | None = None) -> str | None:
    p = shutil.which("ffprobe")
    if p:
        return p
    if ffmpeg:
        side = Path(ffmpeg).with_name("ffprobe.exe" if IS_WIN else "ffprobe")
        if side.is_file():
            return str(side)
    return None


# ── Fuentes para PIL/Tk ──────────────────────────────────────
_FONT_CACHE: dict[str, str | None] = {}


def font_file(*names: str) -> str | None:
    """Devuelve la primera fuente disponible (para usar con PIL)."""
    key = "|".join(names)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    result = None
    if IS_WIN:
        for n in names:
            p = Path("C:/Windows/Fonts") / n
            if p.is_file():
                result = str(p)
                break
    if result is None:
        fallbacks = [
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/liberation-sans/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/google-noto/NotoSans-Bold.ttf",
            "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
        ]
        for p in fallbacks:
            if Path(p).is_file():
                result = p
                break
    if result is None:
        try:
            out = subprocess.run(["fc-match", "-f", "%{file}", "sans:bold"],
                                 capture_output=True, text=True, timeout=5).stdout.strip()
            if out and Path(out).is_file():
                result = out
        except Exception:
            pass
    _FONT_CACHE[key] = result
    return result


# ── Perfiles de navegador (cookies) ─────────────────────────
def browser_profiles() -> list[dict]:
    """Lista [{browser, profile, stamp}, ...] con perfiles que tengan cookies."""
    home = Path.home()
    cands: list[dict] = []

    def _add(browser: str, profile: Path):
        try:
            ck = profile / "cookies.sqlite"
            if IS_WIN:
                ck = profile / "Network" / "Cookies"
                if not ck.exists():
                    ck = profile / "Cookies"
            if not ck.exists():
                return
            stamp = ck.stat().st_mtime
        except OSError:
            return
        cands.append({"browser": browser, "profile": str(profile),
                      "stamp": stamp})

    if IS_WIN:
        appdata = Path(os.environ.get("APPDATA", home / "AppData/Roaming"))
        local = Path(os.environ.get("LOCALAPPDATA", home / "AppData/Local"))
        ffs = [
            ("zen", appdata / "zen/Profiles"),
            ("zen", appdata / "Zen/Profiles"),
            ("firefox", appdata / "Mozilla/Firefox/Profiles"),
        ]
        chrs = [
            ("chrome", local / "Google/Chrome/User Data"),
            ("edge", local / "Microsoft/Edge/User Data"),
            ("brave", local / "BraveSoftware/Brave-Browser/User Data"),
            ("helium", local / "imput/Helium/User Data"),
        ]
    else:
        config = Path(os.environ.get("XDG_CONFIG_HOME", home / ".config"))
        ffs = [
            ("zen", home / ".zen"),
            ("zen", config / "zen"),
            ("firefox", home / ".mozilla/firefox"),
        ]
        chrs = [
            ("chrome", config / "google-chrome"),
            ("chromium", config / "chromium"),
            ("brave", config / "BraveSoftware/Brave-Browser"),
            ("edge", config / "microsoft-edge"),
            ("helium", config / "net.imput.helium"),
        ]

    for browser, root in ffs:
        if not root.is_dir():
            continue
        for child in root.iterdir():
            if child.is_dir():
                _add(browser, child)

    for browser, root in chrs:
        if not root.is_dir():
            continue
        for name in ("Default", "Profile 1", "Profile 2", "Profile 3"):
            p = root / name
            if p.is_dir():
                _add(browser, p)

    cands.sort(key=lambda c: (c["browser"] in ("zen", "firefox"), c["stamp"]),
               reverse=True)
    return cands


# ── Diálogos nativos (KDE/GTK) ───────────────────────────────
_DIALOGS_PATCHED = False


def patch_tkinter_dialogs() -> None:
    """Usa kdialog (KDE) o zenity (GTK) para elegir archivos y carpetas.

    El selector propio de Tk no sigue el tema del escritorio y en Wayland
    puede quedar detrás de la ventana. Si no hay herramienta nativa, o si
    algo falla, se conservan los diálogos originales de Tkinter.
    """
    global _DIALOGS_PATCHED
    if IS_WIN or _DIALOGS_PATCHED:
        return
    try:
        import tkinter.filedialog as fd
    except Exception:
        return

    kdialog = shutil.which("kdialog")
    zenity = shutil.which("zenity")
    if not (kdialog or zenity):
        return

    def _kfilter(filetypes) -> str | None:
        """Filtros en formato Qt: 'Nombre (*.ext *.ext2)|Otro (*.x)'."""
        parts = []
        for name, patterns in filetypes or []:
            pats = str(patterns).split()
            if pats:
                parts.append(f"{name} ({' '.join(pats)})")
        return "|".join(parts) or None

    def _zfilter(filetypes) -> list[str]:
        """Filtros para zenity: ['Nombre | *.ext *.ext2', ...]."""
        out = []
        for name, patterns in filetypes or []:
            pats = str(patterns).split()
            if pats:
                out.append(f"{name} | {' '.join(pats)}")
        return out

    def _run(mode, initialdir=None, initialfile=None, filetypes=None,
             parent=None, title=None):
        start = os.path.abspath(os.path.expanduser(initialdir or str(Path.home())))
        title = title or "IndieDL"

        if kdialog:
            cmd = [kdialog, "--title", title]
            if mode == "save":
                cmd.append("--getsavefilename")
                cmd.append(os.path.join(start, initialfile) if initialfile else start)
                kf = _kfilter(filetypes)
                if kf:
                    cmd.append(kf)
            elif mode == "dir":
                cmd.extend(["--getexistingdirectory", start])
            else:
                cmd.append("--getopenfilename")
                cmd.append(start)
                kf = _kfilter(filetypes)
                if kf:
                    cmd.append(kf)
            # --attach solo entiende ventanas X11; en Wayland se omite.
            if os.environ.get("XDG_SESSION_TYPE", "").lower() != "wayland":
                try:
                    import tkinter as tk
                    win = parent if parent is not None else tk._default_root
                    if win is not None:
                        win.update_idletasks()
                        cmd.extend(["--attach", str(win.winfo_id())])
                except Exception:
                    pass
            try:
                res = subprocess.run(cmd, capture_output=True, text=True)
                if res.returncode == 0:
                    return res.stdout.strip()
                if res.returncode == 1:
                    return ""  # el usuario canceló
            except Exception:
                pass

        if zenity:
            cmd = [zenity, "--file-selection", "--title", title]
            if mode == "save":
                cmd.append("--save")
                cmd.extend(["--filename",
                            os.path.join(start, initialfile) if initialfile else start])
            elif mode == "dir":
                cmd.extend(["--directory", "--filename", start])
            else:
                cmd.extend(["--filename",
                            os.path.join(start, initialfile) if initialfile else start])
            for f in _zfilter(filetypes):
                cmd.extend(["--file-filter", f])
            try:
                res = subprocess.run(cmd, capture_output=True, text=True)
                if res.returncode == 0:
                    return res.stdout.strip()
                if res.returncode == 1:
                    return ""  # el usuario canceló
            except Exception:
                pass

        return None

    old_open = fd.askopenfilename
    old_save = fd.asksaveasfilename
    old_dir = fd.askdirectory

    def new_open(*args, **kwargs):
        if args:  # llamadas posicionales: que las maneje Tk
            return old_open(*args, **kwargs)
        res = _run("open", kwargs.get("initialdir"), kwargs.get("initialfile"),
                   kwargs.get("filetypes"), kwargs.get("parent"),
                   kwargs.get("title"))
        return res if res is not None else old_open(**kwargs)

    def new_save(*args, **kwargs):
        if args:
            return old_save(*args, **kwargs)
        res = _run("save", kwargs.get("initialdir"), kwargs.get("initialfile"),
                   kwargs.get("filetypes"), kwargs.get("parent"),
                   kwargs.get("title"))
        return res if res is not None else old_save(**kwargs)

    def new_dir(*args, **kwargs):
        if args:
            return old_dir(*args, **kwargs)
        res = _run("dir", kwargs.get("initialdir"), None, None,
                   kwargs.get("parent"), kwargs.get("title"))
        return res if res is not None else old_dir(**kwargs)

    fd.askopenfilename = new_open
    fd.asksaveasfilename = new_save
    fd.askdirectory = new_dir
    _DIALOGS_PATCHED = True