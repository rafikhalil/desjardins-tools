@echo off
setlocal

rem Coverage Optimizer — local dev server.
rem Serves this folder over http(s) instead of opening optimizer.html
rem directly from disk — needed for fetch() (e.g. the Rates tab's
rem "Load from rates/" button) and to dodge stale-cache issues where the
rem browser holds on to an old .js file after an edit (OPTIMIZER_REFERENCE.md
rem "Running it").

cd /d "%~dp0"
set PORT=8000

where python >nul 2>nul
if %errorlevel%==0 (
    set PYCMD=python
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (
        set PYCMD=py
    ) else (
        echo Python was not found on PATH.
        echo Install Python 3, or run this manually from this folder:
        echo     python -m http.server %PORT%
        pause
        exit /b 1
    )
)

start "Coverage Optimizer server (port %PORT%) - close this window to stop it" cmd /k %PYCMD% -m http.server %PORT%
timeout /t 2 /nobreak >nul
start "" http://localhost:%PORT%/optimizer.html

echo Server starting in a separate window on port %PORT%.
echo Close that window (or press Ctrl+C in it) to stop the server.
