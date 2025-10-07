-- Migration 004: Increase short_code length to support longer custom aliases
-- This migration increases the short_code field from VARCHAR(10) to VARCHAR(30)
-- to support custom aliases up to 30 characters

-- Drop views that depend on the short_code column
DROP VIEW IF EXISTS active_urls;
DROP VIEW IF EXISTS url_statistics;
DROP VIEW IF EXISTS user_statistics;

-- Alter the main url_mappings table
ALTER TABLE url_mappings ALTER COLUMN short_code TYPE VARCHAR(30);

-- Update analytics_events table to match
ALTER TABLE analytics_events ALTER COLUMN short_code TYPE VARCHAR(30);

-- Update analytics_aggregates table to match  
ALTER TABLE analytics_aggregates ALTER COLUMN short_code TYPE VARCHAR(30);

-- Update the constraint to allow longer codes
ALTER TABLE url_mappings DROP CONSTRAINT IF EXISTS valid_short_code;
ALTER TABLE url_mappings ADD CONSTRAINT valid_short_code 
  CHECK (short_code ~ '^[a-zA-Z0-9_-]+$' AND char_length(short_code) >= 1 AND char_length(short_code) <= 30);

-- Recreate the views with updated schema
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

-- Migration completed successfully
SELECT 'Migration 004 completed successfully - short_code length increased to 30 characters' as status;