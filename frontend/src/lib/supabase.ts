import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ctizzbqfcospnfsccirw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy_anon_key_replace_in_env';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
