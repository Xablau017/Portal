<!-- src/routes/bi/+page.svelte -->
<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte'

  const DASHBOARDS = [
    {id: 'geral', label:'Geral', url:'https://app.powerbi.com/view?r=eyJrIjoiOTZmMzQ3YjUtMTQ5Yi00NmNlLWE4ZjctYTFiZmNiOTgyYjM5IiwidCI6ImU1NmNhMWJkLWI4NTktNGVkNy05OWQ2LThkYWU5MjI0MGM4NSJ9&embedImagePlaceholder=true&pageName=559f56b6f838c096b16d', role: null},
    {id: 'financeiro', label:'Financeiro', url:'https://app.powerbi.com/view?r=eyJrIjoiMDk2Y2ZkMTMtODg0Ni00Y2VlLTg0NjItMjY5Nzg0MzZmNzkyIiwidCI6ImU1NmNhMWJkLWI4NTktNGVkNy05OWQ2LThkYWU5MjI0MGM4NSJ9', role: 'financeiro'},
  ];

  let role = $state('');
  let carregando = $state(true);
  let abaAtiva = $state('geral');

  onMount(async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if(userId) {
      const { data: perfil } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
        if (perfil) role = perfil.role;
    }
    carregando = false;
  })

  let abasVisiveis = $derived(
  DASHBOARDS.filter((d) => d.role === null || d.role === role)
  );

  let dashboardAtual = $derived(
  abasVisiveis.find((d) => d.id === abaAtiva) ?? abasVisiveis[0]
  );
</script>

<main class="bi">
	<a href="/" class="voltar">← Voltar</a>
	<h1>Indicadores</h1>

	{#if carregando}
		<p>Carregando...</p>
	{:else}
		<!-- As abas -->
		<nav class="abas">
			{#each abasVisiveis as aba}
				<button
					class:ativa={aba.id === abaAtiva}
					onclick={() => (abaAtiva = aba.id)}
				>
					{aba.label}
				</button>
			{/each}
		</nav>

		<!-- O dashboard da aba ativa -->
		{#if dashboardAtual}
			<div class="frame">
				<iframe
					title={dashboardAtual.label}
					src={dashboardAtual.url}
					allowfullscreen
				></iframe>
			</div>
		{/if}
	{/if}
</main>


<style>
	.abas { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 2px solid var(--borda); }
	.abas button {
		background: none;
		color: var(--texto-suave);
		border: none;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		padding: 10px 18px;
		margin-bottom: -2px;
		font-weight: 700;
		cursor: pointer;
	}
	.abas button.ativa {
		color: var(--azul-pleno);
		border-bottom-color: var(--ouro-legado);
	}
	.frame { position: relative; padding-top: 56.25%; height: 0; }
	.frame iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 8px; }
</style>
