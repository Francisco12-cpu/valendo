@echo off
chcp 65001 >nul
title Valendo! - sala sem internet (servidor local)
cd /d "%~dp0"

echo.
echo   ==========================================
echo     Valendo!  -  sala sem internet
echo   ==========================================
echo.
echo   Os alunos precisam estar no MESMO Wi-Fi deste computador
echo   (ou no roteador do celular do professor).
echo   Abaixo aparecem os enderecos para o professor e para os alunos.
echo   Para desligar: feche esta janela ou aperte Ctrl+C
echo.

where node >nul 2>nul
if not %errorlevel%==0 (
  echo   [ERRO] Este modo precisa do Node.js: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

start "" cmd /c "timeout /t 2 >nul & start http://localhost:8080/#/sala?modo=local"
node server\valendo-server.js
pause
