@echo off
echo Setting up Hospital Appointment System...
echo.

echo Step 1: Installing backend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install backend dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo Failed to install frontend dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo Step 3: Seeding database...
call npm run seed
if %errorlevel% neq 0 (
    echo Failed to seed database
    pause
    exit /b 1
)

echo.
echo Step 4: Starting backend servers...
start "Backend Servers" cmd /k "npm run start:all"

echo.
echo Waiting 5 seconds for backend to start...
timeout /t 5 /nobreak >nul

echo.
echo Step 5: Starting frontend...
cd frontend
start "Frontend" cmd /k "npm start"

echo.
echo Setup complete!
echo.
echo The application should now be running:
echo   - Frontend: http://localhost:3000
echo   - Backend Servers: http://localhost:5001, 5002, 5003
echo.
echo Press any key to close this setup window...
pause >nul


