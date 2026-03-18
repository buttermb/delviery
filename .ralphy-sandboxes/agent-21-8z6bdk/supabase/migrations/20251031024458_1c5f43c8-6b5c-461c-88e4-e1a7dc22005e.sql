-- Add coordinates column to wholesale_clients table
ALTER TABLE public.wholesale_clients 
ADD COLUMN coordinates JSONB;

-- Add index for better query performance
CREATE INDEX idx_wholesale_clients_coordinates ON public.wholesale_clients USING GIN (coordinates);

COMMENT ON COLUMN public.wholesale_clients.coordinates IS 'Client location coordinates as {lat: number, lng: number}';
