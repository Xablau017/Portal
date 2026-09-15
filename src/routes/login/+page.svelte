<script lang="ts">
import { supabase }from '$lib/supabaseClient';
import { goto } from '$app/navigation';

let email = $state('');
let senha = $state('');
let erro = $state('');
let carregando = $state(false);

async function fazerLogin() {
    erro = '';
    carregando = true;

    const { error } = await
    supabase.auth.signInWithPassword({
        email: email,
        password: senha
    });

    carregando = false

    if (error) {
        erro = 'E-mail ou senha inválidos.';
    } else {
        goto('/')
    }
}
</script>

<main class= "login">
    <h1> Portal Grupo Maria Cristina</h1>

    <input
    type="email"
    placeholder="Seu E-mail (@grupomariacristina)"
    bind:value={email}
    />

    <input
    type="password"
    placeholder="Sua senha"
    bind:value={senha}
    />

    <button on:click={fazerLogin} disabled={carregando}>
        {carregando ? 'Entrando...' : 'Entrar'}
    </button>

    {#if erro}
    <p class="erro">{erro}</p>
    {/if}
</main>

<style>
    .login {
        max-width: 360px;
        margin: 80px auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: system-ui, sans-serif;
    }
    input, button {
        padding: 10px;
        font-size: 16px;
    }
    .erro { color: #c00; }
</style>