@echo off
chcp 65001 >nul
setlocal

title WarSpectra Discord Bot

set "PROJECT_DIR=E:\Discord-Bot-WS-Arma"
set "GIT_PATH=E:\Git"
set "NODE_PATH=E:\node-portable"

set "PATH=%GIT_PATH%\cmd;%GIT_PATH%\bin;%NODE_PATH%;%PATH%"

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
echo ==========================================
echo          АВТОПЕРЕЗАПУСК ВКЛЮЧЕН
echo          Задержка: 5 секунд
echo ==========================================
echo.

:START

echo.
echo ==========================================
echo [INFO] Запуск бота...
echo ==========================================
echo.

call "%NODE_PATH%\npm.cmd" run start

echo.
echo ==========================================
echo [WARNING] Бот остановился!
echo ==========================================
echo.
echo Перезапуск через 5 секунд...
echo.

timeout /t 5 /nobreak >nul

goto START