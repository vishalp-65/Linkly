# ============================================
# OPTIMIZED MULTI-STAGE DOCKERFILE
# ============================================

# ============================================
# Stage 1: Dependencies Base
# ============================================
FROM node:18-alpine AS deps

WORKDIR /app

# Install system dependencies needed for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production \
    && npm cache clean --force

# ============================================
# Stage 2: Development Dependencies
# ============================================
FROM node:18-alpine AS dev-deps

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci \
    && npm cache clean --force

# ============================================
# Stage 3: Build Stage
# ============================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from dev-deps stage
COPY --from=dev-deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# ============================================
# Stage 4: Development Stage
# ============================================
FROM node:18-alpine AS development

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files first
COPY package*.json ./

# Copy dev dependencies
COPY --from=dev-deps /app/node_modules ./node_modules

# Copy tsconfig and other config files
COPY tsconfig.json ./
COPY .swcrc* ./

# Copy source code
COPY . .

# Create logs directory with proper permissions
RUN mkdir -p logs && chmod 755 logs

# Use .env from root (will be mounted or copied)
# Application will load it automatically

# Set NODE_OPTIONS to handle ES modules properly
ENV NODE_OPTIONS="--loader ts-node/esm --experimental-specifier-resolution=node"

# Expose application and WebSocket ports
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start development server
CMD ["npm", "run", "dev"]

# ============================================
# Stage 5: Production Stage (Optimized)
# ============================================
FROM node:18-alpine AS production

WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Copy production dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create logs directory with proper permissions
RUN mkdir -p logs \
    && chown -R nodejs:nodejs logs \
    && chmod 755 logs

# Use .env from root (will be mounted or copied)
# Ensure .env is accessible by nodejs user
RUN touch .env && chown nodejs:nodejs .env

# Switch to non-root user
USER nodejs

# Expose application and WebSocket ports
EXPOSE 3000

# Health check with faster intervals
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=2 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start production server
CMD ["node", "dist/server.js"]