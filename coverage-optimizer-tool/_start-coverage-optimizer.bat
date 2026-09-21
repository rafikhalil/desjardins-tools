@echo off
setlocal

rem Coverage Optimizer — local server (server.py).
rem Serves this folder over http instead of opening optimizer.html directly
rem from disk — needed for fetch() (the pre-load page loads rates/ this way),
rem to dodge stale-cache issues where the browser holds on to an old .js file
rem after an edit (OPTIMIZER_REFERENCE.md "Running it"), and so Save Test can
rem write its .json straight into data/ (server.py, this PC only).

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
        echo     python server.py %PORT%
        pause
        exit /b 1
    )
)

start "Coverage Optimizer server (port %PORT%) - close this window to stop it" cmd /k %PYCMD% server.py %PORT%
timeout /t 2 /nobreak >nul
start "" http://localhost:%PORT%/optimizer.html

echo Server starting in a separate window on port %PORT%.
echo Close that window (or press Ctrl+C in it) to stop the server.
