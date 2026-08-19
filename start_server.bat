@echo off
title APMS Server
echo Starting APMS Development Server...
echo.

REM Optional: Automatically install dependencies if node_modules doesn't exist
if not exist "node_modules\" (
    echo Installing dependencies...
    npm install
)

echo Building the project...
npm run build

echo Starting the server in production mode...
npm start

pause
