@echo off
setlocal
cd /d "%~dp0"
title Indie Now Suite - Instalacion completa

echo ============================================================
echo   INDIE NOW SUITE - instalacion completa (Windows)
echo ============================================================
echo.
echo   Se instalan las tres herramientas en este orden:
echo     1. Descargador  (Indie Now DL)
echo     2. Subtitulos   (DaVinci Resolve)
echo     3. MusoSoup     (guiones)
echo.
echo   Cada paso pide Enter al terminar. Podes cerrar la ventana
echo   y ejecutar solo el que te falte.
echo.
pause

echo.
echo [1/3] Descargador
call "%~dp0descargador\INSTALAR.bat"

echo.
echo [2/3] Subtitulos
call "%~dp0subs\INSTALAR.bat"

echo.
echo [3/3] MusoSoup
call "%~dp0musosoup\INSTALAR_DESDE_CERO.bat"

echo.
echo ============================================================
echo   Listo.
echo ============================================================
pause
