<!-- src/routes/treinamentos/[id]/+page.svelte -->
<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  type Training = {
    id: string;
    titulo: string;
    descricao: string;
    video_url: string;
  };

  // O vídeo pode ser um Training OU null (enquanto não carregou / não achou).
  let video: Training | null = $state(null);
  let carregando = $state(true);

  onMount(async () => {
    // Pega o "id" da URL. Se a URL é /treinamentos/abc, params.id é "abc".
    const id = $page.params.id;

    // Busca UM vídeo específico pelo id. ".single()" pede um só resultado.
    const { data, error } = await supabase
      .from('trainings')
      .select('id, titulo, descricao, video_url')
      .eq('id', id)
      .single();

    if (!error && data) {
      video = data;
    }
    carregando = false;
  });
</script>

<main class="player">
  <a href="/treinamentos" class="voltar">← Treinamentos</a>

  {#if carregando}
    <p>Carregando...</p>
  {:else if !video}
    <p>Vídeo não encontrado.</p>
  {:else}
    <h1>{video.titulo}</h1>

    <!-- O iframe do Google Drive. video_url deve terminar em /preview. -->
    <div class="frame">
      <iframe
        title={video.titulo}
        src={video.video_url}
        allowfullscreen
      ></iframe>
    </div>

    <p class="desc">{video.descricao}</p>
  {/if}
</main>

<style>
  .player { max-width: 900px; margin: 24px auto; font-family: system-ui, sans-serif; }
  .voltar { text-decoration: none; color: #555; }
  .frame { position: relative; padding-top: 56.25%; height: 0; }
  .frame iframe {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%; border: 0; border-radius: 8px;
  }
  .desc { margin-top: 16px; color: #444; }
</style>