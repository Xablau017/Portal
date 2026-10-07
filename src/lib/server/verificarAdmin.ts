import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function verificarAdmin(accessToken: String): Promise<boolean> {
    const sb = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${accessToken}`} }
    });
    const { data, error } = await sb.rpc('is_admin');
    return !error && data === true;
}