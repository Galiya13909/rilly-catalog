// Подключение RILLY к Supabase.
// Publishable key можно хранить во frontend-коде: безопасность обеспечивается RLS в Supabase.
const SUPABASE_URL = 'https://twddrhumjeyevekrumta.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_VupUNZbfRaMCsjThqFIfVw_tyyhD7pm';

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
