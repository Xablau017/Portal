# Guia de Reconstrução — Portal Interno (Parte 2)

> **Continuação do primeiro guia.** Aqui entram as melhorias que transformam o
> MVP funcional num portal com cara de empresa: correção do login em branco,
> login só com o usuário (o `@grupomariacristina.com` fica fixo), papéis (roles)
> com separação de conteúdo por área, identidade visual do Grupo Maria Cristina,
> e-mail do usuário na home, thumbnails decentes, e polimento geral.
>
> **Como usar:** cada seção é independente. Faça uma, teste, siga para a próxima.
> Nada aqui exige refazer o que já funciona.

---

## Índice

1. [Corrigir a tela de login em branco](#1-corrigir-a-tela-de-login-em-branco)
2. [Login só com o nome de usuário (@ fixo)](#2-login-só-com-o-nome-de-usuário)
3. [Mostrar o e-mail do usuário na home](#3-mostrar-o-e-mail-do-usuário-na-home)
4. [Papéis (roles) e separação de conteúdo](#4-papéis-roles-e-separação-de-conteúdo)
5. [Identidade visual do Grupo Maria Cristina](#5-identidade-visual)
6. [Thumbnails: template de marca + fallback](#6-thumbnails)
7. [Polimento "cara de empresa grande"](#7-polimento)
8. [Ordem sugerida e testes](#8-ordem-sugerida-e-testes)

---

## 1. Corrigir a tela de login em branco

### Por que acontece

No `+layout.svelte` atual, **tudo** fica escondido atrás de `{#if verificado}`,
e `verificado` só vira `true` depois de um `await getSession()` — uma chamada de
rede ao Supabase. Na página de login (que é pública), isso significa esperar a
rede antes de mostrar o formulário. Se essa chamada demora ou o timing falha, a
tela fica branca até você atualizar.

A causa raiz: a página de login **não deveria** esperar a verificação de sessão.
Ela é pública. Só as rotas protegidas precisam esperar.

### A correção

A ideia: se a rota é `/login`, renderize **na hora**, sem esperar nada. Só as
outras rotas passam pela checagem de sessão.

```svelte
<!-- src/routes/+layout.svelte (corrigido) -->
<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Descobrimos logo se estamos no login — sem esperar rede.
	let estaNoLogin = $derived($page.url.pathname === '/login');

	// "pronto" controla só as rotas protegidas.
	let pronto = $state(false);

	onMount(async () => {
		// Na tela de login não checamos sessão: ela é pública e
		// deve aparecer imediatamente.
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

<!-- Login sempre renderiza na hora. Rotas protegidas esperam "pronto". -->
{#if estaNoLogin || pronto}
	{@render children()}
{/if}
```

O que mudou: `estaNoLogin` é `$derived` (calculado na hora, sem rede), e a
condição de render é `estaNoLogin || pronto`. A tela de login aparece
instantaneamente; as protegidas continuam esperando a sessão.

> Nota honesta: essa continua sendo proteção **no cliente** — coerente com a
> arquitetura atual e adequada para conteúdo não confidencial. A seção 4 explica
> quando vale migrar para servidor.

---

## 2. Login só com o nome de usuário

Como todos os e-mails terminam em `@grupomariacristina.com`, o usuário digita só
a parte antes do `@`. O código junta o domínio antes de chamar o Supabase.

No `src/routes/login/+page.svelte`, ajuste o campo e a função de login:

```svelte
<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';

	// O domínio fixo. Se um dia mudar, muda só aqui.
	const DOMINIO = '@grupomariacristina.com';

	let usuario = $state('');   // só a parte antes do @
	let senha = $state('');
	let erro = $state('');
	let carregando = $state(false);

	async function fazerLogin() {
		erro = '';
		carregando = true;

		// Monta o e-mail completo. .trim() remove espaços acidentais,
		// .toLowerCase() evita problema de maiúsculas.
		const email = usuario.trim().toLowerCase() + DOMINIO;

		const { error } = await supabase.auth.signInWithPassword({
			email,
			password: senha
		});

		carregando = false;

		if (error) {
			erro = 'Usuário ou senha inválidos.';
		} else {
			await goto('/');
		}
	}
</script>

<main class="login">
	<h1>Portal Grupo Maria Cristina</h1>

	<!-- O campo mostra o @dominio fixo ao lado, para ficar claro. -->
	<label class="campo-usuario">
		<input
			type="text"
			placeholder="seu.usuario"
			bind:value={usuario}
			autocomplete="username"
		/>
		<span class="dominio">{DOMINIO}</span>
	</label>

	<input
		type="password"
		placeholder="Sua senha"
		bind:value={senha}
		autocomplete="current-password"
	/>

	<button onclick={fazerLogin} disabled={carregando}>
		{carregando ? 'Entrando...' : 'Entrar'}
	</button>

	{#if erro}
		<p class="erro">{erro}</p>
	{/if}
</main>

<style>
	/* estilos completos na seção 5 (identidade visual) */
	.campo-usuario { display: flex; align-items: center; }
	.campo-usuario input { flex: 1; }
	.dominio { padding: 0 8px; color: #666; white-space: nowrap; }
	.erro { color: #c0392b; }
</style>
```

Repare que já troquei `on:click` por `onclick` (a sintaxe nova do Svelte 5).
Faça o mesmo em qualquer outro botão que ainda use `on:click`.

---

## 3. Mostrar o e-mail do usuário na home

Assim o usuário sabe em qual conta está logado — útil sobretudo nas contas de
loja/setor compartilhadas.

No `src/routes/+page.svelte`, busque o usuário logado e mostre o e-mail:

```svelte
<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let email = $state('');

	onMount(async () => {
		const { data } = await supabase.auth.getUser();
		email = data.user?.email ?? '';
	});

	async function sair() {
		await supabase.auth.signOut();
		await goto('/login');
	}
</script>

<header class="topo">
	<div class="marca">Portal GMC</div>
	<div class="usuario">
		<!-- Só mostra quando já carregou o e-mail. -->
		{#if email}<span>{email}</span>{/if}
		<button onclick={sair}>Sair</button>
	</div>
</header>

<!-- resto da home (blocos de Treinamentos e BI) -->
```

> `?.` (optional chaining) e `?? ''` tratam o caso de `user` ser nulo sem quebrar.
> Se não houver usuário, `email` fica vazio e a barra simplesmente não mostra nada.

-
## 4. Papéis (roles) e separação de conteúdo

Esta é a parte mais estrutural. O objetivo: **RH não vê os treinamentos de
Suprimentos**, e vice-versa. Cada usuário tem um papel; cada treinamento pertence
a uma ou mais áreas; a lista mostra só o que é relevante.

### Decisão de arquitetura (leia antes de codar)

Você disse que o conteúdo **não é confidencial** — o problema é relevância, não
sigilo. Então faremos a filtragem de forma **simples**, adequada ao MVP:

- O papel do usuário fica **no banco** (feito direito, não só no frontend).
- A lista de treinamentos é **filtrada pelo papel**.
- No MVP, essa filtragem pode acontecer no cliente (coerente com sua arquitetura
  atual). **Se algum dia o conteúdo virar sigiloso, a filtragem precisa migrar
  para o servidor / RLS** — deixo o caminho documentado no fim desta seção.

### Passo 1 — Tabela de perfis com o papel

O Supabase guarda os usuários em `auth.users`, mas você não deve escrever lá
diretamente. O padrão é criar uma tabela `profiles` ligada a ela, com o papel.

Rode no SQL Editor:

```sql
-- Tabela de perfis: 1 linha por usuário, com o papel.
create table public.profiles (
    id    uuid primary key references auth.users (id) on delete cascade,
    email text,
    role  text not null default 'colaborador',  -- ex: admin, rh, suprimentos, vendas...
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuário lê o próprio perfil.
create policy "profiles_select_proprio"
    on public.profiles for select
    to authenticated
    using (id = auth.uid());

-- Cria o perfil automaticamente quando um usuário novo é criado.
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email);
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
```

> A partir de agora, todo usuário criado ganha uma linha em `profiles` com
> `role = 'colaborador'`. Você ajusta o papel de cada um manualmente (Table
> Editor) ou por script.

### Passo 2 — Área nos treinamentos

Adicione à tabela `trainings` a área a que cada vídeo pertence:

```sql
-- "area" indica de quem é o treinamento. 'todos' = visível a qualquer um.
alter table public.trainings
    add column area text not null default 'todos';
```

Agora cada vídeo tem uma área (`rh`, `suprimentos`, `vendas`, `todos`, etc.).

### Passo 3 — Filtrar a lista pelo papel

Na página de treinamentos, busque o papel do usuário e mostre só os vídeos da
área dele (mais os de `area = 'todos'`):

```svelte
<!-- src/routes/treinamentos/+page.svelte -->
<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
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
		// 1. Descobre o papel do usuário logado.
		const { data: userData } = await supabase.auth.getUser();
		const userId = userData.user?.id;

		let role = 'colaborador';
		if (userId) {
			const { data: perfil } = await supabase
				.from('profiles')
				.select('role')
				.eq('id', userId)
				.single();
			if (perfil) role = perfil.role;
		}

		// 2. Busca os treinamentos: os da área do usuário + os de "todos".
		//    Admin vê tudo.
		let query = supabase
			.from('trainings')
			.select('id, titulo, descricao, thumbnail_url, area')
			.eq('publicado', true)
			.order('ordem', { ascending: true });

		if (role !== 'admin') {
			// .or() = área é a do usuário OU é "todos".
			query = query.or(`area.eq.${role},area.eq.todos`);
		}

		const { data, error } = await query;
		if (!error && data) videos = data;
		carregando = false;
	});
</script>

<!-- (a listagem em si é igual à da Parte 1) -->
```

### Passo 4 — Badge do papel (o "para mostrar")

Você queria que o papel apareça. Na home, mostre um selo com o papel do usuário
— simples e dá a sensação de sistema "de gente grande":

```svelte
<!-- dentro da home, junto do e-mail -->
{#if role}<span class="badge">{role}</span>{/if}
```

### Quando isto precisa virar server-side (não agora)

O que fizemos filtra a lista **no cliente**. Alguém tecnicamente habilidoso
poderia, em tese, consultar o Supabase e ver títulos de outras áreas — porque a
RLS ainda libera SELECT de todo treinamento publicado a qualquer autenticado.
Para o seu caso (conteúdo não sigiloso, só questão de relevância), **isto é
aceitável**. Se um dia precisar ser à prova de bisbilhotice, o caminho é:

1. Guardar o papel de forma confiável (custom claim no JWT ou consulta na RLS).
2. Trocar a policy de `trainings` para comparar `area` com o papel do usuário
   dentro da própria RLS, no banco.

Deixo isto anotado como fase futura; não é necessário para o MVP.

---

## 5. Identidade visual

Baseada no Manual de Uso da Marca do Grupo Maria Cristina. Aplicar isto é o que
mais muda a percepção de "site de empresa grande".

### Paleta oficial

```css
/* Cole no topo do seu CSS global (ex: src/app.css) */
:root {
	--azul-pleno:     #1A2C42;  /* cor institucional principal (navy) */
	--verde-heritage: #275248;  /* verde institucional */
	--verde-apoio:    #97B9A3;  /* verde claro de apoio */
	--ouro-legado:    #D5B038;  /* dourado — só para acentos */

	--fundo:          #ffffff;
	--texto:          #1A2C42;  /* texto usa o azul institucional */
	--texto-suave:    #55636f;
	--borda:          #e2e6ea;
}
```

> Regra da marca: **azul e verde são a base; o ouro é acento** (botões de
> destaque, detalhes), nunca o fundo inteiro. Não distorça essas proporções.

### Tipografia

O manual define **Cormorant Garamond** para títulos e **Lato** para texto. Ambas
estão no Google Fonts. No `src/app.html`, dentro do `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
	href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Lato:ital,wght@0,400;0,700;1,400&display=swap"
	rel="stylesheet"
/>
```

E no CSS global:

```css
body {
	font-family: 'Lato', system-ui, sans-serif;
	color: var(--texto);
	background: var(--fundo);
}
h1, h2, h3 {
	font-family: 'Cormorant Garamond', Georgia, serif;
	color: var(--azul-pleno);
	font-weight: 600;
}
```

> Também troque `lang="en"` por `lang="pt-BR"` no `<html>` do `app.html` — o
> portal é em português (era o item #13 da revisão de código).

### O monograma como favicon

O manual define o monograma (o símbolo da onda no quadrado arredondado) com
tamanho mínimo digital de 24px. Use-o como favicon. Coloque o arquivo do símbolo
em `src/lib/assets/` e aponte o `<link rel="icon">` para ele (já está no layout).
Peça ao setor de marketing o arquivo vetorial (SVG) oficial do símbolo.

### Botão institucional (exemplo)

```css
button {
	background: var(--azul-pleno);
	color: #fff;
	border: none;
	border-radius: 6px;
	padding: 12px 20px;
	font-family: 'Lato', sans-serif;
	font-weight: 700;
	cursor: pointer;
	transition: background .2s;
}
button:hover { background: var(--verde-heritage); }
/* botão de destaque, com o ouro como acento: */
button.destaque { background: var(--ouro-legado); color: var(--azul-pleno); }
```

-
## 6. Thumbnails

Dois problemas: o auto-thumbnail do Drive pega o primeiro quadro (tela branca), e
seu `.jpeg` único é genérico. Solução em duas camadas.

### Camada 1 — Template de marca (o jeito profissional)

Crie uma thumbnail por vídeo, num template consistente com a marca. Não precisa
de designer: no **Canva**, tamanho 1280×720, monte um modelo com:

- Fundo em **Azul Pleno** (`#1A2C42`) ou **Verde Heritage** (`#275248`).
- O **monograma** do grupo num canto.
- O **título do treinamento** em Cormorant Garamond, branco ou ouro.
- Opcional: um ícone/marca-d'água da área (RH, Vendas...).

Duplique o modelo para cada vídeo, troque o título, exporte PNG. Resultado:
biblioteca com aparência unificada, não quadros brancos aleatórios.

**Onde hospedar:** Supabase Storage (você já tem). Crie um bucket público
`thumbnails`, suba os PNGs, e use a URL pública de cada um na coluna
`thumbnail_url`. (Storage free = 1 GB; thumbnails são minúsculas, sem risco.)

### Camada 2 — Fallback automático (rede de segurança)

Para quando um `thumbnail_url` estiver vazio ou quebrado, mostre uma imagem
padrão de marca em vez de um retângulo em branco (era o item #16 da revisão):

```svelte
<!-- na listagem, no <img> de cada card -->
<img
	src={video.thumbnail_url || '/thumb-padrao.png'}
	alt={video.titulo}
	onerror={(e) => (e.currentTarget.src = '/thumb-padrao.png')}
/>
```

- `video.thumbnail_url || '/thumb-padrao.png'` → usa o padrão se o campo é vazio.
- `onerror` → se a URL existe mas falha ao carregar, troca pelo padrão.

Coloque um `thumb-padrao.png` (fundo azul/verde com o monograma) na pasta
`static/`. Assim nenhum card jamais aparece vazio.

---

## 7. Polimento

Ajustes que somados dão a "cara de empresa grande". Nenhum é grande sozinho.

### Barra superior consistente (header)

Um cabeçalho fixo em todas as páginas internas, com o monograma à esquerda e o
usuário/logout à direita. Coloque-o no `+layout.svelte` (assim aparece em tudo,
menos no login) para não repetir em cada página.

### Estados de carregamento (nada de telas brancas)

Onde houver `await` (buscar vídeos, sessão), mostre "Carregando..." ou um
esqueleto em vez de vazio. Você já faz isso na lista; aplique o mesmo padrão em
toda página que busca dados.

### Rodapé institucional

Um rodapé simples com nome da empresa, ano, e talvez "Uso interno". Dá
fechamento visual e ar corporativo.

### robots.txt — bloquear indexação

Portal interno não deve aparecer no Google. Em `static/robots.txt`:

```
User-agent: *
Disallow: /
```

(Era o item #14 da revisão.)

### Preencher a página /bi

Continua vazia (0 bytes). Cole o iframe do Power BI (código na Parte 1, seção 10),
já com o cabeçalho e as cores da marca.

### Limpezas rápidas da revisão de código

- `on:click` → `onclick` em todos os botões (Svelte 5).
- `$app/stores` → `$app/state` quando for atualizar (opcional agora).
- Tratar erros das queries: logar em vez de engolir silenciosamente.
- Página de troca de senha (importante se distribuir senhas temporárias):
  usa `supabase.auth.updateUser({ password })`.

---

## 8. Ordem sugerida e testes

Uma ordem que entrega valor cedo e evita retrabalho:

1. **Corrigir o login em branco** (seção 1) — resolve um bug visível já.
2. **Login só com usuário** (seção 2) — melhora imediata de usabilidade.
3. **E-mail do usuário na home** (seção 3) — rápido.
4. **Identidade visual** (seção 5) — o maior salto de percepção; aplique cores,
   fontes e favicon antes das roles, porque muda tudo visualmente.
5. **Roles e separação de conteúdo** (seção 4) — a parte estrutural; teste com
   dois usuários de áreas diferentes e confirme que cada um vê só o seu.
6. **Thumbnails** (seção 6) — template + fallback.
7. **Polimento** (seção 7) — header, rodapé, /bi, robots, limpezas.

### Testes-chave

- Login aparece **na hora**, sem refresh. (seção 1)
- Digitar só `fernandomartinez` + senha loga corretamente. (seção 2)
- A home mostra o e-mail e o badge do papel. (seções 3, 4)
- Um usuário `rh` **não vê** treinamentos de `suprimentos`; um `admin` vê tudo.
  (seção 4)
- Cores, fontes e favicon do grupo aplicados em todas as telas. (seção 5)
- Nenhum card de vídeo aparece com thumbnail em branco. (seção 6)

---

*Feito isto, o portal deixa de parecer um MVP e passa a parecer um sistema
interno da empresa. As partes estruturais (roles, identidade) ficam prontas para
crescer; o resto é conteúdo.*
