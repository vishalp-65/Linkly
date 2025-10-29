-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    duplicate_strategy VARCHAR(20) DEFAULT 'generate_new' CHECK (duplicate_strategy IN ('generate_new', 'reuse_existing')),
    default_expiry INTEGER, -- null for permanent, number for days
    custom_domain VARCHAR(255),
    enable_analytics BOOLEAN DEFAULT TRUE,
    enable_qr_code BOOLEAN DEFAULT TRUE,
    enable_password_protection BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    -- Email notifications
    email_url_expiring BOOLEAN DEFAULT TRUE,
    email_url_expired BOOLEAN DEFAULT TRUE,
    email_high_traffic BOOLEAN DEFAULT FALSE,
    email_weekly_report BOOLEAN DEFAULT TRUE,
    email_monthly_report BOOLEAN DEFAULT FALSE,
    -- Webhook settings
    webhook_enabled BOOLEAN DEFAULT FALSE,
    webhook_url TEXT,
    webhook_secret VARCHAR(255),
    webhook_event_url_created BOOLEAN DEFAULT FALSE,
    webhook_event_url_clicked BOOLEAN DEFAULT FALSE,
    webhook_event_url_expired BOOLEAN DEFAULT TRUE,
    webhook_event_url_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_webhook_enabled ON notification_settings(webhook_enabled);

-- Create triggers for updated_at
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at 
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to initialize default preferences for new users
CREATE OR REPLACE FUNCTION create_default_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO notification_settings (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create preferences for new users
CREATE TRIGGER create_user_preferences_trigger
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_user_preferences();

-- Backfill preferences for existing users
INSERT INTO user_preferences (user_id)
SELECT user_id FROM users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO notification_settings (user_id)
SELECT user_id FROM users
ON CONFLICT (user_id) DO NOTHING;
