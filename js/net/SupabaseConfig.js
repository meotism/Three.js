// Supabase credentials — placeholders replaced by GitHub Actions during deployment.
// In local dev, placeholders remain and isOnlineAvailable() returns false.
export const SUPABASE_URL = '__SUPABASE_URL__';
export const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// String-split check prevents sed from accidentally replacing the guard itself.
export function isOnlineAvailable() {
    return SUPABASE_URL !== '__SUPABASE' + '_URL__' &&
           SUPABASE_ANON_KEY !== '__SUPABASE' + '_ANON_KEY__';
}
