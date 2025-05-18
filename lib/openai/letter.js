/**
 * @file lib/openai/letter.js
 * @description Geração da Carta de Consciência personalizada
 * 
 * Este módulo gerencia a geração da Carta de Consciência personalizada
 * com base nos dados do perfil do usuário, utilizando a API da OpenAI.
 */

const openai = require('./client');
const { safeLogError } = require('../utils/error');

/**
 * Gera uma Carta de Consciência personalizada com base nos dados do perfil
 * @param {Object} profileData - Dados do perfil do usuário
 * @param {string} userName - Nome do usuário
 * @returns {Promise<string>} - Carta de Consciência gerada
 */
async function generateConscienciaLetter(profileData, userName) {
  console.log(`[OPENAI_LETTER_GENERATION_ATTEMPT] Gerando Carta de Consciência para: ${userName}`);
  
  try {
    if (!openai) {
      console.error("[OPENAI_LETTER_GENERATION_ERROR] Cliente OpenAI não inicializado.");
      return "Não foi possível gerar sua Carta de Consciência personalizada. Por favor, tente novamente mais tarde.";
    }
    
    // Preparar dados enriquecidos para o prompt
    const imageAnalysis = profileData.profileImageAnalysis?.description || 'Não disponível';
    const contentThemes = profileData.contentThemes?.join(', ') || 'Não disponível';
    const googleInfo = profileData.additionalInfo?.googleSnippets?.join('\n') || 'Não disponível';
    const linkedinProfile = profileData.linkedProfiles?.linkedin || 'Não disponível';
    const hashtags = profileData.hashtags?.join(', ') || 'Não disponível';
    const websiteUrl = profileData.websiteUrl || 'Não disponível';
    const locationInfo = profileData.locationInfo || 'Não disponível';
    const fallbackAnalysis = profileData.fallbackAnalysis || '';
    
    // Preparar o prompt para a OpenAI
    const prompt = `
    Você é o Conselheiro da Consciênc.IA, um assistente virtual especial criado para o evento MAPA DO LUCRO.
    
    Sua tarefa é gerar uma "Carta de Consciência" profundamente personalizada e emocionalmente impactante para ${userName}, com base nos dados enriquecidos do perfil digital @${profileData.username}.
    
    DADOS DETALHADOS DO PERFIL:
    - Nome: ${profileData.fullName || userName}
    - Bio: "${profileData.bio || 'Não disponível'}"
    - Seguidores: ${profileData.followersCount || 'Não disponível'}
    - Número de posts: ${profileData.postsCount || 'Não disponível'}
    - Conta comercial: ${profileData.isBusinessAccount ? 'Sim' : 'Não'}
    - Categoria de negócio: ${profileData.businessCategory || 'Não disponível'}
    - Website: ${websiteUrl}
    - Localização: ${locationInfo}
    - Hashtags utilizadas: ${hashtags}
    - Temas de conteúdo identificados: ${contentThemes}
    - Análise da imagem de perfil: ${imageAnalysis}
    - Informações adicionais do Google: ${googleInfo}
    - Perfil do LinkedIn: ${linkedinProfile}
    ${fallbackAnalysis ? `- Análise alternativa: ${fallbackAnalysis}` : ''}
    
    A Carta de Consciência deve ter quatro seções, cada uma com formatação visual rica, emojis relevantes e linguagem emocionalmente impactante:
    
    1. ✨ PERFIL COMPORTAMENTAL (INSIGHT DE CONSCIÊNCIA) ✨
    Uma análise PROFUNDAMENTE personalizada do comportamento e "pegada digital" do participante. Identifique traços específicos de personalidade empreendedora, interesses e estilo de comunicação com base nos dados disponíveis. Seja respeitoso, mas surpreendentemente preciso, mencionando detalhes específicos que façam a pessoa pensar "como você sabe disso sobre mim?". Relacione com o conceito Ikigai (equilíbrio entre paixão, missão, vocação e profissão). Use emojis relevantes para destacar pontos-chave.
    
    2. 🚀 DICAS PRÁTICAS DE USO DE IA NOS NEGÓCIOS 🚀
    Ofereça 3 dicas extremamente específicas e sob medida de como esta pessoa pode alavancar Inteligência Artificial em seu negócio ou rotina profissional. Considere o ramo ou interesse detectado e mencione ferramentas reais e atuais de IA. Por exemplo, se for do setor de varejo, sugira ferramentas específicas de IA para análise de tendências; se for prestador de serviço, indique uso de IA para automação de marketing. Seja específico, prático e inovador. Use emojis para cada dica.
    
    3. 💫 PÍLULA DE INSPIRAÇÃO (POESIA INDIVIDUALIZADA) 💫
    Crie uma poesia verdadeiramente tocante e emocionante (6-8 linhas) para o participante. A poesia deve ser profundamente personalizada, baseada em valores que a pessoa transparece, nome ou significado da marca, cidade natal, etc. Use metáforas poderosas relacionadas ao contexto da pessoa. A poesia deve ter ritmo, rima e impacto emocional - algo que a pessoa queira compartilhar e guardar. Formate a poesia de forma visualmente atraente com emojis sutis.
    
    4. 🧭 RECOMENDAÇÕES ALINHADAS 🧭
    Conecte os insights do perfil e dicas de IA com os pilares do Método S.I.M. (ambiente, mindset, vendas, felicidade), com o conceito Ikigai e com o propósito do evento Mapa do Lucro. Dê recomendações motivacionais e estratégicas que reafirmem esses conceitos aplicados ao contexto específico do indivíduo. Seja inspirador e visionário, mostrando um caminho claro para o sucesso pessoal e profissional.
    
    FORMATAÇÃO e ESTILO:
    - Use emojis relevantes e estratégicos para destacar pontos importantes e criar impacto visual
    - Crie uma formatação visualmente atraente com espaçamento, negrito e itálico
    - Utilize uma linguagem emocionalmente rica, inspiradora e impactante
    - Seja extremamente específico e personalizado, evitando completamente generalizações
    - Mencione detalhes específicos do perfil que causem surpresa e reconhecimento
    - Escreva em português brasileiro, com expressões contemporâneas e naturais
    - Termine com uma assinatura personalizada e inspiradora
    
    CONCLUSÃO:
    Encerre a carta com uma mensagem inspiradora e um convite para conhecer o Programa Consciênc.IA de Renato Hilel e Nuno Arcanjo (visite: https://www.floreon.app.br/conscienc-ia), sugerindo também explorar o Método S.I.M. (https://metodosim.com.br) e visitar o Coworking Ikigai (https://www.coworkingikigai.com.br) para aprofundar esses conceitos.
    Assine como "✨ Conselheiro da Consciênc.IA ✨" com uma frase de efeito personalizada.
    `;
    
    // Gerar a carta usando a OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Gere uma Carta de Consciência personalizada que seja verdadeiramente impactante, específica e emocionante." }
      ],
      max_tokens: 2000,
      temperature: 0.8,
    });
    
    let letter = completion.choices[0].message.content;
    
    // Garantir substituição de links curtos pelo completo (se necessário)
    letter = letter.replace(/https:\/\/consciencia\.ia/g, "https://www.floreon.app.br/conscienc-ia");
    
    console.log(`[OPENAI_LETTER_GENERATION_SUCCESS] Carta gerada com sucesso para: ${userName}`);
    return letter;
  } catch (error) {
    console.error(`[OPENAI_LETTER_GENERATION_ERROR] Erro ao gerar carta para ${userName}:`, safeLogError(error));
    return "Não foi possível gerar sua Carta de Consciência personalizada. Por favor, tente novamente mais tarde.";
  }
}

module.exports = {
  generateConscienciaLetter
};
