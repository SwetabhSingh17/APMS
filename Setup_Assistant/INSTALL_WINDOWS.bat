@echo off
REM ============================================================================
REM Integral Project Hub - Windows Installation Launcher
REM Created by: Swetabh Singh
REM This batch file bypasses PowerShell execution policy restrictions
REM ============================================================================

echo.
echo ========================================
echo   Integral Project Hub Setup
echo   By - Swetabh Singh
echo ========================================
echo.
echo Starting installation with administrator privileges...
echo.

REM Get the directory where this batch file is located
cd /d "%~dp0"

REM Run PowerShell with ExecutionPolicy Bypass
PowerShell -ExecutionPolicy Bypass -File "%~dp0install_windows.ps1"

echo.
echo.
echo Press any key to close this window...
pause >nul
