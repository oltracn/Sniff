import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
// 后端必须使用 secret key
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const MISSING_MSG =
  'Supabase admin not configured: please set SUPABASE_URL and SUPABASE_SECRET_KEY in your environment (backend .env)';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Supabase admin not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY in backend .env');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export { supabaseAdmin };
