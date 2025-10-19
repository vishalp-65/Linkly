# URL Shortener with Authentication

A high-performance URL shortener service with comprehensive user authentication and role-based access control.

## Features

### Authentication & Authorization
- **User Registration & Login** - Email/password authentication
- **JWT-based Authentication** - Secure access and refresh tokens
- **Password Reset** - Secure password reset flow
- **Role-based Access Control** - Guest vs Registered user permissions
- **Google OAuth** - Ready for Google Sign-In integration

### URL Shortening
- **Guest Users**: 
  - Can create short URLs with 7-day expiry limit
  - Limited to 10 URLs per day
  - No custom aliases or analytics access
- **Registered Users**:
  - Unlimited URL creation with custom expiry (up to 1 year)
  - Custom aliases support
  - Full analytics access
  - URL duplication handling
  - Up to 100 URLs per day

### Analytics & Monitoring
- Real-time click tracking
- Geographic analytics
- Device and browser analytics
- Performance monitoring with OpenTelemetry
- Comprehensive logging

## Tech Stack

### Backend
- **Node.js** with TypeScript
- **Express.js** - Web framework
- **PostgreSQL** - Primary database
- **Redis** - Caching and session storage
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **Joi** - Input validation
- **Winston** - Logging
- **Kafka** - Analytics event streaming (optional)

### Frontend
- **React 19** with TypeScript
- **Redux Toolkit** - State management
- **React Router** - Navigation
- **Tailwind CSS** - Styling
- **Vite** - Build tool

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- npm or yarn

### Backend Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd url-shortener
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your database and Redis credentials
   ```

3. **Database Setup**
   ```bash
   # Create database
   createdb url_shortener
   
   # Run migrations
   npm run db:migrate
   ```

4. **Start the backend**
   ```bash
   npm run dev
   ```
   Backend will be available at `http://localhost:3000`

### Frontend Setup

1. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env to set the backend URL if different from default
   ```

3. **Start the frontend**
   ```bash
   npm run dev
   ```
   Frontend will be available at `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/request-password-reset` - Request password reset
- `POST /api/v1/auth/confirm-password-reset` - Confirm password reset
- `GET /api/v1/auth/profile` - Get user profile
- `PUT /api/v1/auth/profile` - Update user profile
- `POST /api/v1/auth/change-password` - Change password
- `GET /api/v1/auth/permissions` - Get user permissions

### URL Management
- `POST /api/v1/url/shorten` - Create short URL (guest/authenticated)
- `DELETE /api/v1/url/:shortCode` - Delete URL (authenticated only)
- `GET /api/v1/url/resolve/:shortCode` - Resolve URL details

### Analytics
- `GET /api/v1/analytics/:shortCode` - Get URL analytics (authenticated only)
- `GET /api/v1/analytics/:shortCode/realtime` - Real-time analytics
- `GET /api/v1/analytics/global/summary` - Global analytics summary

### Redirects
- `GET /:shortCode` - Redirect to original URL

## User Permissions

### Guest Users
- ✅ Create short URLs (7-day expiry max)
- ✅ Access shortened URLs
- ❌ Custom aliases
- ❌ Analytics access
- ❌ Custom expiry dates
- ❌ URL management
- **Limits**: 10 URLs per day, 7-day max expiry

### Registered Users
- ✅ All guest features
- ✅ Custom aliases
- ✅ Full analytics access
- ✅ Custom expiry dates (up to 1 year)
- ✅ URL management (edit, delete)
- ✅ Duplicate URL handling
- **Limits**: 100 URLs per day, 365-day max expiry

## Database Schema

### Core Tables
- `users` - User accounts and authentication
- `url_mappings` - URL mappings and metadata
- `analytics_events` - Click tracking events (partitioned)
- `analytics_aggregates` - Pre-computed analytics
- `refresh_tokens` - JWT refresh tokens
- `password_reset_tokens` - Password reset tokens
- `email_verification_tokens` - Email verification tokens

## Security Features

- **Password Security**: bcrypt hashing with configurable rounds
- **JWT Security**: Separate access and refresh tokens
- **Rate Limiting**: Per-user and global rate limits
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Configurable cross-origin policies
- **Helmet.js**: Security headers
- **Environment Validation**: Strict environment variable validation

## Development

### Available Scripts

**Backend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run db:migrate` - Run database migrations
- `npm run db:status` - Check migration status

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run linting

### Environment Variables

**Backend** (see `.env.example` for complete list):

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=url_shortener
DB_USER=postgres
DB_PASSWORD=your_password

# Security
JWT_SECRET=your-jwt-secret-32-chars-min
JWT_REFRESH_SECRET=your-refresh-secret-32-chars-min

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Frontend** (see `frontend/.env.example`):

```env
# Backend API URL
VITE_BASE_URL=http://localhost:3000
```

## Production Deployment

1. **Environment Setup**
   - Use strong, unique secrets for JWT tokens
   - Configure proper CORS origins
   - Set up SSL/TLS certificates
   - Configure rate limiting appropriately

2. **Database**
   - Use connection pooling
   - Set up read replicas for analytics
   - Configure automated backups
   - Monitor performance

3. **Caching**
   - Configure Redis clustering for high availability
   - Set appropriate cache TTLs
   - Monitor cache hit rates

4. **Monitoring**
   - Set up application monitoring (Jaeger/Zipkin)
   - Configure log aggregation
   - Set up health checks
   - Monitor key metrics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details