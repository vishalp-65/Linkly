#!/bin/bash

# URL Shortener Development Docker Script
# This script helps manage the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to start development environment
start_dev() {
    print_status "Starting development environment..."
    check_docker
    
    # Start infrastructure services first
    docker-compose up -d postgres redis
    
    print_status "Waiting for services to be healthy..."
    docker-compose exec postgres pg_isready -U postgres -d url_shortener || sleep 5
    docker-compose exec redis redis-cli ping || sleep 5
    
    # Start the API in development mode
    docker-compose --profile dev up -d api-dev
    
    print_success "Development environment started!"
    print_status "API available at: http://localhost:3000"
    print_status "Health check: http://localhost:3000/health"
    print_status "View logs with: docker-compose logs -f api-dev"
}

# Function to stop development environment
stop_dev() {
    print_status "Stopping development environment..."
    docker-compose --profile dev down
    print_success "Development environment stopped!"
}

# Function to restart development environment
restart_dev() {
    print_status "Restarting development environment..."
    stop_dev
    start_dev
}

# Function to view logs
logs() {
    local service=${1:-api-dev}
    print_status "Showing logs for $service..."
    docker-compose logs -f "$service"
}

# Function to run tests
test() {
    print_status "Running tests..."
    check_docker
    
    # Start test environment
    docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
    
    print_status "Waiting for test services to be ready..."
    sleep 10
    
    # Run tests
    docker-compose -f docker-compose.test.yml run --rm api-test
    
    # Cleanup test environment
    docker-compose -f docker-compose.test.yml down -v
    print_success "Tests completed!"
}

# Function to start production environment
start_prod() {
    print_status "Starting production environment..."
    check_docker
    
    # Build production image
    docker-compose build api
    
    # Start services
    docker-compose up -d postgres redis
    docker-compose --profile prod up -d api
    
    print_success "Production environment started!"
    print_status "API available at: http://localhost:3000"
}

# Function to start with tools (pgAdmin, Redis Commander)
start_tools() {
    print_status "Starting development environment with management tools..."
    check_docker
    
    # Start all services including tools
    docker-compose --profile dev --profile tools up -d
    
    print_success "Development environment with tools started!"
    print_status "API: http://localhost:3000"
    print_status "pgAdmin: http://localhost:5050 (admin@urlshortener.com / admin)"
    print_status "Redis Commander: http://localhost:8081"
}

# Function to clean up everything
clean() {
    print_warning "This will remove all containers, volumes, and images related to the project."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up..."
        docker-compose down -v --remove-orphans
        docker-compose -f docker-compose.test.yml down -v --remove-orphans
        docker system prune -f
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Function to show status
status() {
    print_status "Docker containers status:"
    docker-compose ps
    echo
    print_status "Docker images:"
    docker images | grep url-shortener || echo "No URL shortener images found"
}

# Function to show help
show_help() {
    echo "URL Shortener Development Docker Script"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  start       Start development environment"
    echo "  stop        Stop development environment"
    echo "  restart     Restart development environment"
    echo "  logs [svc]  Show logs (default: api-dev)"
    echo "  test        Run tests in isolated environment"
    echo "  prod        Start production environment"
    echo "  tools       Start with management tools (pgAdmin, Redis Commander)"
    echo "  status      Show status of containers and images"
    echo "  clean       Clean up all containers, volumes, and images"
    echo "  help        Show this help message"
    echo
    echo "Examples:"
    echo "  $0 start              # Start development environment"
    echo "  $0 logs api-dev       # Show API logs"
    echo "  $0 logs postgres      # Show PostgreSQL logs"
    echo "  $0 test               # Run tests"
    echo "  $0 tools              # Start with pgAdmin and Redis Commander"
}

# Main script logic
case "${1:-help}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_dev
        ;;
    logs)
        logs "$2"
        ;;
    test)
        test
        ;;
    prod)
        start_prod
        ;;
    tools)
        start_tools
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac