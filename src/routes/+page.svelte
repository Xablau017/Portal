<script lang="ts">
    import {supabase} from '$lib/supabaseClient';
    import {goto} from '$app/navigation';
    import { onMount } from 'svelte';

    let email =$state('');
    let role =$state('');

    onMount(async () => {
        const { data } = await supabase.auth.getUser();
        email =data.user?.email ?? '';
    

    const userId = data.user?.id;
    if (userId) {
        const { data: perfil } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()
            if (perfil) role = perfil.role;
    }
    });
        
        
    async function sair() {
        await supabase.auth.signOut();
        goto('/login');
    }

</script>

<main class="home">
    <header class="topo">
        <div class="marca">
            <svg class="monograma" viewBox="114 78.5 115.5 80" aria-hidden="true">
                <path d="M123.36,157.99h96.64c4.92,0,8.91-3.99,8.91-8.91v-61.18c0-4.92-3.99-8.91-8.91-8.91h-96.64c-4.92,0-8.91,3.99-8.91,8.91v61.18c0,4.92,3.99,8.91,8.91,8.91ZM146.66,113.53c9.64-1.57,13.54,6.06,18.86,4.84,3.83-.87,5.59-10.93,9.81-17.59,2.35-3.73,7.7-9.53,19.33-9.53,17.01,0,20.47,10.94,21,15,.88,6.67.59,30.82,1,39.5h-12.25c-.11-5.99-.25-27.6-.75-35-.84-12.41-15.94-16.01-21-1.5-3.4,9.75-8.23,21.28-18.17,19.5-7.63-1.38-10.33-10.5-17.83-10.5-7.98,0-6.43,19.52-6.43,27.5h-14.7c1.07-9.7,4.24-29.47,21.13-32.22Z" />
            </svg>
            <span class="nome">Portal GMC</span>
        </div>
        <div class="usuario">
            {#if email}<span class="email">{email}</span>{/if}
            {#if role}<span class="badge">{role}</span>{/if}
            <button class="sair" onclick={sair}>Sair</button>
        </div>
    </header>

    <section class="boas-vindas">
        <p class="sobrelinha">Grupo Maria Cristina</p>
        <h1>Boas-vindas ao portal</h1>
        <span class="filete" aria-hidden="true"></span>
    </section>

    <div class="blocos">
        <a class="bloco" href="/treinamentos">
            <span class="rotulo">Desenvolvimento</span>
            <h2>Treinamentos</h2>
            <p>Vídeos</p>
            <span class="seta" aria-hidden="true">→</span>
        </a>

        <a class="bloco" href="/bi">
            <span class="rotulo">Gestão</span>
            <h2>BI</h2>
            <p>Dashboards</p>
            <span class="seta" aria-hidden="true">→</span>
        </a>
    </div>
</main>

<style>
	.home {
		max-width: 960px;
		margin: 24px auto 48px;
		padding: 0 16px;
	}
	/* barra institucional em Azul Pleno, marca em negativo/Sálvia */
	.topo {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		background: var(--azul-pleno);
		border-bottom: 3px solid var(--ouro-legado);
		border-radius: 12px;
		padding: 14px 20px;
	}
	.marca {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.monograma {
		width: 40px;
		height: auto;
		color: var(--verde-apoio);
	}
	.nome {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: #fff;
	}
	.usuario {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		font-size: 14px;
	}
	.email {
		color: var(--verde-apoio);
	}
	.badge {
		border: 1px solid var(--ouro-legado);
		color: var(--ouro-legado);
		border-radius: 999px;
		padding: 2px 10px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.sair {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.5);
		padding: 8px 16px;
	}
	.sair:hover {
		background: var(--verde-heritage);
		border-color: var(--verde-heritage);
	}
	.boas-vindas {
		margin: 40px 0 28px;
	}
	.sobrelinha {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 12px;
		font-weight: 700;
		color: var(--verde-heritage);
	}
	h1 {
		font-size: 2.4rem;
		margin: 6px 0 12px;
	}
	.filete {
		display: block;
		width: 56px;
		height: 2px;
		background: var(--ouro-legado);
	}
	.blocos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 20px;
	}
	.bloco {
		position: relative;
		display: block;
		padding: 28px 28px 32px;
		background: #fff;
		border: 1px solid var(--borda);
		border-left: 4px solid var(--verde-apoio);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
	}
	.bloco:hover {
		border-left-color: var(--verde-heritage);
		box-shadow: 0 10px 28px rgba(26, 44, 66, 0.12);
		transform: translateY(-2px);
	}
	.rotulo {
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 11px;
		font-weight: 700;
		color: var(--verde-heritage);
	}
	.bloco h2 {
		font-size: 2rem;
		margin: 6px 0 4px;
	}
	.bloco p {
		margin: 0;
		color: var(--texto-suave);
	}
	.seta {
		position: absolute;
		right: 24px;
		bottom: 24px;
		font-size: 20px;
		color: var(--ouro-legado);
		transition: transform 0.2s;
	}
	.bloco:hover .seta {
		transform: translateX(4px);
	}
</style>
