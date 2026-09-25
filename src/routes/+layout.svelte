<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/maria-cristina_simbolo_verde claro.svg';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { children } = $props();
	let estaNoLogin = $derived($page.url.pathname === '/login');
	let pronto = $state(false);

	onMount(async () => {
		if (estaNoLogin) {
			pronto = true;
			return;
		}

		const { data } = await supabase.auth.getSession();

		if (!data.session) {
			goto('/login');
		} else {
			pronto = true;
		}
	});

</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if estaNoLogin || pronto}
	{@render children()}
{/if}