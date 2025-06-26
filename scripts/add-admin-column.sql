-- Add admin column to users table and set admin user
-- Run this in your Supabase SQL editor

-- Add the is_admin column to the users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set the specific user as admin (replace with your user ID)
UPDATE public.users 
SET is_admin = true 
WHERE id = 'c2910d87-ec93-4743-b209-a4c16ab41e95';

-- Verify the change
SELECT 
  id,
  email,
  subscription,
  is_admin,
  created_at
FROM public.users 
WHERE id = 'c2910d87-ec93-4743-b209-a4c16ab41e95';

-- Show all admin users
SELECT 
  id,
  email,
  subscription,
  is_admin,
  created_at
FROM public.users 
WHERE is_admin = true; 