<script lang="ts">
    import {supabase} from '$lib/supabaseClient';
    import {goto} from '$app/navigation';

    async function sair() {
        await supabase.auth.signOut();
        goto('/login');
    }
</script>

<main class="home">
    <header>
        <h1> Portal GMR </h1>
        <button on:click={sair}> Sair </button>
    </header>

    <div class="blocos">
        <a class="bloco" href="/treinamentos">
        <h2>Treinamentos</h2>
        <p>Vídeos</p>
    </a>

    <a class="bloco" href="/bi">
    <h2>BI</h2>
    <p>Dasboards</p>
    </a>
    </div>
</main>

<h1>Welcome to SvelteKit</h1>

<style>
  .home { max-width: 800px; margin: 40px auto; font-family: system-ui, sans-serif; }
  header { display: flex; justify-content: space-between; align-items: center; }
  .blocos { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
  .bloco {
    display: block; padding: 24px; border: 1px solid #ddd; border-radius: 12px;
    text-decoration: none; color: inherit; transition: box-shadow .2s;
  }
  .bloco:hover { box-shadow: 0 2px 12px rgba(0,0,0,.08); }  
</style>

