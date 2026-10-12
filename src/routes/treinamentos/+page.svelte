<script lang="ts">
    import {supabase} from '$lib/supabaseClient';
    import { onMount } from 'svelte';

    type Training = {
        id: string;
        titulo: string;
        descricao: string;
        thumbnail_url: string;
        area: string;
    };

    let videos: Training[] = $state([]);
    let carregando = $state(true);

    onMount(async () => {

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        let role = 'colaborador';
        if (userId) {
            const { data: perfil } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();
                if (perfil) role =perfil.role;
        }

        let query = supabase
            .from('trainings')
            .select('id, titulo, descricao, thumbnail_url, area')
            .eq('publicado', true)
            .order('ordem', {ascending: true});

        if (role !== 'admin') {
            query = query.or(`area.eq.${role}, area.eq.todos`);
        }

        const { data, error } = await query;
        if (!error && data) videos = data; 
        carregando = false;
    });
</script>

<main class="lista">
    <header class="topo">
        <a href="/" class="voltar">← Voltar</a>
        <svg class="monograma" viewBox="114 78.5 115.5 80" aria-hidden="true">
            <path d="M123.36,157.99h96.64c4.92,0,8.91-3.99,8.91-8.91v-61.18c0-4.92-3.99-8.91-8.91-8.91h-96.64c-4.92,0-8.91,3.99-8.91,8.91v61.18c0,4.92,3.99,8.91,8.91,8.91ZM146.66,113.53c9.64-1.57,13.54,6.06,18.86,4.84,3.83-.87,5.59-10.93,9.81-17.59,2.35-3.73,7.7-9.53,19.33-9.53,17.01,0,20.47,10.94,21,15,.88,6.67.59,30.82,1,39.5h-12.25c-.11-5.99-.25-27.6-.75-35-.84-12.41-15.94-16.01-21-1.5-3.4,9.75-8.23,21.28-18.17,19.5-7.63-1.38-10.33-10.5-17.83-10.5-7.98,0-6.43,19.52-6.43,27.5h-14.7c1.07-9.7,4.24-29.47,21.13-32.22Z" />
        </svg>
    </header>

    <section class="cabecalho">
        <p class="sobrelinha">Desenvolvimento</p>
        <h1>Treinamentos</h1>
        <span class="filete" aria-hidden="true"></span>
    </section>

    {#if carregando}
    <p class="aviso">Carregando...</p>
    {:else if videos.length === 0}
    <p class="aviso">Nenhum treinamento disponível</p>
    {:else}
    <div class="grade">
    {#each videos as video}
        <a class="card" href={`/treinamentos/${video.id}`}>
            <div class="capa">
                <img src={video.thumbnail_url} alt={video.titulo} />
                <span class="play" aria-hidden="true">▶</span>
            </div>
            <div class="corpo">
                <h3>{video.titulo}</h3>
                <p>{video.descricao}</p>
            </div>
        </a>
    {/each}
    </div>
    {/if}
</main>

<style>
	.lista {
		max-width: 1040px;
		margin: 24px auto 48px;
		padding: 0 16px;
	}
	/* barra institucional em Azul Pleno */
	.topo {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--azul-pleno);
		border-bottom: 3px solid var(--ouro-legado);
		border-radius: 12px;
		padding: 12px 20px;
	}
	.voltar {
		text-decoration: none;
		color: #fff;
		font-weight: 700;
		font-size: 14px;
		transition: color 0.2s;
	}
	.voltar:hover {
		color: var(--verde-apoio);
	}
	.monograma {
		width: 36px;
		height: auto;
		color: var(--verde-apoio);
	}
	.cabecalho {
		margin: 36px 0 28px;
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
	.aviso {
		color: var(--texto-suave);
	}
	.grade {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 20px;
	}
	.card {
		display: flex;
		flex-direction: column;
		background: #fff;
		border: 1px solid var(--borda);
		border-radius: 12px;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		transition: box-shadow 0.2s, transform 0.2s;
	}
	.card:hover {
		box-shadow: 0 10px 28px rgba(26, 44, 66, 0.12);
		transform: translateY(-2px);
	}
	.capa {
		position: relative;
		background: var(--azul-pleno);
		border-bottom: 3px solid var(--verde-apoio);
	}
	.card:hover .capa {
		border-bottom-color: var(--ouro-legado);
	}
	.capa img {
		display: block;
		width: 100%;
		aspect-ratio: 16/9;
		object-fit: cover;
	}
	.play {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(26, 44, 66, 0.75);
		color: var(--ouro-legado);
		font-size: 16px;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.card:hover .play {
		opacity: 1;
	}
	.corpo {
		padding: 14px 16px 18px;
	}
	.card h3 {
		font-size: 1.35rem;
		line-height: 1.2;
		margin: 0 0 6px;
	}
	.card p {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--texto-suave);
	}
</style>
