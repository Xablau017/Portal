# Guia de Reconstrução — Portal Interno Grupo Maria Cristina

> **Objetivo deste guia:** reconstruir o portal do zero, com as próprias mãos, para dominar cada peça.
> O MVP atual continua no ar; esta é uma segunda versão feita com calma, para aprender.
>
> **O que este guia cobre:** projeto do zero em SvelteKit, as **duas** abordagens de autenticação
> (cliente vs. servidor) lado a lado, integração com Supabase, e o código completo de cada página
> (Login, Home, BI, Treinamentos) comentado linha a linha. TypeScript é usado, mas os tipos são
> explicados conforme aparecem — você nunca vai encontrar um `<T>` sem saber o que é.

---

## Índice

1. [Como pensar no projeto antes de codar](#1-como-pensar-no-projeto-antes-de-codar)
2. [Pré-requisitos e criação do projeto](#2-pré-requisitos-e-criação-do-projeto)
3. [Entendendo a estrutura do SvelteKit](#3-entendendo-a-estrutura-do-sveltekit)
4. [TypeScript: só o que você precisa saber](#4-typescript-só-o-que-você-precisa-saber)
5. [Conectando o Supabase](#5-conectando-o-supabase)
6. [Autenticação: as duas abordagens comparadas](#6-autenticação-as-duas-abordagens-comparadas)
7. [Página de Login (código completo)](#7-página-de-login-código-completo)
8. [Protegendo as rotas internas](#8-protegendo-as-rotas-internas)
9. [Home e layout comum](#9-home-e-layout-comum)
10. [Página de BI](#10-página-de-bi)
11. [Página de Treinamentos (lista + player)](#11-página-de-treinamentos-lista--player)
12. [Rodando e testando](#12-rodando-e-testando)
13. [Deploy no Cloudflare Pages](#13-deploy-no-cloudflare-pages)
14. [Roteiro de estudo depois de terminar](#14-roteiro-de-estudo-depois-de-terminar)

---

## 1. Como pensar no projeto antes de codar

Antes de escrever qualquer linha, entenda o modelo mental. Isso evita 90% da confusão.

O portal tem **três responsabilidades**, e cada uma vive num lugar:

| Responsabilidade | Onde vive | O que faz |
|------------------|-----------|-----------|
| **Interface** (o que o usuário vê) | SvelteKit (seu código) | Páginas, botões, listas, players |
| **Identidade** (quem é a pessoa) | Supabase Auth | Login, sessão, "está logado?" |
| **Dados** (o conteúdo) | Supabase Postgres | A tabela `trainings` com os vídeos |

A regra que amarra tudo: **o SvelteKit pergunta ao Supabase "quem é essa pessoa?" e "quais vídeos existem?", e monta a tela com as respostas.** Seu código quase nunca "sabe" as coisas sozinho — ele pergunta ao Supabase.

O vídeo em si **não** fica em nenhum dos dois: mora no Google Drive, e a tabela `trainings` guarda só o link. Isso é importante — o Supabase guarda o *endereço* do vídeo, não o vídeo.

---

## 2. Pré-requisitos e criação do projeto

### O que instalar antes

- **Node.js** (versão 20 ou superior). Confira com `node --version` no terminal.
- Um editor — **VS Code** é o recomendado.
- Conta no **Supabase** e no **Cloudflare** (as mesmas do MVP servem).

### Criando o projeto

No terminal, dentro da pasta onde você guarda seus projetos:

```bash
# Cria o projeto do SvelteKit de forma interativa
npx sv create portal-v2
```

O assistente vai fazer perguntas. Escolha assim:

- **Which template?** → `SvelteKit minimal` (o esqueleto mais enxuto, sem exemplos que confundem)
- **Add type checking with TypeScript?** → `Yes, using TypeScript syntax` (vamos usar TS, explicado aos poucos)
- **What would you like to add?** → marque **prettier** (formata o código sozinho) e **eslint** (avisa erros). Pode pular o resto.

Depois:

```bash
cd portal-v2          # entra na pasta do projeto
npm install           # instala as dependências base
npm run dev           # sobe o servidor de desenvolvimento
```

Abra `http://localhost:5173` — você verá a página inicial vazia do SvelteKit. **Está funcionando.** Deixe esse comando rodando; ele atualiza a página sozinho quando você salva um arquivo.

### Instalando o Supabase

Em outro terminal (deixe o `npm run dev` rodando):

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- `@supabase/supabase-js` — a biblioteca principal, que conversa com o Supabase. **Usada nas duas abordagens de auth.**
- `@supabase/ssr` — ajuda a lidar com sessão no **servidor** (cookies). **Só usada na abordagem server-side.** Se você for só de cliente, não precisa dela — mas instalar não atrapalha.

---

## 3. Entendendo a estrutura do SvelteKit

Antes de criar arquivos, entenda a **convenção de pastas**, que é o coração do SvelteKit. Diferente de HTML puro (onde uma URL = um arquivo `.html`), aqui **a estrutura de pastas define as URLs**.

```
src/
├── routes/                      ← cada pasta aqui vira uma URL
│   ├── +page.svelte             ← a URL "/"  (home)
│   ├── +layout.svelte           ← moldura comum a todas as páginas
│   ├── login/
│   │   └── +page.svelte         ← a URL "/login"
│   ├── bi/
│   │   └── +page.svelte         ← a URL "/bi"
│   └── treinamentos/
│       ├── +page.svelte         ← a URL "/treinamentos"
│       └── [id]/
│           └── +page.svelte     ← a URL "/treinamentos/QUALQUER-COISA"
├── lib/                         ← código reutilizável (importado com "$lib/...")
│   └── supabaseClient.ts
├── hooks.server.ts              ← roda em TODA requisição (usado na auth server-side)
└── app.d.ts                     ← definições de tipos globais
```

**Os nomes de arquivo têm significado fixo** (isto é a parte que confunde no começo, então guarde):

| Arquivo | O que é | Roda onde |
|---------|---------|-----------|
| `+page.svelte` | A **interface** de uma página (HTML/CSS/JS) | No navegador |
| `+page.server.ts` | Busca **dados no servidor** antes da página aparecer | No servidor |
| `+layout.svelte` | Uma **moldura** que envolve várias páginas (ex: cabeçalho) | No navegador |
| `+layout.server.ts` | Lógica de servidor comum a várias páginas (ex: checar login) | No servidor |
| `hooks.server.ts` | Código que roda em **toda** requisição, antes de tudo | No servidor |

O `+` no início não é decoração — é o que diz ao SvelteKit "este é um arquivo especial de rota". Um arquivo `page.svelte` sem o `+` seria ignorado.

---

## 4. TypeScript: só o que você precisa saber

Você pediu TS com os tipos explicados aos poucos. Aqui está a base — leia uma vez e volte quando encontrar algo estranho no código.

**A ideia central:** TypeScript é JavaScript + anotações que dizem "que tipo de valor é esse". Essas anotações ajudam o editor a te avisar de erros antes de rodar. Elas somem quando o código roda — são só para você e o editor.

```typescript
// JavaScript normal:
let nome = "Maria";

// TypeScript: o ": string" diz "nome é um texto"
let nome: string = "Maria";

// Os tipos básicos que você vai encontrar:
let idade: number = 30;          // número
let ativo: boolean = true;       // verdadeiro/falso
let lista: string[] = ["a","b"]; // uma lista de textos
```

**Você pode ignorar tipos quando quiser.** Se um tipo te travar, escreva o JS normal:

```typescript
let qualquerCoisa: any = ...;  // "any" = "não verifique o tipo disto"
```

`any` é a sua válvula de escape enquanto aprende. Não é elegante, mas destrava. Use sem culpa no começo.

**Um tipo próprio (aparece no código das páginas):** você pode descrever o formato de um objeto e dar um nome a ele.

```typescript
// Descreve como é um vídeo de treinamento (bate com as colunas da tabela)
type Training = {
  id: string;
  titulo: string;
  descricao: string;
  video_url: string;
  thumbnail_url: string;
};

// Agora "Training[]" significa "uma lista de vídeos"
let videos: Training[] = [];
```

Isso é praticamente tudo de TS que o projeto usa. Nada de generics complexos nem magia. Quando aparecer algo novo no código abaixo, ele estará comentado no local.

---

## 5. Conectando o Supabase

### As credenciais

No painel do Supabase → **Settings → API**, você encontra:

- **Project URL** — o endereço do seu projeto (ex: `https://xxxx.supabase.co`)
- **anon public key** — uma chave longa. **É pública e pode ir no frontend** — a segurança vem do RLS no banco, não de esconder essa chave.

Crie um arquivo `.env` na raiz do projeto (mesmo nível do `package.json`):

```bash
# .env — NÃO vai para o Git (confira que está no .gitignore)
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

O prefixo `PUBLIC_` é uma convenção do SvelteKit: variáveis com esse prefixo podem ser lidas no navegador. Sem o prefixo, ficariam só no servidor.

Crie também um `.env.example` (esse **vai** para o Git) como modelo, com os nomes mas sem os valores reais:

```bash
# .env.example
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

### O cliente do Supabase

Crie `src/lib/supabaseClient.ts`. Este arquivo cria **uma** conexão com o Supabase que o resto do app reutiliza.

```typescript
// src/lib/supabaseClient.ts

// Importa a função que cria um cliente do Supabase
import { createClient } from '@supabase/supabase-js';

// Importa as variáveis de ambiente PÚBLICAS que definimos no .env
// O SvelteKit expõe as que começam com PUBLIC_ através deste caminho:
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Cria o cliente. É este objeto "supabase" que usamos para tudo:
// login, logout, buscar dados. Ele é criado uma vez e exportado.
export const supabase = createClient(
  PUBLIC_SUPABASE_URL,     // o endereço do projeto
  PUBLIC_SUPABASE_ANON_KEY // a chave pública
);
```

> `$lib` é um atalho do SvelteKit para a pasta `src/lib`. Em vez de `../../lib/supabaseClient`,
> você escreve `$lib/supabaseClient` de qualquer lugar. `$env/static/public` é outro atalho,
> para as variáveis de ambiente.

Este `supabaseClient.ts` é suficiente para a **abordagem cliente**. A abordagem servidor usa uma
configuração um pouco diferente, explicada na seção 6.

---

## 6. Autenticação: as duas abordagens comparadas

Aqui está o coração do guia. Existem duas formas de proteger o portal. Vou explicar as duas, quando usar cada uma, e você escolhe. **Ambas usam o mesmo Supabase e as mesmas páginas** — muda só *onde* a verificação de login acontece.

### O conceito comum

Quando alguém faz login, o Supabase devolve uma **sessão** — um comprovante de que a pessoa se autenticou. A pergunta que separa as duas abordagens é: **onde guardamos e verificamos essa sessão?**

### Abordagem A — Auth no cliente (mais simples de entender)

A sessão fica no **navegador** (em `localStorage`). Cada página, ao carregar, roda um JavaScript que pergunta "tem sessão? Não? Então vai para /login".

```
Navegador                          Supabase
   │                                  │
   │  usuário digita e-mail/senha     │
   │─────────────────────────────────▶│
   │                                  │
   │  ◀── sessão (guardada no browser)│
   │                                  │
   │  em cada página: "tenho sessão?" │
   │  (verificação no próprio browser)│
```

**Prós:** simples, pouca configuração, cada arquivo é fácil de ler de cima a baixo. Muito próximo do HTML/JS que você domina.

**Contras:** a verificação acontece *depois* que a página começou a carregar no navegador. Por uma fração de segundo, o HTML da página protegida existe no navegador antes do redirecionamento. Alguém tecnicamente habilidoso poderia ver esse HTML.

**Quando é aceitável:** quando o conteúdo protegido **não é sigiloso** — que é exatamente o seu caso (treinamentos internos não-confidenciais, BI já aberto). A proteção real do *banco de dados* continua garantida pelo RLS do Supabase, independente disso.

### Abordagem B — Auth no servidor (mais robusta, mais peças)

A sessão fica num **cookie** que o servidor lê **antes** de mandar a página. Se não há sessão, o servidor responde com um redirecionamento e o HTML protegido **nunca chega** ao navegador.

```
Navegador                 Servidor SvelteKit           Supabase
   │  pede /treinamentos       │                          │
   │──────────────────────────▶│                          │
   │                           │  lê cookie de sessão      │
   │                           │─────────────────────────▶│
   │                           │  ◀── sessão válida?       │
   │                           │                          │
   │  ◀── página OU redirect    │ (decide ANTES de enviar) │
```

**Prós:** o conteúdo protegido nunca sai do servidor sem autorização. É o padrão "correto" para conteúdo sensível.

**Contras:** exige o `hooks.server.ts`, o `@supabase/ssr`, o manejo de cookies e os arquivos `+layout.server.ts`. **São essas peças que provavelmente te confundiram no MVP.** Não são difíceis depois que você entende, mas são mais peças.

### Qual escolher para dominar o projeto

Sugestão honesta para o seu objetivo de aprendizado: **comece pela Abordagem A (cliente).** Ela te deixa entender o app inteiro sem a camada de servidor. Quando tudo estiver funcionando e claro, **migre para a B** como exercício — você já terá o resto do app pronto e poderá focar só na mudança de auth. Assim você aprende as duas de verdade, uma de cada vez.

O guia abaixo mostra o **Login e a proteção nas duas versões**, lado a lado. As páginas de conteúdo (BI, Treinamentos) são quase iguais nas duas — as diferenças estão marcadas.

---

## 7. Página de Login (código completo)

### Versão A — cliente

Crie `src/routes/login/+page.svelte`:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  // "lang=ts" avisa que este script usa TypeScript.

  // Importa o cliente do Supabase que criamos na seção 5.
  import { supabase } from '$lib/supabaseClient';
  // "goto" navega entre páginas por código (equivale a mudar a URL).
  import { goto } from '$app/navigation';

  // Variáveis do formulário. O "$state" é como o Svelte 5 marca
  // um valor que, ao mudar, atualiza a tela automaticamente.
  let email = $state('');
  let senha = $state('');
  let erro = $state('');          // mensagem de erro para mostrar
  let carregando = $state(false); // trava o botão durante o login

  // Função chamada quando o usuário clica em "Entrar".
  async function fazerLogin() {
    erro = '';
    carregando = true;

    // Pede ao Supabase para autenticar com e-mail e senha.
    // "await" espera a resposta chegar antes de continuar.
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha
    });

    carregando = false;

    if (error) {
      // Se o Supabase devolveu erro, mostramos uma mensagem amigável.
      erro = 'E-mail ou senha inválidos.';
    } else {
      // Deu certo: a sessão foi salva no navegador automaticamente.
      // Redirecionamos para a home.
      goto('/');
    }
  }
</script>

<!-- A interface. É HTML normal, com "on:" para eventos. -->
<main class="login">
  <h1>Portal Grupo Maria Cristina</h1>

  <input
    type="email"
    placeholder="Seu e-mail"
    bind:value={email}
  />
  <!-- "bind:value" liga o campo à variável: digitar atualiza "email". -->

  <input
    type="password"
    placeholder="Sua senha"
    bind:value={senha}
  />

  <!-- on:click chama a função. "disabled" trava o botão enquanto carrega. -->
  <button on:click={fazerLogin} disabled={carregando}>
    {carregando ? 'Entrando...' : 'Entrar'}
  </button>

  <!-- Só mostra o erro se a variável "erro" não estiver vazia. -->
  {#if erro}
    <p class="erro">{erro}</p>
  {/if}
</main>

<style>
  /* CSS com escopo: vale só para esta página. */
  .login {
    max-width: 360px;
    margin: 80px auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: system-ui, sans-serif;
  }
  input, button {
    padding: 10px;
    font-size: 16px;
  }
  .erro { color: #c00; }
</style>
```

### Versão B — servidor

Na versão servidor, o login vira uma **action** (código que roda no servidor ao enviar o formulário). Você precisa de dois arquivos:

`src/routes/login/+page.server.ts` (a lógica no servidor):

```typescript
// src/routes/login/+page.server.ts

// "Actions" é o tipo que descreve as ações de formulário desta página.
import type { Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';

export const actions: Actions = {
  // A ação "default" roda quando o formulário é enviado.
  default: async ({ request, locals }) => {
    // Lê os campos enviados pelo formulário.
    const dados = await request.formData();
    const email = dados.get('email') as string;
    const senha = dados.get('senha') as string;

    // "locals.supabase" é o cliente que o hooks.server.ts prepara
    // (ver seção 8). Ele já sabe lidar com o cookie de sessão.
    const { error } = await locals.supabase.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) {
      // "fail" devolve um erro para a página, sem redirecionar.
      return fail(400, { erro: 'E-mail ou senha inválidos.' });
    }

    // Deu certo: redireciona para a home. O cookie já foi setado.
    throw redirect(303, '/');
  }
};
```

`src/routes/login/+page.svelte` (a interface, versão servidor):

```svelte
<!-- src/routes/login/+page.svelte (versão servidor) -->
<script lang="ts">
  // "form" recebe o que a action devolveu (ex: a mensagem de erro).
  let { form } = $props();
</script>

<!-- "method=POST" envia ao servidor. Sem JavaScript de login aqui:
     quem autentica é a action no +page.server.ts. -->
<main class="login">
  <h1>Portal Grupo Maria Cristina</h1>

  <form method="POST">
    <input type="email" name="email" placeholder="Seu e-mail" />
    <input type="password" name="senha" placeholder="Sua senha" />
    <button type="submit">Entrar</button>
  </form>

  {#if form?.erro}
    <p class="erro">{form.erro}</p>
  {/if}
</main>

<style>
  .login { max-width: 360px; margin: 80px auto; font-family: system-ui, sans-serif; }
  .login form { display: flex; flex-direction: column; gap: 12px; }
  input, button { padding: 10px; font-size: 16px; }
  .erro { color: #c00; }
</style>
```

**Compare as duas:** na versão A, o login é JavaScript no navegador (`signInWithPassword` no `<script>`). Na versão B, é uma action no servidor, e o formulário funciona até sem JavaScript. A B é mais robusta; a A é mais fácil de seguir.

---

## 8. Protegendo as rotas internas

"Proteger" significa: se a pessoa não está logada, mande-a para `/login`.

### Versão A — cliente

Criamos um `+layout.svelte` que envolve todas as páginas e verifica a sessão no navegador. Crie `src/routes/+layout.svelte`:

```svelte
<!-- src/routes/+layout.svelte (versão cliente) -->
<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  // "children" é o conteúdo da página atual que este layout envolve.
  let { children } = $props();
  let verificado = $state(false); // só mostra a página após checar a sessão

  // "onMount" roda assim que o componente aparece no navegador.
  onMount(async () => {
    // Pergunta ao Supabase se há uma sessão salva.
    const { data } = await supabase.auth.getSession();

    const estaNoLogin = $page.url.pathname === '/login';

    if (!data.session && !estaNoLogin) {
      // Sem sessão e fora do login → manda para o login.
      goto('/login');
    } else {
      // Tem sessão (ou já está no login) → pode mostrar.
      verificado = true;
    }
  });
</script>

<!-- Só renderiza a página depois da verificação, para não "piscar"
     conteúdo protegido. -->
{#if verificado}
  {@render children()}
{/if}
```

> Repare no contra da abordagem A aqui: a verificação roda no `onMount`, ou seja, **no navegador**.
> Por isso guardamos `verificado` para não mostrar nada antes de checar. Funciona bem, mas a decisão
> acontece no cliente.

### Versão B — servidor

Aqui entram as peças que confundiram no MVP. Vou explicá-las uma a uma.

**Peça 1: `src/hooks.server.ts`** — roda em toda requisição e prepara um cliente Supabase que lê/escreve o cookie de sessão.

```typescript
// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

// "handle" intercepta CADA requisição antes de ela chegar às páginas.
export const handle: Handle = async ({ event, resolve }) => {
  // Cria um cliente Supabase que sabe ler os cookies desta requisição.
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        // Como o Supabase LÊ os cookies (para saber se há sessão):
        getAll: () => event.cookies.getAll(),
        // Como o Supabase ESCREVE cookies (ao logar/renovar sessão):
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, { ...options, path: '/' });
          });
        }
      }
    }
  );

  // Função de atalho para pegar a sessão validada em qualquer lugar.
  event.locals.getSession = async () => {
    const { data: { session } } = await event.locals.supabase.auth.getSession();
    return session;
  };

  // Continua o processamento normal da requisição.
  return resolve(event);
};
```

**Peça 2: `src/app.d.ts`** — diz ao TypeScript que `locals.supabase` e `locals.getSession` existem (senão o editor reclama).

```typescript
// src/app.d.ts
import type { SupabaseClient, Session } from '@supabase/supabase-js';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;              // o cliente que o hook criou
      getSession: () => Promise<Session | null>; // o atalho da sessão
    }
  }
}

export {};
```

> `Session | null` é um **tipo união**: significa "ou uma Session, ou null (ninguém logado)".
> A barra `|` lê-se "ou". Você vai ver isso bastante — é o TS te obrigando a considerar o caso
> "não tem ninguém logado", o que evita bugs.

**Peça 3: `src/routes/+layout.server.ts`** — verifica a sessão no servidor e protege as rotas.

```typescript
// src/routes/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// "load" roda no servidor antes de a página ser enviada.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  const session = await locals.getSession();

  const estaNoLogin = url.pathname === '/login';

  // Sem sessão e fora do login → redireciona no servidor.
  // O HTML protegido nunca é gerado nem enviado.
  if (!session && !estaNoLogin) {
    throw redirect(303, '/login');
  }

  // Se logado, passa a sessão para as páginas usarem (ex: mostrar o e-mail).
  return { session };
};
```

**A diferença essencial entre A e B, resumida:** na A, o navegador recebe a página e *depois* decide se redireciona. Na B, o servidor decide *antes* de enviar. Para conteúdo não-sigiloso, A basta; para sigiloso, B é o certo.

---

## 9. Home e layout comum

A home é a tela que aparece após o login, com os dois blocos (BI e Treinamentos) e o logout.

Crie `src/routes/+page.svelte`:

```svelte
<!-- src/routes/+page.svelte (home) -->
<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';

  // Função de logout, igual nas duas abordagens.
  async function sair() {
    await supabase.auth.signOut(); // limpa a sessão
    goto('/login');                // volta ao login
  }
</script>

<main class="home">
  <header>
    <h1>Portal Interno</h1>
    <button on:click={sair}>Sair</button>
  </header>

  <div class="blocos">
    <!-- "a href" é navegação normal: os links levam às outras páginas. -->
    <a class="bloco" href="/treinamentos">
      <h2>Treinamentos</h2>
      <p>Vídeos e capacitações internas</p>
    </a>

    <a class="bloco" href="/bi">
      <h2>BI</h2>
      <p>Dashboard de indicadores</p>
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
```

> Este arquivo é idêntico nas abordagens A e B. A diferença de auth vive só no layout/hooks, não aqui.
> Essa é a vantagem de isolar a autenticação: o resto do app não muda.

---

## 10. Página de BI

A mais simples do projeto: um iframe com o link do Power BI. Como o BI é de link aberto, não há segredo — só embedar.

Crie `src/routes/bi/+page.svelte`:

```svelte
<!-- src/routes/bi/+page.svelte -->
<script lang="ts">
  // Cole aqui o link de "Publicar na web" do seu Power BI.
  // Deixe como uma constante clara para achar e trocar fácil.
  const POWER_BI_URL = 'https://app.powerbi.com/view?r=SEU_LINK_AQUI';
</script>

<main class="bi">
  <a href="/" class="voltar">← Voltar</a>
  <h1>Indicadores</h1>

  <!-- O iframe ocupa a área toda, com proporção de dashboard. -->
  <div class="frame">
    <iframe
      title="Dashboard Power BI"
      src={POWER_BI_URL}
      allowfullscreen
    ></iframe>
  </div>
</main>

<style>
  .bi { max-width: 1100px; margin: 24px auto; font-family: system-ui, sans-serif; }
  .voltar { text-decoration: none; color: #555; }
  .frame {
    position: relative;
    padding-top: 56.25%;   /* proporção 16:9 */
    height: 0;
  }
  .frame iframe {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%; border: 0; border-radius: 8px;
  }
</style>
```

> No Power BI, o link vem de **Arquivo → Incorporar relatório → Publicar na web (público)**.
> Confirme com a empresa que o dashboard pode ser público antes de usar esse modo.

---

## 11. Página de Treinamentos (lista + player)

Duas telas: a lista de vídeos (`/treinamentos`) e o player de um vídeo (`/treinamentos/[id]`).

### A lista

Precisamos **buscar os vídeos** no Supabase. Mostro a forma **cliente** (busca no navegador) — a mais simples e coerente com a Abordagem A. Ao final há a nota de como fazer na versão servidor.

Crie `src/routes/treinamentos/+page.svelte`:

```svelte
<!-- src/routes/treinamentos/+page.svelte -->
<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';

  // O tipo de um vídeo (bate com as colunas da tabela trainings).
  type Training = {
    id: string;
    titulo: string;
    descricao: string;
    thumbnail_url: string;
  };

  // A lista começa vazia; preenche após buscar. "Training[]" = lista de vídeos.
  let videos: Training[] = $state([]);
  let carregando = $state(true);

  onMount(async () => {
    // Busca na tabela "trainings" as colunas que a lista precisa.
    // O RLS garante que só vêm os vídeos publicados, e só se logado.
    const { data, error } = await supabase
      .from('trainings')                              // da tabela trainings
      .select('id, titulo, descricao, thumbnail_url') // estas colunas
      .eq('publicado', true)                          // onde publicado = true
      .order('ordem', { ascending: true });           // ordenados por "ordem"

    if (!error && data) {
      videos = data;
    }
    carregando = false;
  });
</script>

<main class="lista">
  <a href="/" class="voltar">← Voltar</a>
  <h1>Treinamentos</h1>

  {#if carregando}
    <p>Carregando...</p>
  {:else if videos.length === 0}
    <p>Nenhum treinamento disponível.</p>
  {:else}
    <div class="grade">
      <!-- "#each" repete o bloco para cada vídeo da lista. -->
      {#each videos as video}
        <a class="card" href={`/treinamentos/${video.id}`}>
          <img src={video.thumbnail_url} alt={video.titulo} />
          <h3>{video.titulo}</h3>
          <p>{video.descricao}</p>
        </a>
      {/each}
    </div>
  {/if}
</main>

<style>
  .lista { max-width: 900px; margin: 24px auto; font-family: system-ui, sans-serif; }
  .voltar { text-decoration: none; color: #555; }
  .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .card {
    border: 1px solid #ddd; border-radius: 10px; overflow: hidden;
    text-decoration: none; color: inherit;
  }
  .card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; }
  .card h3, .card p { margin: 8px 12px; }
</style>
```

### O player

Esta página lê o `id` da URL, busca aquele vídeo e mostra o iframe do Drive.

Crie `src/routes/treinamentos/[id]/+page.svelte`:

```svelte
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
```

### Preparando os vídeos do Drive

Para cada vídeo, o `video_url` na tabela precisa estar no formato de embed:

1. No Drive, botão direito no vídeo → **Compartilhar** → **"Qualquer pessoa com o link"** (senão não carrega para os colaboradores).
2. Copie o link normal: `https://drive.google.com/file/d/`**`ID`**`/view?usp=sharing`
3. Pegue só o **ID** (entre `/d/` e `/view`) e monte: `https://drive.google.com/file/d/ID/preview`
4. É essa URL com `/preview` que vai na coluna `video_url`.

### Nota sobre a versão servidor da busca

Na Abordagem B, em vez de buscar no `onMount`, você cria um `+page.server.ts` com uma função `load`
que busca no servidor e entrega os dados prontos para o `.svelte`. O resultado visual é o mesmo; muda
que a busca acontece no servidor. Deixo isso como o **segundo exercício** de migração, depois que a
versão cliente estiver funcionando — assim você aprende os dois padrões de busca de dados.

---

## 12. Rodando e testando

Com o `npm run dev` ativo, teste nesta ordem — cada passo valida uma peça:

1. **Sem login, tente abrir `/treinamentos`.** Deve redirecionar para `/login`. *Isto confirma que a proteção funciona* — é o teste mais importante.
2. **Faça login** com um usuário cadastrado no painel do Supabase (Authentication → Users). Deve cair na home.
3. **Abra Treinamentos.** Devem aparecer os vídeos que você cadastrou na tabela.
4. **Clique num vídeo.** O iframe do Drive deve tocar.
5. **Abra o BI.** O dashboard deve carregar.
6. **Clique em Sair.** Deve voltar ao login, e `/treinamentos` deve voltar a bloquear.

Se algo falhar, o console do navegador (F12 → Console) e o terminal do `npm run dev` mostram o erro.
A maioria dos problemas iniciais é: `.env` com valor errado, RLS não configurado, ou `video_url`
fora do formato `/preview`.

---

## 13. Deploy no Cloudflare Pages

1. Instale o adapter do Cloudflare:
   ```bash
   npm install -D @sveltejs/adapter-cloudflare
   ```
2. No `svelte.config.js`, troque o adapter padrão pelo do Cloudflare:
   ```javascript
   import adapter from '@sveltejs/adapter-cloudflare';
   // ...
   kit: { adapter: adapter() }
   ```
3. Suba o projeto para um repositório no **GitHub** (confira que `.env` está no `.gitignore`).
4. No Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório.
5. Em **Settings → Environment Variables**, adicione `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY`
   com os valores reais.
6. Em **Custom Domains**, aponte `portal.grupomariacristina.com` (o Cloudflare cria o DNS e o HTTPS).
7. No site oficial, o botão de login é só um link: `<a href="https://portal.grupomariacristina.com">Portal</a>`.

---

## 14. Roteiro de estudo depois de terminar

Quando o portal-v2 estiver de pé, aprofunde nesta ordem — cada item ataca uma das partes que hoje
parecem "mágica":

1. **Reatividade do Svelte (`$state`, `$props`, `$derived`).** É o que faz a tela atualizar sozinha.
   Uma tarde de prática e você domina.
2. **O fluxo de sessão do Supabase.** Faça a migração da Abordagem A para a B como exercício guiado —
   é o melhor jeito de entender `hooks.server.ts` de verdade, porque você vê o antes e o depois.
3. **Busca de dados no servidor (`+page.server.ts` com `load`).** O segundo padrão de busca, que
   completa seu entendimento de "cliente vs. servidor".
4. **TypeScript além do básico.** Só depois de tudo acima. Você já estará confortável lendo tipos;
   aí vale aprender a *escrevê-los* bem.

A cada item, o medo de "não conseguir resolver uma falha" diminui, porque você passa a saber
exatamente onde cada coisa acontece. Esse é o real objetivo de reconstruir do zero.

---

*Bom trabalho. Construir a segunda vez, entendendo cada linha, é o que transforma "um projeto que
funciona" em "um projeto que eu domino".*
