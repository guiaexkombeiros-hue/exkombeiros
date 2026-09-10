#!/usr/bin/env node
/**
 * Gera páginas estáticas /camping/{key}.html para cada camping publicado,
 * para que o Google consiga indexar cada camping individualmente.
 *
 * Como funciona:
 *  1. Busca os dados do Firebase Realtime Database (endpoint público /ranking.json)
 *  2. Para cada camping com status !== 'rascunho' e !== 'fechado', gera um HTML
 *     com title, meta description, Open Graph e conteúdo estático visível ao Google
 *  3. A página redireciona automaticamente (via JS) para a experiência completa
 *     no guia-publico.html, abrindo o modal do camping específico
 *  4. Atualiza o sitemap.xml com uma <url> para cada camping
 *
 * Uso:
 *   node gerar-paginas-campings.js
 *
 * Requisitos: Node.js 18+ (usa fetch nativo). Sem dependências externas.
 */

const fs = require('fs');
const path = require('path');

// ── CONFIGURAÇÃO ────────────────────────────────────────────────────────
const FIREBASE_URL = 'https://exkombeiros-24a9a-default-rtdb.firebaseio.com/ranking.json';
const SITE_URL = 'https://www.guiaexkombeiros.com.br';
const OUTPUT_DIR = path.join(__dirname, 'camping'); // pasta /camping na raiz do site
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');

// ── UTILITÁRIOS ──────────────────────────────────────────────────────────
function escaparHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function otimizarCloudinary(url, largura) {
  if (!url || typeof url !== 'string') return url;
  if (url.indexOf('res.cloudinary.com') === -1 || url.indexOf('/upload/') === -1) return url;
  var params = 'f_auto,q_auto' + (largura ? ',w_' + largura : '');
  return url.replace('/upload/', '/upload/' + params + '/');
}

function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ── TEMPLATE DA PÁGINA ESTÁTICA ──────────────────────────────────────────
function gerarHtmlCamping(key, c) {
  const nome = c.nomeSimples || c.nome || 'Camping';
  const local = [c.cidade, c.estado].filter(Boolean).join(', ');
  const tituloPagina = `${nome} — ${local} | Avaliação Técnica | Guia ExKombeiros`;
  const score = parseFloat(c.score) || 0;
  const descricaoBase = c.observacoes
    ? c.observacoes.slice(0, 155)
    : `Avaliação técnica completa do ${nome} em ${local}: energia, água, internet, acesso e banheiros. Nota ${score.toFixed(1)}/5.0.`;
  const metaDescricao = escaparHtml(descricaoBase);
  const imagemPrincipal = (c.fotos && c.fotos.length > 0) ? otimizarCloudinary(c.fotos[0], 1200) : `${SITE_URL}/logo.png`;
  const urlCanonica = `${SITE_URL}/camping/${key}.html`;
  const urlAppComModal = `${SITE_URL}/guia-publico.html#camping=${key}`;

  // JSON-LD (schema.org) para o Google poder exibir rich snippets (nota, localização)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Campground',
    name: nome,
    description: descricaoBase,
    image: imagemPrincipal,
    address: {
      '@type': 'PostalAddress',
      addressLocality: c.cidade || undefined,
      addressRegion: c.estado || undefined,
      addressCountry: 'BR',
    },
    ...(c.localizacao && isFinite(c.localizacao.lat) && isFinite(c.localizacao.lng) ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: c.localizacao.lat,
        longitude: c.localizacao.lng,
      }
    } : {}),
    ...(score > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: score.toFixed(1),
        bestRating: '5',
        worstRating: '0',
        ratingCount: 1,
      }
    } : {}),
  };

  // Conteúdo estático de fallback: visível para o Google e para navegadores sem JS,
  // mas o usuário real é redirecionado automaticamente para a experiência completa.
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escaparHtml(tituloPagina)}</title>
<meta name="description" content="${metaDescricao}">
<link rel="canonical" href="${urlCanonica}">

<!-- Open Graph / WhatsApp / Facebook -->
<meta property="og:type" content="website">
<meta property="og:title" content="${escaparHtml(nome)} — ${escaparHtml(local)}">
<meta property="og:description" content="${metaDescricao}">
<meta property="og:image" content="${imagemPrincipal}">
<meta property="og:url" content="${urlCanonica}">
<meta property="og:site_name" content="Guia ExKombeiros">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escaparHtml(nome)} — ${escaparHtml(local)}">
<meta name="twitter:description" content="${metaDescricao}">
<meta name="twitter:image" content="${imagemPrincipal}">

<!-- Redireciona automaticamente para a experiência completa (SPA) -->
<meta http-equiv="refresh" content="0; url=${urlAppComModal}">
<script>window.location.replace(${JSON.stringify(urlAppComModal)});</script>

<link rel="icon" href="${SITE_URL}/icon192.png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  body { font-family: Georgia, serif; background: #f5f5f5; color: #1a472a; text-align: center; padding: 60px 20px; }
  img { max-width: 320px; border-radius: 8px; margin-bottom: 20px; }
  a { color: #1a472a; }
</style>
</head>
<body>
  <img src="${imagemPrincipal}" alt="${escaparHtml(nome)}">
  <h1>${escaparHtml(nome)}</h1>
  <p>📍 ${escaparHtml(local)} &nbsp;·&nbsp; Nota: ${score.toFixed(1)}/5.0</p>
  <p>${metaDescricao}</p>
  <p>Redirecionando para o Guia ExKombeiros... <a href="${urlAppComModal}">Clique aqui se não for redirecionado automaticamente</a>.</p>
</body>
</html>
`;
}

// ── SITEMAP ──────────────────────────────────────────────────────────────
function gerarSitemap(campingsPublicados) {
  const hoje = new Date().toISOString().split('T')[0];

  // Mantém a mesma estrutura do sitemap.xml original (changefreq incluso)
  const urlsFixas = [
    { loc: `${SITE_URL}/`, lastmod: hoje, changefreq: 'weekly', prioridade: '1.0' },
    { loc: `${SITE_URL}/privacidade.html`, lastmod: '2026-06-27', changefreq: 'yearly', prioridade: '0.3' },
  ];

  const urlsCampings = campingsPublicados.map(({ key }) => ({
    loc: `${SITE_URL}/camping/${key}.html`,
    lastmod: hoje,
    changefreq: 'monthly',
    prioridade: '0.8',
  }));

  const todasUrls = urlsFixas.concat(urlsCampings);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${todasUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.prioridade}</priority>
  </url>`).join('\n')}
</urlset>
`;
  return xml;
}

// ── EXECUÇÃO PRINCIPAL ────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Buscando dados do Firebase...');
  const resp = await fetch(FIREBASE_URL);
  if (!resp.ok) {
    throw new Error(`Falha ao buscar dados do Firebase: ${resp.status} ${resp.statusText}`);
  }
  const dados = await resp.json();

  if (!dados) {
    console.log('⚠️  Nenhum dado encontrado no Firebase (nó "ranking" vazio).');
    return;
  }

  const chaves = Object.keys(dados);
  console.log(`📦 ${chaves.length} campings encontrados no total.`);

  // Filtra: exclui rascunhos (nunca publicados). Mantém "fechado" pois continua acessível por link direto.
  const publicados = chaves
    .map(key => ({ key, c: dados[key] }))
    .filter(({ c }) => c && c.status !== 'rascunho');

  console.log(`✅ ${publicados.length} campings serão publicados como páginas estáticas.`);

  // Garante que a pasta de saída existe
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Remove páginas antigas (campings removidos/renomeados não deixam lixo para trás)
  const existentes = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : [];
  const chavesAtuais = new Set(publicados.map(({ key }) => `${key}.html`));
  for (const arquivo of existentes) {
    if (!chavesAtuais.has(arquivo)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, arquivo));
      console.log(`🗑️  Removido (obsoleto): camping/${arquivo}`);
    }
  }

  // Gera cada página
  for (const { key, c } of publicados) {
    const html = gerarHtmlCamping(key, c);
    const arquivoDestino = path.join(OUTPUT_DIR, `${key}.html`);
    fs.writeFileSync(arquivoDestino, html, 'utf-8');
  }
  console.log(`📝 ${publicados.length} páginas HTML geradas em /camping/`);

  // Gera sitemap.xml atualizado
  const sitemapXml = gerarSitemap(publicados);
  fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf-8');
  console.log('🗺️  sitemap.xml atualizado.');

  console.log('\n✅ Concluído! Não esqueça de fazer commit + push dos arquivos gerados.');
}

main().catch(err => {
  console.error('❌ Erro ao gerar páginas:', err);
  process.exit(1);
});
