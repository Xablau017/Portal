<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';

	let nome = $state('');
	let telefone = $state('');
	let observacoes = $state('');
	let email = $state('');
	let salvo = $state(false);
	let carregando = $state(true);

	onMount(async () => {
		const { data: u } = await supabase.auth.getUser();
		email = u.user?.email ?? '';
		const { data: p } = await supabase
			.from('profiles')
			.select('nome_exibicao, telefone, observacoes')
			.eq('id', u.user?.id)
			.single();
		if (p) {
			nome = p.nome_exibicao ?? '';
			telefone = p.telefone ?? '';
			observacoes = p.observacoes ?? '';
		}
		carregando = false;
	});

	async function salvar() {
		const { data: u } = await supabase.auth.getUser();
		await supabase.from('profiles').update({
			nome_exibicao: nome,
			telefone,
			observacoes
		}).eq('id', u.user?.id);
		salvo = true;
		setTimeout(() => (salvo = false), 2000);
	}
</script>

{#if carregando}
	<p>Carregando...</p>
{:else}
	<main class="perfil">
		<a href="/" class="voltar">← Voltar</a>
		<h1>Meu perfil</h1>
		<p class="email">{email}</p>

		<label>Nome de exibição
			<input type="text" bind:value={nome} />
		</label>
		<label>Telefone
			<input type="text" bind:value={telefone} />
		</label>
		<label>Observações
			<textarea bind:value={observacoes}></textarea>
		</label>

		<button onclick={salvar}>Salvar</button>
		{#if salvo}<span class="ok">Salvo!</span>{/if}
	</main>
{/if}