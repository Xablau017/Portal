<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';

	type Usuario = { id: string; email: string; role: string };
	type Acesso = { email: string; evento: string; criado_em: string };

	let souAdmin = $state(false);
	let usuarios: Usuario[] = $state([]);
	let acessos: Acesso[] = $state([]);
	let carregando = $state(true);

	const ROLES = ['colaborador', 'financeiro', 'rh', 'loja', 'regional', 'cd', 'admin'];

	onMount(async () => {
		await carregar();
		carregando = false;
	});

	async function carregar() {
		// O RLS só deixa admin ver todos os perfis. Se vier a lista toda, é admin.
		const { data: perfis } = await supabase
			.from('profiles')
			.select('id, email, role')
			.order('email');

		if (perfis && perfis.length > 1) {
			souAdmin = true;
			usuarios = perfis;

			const { data: log } = await supabase
				.from('access_log')
				.select('email, evento, criado_em')
				.order('criado_em', { ascending: false })
				.limit(200);
			acessos = log ?? [];
		}
	}

	async function mudarRole(id: string, novaRole: string) {
		await supabase.from('profiles').update({ role: novaRole }).eq('id', id);
		await carregar();
	}

	async function resetarSenha(userId: string) {
		const novaSenha = prompt('Nova senha para esta conta:');
		if (!novaSenha) return;
		const { data } = await supabase.auth.getSession();
		const r = await fetch('/api/admin/reset-senha', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${data.session?.access_token}`
			},
			body: JSON.stringify({ userId, novaSenha })
		});
		alert(r.ok ? 'Senha alterada.' : 'Falhou.');
	}

	async function removerConta(userId: string, email: string) {
		const confirma = prompt(`Para apagar, digite o e-mail: ${email}`);
		if (confirma !== email) return;
		const { data } = await supabase.auth.getSession();
		const r = await fetch('/api/admin/remover', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${data.session?.access_token}`
			},
			body: JSON.stringify({ userId })
		});
		if (r.ok) await carregar();
		else alert('Falhou.');
	}
</script>

{#if carregando}
	<p>Carregando...</p>
{:else if !souAdmin}
	<p>Acesso restrito.</p>
{:else}
	<h1>Administração</h1>

	<section>
		<h2>Usuários</h2>
		<table>
			<thead><tr><th>E-mail</th><th>Papel</th><th>Ações</th></tr></thead>
			<tbody>
				{#each usuarios as u}
					<tr>
						<td>{u.email}</td>
						<td>
							<select value={u.role} onchange={(e) => mudarRole(u.id, e.currentTarget.value)}>
								{#each ROLES as r}<option value={r}>{r}</option>{/each}
							</select>
						</td>
						<td>
							<button onclick={() => resetarSenha(u.id)}>Resetar senha</button>
							<button onclick={() => removerConta(u.id, u.email)}>Remover</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section>
		<h2>Acessos recentes</h2>
		<table>
			<thead><tr><th>E-mail</th><th>Evento</th><th>Quando</th></tr></thead>
			<tbody>
				{#each acessos as a}
					<tr>
						<td>{a.email}</td>
						<td>{a.evento}</td>
						<td>{new Date(a.criado_em).toLocaleString('pt-BR')}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}