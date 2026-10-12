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
}
</script>

<main class="login-pagina">
    <section class="login">
        <svg class="monograma" viewBox="114 78.5 115.5 80" aria-hidden="true">
            <path d="M123.36,157.99h96.64c4.92,0,8.91-3.99,8.91-8.91v-61.18c0-4.92-3.99-8.91-8.91-8.91h-96.64c-4.92,0-8.91,3.99-8.91,8.91v61.18c0,4.92,3.99,8.91,8.91,8.91ZM146.66,113.53c9.64-1.57,13.54,6.06,18.86,4.84,3.83-.87,5.59-10.93,9.81-17.59,2.35-3.73,7.7-9.53,19.33-9.53,17.01,0,20.47,10.94,21,15,.88,6.67.59,30.82,1,39.5h-12.25c-.11-5.99-.25-27.6-.75-35-.84-12.41-15.94-16.01-21-1.5-3.4,9.75-8.23,21.28-18.17,19.5-7.63-1.38-10.33-10.5-17.83-10.5-7.98,0-6.43,19.52-6.43,27.5h-14.7c1.07-9.7,4.24-29.47,21.13-32.22Z" />
        </svg>

        <h1>Portal Grupo Maria Cristina</h1>
        <p class="assinatura">Gestão &amp; Governança</p>
        <span class="filete" aria-hidden="true"></span>

        <label class="rotulo">
            Usuário
            <span class="campo-usuario">
                <input
                    type="text"
                    placeholder="Seu usuário"
                    bind:value={usuario}
                    autocomplete="username"
                />
                <span class="dominio">{DOMINIO}</span>
            </span>
        </label>

        <label class="rotulo">
            Senha
            <input
                class="campo"
                type="password"
                placeholder="Sua senha"
                bind:value={senha}
                autocomplete="current-password"
            />
        </label>

        <button onclick={fazerLogin} disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
        </button>

        {#if erro}
            <p class="erro">{erro}</p>
        {/if}
    </section>

    <p class="slogan">Tradição em cuidar, excelência em gerir.</p>
</main>

<style>
	/* fundo Azul Pleno cobrindo a tela toda (fundo escuro → marca em negativo/ouro) */
	.login-pagina {
		position: fixed;
		inset: 0;
		overflow-y: auto;
		background: var(--azul-pleno);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		box-sizing: border-box;
	}
	.login {
		width: 100%;
		max-width: 400px;
		box-sizing: border-box;
		background: #fff;
		border-radius: 12px;
		border-top: 4px solid var(--ouro-legado);
		padding: 40px 32px 32px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}
	/* monograma preferencial: box Verde Sálvia */
	.monograma {
		width: 64px;
		height: auto;
		align-self: center;
		color: var(--verde-apoio);
	}
	h1 {
		font-size: 1.9rem;
		line-height: 1.15;
		text-align: center;
		margin: 4px 0 0;
	}
	/* ramo de atividade: Lato, caixa alta */
	.assinatura {
		margin: 0;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 11px;
		font-weight: 700;
		color: var(--verde-heritage);
	}
	.filete {
		width: 48px;
		height: 2px;
		background: var(--ouro-legado);
		align-self: center;
		margin: 4px 0 8px;
	}
	.rotulo {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 700;
		color: var(--azul-pleno);
	}
	/* a linha usuario + @dominio, agrupada e sem esticar */
	.campo-usuario {
		display: flex;
		align-items: center;
		border: 1px solid var(--borda);
		border-radius: 6px;
		overflow: hidden;
		transition: border-color 0.2s, box-shadow 0.2s;
	}
	.campo-usuario:focus-within,
	.campo:focus {
		border-color: var(--verde-heritage);
		box-shadow: 0 0 0 3px rgba(151, 185, 163, 0.35);
	}
	.campo-usuario input {
		flex: 1;
		min-width: 0;
		border: none;
		padding: 12px;
		font: inherit;
		font-size: 15px;
		font-weight: 400;
		color: var(--texto);
		outline: none;
	}
	.dominio {
		padding: 0 12px;
		color: var(--texto-suave);
		background: #f3f6f4;
		border-left: 1px solid var(--borda);
		white-space: nowrap;
		font-size: 14px;
		font-weight: 400;
		align-self: stretch;
		display: flex;
		align-items: center;
	}
	/* senha e botão */
	.campo {
		padding: 12px;
		font: inherit;
		font-size: 15px;
		font-weight: 400;
		color: var(--texto);
		border: 1px solid var(--borda);
		border-radius: 6px;
		outline: none;
		width: 100%;
		box-sizing: border-box;
		transition: border-color 0.2s, box-shadow 0.2s;
	}
	button {
		margin-top: 8px;
		width: 100%;
		font-size: 15px;
		letter-spacing: 0.04em;
	}
	button:disabled {
		opacity: 0.7;
		cursor: wait;
	}
	.erro {
		margin: 0;
		color: #b03a2e;
		font-size: 14px;
		text-align: center;
	}
	/* slogan: Lato regular, caixa alta e baixa */
	.slogan {
		margin: 24px 0 0;
		color: var(--verde-apoio);
		font-style: italic;
		font-size: 14px;
	}
</style>
