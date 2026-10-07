import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';


export const supabaseAdmin = createClient(
    env.PUBLIC_SUPABASE_URL ?? '',
    env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession:false } }
);