-- Check user subscription
-- Run this in your Supabase SQL editor

-- Check the specific user's subscription
SELECT 
  id,
  email,
  subscription,
  created_at
FROM auth.users 
WHERE id = 'c2910d87-ec93-4743-b209-a4c16ab41e95';

-- Also check if there's a profiles table with subscription info
SELECT 
  id,
  subscription,
  created_at
FROM public.profiles 
WHERE id = 'c2910d87-ec93-4743-b209-a4c16ab41e95';

-- Check all users and their subscriptions
SELECT 
  id,
  email,
  subscription,
  created_at
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10; 