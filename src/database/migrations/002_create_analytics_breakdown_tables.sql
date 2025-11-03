-- Migration: Create analytics breakdown tables for detailed analytics
-- Created: 2024-11-03
-- Description: Creates tables for storing detailed analytics breakdowns by referrer, country, and device

-- Analytics referrer breakdown table
CREATE TABLE IF NOT EXISTS analytics_referrer_breakdown (
    short_code VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
    referrer VARCHAR(255) NOT NULL,
    click_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (short_code, date, hour, referrer),
    FOREIGN KEY (short_code) REFERENCES url_mappings(short_code) ON DELETE CASCADE
);

-- Analytics country breakdown table
CREATE TABLE IF NOT EXISTS analytics_country_breakdown (
    short_code VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
    country_code VARCHAR(2) NOT NULL,
    click_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (short_code, date, hour, country_code),
    FOREIGN KEY (short_code) REFERENCES url_mappings(short_code) ON DELETE CASCADE
);

-- Analytics device breakdown table
CREATE TABLE IF NOT EXISTS analytics_device_breakdown (
    short_code VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
    device_type VARCHAR(50) NOT NULL,
    click_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (short_code, date, hour, device_type),
    FOREIGN KEY (short_code) REFERENCES url_mappings(short_code) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_analytics_referrer_breakdown_date 
    ON analytics_referrer_breakdown(date, hour);

CREATE INDEX IF NOT EXISTS idx_analytics_referrer_breakdown_short_code_date 
    ON analytics_referrer_breakdown(short_code, date);

CREATE INDEX IF NOT EXISTS idx_analytics_country_breakdown_date 
    ON analytics_country_breakdown(date, hour);

CREATE INDEX IF NOT EXISTS idx_analytics_country_breakdown_short_code_date 
    ON analytics_country_breakdown(short_code, date);

CREATE INDEX IF NOT EXISTS idx_analytics_device_breakdown_date 
    ON analytics_device_breakdown(date, hour);

CREATE INDEX IF NOT EXISTS idx_analytics_device_breakdown_short_code_date 
    ON analytics_device_breakdown(short_code, date);

-- Partitioning for analytics breakdown tables (optional, for high volume)
-- Note: Partitioning can be added later based on data volume requirements

COMMENT ON TABLE analytics_referrer_breakdown IS 'Stores detailed referrer breakdown for analytics aggregation';
COMMENT ON TABLE analytics_country_breakdown IS 'Stores detailed country breakdown for analytics aggregation';
COMMENT ON TABLE analytics_device_breakdown IS 'Stores detailed device type breakdown for analytics aggregation';