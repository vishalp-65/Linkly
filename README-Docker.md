# Docker Setup for URL Shortener

This document explains how to run the URL Shortener application using Docker and Docker Compose.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose (included with Docker Desktop)

## Quick Start

### Development Environment

1. **Start the development environment:**
   ```bash
   # Linux/Mac
   chmod +x scripts/docker-dev.sh
   ./scripts/docker-dev.sh start
   
   # Windows
   scripts\docker-dev.bat start
   ```

2. **Access the application:**
   - API: http://localhost:3000
   - Health Check: http://localhost:3000/health

3. **View logs:**
   ```bash
   # Linux/Mac
   ./scripts/docker-dev.sh logs
   
   # Windows
   scripts\docker-dev.bat logs
   ```

### With Management Tools

Start the development environment with pgAdmin and Redis Commander:

```bash
# Linux/Mac
./scripts/docker-dev.sh tools

# Windows
scripts\docker-dev.bat tools
```

Access the tools:
- pgAdmin: http://localhost:5050 (admin@urlshortener.com / admin)
- Redis Commander: http://localhost:8081

## Docker Compose Profiles

The project uses Docker Compose profiles to manage different environments:

### Available Profiles

- **dev**: Development environment with hot reload
- **prod**: Production environment
- **tools**: Management tools (pgAdmin, Redis Commander)
- **cluster**: Redis cluster setup for testing

### Manual Docker Compose Commands

```bash
# Start infrastructure only (PostgreSQL + Redis)
docker-compose up -d postgres redis

# Start development environment
docker-compose --profile dev up -d

# Start production environment
docker-compose --profile prod up -d

# Start with management tools
docker-compose --profile dev --profile tools up -d

# Start Redis cluster for testing
docker-compose --profile cluster up -d redis-cluster
```

## Services

### PostgreSQL Database
- **Container**: `url-shortener-postgres`
- **Port**: 5432
- **Database**: `url_shortener`
- **Username**: `postgres`
- **Password**: `password`
- **Volume**: `postgres_data`

### Redis Cache
- **Container**: `url-shortener-redis`
- **Port**: 6379
- **Volume**: `redis_data`
- **Configuration**: `docker/redis/redis.conf`

### API Application
- **Development Container**: `url-shortener-api-dev`
- **Production Container**: `url-shortener-api`
- **Port**: 3000
- **Health Check**: `/health` endpoint

### Management Tools

#### pgAdmin
- **Container**: `url-shortener-pgadmin`
- **Port**: 5050
- **Email**: admin@urlshortener.com
- **Password**: admin

#### Redis Commander
- **Container**: `url-shortener-redis-commander`
- **Port**: 8081

## Testing

Run tests in an isolated environment:

```bash
# Linux/Mac
./scripts/docker-dev.sh test

# Windows
scripts\docker-dev.bat test

# Manual test environment
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

The test environment uses:
- PostgreSQL on port 5433
- Redis on port 6380
- Separate test database: `url_shortener_test`

## Production Deployment

### Build and Start Production Environment

```bash
# Linux/Mac
./scripts/docker-dev.sh prod

# Windows
scripts\docker-dev.bat prod

# Manual production start
docker-compose build api
docker-compose --profile prod up -d
```

### Environment Variables

Production environment variables can be customized in:
- `.env` file (not included in repository)
- `docker-compose.yml` environment section
- External secrets management system

### Security Considerations

For production deployment:

1. **Change default passwords:**
   - PostgreSQL password
   - JWT secrets
   - API key secrets

2. **Use external volumes:**
   - Database data persistence
   - Log file storage

3. **Configure networking:**
   - Use reverse proxy (nginx, traefik)
   - Enable SSL/TLS
   - Restrict port access

4. **Resource limits:**
   - Set memory and CPU limits
   - Configure restart policies

## Volumes

- `postgres_data`: PostgreSQL database files
- `redis_data`: Redis persistence files
- `pgadmin_data`: pgAdmin configuration
- `./logs`: Application log files (mounted from host)

## Networks

- `url-shortener-network`: Internal network for service communication

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   # Check what's using the ports
   netstat -tulpn | grep :3000
   netstat -tulpn | grep :5432
   netstat -tulpn | grep :6379
   ```

2. **Permission issues (Linux/Mac):**
   ```bash
   # Make scripts executable
   chmod +x scripts/docker-dev.sh
   
   # Fix volume permissions
   sudo chown -R $USER:$USER logs/
   ```

3. **Database connection issues:**
   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U postgres
   
   # View database logs
   docker-compose logs postgres
   ```

4. **Redis connection issues:**
   ```bash
   # Check Redis health
   docker-compose exec redis redis-cli ping
   
   # View Redis logs
   docker-compose logs redis
   ```

### Cleanup

Remove all containers, volumes, and images:

```bash
# Linux/Mac
./scripts/docker-dev.sh clean

# Windows
scripts\docker-dev.bat clean

# Manual cleanup
docker-compose down -v --remove-orphans
docker system prune -f
```

### Logs and Debugging

```bash
# View all service logs
docker-compose logs

# View specific service logs
docker-compose logs -f api-dev
docker-compose logs -f postgres
docker-compose logs -f redis

# Execute commands in containers
docker-compose exec postgres psql -U postgres -d url_shortener
docker-compose exec redis redis-cli
docker-compose exec api-dev npm run lint
```

## Development Workflow

1. **Start development environment:**
   ```bash
   ./scripts/docker-dev.sh start
   ```

2. **Make code changes** (hot reload enabled)

3. **View logs:**
   ```bash
   ./scripts/docker-dev.sh logs
   ```

4. **Run tests:**
   ```bash
   ./scripts/docker-dev.sh test
   ```

5. **Stop environment:**
   ```bash
   ./scripts/docker-dev.sh stop
   ```

## Configuration Files

- `Dockerfile`: Multi-stage build for development and production
- `docker-compose.yml`: Main compose file with all services
- `docker-compose.dev.yml`: Development overrides
- `docker-compose.test.yml`: Test environment
- `.dockerignore`: Files to exclude from Docker build
- `docker/postgres/init/`: Database initialization scripts
- `docker/redis/redis.conf`: Redis configuration
- `scripts/docker-dev.*`: Helper scripts for common operations