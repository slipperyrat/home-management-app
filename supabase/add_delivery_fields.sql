-- Add delivery-specific fields to ai_parsed_items table
-- This migration adds support for better delivery tracking and date parsing

ALTER TABLE ai_parsed_items 
ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_provider TEXT,
ADD COLUMN IF NOT EXISTS delivery_tracking_number TEXT,
ADD COLUMN IF NOT EXISTS delivery_status TEXT;

-- Add comments for documentation
COMMENT ON COLUMN ai_parsed_items.delivery_date IS 'Parsed delivery date in ISO format, null if parsing failed';
COMMENT ON COLUMN ai_parsed_items.delivery_provider IS 'Delivery service provider (e.g., Amazon, FedEx, UPS)';
COMMENT ON COLUMN ai_parsed_items.delivery_tracking_number IS 'Tracking number for the delivery';
COMMENT ON COLUMN ai_parsed_items.delivery_status IS 'Current status of the delivery (e.g., In Transit, Delivered)';

-- Create index for delivery queries
CREATE INDEX IF NOT EXISTS idx_ai_parsed_items_delivery_date ON ai_parsed_items(delivery_date) WHERE delivery_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_parsed_items_delivery_provider ON ai_parsed_items(delivery_provider) WHERE delivery_provider IS NOT NULL;
