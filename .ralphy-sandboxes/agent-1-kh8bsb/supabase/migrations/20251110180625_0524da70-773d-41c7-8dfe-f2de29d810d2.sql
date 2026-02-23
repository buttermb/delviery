-- Update thca_percentage precision to allow values up to 100
ALTER TABLE products 
ALTER COLUMN thca_percentage TYPE NUMERIC(5,2);