@echo off
echo Starting Hospital Appointment System Backend...
echo.

echo Seeding database...
node seed.js
if %errorlevel% neq 0 (
    echo Failed to seed database
    pause
    exit /b 1
)

echo.
echo Starting all server instances...
echo.

start "Hospital Server 1" cmd /k "set PORT=5001&& set SERVER_ID=1&& node server.js"
timeout /t 2 /nobreak >nul

start "Hospital Server 2" cmd /k "set PORT=5002&& set SERVER_ID=2&& node server.js"
timeout /t 2 /nobreak >nul

start "Hospital Server 3" cmd /k "set PORT=5003&& set SERVER_ID=3&& node server.js"

echo.
echo All servers started successfully!
echo.
echo Server URLs:
echo   - Server 1: http://localhost:5001
echo   - Server 2: http://localhost:5002
echo   - Server 3: http://localhost:5003
echo.
echo Each server is running in its own window.
echo Close individual server windows to stop specific servers.
echo.
echo Press any key to close this window...
pause >nul


