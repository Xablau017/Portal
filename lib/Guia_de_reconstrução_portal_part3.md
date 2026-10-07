# Guia de Reconstrução — Portal Interno (Parte 3)

> **Painel administrativo + página de perfil.** Esta parte é mais densa e mais
> cuidadosa que as anteriores, porque aqui o portal passa a **criar, apagar e
> dar permissões** a contas — ações que, se mal feitas, são perigosas. Por isso
> ela introduz a **camada de servidor** (endpoints `+server.ts`), onde a chave
> secreta mora com segurança, longe do navegador.
>
> **Admin único (por enquanto):** `fernandomartinez@grupomariacristina.com`.
>
> **Leia a seção 1 inteira antes de codar qualquer coisa.** Ela explica a regra
> de ouro que torna este painel seguro, e sem ela o resto não faz sentido.

---

## Índice

1. [A regra de ouro: por que o admin precisa de servidor](#1-a-regra-de-ouro)
2. [Base de dados: quem é admin, de forma inviolável](#2-base-de-dados-admin)
3. [Log detalhado de acessos](#3-log-detalhado-de-acessos)
4. [A camada de servidor (endpoints protegidos)](#4-camada-de-servidor)
5. [Trocar a role de uma conta](#5-trocar-role)
6. [Resetar senha, criar e remover contas](#6-resetar-criar-remover)
7. [A interface do painel admin](#7-interface-admin)
8. [Página de perfil (todos os usuários)](#8-página-de-perfil)
9. [Ordem de trabalho e testes de segurança](#9-ordem-e-testes)

---

## 1. A regra de ouro

Tudo nesta parte gira em torno de uma distinção:

- A **anon key** (que você já usa) é pública e respeita o RLS. Pode ir ao navegador.
- A **service_role key** é a chave-mestra: **ignora todo o RLS** e pode fazer
  qualquer coisa no banco. **NUNCA pode ir ao navegador.**

Resetar senha, criar conta e apagar conta **exigem** a service_role key. Logo,
essas ações **não podem** acontecer no código SvelteKit do navegador — se a chave
fosse para lá, qualquer pessoa poderia extraí-la e destruir o banco inteiro.

A solução, que é o padrão de qualquer painel admin do mundo: essas ações rodam
num **endpoint de servidor** (`+server.ts`). O navegador só *pede* ("resete a
senha do usuário X"); o servidor confirma que **quem pediu é admin** e então
executa, com a chave secreta que só existe no servidor.

```
Navegador (admin clica)          Servidor (+server.ts)             Supabase
      │  "resetar senha do X"          │                               │
      │───────────────────────────────▶│                               │
      │                                │ 1. confirma: quem pediu é admin?│
      │                                │ 2. usa service_role key ────────▶│
      │                                │ 3. senha resetada               │
      │  ◀── "ok" ──────────────────────│                               │
```

A chave secreta nunca sai do servidor. É isto que torna o painel **rigoroso**
(sua escolha) em vez de só aparentemente seguro.

> **Ação sua:** a service_role key vai nas variáveis de ambiente do Cloudflare
> (como você já fez com as PUBLIC_), mas **sem** o prefixo `PUBLIC_` — assim ela
> fica só no servidor. Nome sugerido: `SUPABASE_SERVICE_ROLE_KEY`. Nunca no Git.
>
> **Lembrete importante:** as service_role keys que apareceram no nosso chat
> durante a criação dos usuários estão expostas. Antes de usar a chave de novo
> aqui, **rotacione-a** em Supabase → Settings → API, e use a chave nova.

---

## 2. Base de dados: admin de forma inviolável

"Rigoroso" significa que **nem mexendo direto no banco** alguém pode se
auto-promover. Para isso, a verificação de admin vive no banco, e as políticas de
escrita dependem dela.

### Passo 1 — Marcar quem é admin

Já temos a coluna `role` em `profiles`. O admin é simplesmente quem tem
`role = 'admin'`. Defina o seu:

```sql
update public.profiles
set role = 'admin'
where email = 'fernandomartinez@grupomariacristina.com';
```

### Passo 2 — Uma função que diz "o usuário atual é admin?"

Esta função roda no banco e é a base de todas as permissões de admin:

```sql
-- Retorna true se o usuário autenticado atual é admin.
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;
```

> `auth.uid()` é o id de quem está fazendo a requisição — o Supabase garante que
> isso não pode ser falsificado. Então a função responde sobre o usuário real,
> não sobre o que o navegador alega ser.

### Passo 3 — Política: só admin altera roles

Agora a parte que fecha a porta. Lembra que `profiles` só tinha SELECT do próprio
perfil? Adicionamos: **admin pode atualizar qualquer perfil; mais ninguém pode.**

```sql
-- Admin pode LER todos os perfis (para listar usuários no painel).
create policy "profiles_admin_select_todos"
    on public.profiles for select
    to authenticated
    using (public.is_admin());

-- Admin pode ATUALIZAR qualquer perfil (ex: trocar role).
create policy "profiles_admin_update"
    on public.profiles for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
```

Com isto, mesmo que um usuário comum tente um `update` direto na API do Supabase
para virar admin, o RLS **recusa**, porque `is_admin()` é falso para ele. Esta é
a diferença entre "rigoroso" e "escondido na interface".

> As policies antigas (usuário lê o próprio perfil) continuam valendo em paralelo.
> O Postgres permite a ação se **qualquer** policy aplicável autorizar.

---

## 3. Log detalhado de acessos

Você quis o log **detalhado** — histórico de cada entrada, não só o último acesso.
Então criamos uma tabela própria de eventos.

### Passo 1 — Tabela de log

```sql
create table public.access_log (
    id         bigint generated always as identity primary key,
    user_id    uuid references auth.users (id) on delete set null,
    email      text,
    evento     text not null default 'login',  -- login, logout, etc.
    criado_em  timestamptz not null default now()
);

alter table public.access_log enable row level security;

-- Só admin lê o log.
create policy "access_log_admin_select"
    on public.access_log for select
    to authenticated
    using (public.is_admin());

-- Qualquer autenticado pode inserir o PRÓPRIO evento (registrar que entrou).
create policy "access_log_insert_proprio"
    on public.access_log for insert
    to authenticated
    with check (user_id = auth.uid());

-- Índice para consultar rápido por usuário e por data.
create index idx_access_log_user_data on public.access_log (user_id, criado_em desc);
```

### Passo 2 — Registrar a entrada no login

Depois de um login bem-sucedido (no `login/+page.svelte`, logo após o
`signInWithPassword` dar certo), registre o evento:

```javascript
// logo após o login dar certo, antes do goto('/')
const { data: userData } = await supabase.auth.getUser();
if (userData.user) {
	await supabase.from('access_log').insert({
		user_id: userData.user.id,
		email: userData.user.email,
		evento: 'login'
	});
}
```

Agora cada entrada vira uma linha. O painel admin vai ler isto para mostrar
"quais lojas entraram e quando", com histórico completo.

> Nota honesta: isto registra o login feito **pelo portal**. É suficiente para
> "quais lojas estão usando o portal". Não captura, por exemplo, sessões
> reabertas automaticamente sem novo login — se um dia precisar dessa precisão,
> dá para registrar também na verificação de sessão. Para o objetivo atual, basta.

---

## 4. A camada de servidor

Aqui entra o que o portal ainda não tinha. Um `+server.ts` é um endpoint: código
que **só roda no servidor** (no Cloudflare), nunca no navegador. É onde a
service_role key pode viver.

### Um helper admin no servidor

Crie `src/lib/server/supabaseAdmin.ts`. A pasta `lib/server/` é especial no
SvelteKit: **ele se recusa a mandar qualquer coisa dela para o navegador.** É a
rede de segurança da linguagem contra vazar a chave.

```typescript
// src/lib/server/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private'; // variáveis SÓ do servidor

// Cliente admin com a chave-mestra. Só existe no servidor.
export const supabaseAdmin = createClient(
	env.PUBLIC_SUPABASE_URL ?? '',
	env.SUPABASE_SERVICE_ROLE_KEY ?? '',   // a chave secreta, do ambiente
	{ auth: { autoRefreshToken: false, persistSession: false } }
);
```

> `$env/dynamic/private` lê variáveis que **nunca** vão ao navegador (diferente do
> `$env/static/public` que você usa no cliente). Se você tentasse importar isto
> num arquivo `.svelte`, o SvelteKit barraria o build — de propósito.

### Como o servidor confirma que o chamador é admin

Todo endpoint admin precisa, antes de agir, verificar quem está pedindo. O padrão:
ler a sessão do usuário a partir do token que o navegador envia, e checar
`is_admin()`. Vamos encapsular isso num helper que cada endpoint usa.

```typescript
// src/lib/server/verificarAdmin.ts
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Recebe o token do usuário (enviado pelo navegador) e diz se é admin.
export async function verificarAdmin(accessToken: string): Promise<boolean> {
	// Cliente "como o usuário": respeita o RLS, roda is_admin() como ele.
	const sb = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${accessToken}` } }
	});
	const { data, error } = await sb.rpc('is_admin');
	return !error && data === true;
}
```

> A ideia: o navegador prova quem é mandando o próprio token. O servidor pergunta
> ao banco "esse token é de um admin?" via `is_admin()`. Só se sim, prossegue.
> O usuário não consegue mentir, porque o token é validado pelo Supabase.

---

## 5. Trocar a role

Trocar role é a única ação admin que **não** precisa da service_role key — a
policy do passo 2.3 já permite que o admin faça o `update` direto, respeitando o
RLS. Então esta pode ser feita do cliente, desde que seja admin.

No painel (seção 7), o código é um simples update:

```javascript
// só funciona se quem chama for admin (o RLS garante)
await supabase
	.from('profiles')
	.update({ role: novaRole })
	.eq('id', usuarioId);
```

Se um não-admin tentar isto, o RLS recusa. Segurança no banco, não na tela.

---

## 6. Resetar senha, criar e remover contas

Estas **exigem** a service_role key, então viram endpoints de servidor. Mostro um
em detalhe (resetar senha) e os outros no mesmo molde.

### Resetar senha — `src/routes/api/admin/reset-senha/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { verificarAdmin } from '$lib/server/verificarAdmin';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	// 1. Pega o token de quem está chamando (o navegador o envia).
	const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? '';

	// 2. SÓ admin pode. Sem isto, qualquer um resetaria senhas.
	if (!(await verificarAdmin(token))) {
		throw error(403, 'Apenas administradores.');
	}

	// 3. Lê quem resetar e a nova senha.
	const { userId, novaSenha } = await request.json();

	// 4. Usa a chave-mestra para trocar a senha. (Só o servidor tem a chave.)
	const { error: e } = await supabaseAdmin.auth.admin.updateUserById(userId, {
		password: novaSenha
	});

	if (e) throw error(500, e.message);
	return json({ ok: true });
};
```

O padrão é sempre o mesmo: **pega token → confirma admin → age com a chave-mestra.**

### Criar conta — `src/routes/api/admin/criar/+server.ts`

Mesmo molde, trocando o passo 4 por:

```typescript
const { email, senha } = await request.json();
const { error: e } = await supabaseAdmin.auth.admin.createUser({
	email,
	password: senha,
	email_confirm: true
});
```

### Remover conta — `src/routes/api/admin/remover/+server.ts`

Mesmo molde, passo 4:

```typescript
const { userId } = await request.json();
const { error: e } = await supabaseAdmin.auth.admin.deleteUser(userId);
```

> Para remover, adicione uma confirmação forte na interface (digitar o e-mail da
> conta antes de apagar). Apagar conta é irreversível.

### Como o navegador chama um endpoint desses

Do painel, você envia o token junto:

```javascript
async function resetarSenha(userId, novaSenha) {
	const { data } = await supabase.auth.getSession();
	const token = data.session?.access_token;

	const r = await fetch('/api/admin/reset-senha', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ userId, novaSenha })
	});

	if (!r.ok) {
		const erro = await r.json().catch(() => ({}));
		alert('Falhou: ' + (erro.message ?? r.status));
	}
}
```

---

## 7. A interface do painel admin

A rota `/admin`, visível só para admins, com: lista de usuários (email, role,
último acesso), troca de role, reset de senha, criar/remover, e o log de acessos.

### Proteção da rota

> Honestidade: como sua auth ainda é client-side, a proteção mais forte do painel
> são os **endpoints** (cada um checa admin no servidor via `verificarAdmin`). A
> rota `/admin` em si pode ser escondida no cliente. Um não-admin que force a URL
> `/admin` veria a casca, mas **nenhuma ação funcionaria**, porque todo endpoint
> recusa quem não é admin, e o RLS recusa a leitura da lista completa. Para
> esconder até a casca, migre a auth para servidor (Parte 1, abordagem B).

### A página — `src/routes/admin/+page.svelte` (estrutura)

```svelte
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
```

### Criar conta pela interface

Adicione um pequeno formulário (email + senha) que chama o endpoint `/api/admin/criar`
no mesmo molde dos outros, depois `await carregar()` para atualizar a lista.

### Mostrar a aba Admin só para admin

Na home/header, mostre o link `/admin` apenas se o usuário for admin (você já
busca a `role` lá):

```svelte
{#if role === 'admin'}<a href="/admin">Administração</a>{/if}
```

---

## 8. Página de perfil (todos os usuários)

Simples agora, expansível depois. Cada usuário vê e edita algumas informações da
própria conta/loja.

### Passo 1 — Campos de perfil

Adicione colunas editáveis a `profiles`:

```sql
alter table public.profiles add column nome_exibicao text;
alter table public.profiles add column telefone text;
alter table public.profiles add column observacoes text;

-- Usuário pode ATUALIZAR o próprio perfil (mas não a própria role!).
create policy "profiles_update_proprio"
    on public.profiles for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());
```

> **Cuidado importante com a role.** A policy acima deixaria o usuário mudar
> qualquer campo do próprio perfil — inclusive `role`, o que seria um buraco de
> segurança (auto-promoção!). Para fechar isso, bloqueie a mudança de role por um
> trigger:

```sql
-- Impede que um não-admin mude a própria role.
create or replace function public.protege_role()
returns trigger as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Apenas administradores podem mudar a role.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_protege_role
  before update on public.profiles
  for each row execute function public.protege_role();
```

Agora o usuário edita nome, telefone, observações — mas qualquer tentativa de
mudar a própria role é recusada pelo banco. Rigoroso de verdade.

### Passo 2 — A página — `src/routes/perfil/+page.svelte`

```svelte
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
```

> Esta é a base. Depois dá para adicionar foto (Supabase Storage), campos
> específicos de loja (endereço, gerente responsável), histórico, etc. A estrutura
> já suporta — é só adicionar colunas e campos.

---

## 9. Ordem de trabalho e testes de segurança

Esta parte é sensível, então a ordem importa e os testes de segurança não são
opcionais.

### Ordem

1. **Base de dados** (seção 2): defina-se admin, crie `is_admin()` e as policies.
2. **Teste de segurança #1** (ver abaixo) — antes de qualquer interface.
3. **Log de acessos** (seção 3) + registrar no login.
4. **Camada de servidor** (seção 4) + configurar a service_role key no Cloudflare.
5. **Endpoints** (seção 6), um de cada vez, testando cada um.
6. **Interface admin** (seção 7).
7. **Página de perfil** (seção 8) — inclua o trigger que protege a role.
8. **Testes de segurança #2 e #3.**

### Testes de segurança (faça-os de verdade)

- **#1 — Não-admin não muda role.** Logado como uma conta comum (ex: uma loja,
  senha `12341234`), tente pela interface ou pela API trocar a própria role para
  `admin`. **Deve falhar.** Se funcionar, pare tudo — a policy da seção 2 não
  está certa.
- **#2 — Endpoints recusam não-admin.** Logado como conta comum, tente chamar
  `/api/admin/reset-senha` (pode ser pelo próprio navegador). **Deve retornar
  403.** É o teste que prova que a chave-mestra está protegida.
- **#3 — A service_role key não está no navegador.** Abra o código-fonte da
  página no navegador (DevTools → fontes) e procure pela chave secreta. **Não
  pode aparecer em lugar nenhum do lado do cliente.** Se aparecer, ela vazou —
  é emergência: rotacione a chave e mova-a para o servidor.

### Uma recomendação honesta sobre ritmo

Esta é a parte mais arriscada que você construiu. Não a faça com pressa nem toda
de uma vez. Faça a base de dados, rode o teste #1, e só então siga. Um painel
admin meio-pronto que já cria contas é mais perigoso que não ter painel nenhum.
Quando terminar, você terá um portal que de fato se administra sozinho — e terá
aprendido a camada de servidor, que é o que faltava para você se sentir dono do
projeto inteiro.

---

*Com a Parte 3, o portal deixa de depender de você mexer no Supabase na mão: você
administra tudo pela interface, com segurança real no banco e no servidor. As
próximas evoluções (perfil mais rico, projetos, métricas) assentam sobre esta
base.*
