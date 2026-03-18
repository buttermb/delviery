-- Create location history table for GPS tracking
CREATE TABLE IF NOT EXISTS public.runner_location_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  runner_id UUID NOT NULL REFERENCES public.wholesale_runners(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES public.wholesale_deliveries(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2), -- GPS accuracy in meters
  speed DECIMAL(10, 2), -- Speed in km/h
  heading DECIMAL(5, 2), -- Direction in degrees (0-360)
  altitude DECIMAL(10, 2), -- Altitude in meters
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  battery_level INTEGER, -- Battery percentage (0-100)
  is_moving BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_runner_location_runner_id ON public.runner_location_history(runner_id);
CREATE INDEX idx_runner_location_delivery_id ON public.runner_location_history(delivery_id);
CREATE INDEX idx_runner_location_recorded_at ON public.runner_location_history(recorded_at DESC);
CREATE INDEX idx_runner_location_runner_time ON public.runner_location_history(runner_id, recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE public.runner_location_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserts (for API calls from runner apps via service role)
CREATE POLICY "Allow location inserts"
ON public.runner_location_history
FOR INSERT
WITH CHECK (true);

-- Policy: Authenticated users can view location history
CREATE POLICY "Authenticated users can view location history"
ON public.runner_location_history
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Enable realtime for location updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.runner_location_history;

-- Function to get route statistics
CREATE OR REPLACE FUNCTION public.get_route_statistics(
  p_runner_id UUID,
  p_delivery_id UUID DEFAULT NULL,
  p_start_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  total_distance DECIMAL,
  total_duration INTERVAL,
  average_speed DECIMAL,
  max_speed DECIMAL,
  points_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Calculate total distance using haversine formula (result in km)
    COALESCE(SUM(
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(lag_lat)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(lag_lng)) + 
          sin(radians(lag_lat)) * sin(radians(latitude))
        ))
      )
    ), 0) as total_distance,
    -- Total duration
    COALESCE(MAX(recorded_at) - MIN(recorded_at), INTERVAL '0') as total_duration,
    -- Average speed
    COALESCE(AVG(speed), 0) as average_speed,
    -- Max speed
    COALESCE(MAX(speed), 0) as max_speed,
    -- Number of points
    COUNT(*)::INTEGER as points_count
  FROM (
    SELECT
      latitude,
      longitude,
      speed,
      recorded_at,
      LAG(latitude) OVER (ORDER BY recorded_at) as lag_lat,
      LAG(longitude) OVER (ORDER BY recorded_at) as lag_lng
    FROM public.runner_location_history
    WHERE runner_id = p_runner_id
      AND (p_delivery_id IS NULL OR delivery_id = p_delivery_id)
      AND (p_start_time IS NULL OR recorded_at >= p_start_time)
      AND (p_end_time IS NULL OR recorded_at <= p_end_time)
    ORDER BY recorded_at
  ) subquery
  WHERE lag_lat IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean old location data (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_location_history()
RETURNS void AS $$
BEGIN
  DELETE FROM public.runner_location_history
  WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;