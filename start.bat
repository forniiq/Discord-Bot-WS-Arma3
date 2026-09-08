@echo off
chcp 65001 >nul
setlocal

title WarSpectra Discord Bot

set "PROJECT_DIR=E:\Discord-Bot-WS-Arma"
set "GIT_DIR=E:\Git"
set "NODE_DIR=E:\node-portable"

set "PATH=%GIT_DIR%\cmd;%GIT_DIR%\bin;%NODE_DIR%;%PATH%"

cd /d "%PROJECT_DIR%"

if errorlevel 1 (
    echo [ERROR] Не удалось перейти в папку проекта.
    pause
    exit /b 1
)

echo ==========================================
echo        WAR SPECTRA DISCORD BOT
echo ==========================================
echo.

echo [INFO] Node.js:
node --version

echo [INFO] npm:
call npm --version

echo.
echo [INFO] Запуск бота...
echo.

call "%NODE_DIR%\npm.cmd" run start

echo.
echo ==========================================
echo          БОТ ОСТАНОВЛЕН
echo ==========================================
echo.

pause