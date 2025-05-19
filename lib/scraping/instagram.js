/**
 * @file lib/scraping/instagram.js
 * @description Módulo para scraping de dados do Instagram
 * 
 * Este módulo aprimorado realiza scraping de dados do Instagram para obter
 * informações detalhadas do perfil do usuário, permitindo uma personalização
 * profunda da Carta de Consciência.
 */

const puppeteer = require('puppeteer');
const config = require('../../config');
const { safeLogError } = require('../utils/error');

/**
 * Obtém dados detalhados do perfil do Instagram
 * @param {string} username - Nome de usuário do Instagram (sem @)
 * @returns {Promise<Object>} - Dados do perfil do Instagram
 */
async function getInstagramProfileData(username) {
  console.log(`[INSTAGRAM_SCRAPING_START] Iniciando scraping do perfil @${username}`);
  
  let browser = null;
  
  try {
    // Configuração do Puppeteer para ambiente serverless
    const puppeteerOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      headless: true
    };
    
    // Iniciar o navegador
    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    
    // Configurar user agent e viewport
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // Acessar a página do perfil
    const profileUrl = `https://www.instagram.com/${username}/`;
    console.log(`[INSTAGRAM_SCRAPING] Acessando URL: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Aguardar carregamento do conteúdo
    await page.waitForSelector('header', { timeout: 30000 }).catch(() => {
      console.log('[INSTAGRAM_SCRAPING] Timeout ao aguardar header, continuando mesmo assim');
    });
    
    // Extrair dados do perfil
    console.log(`[INSTAGRAM_SCRAPING] Extraindo dados do perfil @${username}`);
    const profileData = await page.evaluate(() => {
      // Função auxiliar para extrair texto com segurança
      const safeTextContent = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : null;
      };
      
      // Extrair bio
      const bio = document.querySelector('header h1') ? 
                 document.querySelector('header h1').textContent.trim() : 
                 (document.querySelector('header span') ? document.querySelector('header span').textContent.trim() : '');
      
      // Extrair contadores (posts, seguidores, seguindo)
      const counters = Array.from(document.querySelectorAll('header ul li span')).map(el => el.textContent.trim());
      
      // Extrair posts recentes
      const posts = Array.from(document.querySelectorAll('article img')).slice(0, 5).map(img => ({
        imageUrl: img.src,
        caption: img.alt || ''
      }));
      
      // Analisar temas e interesses com base nos posts e bio
      const allText = posts.map(p => p.caption).join(' ') + ' ' + bio;
      
      // Identificar temas recorrentes
      const themes = [];
      const themeKeywords = {
        'tecnologia': ['tech', 'tecnologia', 'digital', 'inovação', 'inovacao', 'programação', 'programacao', 'código', 'codigo', 'software', 'app', 'aplicativo', 'startup'],
        'negócios': ['negócio', 'negocio', 'empreendedor', 'empreendedorismo', 'empresa', 'business', 'marketing', 'vendas', 'cliente', 'mercado'],
        'finanças': ['finança', 'financa', 'investimento', 'dinheiro', 'money', 'financeiro', 'economia', 'lucro', 'resultado'],
        'educação': ['educação', 'educacao', 'aprendizado', 'curso', 'ensino', 'conhecimento', 'aula', 'workshop', 'mentoria'],
        'saúde': ['saúde', 'saude', 'bem-estar', 'fitness', 'exercício', 'exercicio', 'alimentação', 'alimentacao', 'nutrição', 'nutricao'],
        'criatividade': ['criativo', 'criatividade', 'arte', 'design', 'criação', 'criacao', 'inspiração', 'inspiracao', 'ideia'],
        'sustentabilidade': ['sustentável', 'sustentavel', 'sustentabilidade', 'ecológico', 'ecologico', 'meio ambiente', 'verde', 'eco'],
        'liderança': ['líder', 'lider', 'liderança', 'lideranca', 'gestão', 'gestao', 'equipe', 'time', 'colaborador']
      };
      
      for (const [theme, keywords] of Object.entries(themeKeywords)) {
        for (const keyword of keywords) {
          if (allText.toLowerCase().includes(keyword.toLowerCase())) {
            themes.push(theme);
            break;
          }
        }
      }
      
      // Identificar interesses
      const interests = [];
      const interestKeywords = {
        'inovação': ['inovação', 'inovacao', 'inovar', 'novo', 'disruptivo', 'futuro', 'tendência', 'tendencia'],
        'desenvolvimento pessoal': ['desenvolvimento', 'crescimento', 'evolução', 'evolucao', 'aprendizado', 'melhoria', 'progresso'],
        'networking': ['networking', 'conexão', 'conexao', 'rede', 'contato', 'relacionamento', 'parceria'],
        'produtividade': ['produtividade', 'eficiência', 'eficiencia', 'organização', 'organizacao', 'tempo', 'resultado'],
        'empreendedorismo': ['empreender', 'empreendedor', 'negócio próprio', 'negocio proprio', 'startup', 'empresa'],
        'tecnologia': ['tecnologia', 'tech', 'digital', 'online', 'internet', 'web', 'app', 'software'],
        'marketing digital': ['marketing', 'digital', 'social media', 'mídia social', 'midia social', 'conteúdo', 'conteudo'],
        'investimentos': ['investimento', 'investir', 'financeiro', 'finança', 'financa', 'dinheiro', 'retorno']
      };
      
      for (const [interest, keywords] of Object.entries(interestKeywords)) {
        for (const keyword of keywords) {
          if (allText.toLowerCase().includes(keyword.toLowerCase())) {
            interests.push(interest);
            break;
          }
        }
      }
      
      // Identificar estilo de conteúdo
      let contentStyle = 'Não identificado';
      if (allText.match(/\?/g)?.length > 3) {
        contentStyle = 'Questionador/Educativo';
      } else if (allText.match(/!/g)?.length > 3) {
        contentStyle = 'Entusiasta/Motivacional';
      } else if (posts.some(p => p.caption.length > 200)) {
        contentStyle = 'Detalhista/Informativo';
      } else if (posts.some(p => p.caption.includes('#') && p.caption.split('#').length > 3)) {
        contentStyle = 'Estratégico/Conectado';
      } else if (bio.length < 50 && posts.some(p => p.caption.length < 50)) {
        contentStyle = 'Minimalista/Direto';
      }
      
      return {
        bio,
        postsCount: counters[0] || 'Não disponível',
        followersCount: counters[1] || 'Não disponível',
        followingCount: counters[2] || 'Não disponível',
        themes: [...new Set(themes)],
        interests: [...new Set(interests)],
        contentStyle,
        recentPosts: posts
      };
    });
    
    console.log(`[INSTAGRAM_SCRAPING_SUCCESS] Dados extraídos com sucesso para @${username}`);
    
    // Análise adicional dos dados para enriquecer a personalização
    profileData.analysisNotes = analyzeProfileData(profileData);
    
    return profileData;
  } catch (error) {
    console.error(`[INSTAGRAM_SCRAPING_ERROR] Erro ao fazer scraping do perfil @${username}:`, safeLogError(error));
    
    // Retornar dados básicos mesmo em caso de erro
    return {
      bio: 'Não disponível devido a erro de scraping',
      postsCount: 'Desconhecido',
      followersCount: 'Desconhecido',
      followingCount: 'Desconhecido',
      themes: [],
      interests: [],
      contentStyle: 'Não identificado',
      recentPosts: [],
      error: error.message
    };
  } finally {
    // Fechar o navegador
    if (browser) {
      await browser.close();
      console.log(`[INSTAGRAM_SCRAPING_CLEANUP] Navegador fechado após scraping de @${username}`);
    }
  }
}

/**
 * Analisa os dados do perfil para extrair insights adicionais
 * @param {Object} profileData - Dados brutos do perfil
 * @returns {Object} - Insights adicionais sobre o perfil
 */
function analyzeProfileData(profileData) {
  const analysis = {};
  
  // Analisar engajamento
  if (profileData.followersCount && profileData.postsCount) {
    const followersNum = parseInt(profileData.followersCount.replace(/[^0-9]/g, '')) || 0;
    const postsNum = parseInt(profileData.postsCount.replace(/[^0-9]/g, '')) || 0;
    
    if (followersNum > 10000) {
      analysis.audienceSize = 'Grande (influenciador)';
    } else if (followersNum > 1000) {
      analysis.audienceSize = 'Médio (micro-influenciador)';
    } else {
      analysis.audienceSize = 'Nicho (especialista)';
    }
    
    if (postsNum > 500) {
      analysis.activityLevel = 'Muito ativo';
    } else if (postsNum > 100) {
      analysis.activityLevel = 'Ativo';
    } else {
      analysis.activityLevel = 'Seletivo';
    }
  }
  
  // Analisar estilo de comunicação
  if (profileData.bio) {
    if (profileData.bio.includes('!')) {
      analysis.communicationStyle = 'Entusiasta';
    } else if (profileData.bio.includes('?')) {
      analysis.communicationStyle = 'Questionador';
    } else if (profileData.bio.length > 150) {
      analysis.communicationStyle = 'Detalhista';
    } else if (profileData.bio.length < 50) {
      analysis.communicationStyle = 'Conciso';
    } else {
      analysis.communicationStyle = 'Equilibrado';
    }
  }
  
  // Analisar foco de conteúdo
  const allThemesAndInterests = [...(profileData.themes || []), ...(profileData.interests || [])];
  if (allThemesAndInterests.length > 0) {
    const uniqueTopics = [...new Set(allThemesAndInterests)];
    
    if (uniqueTopics.length > 5) {
      analysis.contentFocus = 'Diversificado';
    } else if (uniqueTopics.length > 2) {
      analysis.contentFocus = 'Multifacetado';
    } else {
      analysis.contentFocus = 'Especializado';
    }
    
    // Identificar temas dominantes
    const topicCounts = {};
    allThemesAndInterests.forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });
    
    const dominantTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    analysis.dominantTopics = dominantTopics;
  }
  
  return analysis;
}

module.exports = {
  getInstagramProfileData
};

