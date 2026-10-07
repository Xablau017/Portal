import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { verificarAdmin } from '$lib/server/verificarAdmin';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? '';

    if (!(await verificarAdmin(token))) {
        throw error(403, 'Apenas administradores.');
    }

    const { userId, novaSenha } = await request.json();

    const { error: e } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: novaSenha
    });

    if (e) throw error(500, e.message);
    return json({ ok: true }); 
}