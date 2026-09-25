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
    <a href="/" class="voltar"> ← Voltar</a>
    <h1>Treinamentos</h1>

    {#if carregando}
    <p>Carregando...</p>
    {:else if videos.length === 0}
    <p>Nenhum treinamento disponível</p>
    {:else}
    <div class="grade">
    {#each videos as video}
        <a class="card" href={`/treinamentos/${video.id}`}>
            <img src={video.thumbnail_url} alt={video.titulo} />
            <h3>{video.titulo}</h3>
            <p>{video.descricao}</p>
        </a>
    {/each}
    </div>
    {/if}
</main>

<style>
  .lista { max-width: 900px; margin: 24px auto; font-family: system-ui, sans-serif; }
  .voltar { text-decoration: none; color: #555; }
  .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .card {
    border: 1px solid #ddd; border-radius: 10px; overflow: hidden;
    text-decoration: none; color: inherit;
  }
  .card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; }
  .card h3, .card p { margin: 8px 12px; }
</style>