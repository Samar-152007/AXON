import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration (reads from Vite env or local defaults)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTk4MzQxMjgwMH0.sample-anon-key-local-supabase-mock';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
