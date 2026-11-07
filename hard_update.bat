
@echo off
chcp 65001 >nul
setlocal EnableExtensions

title War Spectra Bot - HARD UPDATE

:: ==========================================
:: CONFIGURATION
:: ==========================================

set "PROJECT_DIR=E:\Discord-Bot-WS-Arma"
set "GIT_PATH=E:\Git"
set "NODE_PATH=E:\node-portable"

set "PATH=%GIT_PATH%\cmd;%GIT_PATH%\bin;%NODE_PATH%;%PATH%"

set "LOG_FILE=%PROJECT_DIR%\hard-update.log"

:: ==========================================
:: HEADER
:: ==========================================

cls
echo ==========================================
echo       WAR SPECTRA BOT - HARD UPDATE
echo ==========================================
echo.
echo WARNING!
echo Все локальные изменения Git будут удалены.
echo.
echo .env и другие ignored-файлы сохранятся.
echo.

choice /C YN /N /M "Продолжить? [Y/N]: "

if errorlevel 2 (
    echo.
    echo Обновление отменено.
    pause
    exit /b 0
)

:: ==========================================
:: PROJECT CHECK
:: ==========================================

if not exist "%PROJECT_DIR%\" (
    echo [ERROR] Папка проекта не найдена!
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"

echo.
echo ==========================================
echo [1/7] ПРОВЕРКА ОКРУЖЕНИЯ
echo ==========================================

git --version

if errorlevel 1 goto ERROR_GIT

node --version

if errorlevel 1 goto ERROR_NODE

call npm --version

if errorlevel 1 goto ERROR_NPM

if not exist ".git\" (
    echo [ERROR] Git-репозиторий не найден!
    goto ERROR
)

echo.
echo Проверка завершена.

:: ==========================================
:: STOP PROJECT NODE PROCESSES
:: ==========================================

echo.
echo ==========================================
echo [2/7] ПРОВЕРКА ПРОЦЕССОВ
echo ==========================================

echo.
echo Если бот запущен, остановите его вручную.
echo Обновление не будет завершать чужие процессы Node.js.
echo.

:: ==========================================
:: FETCH
:: ==========================================

echo.
echo ==========================================
echo [3/7] ПОЛУЧЕНИЕ ОБНОВЛЕНИЙ
echo ==========================================

set "FETCH_ATTEMPT=0"

:FETCH_RETRY

set /a FETCH_ATTEMPT+=1

echo.
echo Попытка %FETCH_ATTEMPT% из 3...

git fetch origin

if not errorlevel 1 goto FETCH_SUCCESS

if %FETCH_ATTEMPT% GEQ 3 (
    echo.
    echo [ERROR] Не удалось получить обновления.
    goto ERROR
)

echo.
echo Git завершился с ошибкой.
echo Закройте VS Code и другие программы,
echo использующие репозиторий.
echo.
echo Повтор через 3 секунды...

timeout /t 3 /nobreak >nul

goto FETCH_RETRY

:FETCH_SUCCESS

echo.
echo [OK] Обновления получены.

:: ==========================================
:: RESET
:: ==========================================

echo.
echo ==========================================
echo [4/7] СБРОС ЛОКАЛЬНЫХ ИЗМЕНЕНИЙ
echo ==========================================

git reset --hard origin/main

if errorlevel 1 (
    echo [ERROR] Не удалось выполнить git reset.
    goto ERROR
)

echo.
echo [OK] Репозиторий синхронизирован.

:: ==========================================
:: CLEAN
:: ==========================================

echo.
echo ==========================================
echo [5/7] ОЧИСТКА НЕОТСЛЕЖИВАЕМЫХ ФАЙЛОВ
echo ==========================================

git clean -fd

if errorlevel 1 (
    echo [ERROR] Не удалось выполнить git clean.
    goto ERROR
)

echo.
echo [OK] Очистка завершена.

:: ==========================================
:: NPM INSTALL
:: ==========================================

echo.
echo ==========================================
echo [6/7] УСТАНОВКА ЗАВИСИМОСТЕЙ
echo ==========================================

call npm install

if errorlevel 1 (
    echo [ERROR] npm install завершился с ошибкой.
    goto ERROR
)

echo.
echo [OK] Зависимости установлены.

:: ==========================================
:: BUILD
:: ==========================================

echo.
echo ==========================================
echo [7/7] СБОРКА COMMANDKIT
echo ==========================================

call npm run build

if errorlevel 1 (
    echo [ERROR] Сборка CommandKit завершилась с ошибкой.
    goto ERROR
)

:: ==========================================
:: SUCCESS
:: ==========================================

echo.
echo ==========================================
echo       HARD UPDATE ЗАВЕРШЕН
echo ==========================================
echo.
echo Проект синхронизирован с origin/main.
echo Зависимости установлены.
echo CommandKit успешно собран.
echo.
echo Не забудьте запустить бота.
echo.

pause
exit /b 0

:: ==========================================
:: ERRORS
:: ==========================================

:ERROR_GIT
echo [ERROR] Git не найден!
goto ERROR

:ERROR_NODE
echo [ERROR] Node.js не найден!
goto ERROR

:ERROR_NPM
echo [ERROR] npm не найден!
goto ERROR

:ERROR
echo.
echo ==========================================
echo       ОБНОВЛЕНИЕ ЗАВЕРШИЛОСЬ ОШИБКОЙ
echo ==========================================
echo.
echo Код ошибки: %ERRORLEVEL%
echo Проверьте вывод выше.
echo.
pause
exit /b 1
