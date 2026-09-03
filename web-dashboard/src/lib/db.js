import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

let supabase = null;

export async function openDb() {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}
