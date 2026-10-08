// Public Supabase client config (anon key is safe to ship; never put the service role here).
// Filled by scripts/provision-supabase.sh after the project is created.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
export const SITE_URL = 'https://jblanchard87.github.io/momos';
export const isSupabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
