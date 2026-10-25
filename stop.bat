@echo off
title GrocIQ Stack Stopper
echo ===================================================
echo   Stopping GrocIQ Full-Stack Environment
echo ===================================================

where docker >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/3] Stopping Local Supabase containers...
    call npx supabase stop
) else (
    where podman >nul 2>nul
    if %errorlevel% equ 0 (
        echo [1/3] Stopping Local Supabase containers...
        call npx supabase stop
    ) else (
        echo [1/3] Skipping Supabase container stop - Docker or Podman not installed...
    )
)

echo [2/3] Terminating Backend Python server processes (Port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

echo [3/3] Terminating Frontend Vite/Node dev server processes (Port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

echo [Optional] Closing associated terminal windows...
taskkill /F /FI "WINDOWTITLE eq GrocIQ Backend API*" 2>nul
taskkill /F /FI "WINDOWTITLE eq GrocIQ Frontend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq Supabase Local*" 2>nul

echo ===================================================
echo   All GrocIQ services have been stopped cleanly.
echo ===================================================
