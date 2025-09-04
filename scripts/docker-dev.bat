@echo off
REM URL Shortener Development Docker Script for Windows
REM This script helps manage the development environment

setlocal enabledelayedexpansion

REM Function to print status messages
:print_status
echo [INFO] %~1
goto :eof

:print_success
echo [SUCCESS] %~1
goto :eof

:print_warning
echo [WARNING] %~1
goto :eof

:print_error
echo [ERROR] %~1
goto :eof

REM Function to check if Docker is running
:check_docker
docker info >nul 2>&1
if errorlevel 1 (
    call :print_error "Docker is not running. Please start Docker and try again."
    exit /b 1
)
goto :eof

REM Function to start development environment
:start_dev
call :print_status "Starting development environment..."
call :check_docker
if errorlevel 1 exit /b 1

REM Start infrastructure services first
docker-compose up -d postgres redis

call :print_status "Waiting for services to be healthy..."
timeout /t 10 /nobreak >nul

REM Start the API in development mode
docker-compose --profile dev up -d api-dev

call :print_success "Development environment started!"
call :print_status "API available at: http://localhost:3000"
call :print_status "Health check: http://localhost:3000/health"
call :print_status "View logs with: docker-compose logs -f api-dev"
goto :eof

REM Function to stop development environment
:stop_dev
call :print_status "Stopping development environment..."
docker-compose --profile dev down
call :print_success "Development environment stopped!"
goto :eof

REM Function to restart development environment
:restart_dev
call :print_status "Restarting development environment..."
call :stop_dev
call :start_dev
goto :eof

REM Function to view logs
:logs
set service=%~1
if "%service%"=="" set service=api-dev
call :print_status "Showing logs for %service%..."
docker-compose logs -f %service%
goto :eof

REM Function to run tests
:test
call :print_status "Running tests..."
call :check_docker
if errorlevel 1 exit /b 1

REM Start test environment
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test

call :print_status "Waiting for test services to be ready..."
timeout /t 15 /nobreak >nul

REM Run tests
docker-compose -f docker-compose.test.yml run --rm api-test

REM Cleanup test environment
docker-compose -f docker-compose.test.yml down -v
call :print_success "Tests completed!"
goto :eof

REM Function to start production environment
:start_prod
call :print_status "Starting production environment..."
call :check_docker
if errorlevel 1 exit /b 1

REM Build production image
docker-compose build api

REM Start services
docker-compose up -d postgres redis
docker-compose --profile prod up -d api

call :print_success "Production environment started!"
call :print_status "API available at: http://localhost:3000"
goto :eof

REM Function to start with tools
:start_tools
call :print_status "Starting development environment with management tools..."
call :check_docker
if errorlevel 1 exit /b 1

REM Start all services including tools
docker-compose --profile dev --profile tools up -d

call :print_success "Development environment with tools started!"
call :print_status "API: http://localhost:3000"
call :print_status "pgAdmin: http://localhost:5050 (admin@urlshortener.com / admin)"
call :print_status "Redis Commander: http://localhost:8081"
goto :eof

REM Function to clean up everything
:clean
call :print_warning "This will remove all containers, volumes, and images related to the project."
set /p confirm="Are you sure? (y/N): "
if /i "%confirm%"=="y" (
    call :print_status "Cleaning up..."
    docker-compose down -v --remove-orphans
    docker-compose -f docker-compose.test.yml down -v --remove-orphans
    docker system prune -f
    call :print_success "Cleanup completed!"
) else (
    call :print_status "Cleanup cancelled."
)
goto :eof

REM Function to show status
:status
call :print_status "Docker containers status:"
docker-compose ps
echo.
call :print_status "Docker images:"
docker images | findstr url-shortener
if errorlevel 1 echo No URL shortener images found
goto :eof

REM Function to show help
:show_help
echo URL Shortener Development Docker Script
echo.
echo Usage: %~nx0 [COMMAND]
echo.
echo Commands:
echo   start       Start development environment
echo   stop        Stop development environment
echo   restart     Restart development environment
echo   logs [svc]  Show logs (default: api-dev)
echo   test        Run tests in isolated environment
echo   prod        Start production environment
echo   tools       Start with management tools (pgAdmin, Redis Commander)
echo   status      Show status of containers and images
echo   clean       Clean up all containers, volumes, and images
echo   help        Show this help message
echo.
echo Examples:
echo   %~nx0 start              # Start development environment
echo   %~nx0 logs api-dev       # Show API logs
echo   %~nx0 logs postgres      # Show PostgreSQL logs
echo   %~nx0 test               # Run tests
echo   %~nx0 tools              # Start with pgAdmin and Redis Commander
goto :eof

REM Main script logic
set command=%~1
if "%command%"=="" set command=help

if "%command%"=="start" (
    call :start_dev
) else if "%command%"=="stop" (
    call :stop_dev
) else if "%command%"=="restart" (
    call :restart_dev
) else if "%command%"=="logs" (
    call :logs %~2
) else if "%command%"=="test" (
    call :test
) else if "%command%"=="prod" (
    call :start_prod
) else if "%command%"=="tools" (
    call :start_tools
) else if "%command%"=="status" (
    call :status
) else if "%command%"=="clean" (
    call :clean
) else if "%command%"=="help" (
    call :show_help
) else if "%command%"=="--help" (
    call :show_help
) else if "%command%"=="-h" (
    call :show_help
) else (
    call :print_error "Unknown command: %command%"
    call :show_help
    exit /b 1
)