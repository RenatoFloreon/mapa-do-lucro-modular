/**
 * @file lib/scraping/instagram.js
 * @description Funções para scraping de perfis do Instagram
 * 
 * Este módulo gerencia o scraping de perfis do Instagram e enriquecimento
 * com outras fontes, utilizando Puppeteer e Cheerio.
 */

const puppeteer = require('puppeteer');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const axios = require('axios');
const { safeLogError } = require('../utils/error');
const openai = require('../openai/client');

// Variável para armazenar a instância do navegador
let browser;

/**
 * Extrai dados públicos do Instagram e enriquece com outras fontes
 * @param {string} username - Nome de usuário do Instagram
 * @returns {Promise<Object>} - Dados do perfil enriquecidos
 */
async function scrapeInstagramProfile(username) {
  console.log(`[INSTAGRAM_SCRAPE_ATTEMPT] Tentando extrair dados do perfil: ${username}`);
  try {
    // Removendo @ se existir
    username = username.replace('@', '');
    
    // Objeto para armazenar todos os dados coletados
    const profileData = {
      username: username,
      fullName: '',
      bio: '',
      followersCount: 0,
      postsCount: 0,
      isBusinessAccount: false,
      businessCategory: '',
      recentPosts: [],
      hashtags: [],
      profileImageAnalysis: {},
      websiteUrl: '',
      linkedProfiles: {},
      contentThemes: [],
      locationInfo: '',
      additionalInfo: {}
    };
    
    // 1. Acessar página do Instagram com Puppeteer
    if (!browser) {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true
      });
      console.log("[PUPPETEER] Navegador Puppeteer iniciado.");
    }
    
    const page = await browser.newPage();
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2', timeout: 15000 });
    const html = await page.content();
    await page.close();
    
    const $ = cheerio.load(html);
    
    // Extrair metadados do perfil
    $('meta').each((i, el) => {
      const property = $(el).attr('property');
      const content = $(el).attr('content') || '';
      
      if (property === 'og:title') {
        profileData.fullName = content.split(' (')[0];
      }
      
      if (property === 'og:description') {
        if (content.includes('Followers') && content.includes('Following')) {
          profileData.bio = content.split('Followers')[0].trim();
          
          const followersMatch = content.match(/(\d+(?:,\d+)*) Followers/);
          if (followersMatch) {
            profileData.followersCount = parseInt(followersMatch[1].replace(/,/g, '')) || 0;
          }
          
          const postsMatch = content.match(/(\d+(?:,\d+)*) Posts/);
          if (postsMatch) {
            profileData.postsCount = parseInt(postsMatch[1].replace(/,/g, '')) || 0;
          }
        }
      }
      
      if (property === 'og:image') {
        profileData.profileImageUrl = content;
      }
    });
    
    // Verificar se é uma conta comercial (presença de botão "Contact" na página)
    if ($('a:contains("Contact")').length > 0) {
      profileData.isBusinessAccount = true;
    }
    
    // Extrair categoria de negócio (aparece após um ponto "·" na página)
    const categoryElement = $('div:contains("·")').first();
    if (categoryElement.length > 0) {
      const categoryText = categoryElement.text();
      if (categoryText.includes('·')) {
        profileData.businessCategory = categoryText.split('·')[1].trim();
      }
    }
    
    // Extrair website/link na bio (primeiro link externo encontrado)
    $('a[href^="http"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes('instagram.com')) {
        profileData.websiteUrl = href;
        return false; // parar após encontrar o primeiro link externo
      }
    });
    
    // Extrair hashtags da bio
    const bioText = profileData.bio || '';
    const hashtagRegex = /#(\w+)/g;
    let match;
    while ((match = hashtagRegex.exec(bioText)) !== null) {
      profileData.hashtags.push(match[1]);
    }
    
    // Extrair localização da bio (se houver emoji de localização 📍)
    const locationElement = $('span:contains("📍")');
    if (locationElement.length > 0) {
      profileData.locationInfo = locationElement.text().replace('📍', '').trim();
    }
    
    // 2. Buscar informações adicionais no Google (snippets públicos e LinkedIn)
    try {
      const googleResponse = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(profileData.fullName || username)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      
      const $google = cheerio.load(googleResponse.data);
      const snippets = [];
      
      $google('.VwiC3b').each((i, el) => {
        const snippet = $google(el).text().trim();
        if (snippet && snippet.length > 20) {
          snippets.push(snippet);
        }
      });
      
      if (snippets.length > 0) {
        profileData.additionalInfo.googleSnippets = snippets.slice(0, 3);
      }
      
      const linkedinLink = $google('a[href*="linkedin.com/in/"]').first().attr('href');
      if (linkedinLink) {
        profileData.linkedProfiles.linkedin = linkedinLink;
      }
    } catch (error) {
      console.log(`[GOOGLE_SEARCH_INFO] Não foi possível obter informações adicionais do Google: ${error.message}`);
    }
    
    // 3. Extrair informações das últimas postagens (imagens e legendas)
    const postLinks = [];
    $('article a[href*="/p/"]').slice(0, 3).each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        postLinks.push(`https://www.instagram.com${href}`);
      }
    });
    
    for (const postUrl of postLinks) {
      try {
        const postPage = await browser.newPage();
        await postPage.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const postHtml = await postPage.content();
        await postPage.close();
        
        const $post = cheerio.load(postHtml);
        const imageUrl = $post('meta[property="og:image"]').attr('content') || '';
        let captionSnippet = $post('meta[property="og:description"]').attr('content') || '';
        let captionText = captionSnippet;
        
        const quoteStart = captionSnippet.indexOf('"');
        const quoteEnd = captionSnippet.lastIndexOf('"');
        if (quoteStart !== -1 && quoteEnd !== -1 && quoteEnd > quoteStart) {
          captionText = captionSnippet.substring(quoteStart + 1, quoteEnd);
        }
        
        // Extrair hashtags das legendas
        const hashtagRegexPost = /#(\w+)/g;
        let matchPost;
        const captionHashtags = [];
        
        while ((matchPost = hashtagRegexPost.exec(captionText)) !== null) {
          captionHashtags.push(matchPost[1]);
        }
        
        captionHashtags.forEach(tag => {
          if (!profileData.hashtags.includes(tag)) {
            profileData.hashtags.push(tag);
          }
        });
        
        profileData.recentPosts.push({ imageUrl: imageUrl, caption: captionText });
      } catch (err) {
        console.error('[INSTAGRAM_POST_SCRAPE_ERROR] Erro ao extrair dados de uma postagem:', err.message);
      }
    }
    
    // 4. Analisar imagem de perfil via OpenAI (se disponível)
    if (profileData.profileImageUrl && openai) {
      try {
        const imageAnalysisPrompt = `
        Analise esta imagem de perfil do Instagram e descreva:
        1. O que a pessoa está fazendo na foto
        2. Ambiente/cenário (interior, exterior, natureza, urbano, etc.)
        3. Estilo visual e cores predominantes
        4. Impressão geral transmitida (profissional, casual, artística, etc.)
        5. Elementos notáveis (objetos, símbolos, texto)
        
        Forneça uma análise concisa em português.
        `;
        
        const imageAnalysis = await openai.chat.completions.create({
          model: "gpt-4-vision-preview",
          messages: [
            { 
              role: "user", 
              content: [
                { type: "text", text: imageAnalysisPrompt },
                { type: "image_url", image_url: { url: profileData.profileImageUrl } }
              ]
            }
          ],
          max_tokens: 300
        });
        
        profileData.profileImageAnalysis = {
          description: imageAnalysis.choices[0].message.content
        };
        
        console.log(`[PROFILE_IMAGE_ANALYSIS_SUCCESS] Análise da imagem de perfil concluída para: ${username}`);
      } catch (error) {
        console.log(`[PROFILE_IMAGE_ANALYSIS_INFO] Não foi possível analisar a imagem de perfil: ${error.message}`);
      }
    }
    
    // 5. Identificar temas de conteúdo (usando bio/hashtags coletados)
    try {
      if (openai && (profileData.bio || profileData.hashtags.length > 0)) {
        const contentAnalysisPrompt = `
        Com base nas seguintes informações de um perfil do Instagram, identifique os principais temas de conteúdo e interesses:
        
        Nome: ${profileData.fullName}
        Bio: ${profileData.bio}
        Hashtags: ${profileData.hashtags.join(', ')}
        Categoria: ${profileData.businessCategory}
        
        Liste apenas 3-5 temas principais em português, separados por vírgula.
        `;
        
        const contentAnalysis = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [ { role: "user", content: contentAnalysisPrompt } ],
          max_tokens: 100
        });
        
        const themes = contentAnalysis.choices[0].message.content.split(',').map(theme => theme.trim());
        profileData.contentThemes = themes;
        
        console.log(`[CONTENT_THEMES_ANALYSIS_SUCCESS] Temas de conteúdo identificados para: ${username}`);
      }
    } catch (error) {
      console.log(`[CONTENT_THEMES_ANALYSIS_INFO] Não foi possível identificar temas de conteúdo: ${error.message}`);
    }
    
    console.log(`[INSTAGRAM_SCRAPE_SUCCESS] Dados enriquecidos extraídos com sucesso para: ${username}`);
    return profileData;
  } catch (error) {
    console.error(`[INSTAGRAM_SCRAPE_ERROR] Erro ao extrair dados do perfil ${username}:`, safeLogError(error));
    
    // Mesmo com erro, tentar obter informações básicas via OpenAI
    try {
      if (openai) {
        const fallbackAnalysisPrompt = `
        Gere informações hipotéticas plausíveis para um perfil de Instagram com o nome de usuário @${username}.
        Inclua: possível nome completo, bio provável, tipo de conteúdo que provavelmente compartilha,
        e se parece ser uma conta pessoal ou profissional. Baseie sua análise apenas no nome de usuário.
        Responda em português.
        `;
        
        const fallbackAnalysis = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [ { role: "user", content: fallbackAnalysisPrompt } ],
          max_tokens: 250
        });
        
        return {
          username: username,
          fallbackAnalysis: fallbackAnalysis.choices[0].message.content,
          error: "Não foi possível extrair dados reais do perfil"
        };
      }
    } catch (fallbackError) {
      console.error(`[FALLBACK_ANALYSIS_ERROR] Erro ao gerar análise alternativa: ${fallbackError.message}`);
    }
    
    return { username: username, error: "Não foi possível extrair dados do perfil" };
  }
}

module.exports = {
  scrapeInstagramProfile
};
