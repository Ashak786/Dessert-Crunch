import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tsbvcjjybxpkappcqqqi.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzYnZjamp5Ynhwa2FwcGNxcXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDU2NjgsImV4cCI6MjA5MDAyMTY2OH0.4niTaQsV6tcLSYGVmJav1zI4rROuosbwLBf6GPQ8yiE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
