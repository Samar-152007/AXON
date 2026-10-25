@echo off
title GrocIQ Stack Starter
echo ===================================================
echo   Starting GrocIQ Full-Stack Environment
echo ===================================================

where docker >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/3] Launching Local Supabase - Docker detected...
    start "Supabase Local" cmd /k "cd /d "%~dp0" && echo Starting Supabase Local... && npx supabase start"
) else (
    where podman >nul 2>nul
    if %errorlevel% equ 0 (
        echo [1/3] Launching Local Supabase - Podman detected...
        start "Supabase Local" cmd /k "cd /d "%~dp0" && echo Starting Supabase Local... && npx supabase start"
    ) else (
        echo [1/3] Notice: Neither Docker nor Podman is installed.
        echo       Skipping local Supabase container launch.
        echo       Backend will operate in standalone mode with SQLite.
    )
)

echo [2/3] Launching Backend API Server (Port 8000)...
start "GrocIQ Backend API" cmd /k "cd /d "%~dp0" && echo Starting Backend API... && python backend/run.py"

echo [3/3] Launching Frontend Dev Server (Port 5173)...
start "GrocIQ Frontend" cmd /k "cd /d "%~dp0frontend" && echo Starting Frontend Dev Server... && npm run dev"

echo ===================================================
echo   GrocIQ services launched:
echo   - Frontend: http://localhost:5173
echo   - Backend:  http://127.0.0.1:8000
where docker >nul 2>nul && echo   - Supabase: http://127.0.0.1:54321
echo ===================================================
