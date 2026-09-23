@echo off
setlocal

rem Inforce Tool - launcher. Runs backend\server.py in THIS window (close the
rem window, or press Ctrl+C, to stop the server) and opens the tool in the
rem browser. Served over http (not opened from disk) so the pre-load page can
rem fetch() usernames.json, the browser never serves a stale .js, and Save
rem Test can write into history_data\.

cd /d "%~dp0"
set PORT=8001

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
        echo     python backend\server.py %PORT%
        pause
        exit /b 1
    )
)

rem Open the browser ~2 s from now, in the background of THIS window (no second console).
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/backend/inforce.html'"

echo Inforce Tool server on port %PORT% - close this window (or press Ctrl+C) to stop it.
%PYCMD% backend\server.py %PORT%

rem Only reached if the server stopped by itself (e.g. the port is already in use) - keep the message readable.
pause
