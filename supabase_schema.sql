-- Run this in your Supabase SQL Editor

-- 1. Create the Service Schedules Table
CREATE TABLE IF NOT EXISTS service_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    car_id BIGINT REFERENCES cars(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    last_service_date DATE,
    last_service_mileage INTEGER,
    interval_miles INTEGER,
    interval_months INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for service_schedules
ALTER TABLE service_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/edit schedules for their own cars
-- Assuming 'user_id' exists on the 'cars' table and you map it via Clerk. 
-- Since we do RLS on cars, we can do a subquery:
DROP POLICY IF EXISTS "Users can manage schedules for their cars" ON service_schedules;
CREATE POLICY "Users can manage schedules for their cars" 
ON service_schedules 
FOR ALL 
USING (
  car_id IN (SELECT id FROM cars WHERE user_id = (auth.jwt() ->> 'sub'))
);

-- 2. Create the Service Logs Table
CREATE TABLE IF NOT EXISTS service_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    car_id BIGINT REFERENCES cars(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    date_performed DATE NOT NULL,
    mileage_at_service INTEGER,
    cost NUMERIC(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for service_logs
ALTER TABLE service_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/edit logs for their own cars
DROP POLICY IF EXISTS "Users can manage logs for their cars" ON service_logs;
CREATE POLICY "Users can manage logs for their cars" 
ON service_logs 
FOR ALL 
USING (
  car_id IN (SELECT id FROM cars WHERE user_id = (auth.jwt() ->> 'sub'))
);
