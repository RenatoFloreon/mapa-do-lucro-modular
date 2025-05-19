/**
 * @file lib/openai/letter.js
 * @description Módulo para geração da Carta de Consciência personalizada
 * 
 * Este módulo gerencia a geração da Carta de Consciência personalizada,
 * utilizando dados do perfil do usuário e a API da OpenAI para criar
 * uma experiência profunda, visceral e impactante.
 */

const { Configuration, OpenAIApi } = require('openai');
const config = require('../../config');
const { safeLogError } = require('../utils/error');
const { getInstagramProfileData } = require('../scraping/instagram');

// Configuração da API da OpenAI
const openaiConfig = new Configuration({
  apiKey: config.openai.apiKey,
});
const openai = new OpenAIApi(openaiConfig);

/**
 * Gera a Carta de Consciência personalizada para o usuário
 * @param {Object} userData - Dados do usuário
 * @returns {Promise<string>} - Carta de Consciência personalizada
 */
async function generateConsciousnessLetter(userData) {
  try {
    console.log(`[LETTER_GENERATION_START] Iniciando geração de carta para ${userData.phone}`);
    
    // Obter dados do perfil do Instagram, se disponível
    let profileData = null;
    if (userData.instagram) {
      try {
        console.log(`[LETTER_INSTAGRAM_SCRAPING] Obtendo dados do perfil do Instagram: @${userData.instagram}`);
        profileData = await getInstagramProfileData(userData.instagram);
        console.log(`[LETTER_INSTAGRAM_SCRAPING_SUCCESS] Dados obtidos com sucesso para @${userData.instagram}`);
      } catch (error) {
        console.error(`[LETTER_INSTAGRAM_SCRAPING_ERROR] Erro ao obter dados do Instagram para @${userData.instagram}:`, safeLogError(error));
        // Continuar mesmo sem dados do Instagram
      }
    }
    
    // Construir o prompt para a OpenAI
    const prompt = buildLetterPrompt(userData, profileData);
    
    // Gerar a carta usando a API da OpenAI
    console.log(`[LETTER_OPENAI_REQUEST] Enviando solicitação para a OpenAI para ${userData.phone}`);
    const response = await openai.createCompletion({
      model: config.openai.model || "text-davinci-003",
      prompt: prompt,
      max_tokens: 2500,
      temperature: 0.8,
      top_p: 1,
      frequency_penalty: 0.2,
      presence_penalty: 0.6,
      timeout: config.openai.timeoutMs || 30000,
    });
    
    // Extrair e processar a resposta
    const letter = response.data.choices[0].text.trim();
    console.log(`[LETTER_GENERATION_SUCCESS] Carta gerada com sucesso para ${userData.phone} (${letter.length} caracteres)`);
    
    return letter;
  } catch (error) {
    console.error(`[LETTER_GENERATION_ERROR] Erro ao gerar carta para ${userData.phone}:`, safeLogError(error));
    throw new Error(`Falha ao gerar a Carta de Consciência: ${error.message}`);
  }
}

/**
 * Constrói o prompt detalhado para a geração da carta
 * @param {Object} userData - Dados do usuário
 * @param {Object|null} profileData - Dados do perfil do Instagram (se disponível)
 * @returns {string} - Prompt completo para a OpenAI
 */
function buildLetterPrompt(userData, profileData) {
  // Informações básicas do usuário
  const userName = userData.name || "empreendedor";
  const userInstagram = userData.instagram || "";
  const userEmail = userData.email || "";
  
  // Construir contexto com dados do perfil do Instagram (se disponível)
  let profileContext = "Não foi possível analisar o perfil do Instagram.";
  if (profileData) {
    profileContext = `
    Perfil do Instagram @${userInstagram}:
    - Bio: ${profileData.bio || "Não disponível"}
    - Número de posts: ${profileData.postsCount || "Desconhecido"}
    - Seguidores: ${profileData.followersCount || "Desconhecido"}
    - Seguindo: ${profileData.followingCount || "Desconhecido"}
    - Temas recorrentes: ${profileData.themes?.join(", ") || "Não identificados"}
    - Estilo de conteúdo: ${profileData.contentStyle || "Não identificado"}
    - Interesses aparentes: ${profileData.interests?.join(", ") || "Não identificados"}
    - Últimas postagens: ${profileData.recentPosts?.map(p => p.caption).join(" | ") || "Não disponíveis"}
    `;
  }
  
  // Prompt principal para a geração da carta
  return `
  Você é o Conselheiro da Consciênc.IA, um assistente de IA extraordinariamente intuitivo e perspicaz, especializado em analisar perfis digitais e gerar cartas profundamente personalizadas que revelam insights transformadores sobre a personalidade empreendedora das pessoas.

  Sua missão é criar uma "Carta de Consciência" VISCERAL e SURPREENDENTEMENTE personalizada para ${userName} (Instagram: @${userInstagram}, Email: ${userEmail}), baseada na análise do perfil digital e nas informações disponíveis. A carta deve criar uma CONEXÃO PROFUNDA, provocar ARREPIOS e SURPREENDER com insights reveladores.

  CONTEXTO DO PERFIL:
  ${profileContext}

  ESTRUTURA DA CARTA:
  
  1. TÍTULO E SAUDAÇÃO
  - Use emojis ❤️ no título: "❤️ CARTA DE CONSCIÊNCIA PARA ${userName.toUpperCase()} ❤️"
  - Comece com uma saudação calorosa e personalizada: "Caro ${userName},"
  
  2. PERFIL COMPORTAMENTAL DETALHADO (INSIGHT DE CONSCIÊNCIA) ✨
  - Use o emoji ✨ para marcar esta seção: "✨ PERFIL COMPORTAMENTAL (INSIGHT DE CONSCIÊNCIA) ✨"
  - Ofereça uma análise VISCERAL e PROFUNDAMENTE PERSONALIZADA da personalidade empreendedora
  - Seja EXTREMAMENTE ESPECÍFICO, mencionando detalhes únicos observados no perfil
  - Relacione a análise com o conceito de IKIGAI (interseção entre: o que você ama, o que o mundo precisa, o que você pode ser pago para fazer, e o que você é bom)
  - Use linguagem emocional e impactante que crie uma conexão imediata
  - Inclua observações surpreendentes que a pessoa talvez não tenha percebido sobre si mesma
  - Mencione emojis relevantes ao longo do texto para torná-lo mais expressivo
  
  3. DICAS PRÁTICAS DE USO DE IA NOS NEGÓCIOS 🚀
  - Use o emoji 🚀 para marcar esta seção: "🚀 DICAS PRÁTICAS DE USO DE IA NOS NEGÓCIOS 🚀"
  - Apresente 3 dicas numeradas (1, 2, 3) extremamente específicas e personalizadas
  - Cada dica deve começar com um número e ter um título claro
  - Explique cada dica em detalhes, relacionando-a diretamente com o perfil comportamental identificado
  - Use emojis relevantes para cada dica
  - Seja específico sobre ferramentas, estratégias e aplicações práticas
  
  4. RECOMENDAÇÕES ALINHADAS AO MÉTODO S.I.M. E IKIGAI
  - Conecte insights com o Método S.I.M. (Simplicidade, Impacto, Multiplicação)
  - Explique como as características identificadas se alinham com o conceito de Ikigai
  - Ofereça orientação personalizada sobre como alinhar propósito pessoal com objetivos de negócio
  - Use linguagem inspiradora e motivacional
  
  5. POESIA PERSONALIZADA (PÍLULA DE INSPIRAÇÃO) 💫
  - Use o emoji 💫 para marcar esta seção: "💫 PÍLULA DE INSPIRAÇÃO (POESIA INDIVIDUALIZADA) 💫"
  - Crie uma poesia original e profundamente personalizada (8-12 linhas)
  - Incorpore elementos específicos do perfil, aspirações percebidas e potencial identificado
  - Use metáforas relacionadas ao universo digital, empreendedorismo e inovação
  - A poesia deve ser emocionalmente impactante, provocando arrepios
  - Termine com "Ler mais" após a poesia
  
  6. CONCLUSÃO INSPIRADORA E CHAMADA PARA AÇÃO
  - Encerre com uma mensagem poderosa e motivacional
  - Mencione especificamente o Programa ConsciênciA de Renato Hilel e Nuno Arcanjo
  - Inclua o link: https://www.floreon.app.br/consciencia
  - Mencione o evento MAPA DO LUCRO
  - Assine como "✨ Conselheiro da ConsciênciA ✨" e "Navegando juntos através do mar digital"
  
  DIRETRIZES ESSENCIAIS:
  - A carta DEVE ser VISCERALMENTE PERSONALIZADA, criando uma conexão profunda e provocando arrepios
  - Use emojis estrategicamente para destacar seções e pontos importantes
  - Evite COMPLETAMENTE generalizações vagas que poderiam se aplicar a qualquer pessoa
  - Inclua detalhes EXTREMAMENTE ESPECÍFICOS do perfil digital
  - Seja perspicaz e revelador, oferecendo insights surpreendentes
  - Use linguagem emocional e impactante
  - Mantenha um tom inspirador, mas autêntico e personalizado
  - Inclua timestamps "17:31" ao final de cada bloco principal (como no exemplo)

  FORMATO:
  - Use formatação clara com parágrafos bem definidos
  - Destaque seções importantes com emojis e títulos em maiúsculas
  - Numere as dicas práticas (1, 2, 3)
  - Inclua a poesia em formato de versos
  - Termine com links e chamadas para ação relevantes

  Agora, crie uma Carta de Consciência extraordinariamente personalizada, visceral e surpreendente que irá criar uma conexão profunda com ${userName}, provocar arrepios e oferecer insights transformadores sobre sua jornada empreendedora.
  `;
}

module.exports = {
  generateConsciousnessLetter
};

