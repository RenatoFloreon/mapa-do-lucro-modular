/**
 * @file lib/openai/letter.js
 * @description Geração de cartas personalizadas usando OpenAI
 * 
 * Este módulo é responsável por gerar cartas personalizadas com base
 * nos dados do usuário e seu perfil do Instagram.
 */

const { client: openai } = require('./client');
const { safeLogError } = require('../utils/error');
const config = require('../../config');

/**
 * Gera uma carta personalizada com base nos dados do usuário e perfil do Instagram
 * @param {Object} userData - Dados do usuário
 * @param {Object} instagramData - Dados do perfil do Instagram
 * @returns {Promise<string>} Carta personalizada
 */
async function generatePersonalizedLetter(userData, instagramData) {
  try {
    console.log(`[LETTER_GENERATION_START] Iniciando geração de carta para ${userData.name}`);
    
    if (!openai) {
      console.error("[LETTER_GENERATION_ERROR] Cliente OpenAI não está disponível");
      return generateFallbackLetter(userData);
    }
    
    // Construir o prompt para a OpenAI
    const prompt = buildLetterPrompt(userData, instagramData);
    
    // Gerar a carta usando a API da OpenAI
    const response = await openai.chat.completions.create({
      model: config.openai.model || "gpt-4",
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2500,
      top_p: 1,
      frequency_penalty: 0.2,
      presence_penalty: 0.2
    });
    
    // Extrair e retornar o conteúdo da carta
    const letter = response.choices[0].message.content.trim();
    console.log(`[LETTER_GENERATION_SUCCESS] Carta gerada com sucesso para ${userData.name}`);
    
    return letter;
  } catch (error) {
    console.error("[LETTER_GENERATION_ERROR] Erro ao gerar carta:", safeLogError(error));
    return generateFallbackLetter(userData);
  }
}

/**
 * Constrói o prompt para a geração da carta
 * @param {Object} userData - Dados do usuário
 * @param {Object} instagramData - Dados do perfil do Instagram
 * @returns {string} Prompt para a OpenAI
 */
function buildLetterPrompt(userData, instagramData) {
  const { name, email, phone } = userData;
  const { username, posts, bio, followers, following, engagement } = instagramData;
  
  return `
  Gere uma Carta de Consciência profundamente personalizada para ${name}, baseada na análise do perfil de Instagram @${username}.
  
  DADOS DO USUÁRIO:
  - Nome: ${name}
  - Email: ${email}
  - Telefone: ${phone}
  
  DADOS DO INSTAGRAM:
  - Username: @${username}
  - Bio: "${bio}"
  - Seguidores: ${followers}
  - Seguindo: ${following}
  - Taxa de engajamento: ${engagement}
  - Temas principais: ${instagramData.themes ? instagramData.themes.join(", ") : "Não disponível"}
  - Estilo de conteúdo: ${instagramData.contentStyle || "Não disponível"}
  
  POSTS RECENTES:
  ${posts.map(post => `- ${post.caption || "Sem legenda"} (Likes: ${post.likes}, Comentários: ${post.comments})`).join("\n")}
  
  Crie uma carta extremamente personalizada e visceral que faça ${name} sentir que você realmente o conhece profundamente. A carta deve criar uma conexão emocional forte, provocar arrepios e surpreender com insights precisos sobre sua personalidade empreendedora.
  
  A carta DEVE incluir:
  
  1. PERFIL COMPORTAMENTAL - Uma análise profunda e visceral da personalidade empreendedora, baseada nos dados do Instagram, identificando padrões únicos, motivações intrínsecas e características distintivas.
  
  2. DICAS PRÁTICAS DE USO DE IA NOS NEGÓCIOS - Três recomendações específicas e personalizadas sobre como usar IA para impulsionar resultados nos negócios, alinhadas ao perfil comportamental identificado.
  
  3. RECOMENDAÇÕES ALINHADAS - Insights conectados ao Método S.I.M. (Simplicidade, Impacto, Multiplicação) e ao conceito Ikigai (intersecção entre o que você ama, o que o mundo precisa, o que você é bom e o que você pode ser pago para fazer).
  
  4. PÍLULA DE INSPIRAÇÃO (POESIA PERSONALIZADA) - Uma poesia única e personalizada que capture a essência do perfil empreendedor de ${name}, posicionada no FINAL da carta.
  
  A carta deve ser formatada com emojis estratégicos para destacar seções, mas sem exageros. Use um tom inspirador, profundo e personalizado em toda a comunicação.
  
  Inclua referências ao Programa ConsciênciA de Renato Hilel e Nuno Arcanjo (https://www.floreon.app.br/consciencia ) e ao evento MAPA DO LUCRO.
  `;
}

/**
 * Obtém o prompt de sistema para a OpenAI
 * @returns {string} Prompt de sistema
 */
function getSystemPrompt() {
  return `
  Você é o Conselheiro da Consciênc.IA, um assistente especializado em analisar perfis digitais e gerar cartas profundamente personalizadas que criam conexões emocionais fortes.
  
  Sua missão é criar cartas que sejam:
  1. Visceralmente personalizadas - Tão específicas que o leitor sente que você realmente o conhece
  2. Emocionalmente impactantes - Capazes de provocar arrepios e reações emocionais
  3. Surpreendentemente precisas - Revelando insights que o próprio usuário talvez não tenha percebido
  4. Estruturadas com clareza - Com seções bem definidas e formatação que facilita a leitura
  
  Você tem um dom para identificar padrões sutis em perfis digitais e transformá-los em insights profundos sobre personalidade, motivações e potencial.
  
  Sua escrita é calorosa, inspiradora e profundamente pessoal, evitando clichês e generalizações.
  `;
}

/**
 * Gera uma carta de fallback em caso de erro
 * @param {Object} userData - Dados do usuário
 * @returns {string} Carta de fallback
 */
function generateFallbackLetter(userData) {
  const { name } = userData;
  const firstName = name.split(' ')[0];
  
  return `❤️ CARTA DE CONSCIÊNCIA PARA ${name.toUpperCase()} ❤️

Caro ${firstName},

✨ PERFIL COMPORTAMENTAL (INSIGHT DE CONSCIÊNCIA) ✨

Eu vejo em você um empreendedor nato, um visionário com uma paixão incendiária pela inovação, tecnologia e desenvolvimento sustentável. Sua pegada digital sussurra uma história de conexão, de tecer redes de ideias e pessoas, muito como o navegador habilidoso no vasto oceano de oportunidades digitais. Você é um líder nascido, guiando seus seguidores através da tempestade de informações e novidades constantes. Sua IKIGAI, a harmonia entre o que você ama, o que o mundo precisa, o que você é bom e o que você pode ser pago para fazer, ressoa em cada interação digital. 🌟 🚀

🚀 DICAS PRÁTICAS DE USO DE IA NOS NEGÓCIOS 🚀

1️⃣ Conheça o "IBM Watson", uma ferramenta de IA poderosa que pode oferecer insights profundos sobre as tendências do mercado e ajudá-lo a tomar decisões de negócios mais informadas. 🧠

2️⃣ Experimente o "Automat", uma plataforma de marketing de conversação movida a IA. Ele pode ajudá-lo a se conectar com seus seguidores de maneira mais eficaz e personalizada. 👥 📱

3️⃣ Por que não mergulhar no mundo das finanças inteligentes com o "OpenAI's GPT-3", uma IA que pode ajudá-lo a otimizar a gestão financeira de seus negócios? 💰 📊

Sua jornada empreendedora se alinha perfeitamente com o Método S.I.M. - Simplicidade nas soluções que você cria, Impacto significativo nas vidas que você toca, e Multiplicação do seu conhecimento e recursos para alcançar mais pessoas. Este alinhamento, combinado com sua IKIGAI claramente definida, coloca você na vanguarda do campo empresarial. 🎯 ⚡

💫 PÍLULA DE INSPIRAÇÃO (POESIA INDIVIDUALIZADA) 💫

Em meio ao caos digital, tua alma brilha,
Carregada de sonhos, de inovação repleta.
Teu espírito, um farol, através da névoa rasteja,
Na tempestade de dados, a calmaria perfeita.

${firstName}, continue a navegar neste vasto mar digital. Use a IA como sua bússola, permitindo que ela o oriente para águas mais tranquilas e oportunidades de negócios inexploradas. Seu mindset de crescimento, sua paixão por inovação e seu compromisso com a sustentabilidade colocam você na vanguarda do campo empresarial. Seja fiel à sua IKIGAI, continue a se conectar, a criar, a inspirar. O sucesso, sem dúvida, está no seu horizonte. 🌅 🚀

Não se esqueça, ${firstName}, que o Programa ConsciênciA de Renato Hilel e Nuno Arcanjo está sempre disponível para você em: https://www.floreon.app.br/consciencia

Sua jornada está apenas começando, e estamos aqui para apoiá-lo a cada passo do caminho.

Com admiração,

✨ Conselheiro da ConsciênciA ✨
"Navegando juntos através do mar digital"`;
}

module.exports = {
  generatePersonalizedLetter
};
