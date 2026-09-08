@echo off
chcp 65001 >nul
setlocal

title WarSpectra Bot - Update

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
echo        WAR SPECTRA BOT - UPDATE
echo ==========================================
echo.

echo [1/5] Проверка Git...
git --version

if errorlevel 1 (
    echo [ERROR] Git не найден.
    pause
    exit /b 1
)

echo.
echo [INFO] Node.js:
node --version

if errorlevel 1 (
    echo [ERROR] Node.js не найден.
    echo Проверь путь: %NODE_PATH%
    pause
    exit /b 1
)

echo.
echo [2/5] Получение обновлений с GitHub...

git fetch origin

if errorlevel 1 (
    echo [ERROR] Не удалось получить обновления.
    pause
    exit /b 1
)

echo.
echo [3/5] Обновление проекта...

git pull --ff-only

if errorlevel 1 (
    echo.
    echo [ERROR] Git не смог выполнить обновление.
    echo.
    echo Если нужно полностью сбросить локальные изменения,
    echo используй hard_update.bat
    echo.
    pause
    exit /b 1
)

echo.
echo [4/5] Установка зависимостей...

call "%NODE_PATH%\npm.cmd" install

if errorlevel 1 (
    echo [ERROR] npm install завершился с ошибкой.
    pause
    exit /b 1
)

echo.
echo [5/5] Сборка CommandKit...

call "%NODE_PATH%\npm.cmd" run build

if errorlevel 1 (
    echo.
    echo [ERROR] Сборка CommandKit завершилась с ошибкой.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo       ОБНОВЛЕНИЕ ЗАВЕРШЕНО
echo ==========================================
echo.

pause
exit /b 0