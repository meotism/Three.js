// Supabase credentials — anon/publishable keys are designed to be public.
// Row Level Security (RLS) protects data, not the anon key.
export const SUPABASE_URL = 'https://uihwtvwgiwspgusznprl.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_bbnFoikQhkE18Mf3C4jZAw__jeRoZhQ';

export function isOnlineAvailable() {
    return SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 10;
}
