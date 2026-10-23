@echo off
chcp 65001 >nul
title Valendo! - servidor local
cd /d "%~dp0"

set PORTA=8080
set URL=http://127.0.0.1:%PORTA%

echo.
echo   ==========================================
echo     Valendo!  -  servidor local de teste
echo   ==========================================
echo.
echo   Endereco: %URL%
echo   Para parar: feche esta janela ou aperte Ctrl+C
echo.

rem Abre o navegador depois de 2 segundos (tempo do servidor subir)
start "" cmd /c "timeout /t 2 >nul & start %URL%"

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server %PORTA% --bind 127.0.0.1
  goto fim
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server %PORTA% --bind 127.0.0.1
  goto fim
)

where npx >nul 2>nul
if %errorlevel%==0 (
  npx --yes serve -l tcp://127.0.0.1:%PORTA% .
  goto fim
)

echo   [ERRO] Nao encontrei Python nem Node.js neste computador.
echo   Instale um deles:
echo     - Python: https://www.python.org/downloads/
echo     - Node.js: https://nodejs.org/
echo.

:fim
pause
