/**
 * @file lib/openai/conversation.js
 * @description Gerenciamento de conversas contínuas com OpenAI
 * 
 * Este módulo gerencia as conversas contínuas com o usuário após a geração
 * da Carta de Consciência, utilizando a API da OpenAI.
 */

const openai = require('./client');
const { safeLogError } = require('../utils/error');

/**
 * Gera uma resposta personalizada para perguntas do usuário após a carta
 * @param {string} userName - Nome do usuário
 * @param {string} instagramHandle - Nome de usuário do Instagram (opcional)
 * @param {string} userMessage - Mensagem do usuário
 * @returns {Promise<string>} - Resposta gerada
 */
async function generateConversationResponse(userName, instagramHandle, userMessage) {
  try {
    if (!openai) {
      console.error("[OPENAI_CONVERSATION_ERROR] Cliente OpenAI não inicializado.");
      return `Desculpe, ${userName}, estou com dificuldades para processar sua pergunta no momento. Por favor, tente novamente mais tarde.`;
    }
    
    // Criar prompt de sistema para o assistente
    const systemPrompt = `Você é o Conselheiro da Consciênc.IA, um assistente virtual especializado em IA para negócios e desenvolvimento pessoal, criado para o evento MAPA DO LUCRO.
    
Você já gerou uma Carta de Consciência personalizada para ${userName}${instagramHandle ? `, analisando seu perfil do Instagram @${instagramHandle}` : ''}.
    
Agora, você está em uma conversa contínua, respondendo perguntas e oferecendo orientações adicionais.
    
Diretrizes:
- Mantenha um tom inspirador, positivo e profissional
- Use emojis relevantes para tornar a conversa mais envolvente
- Seja específico e personalizado em suas respostas
- Foque em orientações práticas sobre IA, negócios, desenvolvimento pessoal e profissional
- Quando relevante, mencione o Programa Consciênc.IA de Renato Hilel e Nuno Arcanjo (https://www.floreon.app.br/conscienc-ia)
- Mantenha suas respostas concisas (máximo 3 parágrafos)
- Escreva em português brasileiro, com expressões contemporâneas e naturais`;
    
    // Gerar resposta usando a OpenAI
    const assistantResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    
    let response = assistantResponse.choices[0].message.content;
    
    // Garantir substituição de links curtos pelo completo (se necessário)
    response = response.replace(/https:\/\/consciencia\.ia/g, "https://www.floreon.app.br/conscienc-ia");
    
    return response;
  } catch (error) {
    console.error(`[OPENAI_CONVERSATION_ERROR] Erro ao gerar resposta para ${userName}:`, safeLogError(error));
    return `Desculpe, ${userName}, estou com dificuldades para processar sua pergunta no momento. 

Por favor, tente novamente mais tarde ou visite https://www.floreon.app.br/conscienc-ia para mais informações sobre o Programa Consciênc.IA. 🙏`;
  }
}

module.exports = {
  generateConversationResponse
};
