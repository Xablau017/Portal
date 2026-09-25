<!-- src/routes/bi/+page.svelte -->
<script lang="ts">
  // Cole aqui o link de "Publicar na web" do seu Power BI.
  // Deixe como uma constante clara para achar e trocar fácil.
  const POWER_BI_URL = 'https://app.powerbi.com/view?r=eyJrIjoiOTZmMzQ3YjUtMTQ5Yi00NmNlLWE4ZjctYTFiZmNiOTgyYjM5IiwidCI6ImU1NmNhMWJkLWI4NTktNGVkNy05OWQ2LThkYWU5MjI0MGM4NSJ9&embedImagePlaceholder=true&pageName=559f56b6f838c096b16d';
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
