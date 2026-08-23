@echo off
title APMS Server
setlocal

echo ==========================================================
echo    APMS - Academic Project Management System
echo    One-Click Production Server
echo ==========================================================
echo.

REM ----------------------------------------------------------
REM Step 0: Verify Node.js is installed
REM ----------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Install the LTS version from https://nodejs.org and run this file again.
    goto :fail
)

REM ----------------------------------------------------------
REM Step 1: Ensure .env exists (bootstrap from template on first run)
REM ----------------------------------------------------------
if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo [ACTION REQUIRED] First run detected: created .env from .env.example
        echo.
        echo   1. Open the .env file in this folder with Notepad
        echo   2. Set DATABASE_URL to your PostgreSQL credentials, e.g.
        echo      DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/integral_project_hub
        echo   3. Change SESSION_SECRET to a long random string
        echo   4. Save the file and run start_server.bat again
        echo.
        pause
        exit /b 1
    ) else (
        echo [ERROR] Neither .env nor .env.example found in this folder.
        goto :fail
    )
)

REM ----------------------------------------------------------
REM Step 2: Install / update dependencies
REM ----------------------------------------------------------
echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 goto :fail
echo.

REM ----------------------------------------------------------
REM Step 3: Prepare database (creates schema + admin on fresh installs,
REM         safely syncs schema changes on updates - never wipes data)
REM ----------------------------------------------------------
echo [2/4] Preparing database...
call npm run db:ensure
if errorlevel 1 goto :fail
echo.

REM ----------------------------------------------------------
REM Step 4: Build production bundle
REM ----------------------------------------------------------
echo [3/4] Building production bundle...
call npm run build
if errorlevel 1 goto :fail
echo.

REM ----------------------------------------------------------
REM Step 5: Start the server
REM ----------------------------------------------------------
echo [4/4] Starting APMS server...
echo       (Press Ctrl+C to stop the server)
echo.
call npm start

echo.
echo Server stopped.
pause
exit /b 0

:fail
echo.
echo [ERROR] Startup failed. Fix the problem shown above and run start_server.bat again.
pause
exit /b 1
