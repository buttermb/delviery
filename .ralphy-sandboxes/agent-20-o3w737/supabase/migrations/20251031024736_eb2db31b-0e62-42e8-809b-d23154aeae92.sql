-- Add current_location column to wholesale_runners table
ALTER TABLE public.wholesale_runners 
ADD COLUMN current_location JSONB;

-- Add index for better query performance
CREATE INDEX idx_wholesale_runners_current_location ON public.wholesale_runners USING GIN (current_location);

COMMENT ON COLUMN public.wholesale_runners.current_location IS 'Runner current location coordinates as {lat: number, lng: number}';
