-- URL Shortener Database Schema
-- Migration 001: Create core tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  duplicate_strategy VARCHAR(20) DEFAULT 'generate_new' CHECK (duplicate_strategy IN ('generate_new', 'reuse_existing')),
  default_expiry_days INTEGER DEFAULT NULL,
  rate_limit_tier VARCHAR(20) DEFAULT 'standard' CHECK (rate_limit_tier IN ('standard', 'premium', 'enterprise')),
  api_key_hash VARCHAR(64) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Create id_counter table for distributed ID generation
CREATE TABLE IF NOT EXISTS id_counter (
  counter_id INTEGER PRIMARY KEY DEFAULT 1,
  current_value BIGINT NOT NULL DEFAULT 1000000,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT single_row CHECK (counter_id = 1)
);

-- Insert initial counter value
INSERT INTO id_counter (counter_id, current_value) 
VALUES (1, 1000000) 
ON CONFLICT (counter_id) DO NOTHING;

-- Create url_mappings table (main table for URL storage)
CREATE TABLE IF NOT EXISTS url_mappings (
  short_code VARCHAR(10) PRIMARY KEY,
  long_url TEXT NOT NULL,
  long_url_hash VARCHAR(64) NOT NULL,
  user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count BIGINT DEFAULT 0,
  is_custom_alias BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_short_code CHECK (short_code ~ '^[a-zA-Z0-9]+$'),
  CONSTRAINT valid_long_url CHECK (char_length(long_url) <= 2048),
  CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Create analytics_events table (partitioned by date for performance)
CREATE TABLE IF NOT EXISTS analytics_events (
  event_id UUID DEFAULT uuid_generate_v4(),
  short_code VARCHAR(10) NOT NULL,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  country_code VARCHAR(2),
  region VARCHAR(100),
  city VARCHAR(100),
  device_type VARCHAR(20),
  browser VARCHAR(50),
  os VARCHAR(50),
  
  PRIMARY KEY (event_id, clicked_at)
) PARTITION BY RANGE (clicked_at);

-- Create analytics_aggregates table for pre-computed statistics
CREATE TABLE IF NOT EXISTS analytics_aggregates (
  short_code VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  click_count INTEGER DEFAULT 0,
  unique_ips INTEGER DEFAULT 0,
  unique_countries INTEGER DEFAULT 0,
  top_referrer TEXT,
  top_country VARCHAR(2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (short_code, date, hour),
  
  -- Foreign key constraint
  CONSTRAINT fk_aggregates_short_code FOREIGN KEY (short_code) REFERENCES url_mappings(short_code) ON DELETE CASCADE
);

-- Create indexes for performance optimization

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash) WHERE api_key_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- URL mappings table indexes
CREATE INDEX IF NOT EXISTS idx_url_mappings_long_url_hash ON url_mappings(long_url_hash, expires_at) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_url_mappings_user_id ON url_mappings(user_id, created_at) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_url_mappings_expires_at ON url_mappings(expires_at) WHERE expires_at IS NOT NULL AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_url_mappings_created_at ON url_mappings(created_at) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_url_mappings_access_count ON url_mappings(access_count DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_url_mappings_last_accessed ON url_mappings(last_accessed_at) WHERE NOT is_deleted;

-- Analytics events table indexes (will be inherited by partitions)
CREATE INDEX IF NOT EXISTS idx_analytics_events_short_code_time ON analytics_events(short_code, clicked_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_clicked_at ON analytics_events(clicked_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_ip_address ON analytics_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_analytics_events_country_code ON analytics_events(country_code);

-- Analytics aggregates table indexes
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_date ON analytics_aggregates(date);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_short_code_date ON analytics_aggregates(short_code, date);

-- Create partitions for analytics_events table (current month and next 3 months)
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    -- Create partitions for current month and next 11 months (1 year total)
    FOR i IN 0..11 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'analytics_events_' || TO_CHAR(start_date, 'YYYY_MM');
        
        -- Create partition if it doesn't exist
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        -- Create indexes on partition
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I ON %I(short_code, clicked_at)',
            partition_name || '_short_code_time_idx', partition_name
        );
        
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I ON %I(clicked_at)',
            partition_name || '_clicked_at_idx', partition_name
        );
        
        -- Add foreign key constraint to partition
        EXECUTE format('
            ALTER TABLE %I ADD CONSTRAINT %I 
            FOREIGN KEY (short_code) REFERENCES url_mappings(short_code) ON DELETE CASCADE',
            partition_name, partition_name || '_fk_short_code'
        );
    END LOOP;
END $$;

-- Create functions for automatic partition management
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS VOID AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Create partition for next month
    start_date := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '12 months';
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'analytics_events_' || TO_CHAR(start_date, 'YYYY_MM');
    
    -- Create partition
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
    
    -- Create indexes on partition
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON %I(short_code, clicked_at)',
        partition_name || '_short_code_time_idx', partition_name
    );
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON %I(clicked_at)',
        partition_name || '_clicked_at_idx', partition_name
    );
    
    -- Add foreign key constraint to partition
    EXECUTE format('
        ALTER TABLE %I ADD CONSTRAINT %I 
        FOREIGN KEY (short_code) REFERENCES url_mappings(short_code) ON DELETE CASCADE',
        partition_name, partition_name || '_fk_short_code'
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to drop old partitions (older than 2 years)
CREATE OR REPLACE FUNCTION drop_old_partitions()
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    cutoff_date DATE;
BEGIN
    cutoff_date := DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '24 months';
    partition_name := 'analytics_events_' || TO_CHAR(cutoff_date, 'YYYY_MM');
    
    -- Drop partition if it exists
    EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_analytics_aggregates_updated_at
    BEFORE UPDATE ON analytics_aggregates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for URL expiry cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_urls()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Soft delete expired URLs
    UPDATE url_mappings 
    SET is_deleted = TRUE, deleted_at = NOW()
    WHERE expires_at < NOW() 
      AND NOT is_deleted;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- Create function for hard deletion of old soft-deleted URLs
CREATE OR REPLACE FUNCTION hard_delete_old_urls()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Permanently delete URLs that were soft-deleted more than 30 days ago
    DELETE FROM url_mappings 
    WHERE is_deleted = TRUE 
      AND deleted_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- Create function to get next ID range for distributed ID generation
CREATE OR REPLACE FUNCTION get_next_id_range(range_size INTEGER DEFAULT 10000)
RETURNS BIGINT AS $$
DECLARE
    start_id BIGINT;
BEGIN
    -- Get and increment counter atomically
    UPDATE id_counter 
    SET current_value = current_value + range_size,
        last_updated = NOW()
    WHERE counter_id = 1
    RETURNING current_value - range_size INTO start_id;
    
    RETURN start_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your security model)
-- These are basic permissions - adjust based on your application user roles

-- Create application user role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'url_shortener_app') THEN
        CREATE ROLE url_shortener_app LOGIN;
    END IF;
END $$;

-- Grant necessary permissions to application role
GRANT USAGE ON SCHEMA public TO url_shortener_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO url_shortener_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO url_shortener_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO url_shortener_app;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO url_shortener_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO url_shortener_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO url_shortener_app;

-- Create views for common queries

-- Active URLs view (excludes deleted URLs)
CREATE OR REPLACE VIEW active_urls AS
SELECT 
    short_code,
    long_url,
    user_id,
    created_at,
    expires_at,
    last_accessed_at,
    access_count,
    is_custom_alias,
    CASE 
        WHEN expires_at IS NULL THEN 'permanent'
        WHEN expires_at > NOW() THEN 'active'
        ELSE 'expired'
    END as status
FROM url_mappings
WHERE NOT is_deleted;

-- URL statistics view
CREATE OR REPLACE VIEW url_statistics AS
SELECT 
    u.short_code,
    u.long_url,
    u.created_at,
    u.access_count,
    COALESCE(SUM(aa.click_count), 0) as total_analytics_clicks,
    COUNT(DISTINCT aa.date) as days_with_activity,
    MAX(aa.date) as last_activity_date
FROM url_mappings u
LEFT JOIN analytics_aggregates aa ON u.short_code = aa.short_code
WHERE NOT u.is_deleted
GROUP BY u.short_code, u.long_url, u.created_at, u.access_count;

-- User statistics view
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.user_id,
    u.email,
    u.created_at,
    COUNT(um.short_code) as total_urls,
    COUNT(CASE WHEN NOT um.is_deleted THEN 1 END) as active_urls,
    SUM(um.access_count) as total_clicks,
    MAX(um.last_accessed_at) as last_url_accessed
FROM users u
LEFT JOIN url_mappings um ON u.user_id = um.user_id
WHERE u.is_active
GROUP BY u.user_id, u.email, u.created_at;

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts and preferences';
COMMENT ON TABLE url_mappings IS 'Main table storing URL mappings and metadata';
COMMENT ON TABLE id_counter IS 'Counter for distributed ID generation';
COMMENT ON TABLE analytics_events IS 'Raw click events (partitioned by month)';
COMMENT ON TABLE analytics_aggregates IS 'Pre-computed analytics aggregates';

COMMENT ON COLUMN users.duplicate_strategy IS 'Strategy for handling duplicate URLs: generate_new or reuse_existing';
COMMENT ON COLUMN users.rate_limit_tier IS 'Rate limiting tier: standard, premium, or enterprise';
COMMENT ON COLUMN url_mappings.long_url_hash IS 'SHA256 hash of long_url for duplicate detection';
COMMENT ON COLUMN url_mappings.access_count IS 'Direct access counter (may differ from analytics due to caching)';
COMMENT ON COLUMN analytics_events.clicked_at IS 'Timestamp when URL was accessed (partitioning key)';

-- Migration completed successfully
SELECT 'Migration 001 completed successfully' as status;