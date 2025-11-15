-- Add region_code column to analytics_events table for state-level tracking (especially for India)
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS region_code VARCHAR(10);

-- Add index for efficient querying by region_code
CREATE INDEX IF NOT EXISTS idx_analytics_events_region_code 
ON analytics_events(region_code) 
WHERE region_code IS NOT NULL;

-- Add composite index for country and region queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_country_region 
ON analytics_events(country_code, region_code) 
WHERE country_code IS NOT NULL;

-- Comment on the column
COMMENT ON COLUMN analytics_events.region_code IS 'ISO 3166-2 region/state code (e.g., IN-MH for Maharashtra, IN-DL for Delhi)';
