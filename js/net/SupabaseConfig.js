// Supabase credentials — placeholders replaced by GitHub Actions during deployment.
// In local dev, placeholders remain and isOnlineAvailable() returns false.
export const SUPABASE_URL = '__SUPABASE_URL__';
export const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

export function isOnlineAvailable() {
    return SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 10;
}
