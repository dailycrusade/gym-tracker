import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client — uses service_role key for write access.
// Never import this in React components; use src/lib/supabase.js there.
export function createServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
