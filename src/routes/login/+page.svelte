<script lang="ts">
import { supabase }from '$lib/supabaseClient';
import { goto } from '$app/navigation';

const DOMINIO = '@grupomariacristina.com'

let usuario = $state('');
let senha = $state('');
let erro = $state('');
let carregando = $state(false);

async function fazerLogin() {
    erro = '';
    carregando = true;

    const email = usuario.trim().toLowerCase() + DOMINIO;

    const { error } = await
    supabase.auth.signInWithPassword({
        email,
        password: senha
    });

    carregando = false

    if (error) {
        erro = 'E-mail ou senha inválidos.';
    } else {
        goto('/')
    }

const { data: userData } = await supabase.auth.getUser();
	if (userData.user) {
		await supabase.from('access_log').insert({
			user_id: userData.user.id,
			email: userData.user.email,
			evento: 'login'
	});
}
}
</script>

<main class= "login">
    <h1> Portal Grupo Maria Cristina</h1>

    <label class="campo-usuario">
          <input
                type="text"
                placeholder="Seu Usuario"
                bind:value={usuario}
                autocomplete="username"
            />  
            <span class="dominio">{DOMINIO}</span>
    </label>

    <input
        type="password"
        placeholder="Sua senha"
        bind:value={senha}
        autocomplete="current-password"
    />

    <button onclick={fazerLogin} disabled={carregando}>
        {carregando ? 'Entrando...' : 'Entrar'}
    </button>

    {#if erro}
        <p class="erro">{erro}</p>
    {/if}
</main>

<style>
	.login {
		max-width: 380px;
		margin: 80px auto;
		padding: 0 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	h1 {
		font-size: 1.8rem;
		margin-bottom: 8px;
	}
	/* a linha usuario + @dominio, agrupada e sem esticar */
	.campo-usuario {
		display: flex;
		align-items: center;
		border: 1px solid var(--borda);
		border-radius: 6px;
		overflow: hidden;
	}
	.campo-usuario input {
		flex: 1;
		border: none;
		padding: 12px;
		font-size: 15px;
		outline: none;
	}
	.dominio {
		padding: 0 12px;
		color: var(--texto-suave);
		background: #f4f6f8;
		white-space: nowrap;
		font-size: 14px;
		align-self: stretch;
		display: flex;
		align-items: center;
	}
	/* senha e botão */
	input[type='password'] {
		padding: 12px;
		font-size: 15px;
		border: 1px solid var(--borda);
		border-radius: 6px;
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}
	.erro { color: #c0392b; font-size: 14px; }
</style>