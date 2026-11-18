@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist dados mkdir dados
where node >nul 2>nul || (echo O Node.js nao esta instalado. Instale a versao LTS em https://nodejs.org e tente de novo. & pause & exit /b 1)
echo Abrindo o Toxic Music Discovery... (deixe esta janela aberta)
node src/cli.js servir
echo.
echo O programa fechou. Se apareceu ERRO acima, me conte o que estava escrito.
pause
