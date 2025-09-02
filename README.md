# URL Shortener

A high-performance URL shortener service built with Node.js, TypeScript, Express, PostgreSQL, and Redis.

## Features

- High-performance URL shortening and redirects
- Scalable architecture with caching
- Comprehensive logging and monitoring
- Health checks and metrics
- Rate limiting and security
- Analytics tracking
- URL expiration management

## Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd url-shortener
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration values.

5. Set up the database:
```bash
# Create database
createdb url_shortener

# Run migrations (will be added in future tasks)
npm run migrate
```

6. Start Redis server:
```bash
redis-server
```

## Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

## Production

Build and start the production server:
```bash
npm run build
npm start
```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Scripts

- `npm run build` - Build the TypeScript code
- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reload
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix

## API Endpoints

### Health Checks

- `GET /health` - Comprehensive health check
- `GET /ready` - Readiness check (for Kubernetes)
- `GET /live` - Liveness check (for Kubernetes)
- `GET /health/database` - Database-specific health check
- `GET /health/cache` - Redis cache health check

### URL Operations (Coming in future tasks)

- `POST /api/v1/shorten` - Create short URL
- `GET /{shortCode}` - Redirect to long URL
- `DELETE /api/v1/url/{shortCode}` - Delete short URL
- `GET /api/v1/analytics/{shortCode}` - Get analytics

## Configuration

The application uses environment variables for configuration. See `.env.example` for all available options.

### Key Configuration Options

- `NODE_ENV` - Environment (development, production, test)
- `PORT` - Server port (default: 3000)
- `DB_*` - Database configuration
- `REDIS_*` - Redis configuration
- `LOG_LEVEL` - Logging level (error, warn, info, debug)

## Architecture

The application follows a modular architecture with:

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Primary database with connection pooling
- **Redis** - Caching layer with cluster support
- **Winston** - Structured JSON logging
- **Helmet** - Security middleware
- **Jest** - Testing framework

## Logging

The application uses structured JSON logging with Winston. Logs include:

- Request/response logging
- Database operations
- Cache operations
- Business events
- Security events
- Performance metrics
- Error tracking

## Monitoring

Health check endpoints provide:

- Service status (healthy/unhealthy)
- Database connectivity
- Redis connectivity
- System metrics (memory, CPU)
- Response times

## Security

Security features include:

- Helmet.js for security headers
- CORS configuration
- Input validation
- Rate limiting (coming in future tasks)
- API key authentication (coming in future tasks)

## License

MIT