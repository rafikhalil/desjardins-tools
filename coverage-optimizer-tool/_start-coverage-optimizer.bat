@echo off
setlocal

rem Coverage Optimizer - launcher. Runs backend_files\server.py in THIS window (close the
rem window, or press Ctrl+C, to stop the server) and opens the tool in the browser.
rem Served over http (not opened from disk) so the pre-load page can fetch() rates\, the
rem browser never serves a stale .js, and Save Test can write into history_data\.

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
        echo     python backend_files\server.py %PORT%
        pause
        exit /b 1
    )
)

rem Open the browser ~2 s from now, in the background of THIS window (no second console).
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/backend_files/optimizer.html'"

echo Coverage Optimizer server on port %PORT% - close this window (or press Ctrl+C) to stop it.
%PYCMD% backend_files\server.py %PORT%

rem Only reached if the server stopped by itself (e.g. the port is already in use) - keep the message readable.
pause
