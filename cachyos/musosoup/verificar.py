#!/usr/bin/env python3
"""Comprueba que MusoSoup quedó apto para Linux/CachyOS tras la copia.

MusoSoup no necesita parches: musosoup_diario.py y musosoup_ui.py ya
bifurcan por sistema operativo. Este verificador existe para que un cambio
futuro en la versión de Windows no reintroduzca silenciosamente una llamada
exclusiva de Windows. Devuelve 1 si encuentra algún problema.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

REQUERIDO = {
    "musosoup_ui.py": ["def _abrir(", "xdg-open", "Liberation Sans"],
    "musosoup_diario.py": ["soffice", "libreoffice", "from docx import Document"],
}


def main() -> int:
    here = (Path(sys.argv[1]).resolve() if len(sys.argv) > 1
            else Path(__file__).resolve().parent)
    print(f"Verificando MusoSoup para Linux en {here}…")
    problemas: list[str] = []

    for nombre, marcas in REQUERIDO.items():
        p = here / nombre
        if not p.is_file():
            problemas.append(f"{nombre}: archivo no encontrado")
            continue
        texto = p.read_text(encoding="utf-8", errors="replace")
        for marca in marcas:
            if marca not in texto:
                problemas.append(f"{nombre}: falta {marca!r}")
        try:
            compile(texto, str(p), "exec")
            arbol = ast.parse(texto, filename=str(p))
        except SyntaxError as exc:
            problemas.append(f"{nombre}: error de sintaxis ({exc})")
            continue
        # Solo llamadas reales: los comentarios y docstrings no cuentan.
        lineas = texto.splitlines()
        for nodo in ast.walk(arbol):
            if not (isinstance(nodo, ast.Attribute) and nodo.attr == "startfile"
                    and isinstance(nodo.value, ast.Name)
                    and nodo.value.id == "os"):
                continue
            linea = (lineas[nodo.lineno - 1]
                     if nodo.lineno <= len(lineas) else "")
            if 'os.name == "nt"' not in linea:
                problemas.append(
                    f"{nombre}:{nodo.lineno}: os.startfile() sin protección de SO")

    if problemas:
        print("ERROR: MusoSoup no está listo para Linux:", file=sys.stderr)
        for x in problemas:
            print(f"  - {x}", file=sys.stderr)
        return 1
    print("Verificación: MusoSoup compatible con Linux y sintaxis OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
