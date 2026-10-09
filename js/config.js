// Public Supabase client config (anon key is safe to ship; never put the service role here).
export const SUPABASE_URL = 'https://ctwtzshjpoykquhyiwwt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0d3R6c2hqcG95a3F1aHlpd3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODE4ODIsImV4cCI6MjEwNzA1Nzg4Mn0.KFC83OQjI23dQneL0FUc9iE8HViQ3nx2sOFWH1-gSL4';
export const SITE_URL = 'https://mom-os.github.io';
export const isSupabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Forever-free founder accounts (case-insensitive). Never put secrets here. */
export const OWNER_EMAILS = ['helllo.jordan@gmail.com'];

/** Public Stripe LIVE checkout config (price ids are not secrets). */
export const STRIPE_TEST_MODE = false;
export const STRIPE_PRICE_MONTHLY = 'price_1UOiFzJlf5VyzN6wxNYUOvxE';
export const STRIPE_PRICE_YEARLY = 'price_1UOiFzJlf5VyzN6w5c7G1qJd';
export const STRIPE_PRICE_FOUNDING = 'price_1UOiG0Jlf5VyzN6w8PYohmdy';
