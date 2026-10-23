@echo off
rem Starts Top Respuestas on this computer (no internet or deploy needed).
rem Always serves http://localhost:4173, so the browser keeps the same saved data.
cd /d "%~dp0"
title Top Respuestas

if not exist node_modules\.bin\vite.cmd call npm install
if not exist dist\index.html call npm run build

echo.
echo Top Respuestas: http://localhost:4173
echo Deja esta ventana abierta mientras juegas. Cierrala para detener la app.
echo.
call npm run servir
pause
