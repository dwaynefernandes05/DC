@echo off
echo Starting Hospital Appointment System Backend Servers...
echo.

echo Starting Server 1 (Port 5001)...
start "Server-1" cmd /k "set PORT=5001&& set SERVER_ID=1&& node server.js"

timeout /t 2 /nobreak >nul

echo Starting Server 2 (Port 5002)...
start "Server-2" cmd /k "set PORT=5002&& set SERVER_ID=2&& node server.js"

timeout /t 2 /nobreak >nul

echo Starting Server 3 (Port 5003)...
start "Server-3" cmd /k "set PORT=5003&& set SERVER_ID=3&& node server.js"

echo.
echo All servers started!
echo Server URLs:
echo   - Server 1: http://localhost:5001
echo   - Server 2: http://localhost:5002
echo   - Server 3: http://localhost:5003
echo.
echo Close this window to stop all servers.
pause


