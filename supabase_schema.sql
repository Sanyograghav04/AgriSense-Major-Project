-- ============================================================
-- AgriSense Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Sensor Readings Table
CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  location TEXT NOT NULL DEFAULT 'Unknown',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  crop TEXT NOT NULL DEFAULT 'Unknown',
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION,
  soil_moisture DOUBLE PRECISION,
  soil_temperature DOUBLE PRECISION,
  rainfall DOUBLE PRECISION,
  wind_speed DOUBLE PRECISION,
  health_score INTEGER,
  ndvi DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sensor Alerts Table
CREATE TABLE IF NOT EXISTS sensor_alerts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  location TEXT NOT NULL DEFAULT 'Unknown',
  crop TEXT NOT NULL DEFAULT 'Unknown',
  alert_level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Users can only see/edit their own data
CREATE POLICY "Users can view own readings"
  ON sensor_readings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own readings"
  ON sensor_readings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own readings"
  ON sensor_readings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own alerts"
  ON sensor_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON sensor_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 6. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_readings_user ON sensor_readings(user_id);
CREATE INDEX IF NOT EXISTS idx_readings_created ON sensor_readings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON sensor_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON sensor_alerts(created_at DESC);
