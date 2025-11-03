-- Migration: Create analytics summary tables for batch processing
-- Created: 2024-11-03
-- Description: Creates tables for storing daily analytics summaries and global reports

-- Daily analytics summaries table
CREATE TABLE IF NOT EXISTS analytics_daily_summaries (
    short_code VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    total_clicks INT NOT NULL DEFAULT 0,
    unique_visitors INT NOT NULL DEFAULT 0,
    top_countries JSONB,
    top_referrers JSONB,
    device_breakdown JSONB,
    browser_breakdown JSONB,
    hourly_distribution JSONB,
    peak_hour INT CHECK (peak_hour >= 0 AND peak_hour <= 23),
    avg_clicks_per_hour DECIMAL(10,2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    
    PRIMARY KEY (short_code, date),
    FOREIGN KEY (short_code) REFERENCES url_mappings(short_code) ON DELETE CASCADE
);

-- Global analytics summaries table
CREATE TABLE IF NOT EXISTS analytics_global_summaries (
    date DATE PRIMARY KEY,
    active_urls INT NOT NULL DEFAULT 0,
    total_clicks BIGINT NOT NULL DEFAULT 0,
    total_unique_visitors BIGINT NOT NULL DEFAULT 0,
    avg_clicks_per_hour DECIMAL(10,2),
    top_urls JSONB,
    top_countries JSONB,
    device_distribution JSONB,
    browser_distribution JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_analytics_daily_summaries_date 
    ON analytics_daily_summaries(date);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summaries_short_code 
    ON analytics_daily_summaries(short_code);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summaries_total_clicks 
    ON analytics_daily_summaries(total_clicks DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_global_summaries_date 
    ON analytics_global_summaries(date);

-- GIN indexes for JSONB columns for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_daily_summaries_top_countries 
    ON analytics_daily_summaries USING GIN (top_countries);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summaries_device_breakdown 
    ON analytics_daily_summaries USING GIN (device_breakdown);

CREATE INDEX IF NOT EXISTS idx_analytics_global_summaries_top_urls 
    ON analytics_global_summaries USING GIN (top_urls);

-- Partitioning for analytics_daily_summaries (optional, for high volume)
-- This can be implemented later based on data volume requirements

COMMENT ON TABLE analytics_daily_summaries IS 'Daily analytics summaries per short URL';
COMMENT ON TABLE analytics_global_summaries IS 'Global daily analytics summaries across all URLs';

COMMENT ON COLUMN analytics_daily_summaries.top_countries IS 'JSON array of top countries with click counts';
COMMENT ON COLUMN analytics_daily_summaries.top_referrers IS 'JSON array of top referrers with click counts';
COMMENT ON COLUMN analytics_daily_summaries.device_breakdown IS 'JSON array of device types with click counts';
COMMENT ON COLUMN analytics_daily_summaries.browser_breakdown IS 'JSON array of browsers with click counts';
COMMENT ON COLUMN analytics_daily_summaries.hourly_distribution IS 'JSON array of hourly click distribution';