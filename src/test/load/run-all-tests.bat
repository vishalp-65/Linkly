@echo off
REM Run all load and stress tests for URL Shortener
REM Windows batch script

echo ============================================================
echo URL Shortener - Complete Load Testing Suite
echo ============================================================
echo.

REM Check if k6 is installed
where k6 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: k6 is not installed
    echo Please install k6 from: https://k6.io/docs/get-started/installation/
    echo.
    echo Windows: choco install k6
    exit /b 1
)

echo k6 is installed
echo.

REM Check if server is running
echo Checking if server is running...
curl -s http://localhost:3000/health >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Server is not running at http://localhost:3000
    echo Please start the server first: npm run dev
    exit /b 1
)

echo Server is running
echo.

REM Set base URL
set BASE_URL=http://localhost:3000

echo ============================================================
echo Test 1: Load Test (20 minutes)
echo ============================================================
echo.
k6 run src/test/load/load-test.js
if %ERRORLEVEL% NEQ 0 (
    echo Load test failed!
    exit /b 1
)
echo.
echo Load test completed successfully
echo.
timeout /t 10 /nobreak >nul

echo ============================================================
echo Test 2: Stress Test (30 minutes)
echo ============================================================
echo.
k6 run src/test/load/stress-test.js
if %ERRORLEVEL% NEQ 0 (
    echo Stress test failed!
    exit /b 1
)
echo.
echo Stress test completed successfully
echo.
timeout /t 10 /nobreak >nul

echo ============================================================
echo Test 3: Spike Test (10 minutes)
echo ============================================================
echo.
k6 run src/test/load/spike-test.js
if %ERRORLEVEL% NEQ 0 (
    echo Spike test failed!
    exit /b 1
)
echo.
echo Spike test completed successfully
echo.
timeout /t 10 /nobreak >nul

echo ============================================================
echo Test 4: Chaos Engineering Tests (30 minutes)
echo ============================================================
echo.
echo NOTE: Chaos tests require Docker containers to be running
echo Press Ctrl+C to skip chaos tests, or
pause
node src/test/load/chaos-test.js
if %ERRORLEVEL% NEQ 0 (
    echo Chaos test failed!
    exit /b 1
)
echo.
echo Chaos test completed successfully
echo.

echo ============================================================
echo Test 5: Soak Test (2+ hours) - OPTIONAL
echo ============================================================
echo.
echo Soak test takes over 2 hours. Run separately if needed:
echo k6 run src/test/load/soak-test.js
echo.

echo ============================================================
echo ALL TESTS COMPLETED SUCCESSFULLY
echo ============================================================
echo.
echo Results saved to:
echo   - summary.json
echo   - stress-test-results.json
echo   - spike-test-results.json
echo.
echo Review the results and check for:
echo   - Error rates ^< 1%%
echo   - p99 latency ^< 100ms for redirects
echo   - p99 latency ^< 200ms for URL creation
echo   - System stability during failures
echo.

exit /b 0
