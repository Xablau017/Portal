<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { children } = $props();
	let verificado = $state(false);

	onMount(async () => {
		const { data } = await supabase.auth.getSession();

		const estaNoLogin = $page.url.pathname === '/login';

		if (!data.session && !estaNoLogin) {
			goto('/login');
		} else {
			verificado = true;
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if verificado}
	{@render children()}
{/if}