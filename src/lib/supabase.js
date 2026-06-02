import { createClient } from '@supabase/supabase-js'
const SUPABASE_URL = 'https://qttwthpgzzjzidimlkkh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dHd0aHBnenpqemlkaW1sa2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjUzMzMsImV4cCI6MjA5NjAwMTMzM30.aQpwrBMataDLOeIAWEy_o-L8GfVHi8AhH71i7RZN1ys'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
