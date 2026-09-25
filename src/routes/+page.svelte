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
        <div class="marca">Portal GMC</div>
        <div class="usuario">
            {#if email}<span>{email}</span>{/if}
            {#if role}<span class="badge">{role}</span>{/if}
        <button onclick={sair}> Sair </button>
        </div>
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

