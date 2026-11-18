@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist dados mkdir dados
where node >nul 2>nul || (echo O Node.js nao esta instalado. Instale em https://nodejs.org e tente de novo. & pause & exit /b 1)
echo Lendo as musicas do seu Drive (so leitura)...
node src/cli.js ler-drive
if errorlevel 1 (echo. & echo DEU ERRO. Leia a mensagem acima.) else (echo. & echo Tudo certo.)
pause
