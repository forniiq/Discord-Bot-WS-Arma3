@echo off
chcp 65001 >nul
setlocal

title WarSpectra Bot - HARD UPDATE

set "PROJECT_DIR=E:\Discord-Bot-WS-Arma"
set "GIT_PATH=E:\Git"
set "NODE_PATH=E:\node-portable"

set "PATH=%GIT_PATH%\cmd;%GIT_PATH%\bin;%NODE_PATH%;%PATH%"

echo ==========================================
echo      WAR SPECTRA BOT - HARD UPDATE
echo ==========================================
echo.
echo WARNING!
echo Все локальные изменения Git будут удалены.
echo.

choice /C YN /N /M "Продолжить? [Y/N]: "

if errorlevel 2 (
    echo.
    echo Отмена.
    pause
    exit /b 0
)

echo.

cd /d "%PROJECT_DIR%"

if errorlevel 1 (
    echo [ERROR] Не удалось перейти в папку проекта.
    pause
    exit /b 1
)

echo [1/6] Проверка Git...
git --version

if errorlevel 1 (
    echo [ERROR] Git не найден.
    pause
    exit /b 1
)

echo.
echo [2/6] Получение обновлений с GitHub...
git fetch origin

if errorlevel 1 (
    echo [ERROR] git fetch завершился с ошибкой.
    pause
    exit /b 1
)

echo.
echo [3/6] Сброс локальных изменений...
git reset --hard origin/main

if errorlevel 1 (
    echo [ERROR] Не удалось выполнить git reset.
    pause
    exit /b 1
)

echo.
echo [4/6] Удаление неотслеживаемых файлов...
git clean -fd

if errorlevel 1 (
    echo [ERROR] git clean завершился с ошибкой.
    pause
    exit /b 1
)

echo.
echo [5/6] Установка зависимостей...
call "%NODE_PATH%\npm.cmd" install

if errorlevel 1 (
    echo [ERROR] npm install завершился с ошибкой.
    pause
    exit /b 1
)

echo.
echo [6/6] Сборка CommandKit...
call "%NODE_PATH%\npm.cmd" run build

if errorlevel 1 (
    echo [ERROR] Сборка CommandKit завершилась с ошибкой.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo        HARD UPDATE ЗАВЕРШЕН
echo ==========================================
echo.
echo Проект полностью синхронизирован с origin/main.
echo.

pause