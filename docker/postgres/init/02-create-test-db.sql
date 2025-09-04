-- Create test database
-- This script creates a separate test database for running tests

-- Create test database
CREATE DATABASE url_shortener_test;

-- Connect to test database
\c url_shortener_test;

-- Create extensions for test database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgres;

-- Create health check table for tests
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(10) DEFAULT 'ok',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial health check record
INSERT INTO health_check (status) VALUES ('test_ok');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_health_check_created_at ON health_check(created_at);

-- Log successful test database initialization
DO $$
BEGIN
    RAISE NOTICE 'URL Shortener test database initialized successfully';
END $$;