-- TEMPMAIL - Full Database Schema
-- For Titan V3.0 Bot Integration

-- Temporary emails table
CREATE TABLE IF NOT EXISTS temp_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    domain TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- Messages table (real emails)
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    from_email TEXT,
    subject TEXT,
    body TEXT,
    html_body TEXT,
    received_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0,
    FOREIGN KEY(email) REFERENCES temp_emails(email) ON DELETE CASCADE
);

-- SMS numbers pool
CREATE TABLE IF NOT EXISTS available_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    country TEXT,
    service TEXT,
    is_active INTEGER DEFAULT 1,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Incoming SMS messages
CREATE TABLE IF NOT EXISTS incoming_sms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_number TEXT NOT NULL,
    from_number TEXT,
    message TEXT,
    received_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0,
    FOREIGN KEY(to_number) REFERENCES available_numbers(number)
);

-- API keys for external access (for bots)
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    requests_count INTEGER DEFAULT 0
);

-- Logs for debugging
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,
    message TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_temp_emails_email ON temp_emails(email);
CREATE INDEX IF NOT EXISTS idx_temp_emails_expires ON temp_emails(expires_at);
CREATE INDEX IF NOT EXISTS idx_messages_email ON messages(email);
CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_to_number ON incoming_sms(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_received ON incoming_sms(received_at DESC);

-- Insert default API key for Titan bot
INSERT OR IGNORE INTO api_keys (key, name) 
VALUES ('TITAN_V3_MASTER_KEY', 'Titan Bot v3.0');

-- Insert sample numbers (replace with real numbers from SMS service)
INSERT OR IGNORE INTO available_numbers (number, country, service) VALUES
('+12025550123', 'USA', 'twilio'),
('+442045012345', 'UK', 'twilio'),
('+4915112345678', 'Germany', 'twilio'),
('+33612345678', 'France', 'vonage'),
('+81312345678', 'Japan', 'twilio');