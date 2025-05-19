/**
 * @file lib/whatsapp/handler-no-redis.js
 * @description Manipulador de mensagens do WhatsApp sem dependência do Redis
 * 
 * Este módulo gerencia o processamento de mensagens recebidas do WhatsApp,
 * usando armazenamento em memória em vez de Redis.
 */

// Importação corrigida do sender.js
const sender = require('./sender');
const { generateConsciousnessLetter } = require('../openai/conversation');
const { getInstagramProfileData } = require('../scraping/instagram');
const state = require('../redis/mock-state');
const { safeLogError } = require('../utils/error');
const { formatMessage } = require('../utils/message');
const config = require('../../config');

// Função auxiliar para enviar mensagens WhatsApp
async function sendWhatsAppMessage(phoneNumber, message) {
  return sender.sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Processa mensagem recebida do WhatsApp
 * @param {string} userPhoneNumber - Número de telefone do usuário
 * @param {string} messageText - Texto da mensagem recebida
 * @returns {Promise<void>}
 */
async function processIncomingMessage(userPhoneNumber, messageText) {
  try {
    console.log(`[WHATSAPP_HANDLER] Processando mensagem de ${userPhoneNumber}: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`);
    
    // Verificar comandos especiais
    if (messageText.toLowerCase().includes('reset') || messageText.toLowerCase().includes('reiniciar')) {
      await handleResetCommand(userPhoneNumber);
      return;
    }
    
    // Obter estado atual do usuário
    const userState = await state.getUserData(userPhoneNumber);
    console.log(`[WHATSAPP_HANDLER] Estado atual do usuário ${userPhoneNumber}:`, JSON.stringify(userState));
    
    // Determinar a etapa atual do fluxo
    if (!userState || !userState.state || userState.state === 'NEW' || userState.state === 'WELCOME') {
      await handleNewUser(userPhoneNumber, messageText);
    } else if (userState.state === 'AWAITING_NAME') {
      await handleNameCollection(userPhoneNumber, messageText, userState);
    } else if (userState.state === 'AWAITING_EMAIL') {
      await handleEmailCollection(userPhoneNumber, messageText, userState);
    } else if (userState.state === 'AWAITING_INSTAGRAM') {
      await handleInstagramCollection(userPhoneNumber, messageText, userState);
    } else if (userState.state === 'GENERATING_LETTER') {
      await sendWhatsAppMessage(userPhoneNumber, "Estou trabalhando na sua Carta de Consciência personalizada. Por favor, aguarde mais um pouco...");
    } else if (userState.state === 'COMPLETED') {
      await handlePostLetterInteraction(userPhoneNumber, messageText, userState);
    } else {
      console.error(`[WHATSAPP_HANDLER_ERROR] Estado desconhecido para ${userPhoneNumber}: ${userState.state}`);
      await sendWhatsAppMessage(userPhoneNumber, "Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, envie 'reset' para reiniciar a experiência.");
    }
  } catch (error) {
    console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao processar mensagem de ${userPhoneNumber}:`, safeLogError(error));
    
    try {
      await sendWhatsAppMessage(userPhoneNumber, "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente ou envie 'reset' para reiniciar a experiência.");
    } catch (sendError) {
      console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao enviar mensagem de erro para ${userPhoneNumber}:`, safeLogError(sendError));
    }
  }
}

/**
 * Manipula comando de reset
 * @param {string} userPhoneNumber - Número de telefone do usuário
 * @returns {Promise<void>}
 */
async function handleResetCommand(userPhoneNumber) {
  try {
    console.log(`[WHATSAPP_HANDLER] Processando comando de reset para ${userPhoneNumber}`);
    
    // Obter estado atual para incrementar contador de resets
    const currentState = await state.getUserData(userPhoneNumber);
    const resetCount = (currentState?.resetCount || 0) + 1;
    
    // Resetar estado do usuário
    await state.resetUserExperience(userPhoneNumber);
    
    // Enviar mensagem de confirmação
    await sendWhatsAppMessage(userPhoneNumber, "Sua experiência foi reiniciada com sucesso! Vamos começar novamente.\n\nBem-vindo ao Conselheiro da Consciênc.IA! 🧠✨\n\nEstou aqui para analisar seu perfil digital e gerar uma carta personalizada com insights profundos sobre sua personalidade empreendedora.\n\nPara começar, por favor me diga seu nome completo:");
    
    console.log(`[WHATSAPP_HANDLER] Reset concluído para ${userPhoneNumber}`);
  } catch (error) {
    console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao processar reset para ${userPhoneNumber}:`, safeLogError(error));
    throw error;
  }
}

/**
 * Manipula interação com novo usuário
 * @param {string} userPhoneNumber - Número de telefone do usuário
 * @param {string} messageText - Texto da mensagem recebida
 * @returns {Promise<void>}
 */
async function handleNewUser(userPhoneNumber, messageText) {
  try {
    console.log(`[WHATSAPP_HANDLER] Processando novo usuário ${userPhoneNumber}`);
    
    // Inicializar estado do usuário
    await state.saveUserData(userPhoneNumber, {
      phone: userPhoneNumber,
      state: 'AWAITING_NAME',
      startTime: new Date().toISOString(),
      firstInteractionSent: true
    });
    
    // Enviar mensagem de boas-vindas
    await sendWhatsAppMessage(userPhoneNumber, "Bem-vindo ao Conselheiro da Consciênc.IA! 🧠✨\n\nEstou aqui para analisar seu perfil digital e gerar uma carta personalizada com insights profundos sobre sua personalidade empreendedora.\n\nPara começar, por favor me diga seu nome completo:");
    
    console.log(`[WHATSAPP_HANDLER] Mensagem de boas-vindas enviada para ${userPhoneNumber}`);
  } catch (error) {
    console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao processar novo usuário ${userPhoneNumber}:`, safeLogError(error));
    throw error;
  }
}

/**
 * Manipula coleta de nome do usuário
 * @param {string} userPhoneNumber - Número de telefone do usuário
 * @param {string} messageText - Texto da mensagem recebida
 * @param {Object} userState - Estado atual do usuário
 * @returns {Promise<void>}
 */
async function handleNameCollection(userPhoneNumber, messageText, userState) {
  try {
    console.log(`[WHATSAPP_HANDLER] Coletando nome para ${userPhoneNumber}`);
    
    // Validar nome
    const name = messageText.trim();
    if (name.length < 2) {
      await sendWhatsAppMessage(userPhoneNumber, "Por favor, forneça seu nome completo para que eu possa personalizar sua experiência:");
      return;
    }
    
    // Atualizar estado do usuário
    await state.saveUserData(userPhoneNumber, {
      ...userState,
      name: name,
      state: 'AWAITING_EMAIL'
    });
    
    // Solicitar e-mail
    await sendWhatsAppMessage(userPhoneNumber, `Obrigado, ${name.split(' ')[0]}! 😊\n\nAgora, por favor, me informe seu e-mail para que possamos enviar sua Carta de Consciência personalizada:`);
    
    console.log(`[WHATSAPP_HANDLER] Nome coletado para ${userPhoneNumber}: ${name}`);
  } catch (error) {
    console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao coletar nome para ${userPhoneNumber}:`, safeLogError(error));
    throw error;
  }
}

/**
 * Manipula coleta de e-mail do usuário
 * @param {string} userPhoneNumber - Número de telefone do usuário
 * @param {string} messageText - Texto da mensagem recebida
 * @param {Object} userState - Estado atual do usuário
 * @returns {Promise<void>}
 */
async function handleEmailCollection(userPhoneNumber, messageText, userState) {
  try {
    console.log(`[WHATSAPP_HANDLER] Coletando e-mail para ${userPhoneNumber}`);
    
    // Validar e-mail
    const email = messageText.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      await sendWhatsAppMessage(userPhoneNumber, "O e-mail fornecido parece inválido. Por favor, forneça um endereço de e-mail válido:");
      return;
    }
    
    // Atualizar estado do usuário
    await state.saveUserData(userPhoneNumber, {
      ...userState,
      email: email,
      state: 'AWAITING_INSTAGRAM'
    });
    
    // Solicitar Instagram
    await sendWhatsAppMessage(userPhoneNumber, "Perfeito! 👍\n\nAgora, para que eu possa analisar seu perfil digital e criar uma carta verdadeiramente personalizada, por favor me informe seu nome de usuário do Instagram (sem o @):\n\nExemplo: consciencia.ia");
    
    console.log(`[WHATSAPP_HANDLER] E-mail coletado para ${userPhoneNumber}: ${email}`);
  } catch (error) {
    console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao coletar e-mail para ${userPhoneNumber}:`, safeLogError(error));
    throw error;
  }
}

/**
 * Manipula coleta de Instagram do usuário
 * @param {string} userPhoneNumber - Número de telefone do usuário
 * @param {string} messageText - Texto da mensagem recebida
 * @param {Object} userState - Estado atual do usuário
 * @returns {Promise<void>}
 */
async function handleInstagramCollection(userPhoneNumber, messageText, userState) {
  try {
    console.log(`[WHATSAPP_HANDLER] Coletando Instagram para ${userPhoneNumber}`);
    
    // Limpar nome de usuário do Instagram (remover @ se presente)
    let instagram = messageText.trim().toLowerCase();
    if (instagram.startsWith('@')) {
      instagram = instagram.substring(1);
    }
    
    // Validar Instagram
    if (instagram.length < 1) {
      await sendWhatsAppMessage(userPhoneNumber, "Por favor, forneça seu nome de usuário do Instagram para que eu possa analisar seu perfil digital:");
      return;
    }
    
    // Atualizar estado do usuário
    await state.saveUserData(userPhoneNumber, {
      ...userState,
      instagram: instagram,
      state: 'GENERATING_LETTER'
    });
    
    // Informar que a carta está sendo gerada
    await sendWhatsAppMessage(userPhoneNumber, `Obrigado! 🙏\n\nAgora vou analisar seu perfil do Instagram @${instagram} e gerar sua Carta de Consciência personalizada.\n\nEste processo pode levar alguns minutos. Por favor, aguarde enquanto trabalho na sua carta...`);
    
    console.log(`[WHATSAPP_HANDLER] Instagram coletado para ${userPhoneNumber}: ${instagram}`);
    
    // Iniciar geração da carta de forma assíncrona
    generateAndSendLetter(userPhoneNumber, userState.name, instagram, userState.email).catch(error => {
      console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao gerar carta para ${userPhoneNumber}:`, safeLogError(error));
    });
  } catch (error) {
    console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao coletar Instagram para ${userPhoneNumber}:`, safeLogError(error));
    throw error;
  }
}

/**
 * Gera e envia a Carta de Consciência
 * @param {string} userPhoneNumber - Número de telefone do usuário
 * @param {string} name - Nome do usuário
 * @param {string} instagram - Instagram do usuário
 * @param {string} email - E-mail do usuário
 * @returns {Promise<void>}
 */
async function generateAndSendLetter(userPhoneNumber, name, instagram, email) {
  try {
    console.log(`[WHATSAPP_HANDLER] Iniciando geração de carta para ${userPhoneNumber}`);
    
    // Obter dados do Instagram
    let profileData = null;
    try {
      profileData = await getInstagramProfileData(instagram);
      console.log(`[WHATSAPP_HANDLER] Dados do Instagram obtidos para ${userPhoneNumber}`);
    } catch (error) {
      console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao obter dados do Instagram para ${userPhoneNumber}:`, safeLogError(error));
      // Continuar mesmo sem dados do Instagram
    }
    
    // Gerar a carta
    const userData = {
      phone: userPhoneNumber,
      name: name,
      instagram: instagram,
      email: email,
      profileData: profileData
    };
    
    console.log(`[WHATSAPP_HANDLER] Gerando carta para ${userPhoneNumber}`);
    const letter = await generateConsciousnessLetter(userData);
    console.log(`[WHATSAPP_HANDLER] Carta gerada para ${userPhoneNumber} (${letter.length} caracteres)`);
    
    // Atualizar estado do usuário
    await state.saveUserData(userPhoneNumber, {
      phone: userPhoneNumber,
      name: name,
      instagram: instagram,
      email: email,
      state: 'COMPLETED',
      letter: letter,
      completionTime: new Date().toISOString(),
      questionsCount: 0
    });
    
    // Dividir e enviar a carta em partes se necessário
    const messageParts = formatMessage(letter);
    
    for (let i = 0; i < messageParts.length; i++) {
      await sendWhatsAppMessage(userPhoneNumber, messageParts[i]);
      
      // Pequeno delay entre mensagens para evitar problemas de ordem
      if (i < messageParts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Enviar mensagem final após a carta
    await sendWhatsAppMessage(userPhoneNumber, "Espero que tenha gostado da sua Carta de Consciência personalizada! ✨\n\nSe tiver alguma pergunta ou quiser saber mais sobre como a IA pode transformar seu negócio e sua vida, é só me perguntar.\n\nAproveite o evento MAPA DO LUCRO e não deixe de conversar pessoalmente com os criadores do programa! 🚀");
    
    console.log(`[WHATSAPP_HANDLER] Carta enviada com sucesso para ${userPhoneNumber}`);
  } catch (error) {
    console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao gerar e enviar carta para ${userPhoneNumber}:`, safeLogError(error));
    
    // Notificar usuário sobre o erro
    try {
      await sendWhatsAppMessage(userPhoneNumber, "Desculpe, ocorreu um erro ao gerar sua Carta de Consciência. Por favor, envie 'reset' para tentar novamente.");
      
      // Atualizar estado para permitir nova tentativa
      await state.saveUserData(userPhoneNumber, {
        phone: userPhoneNumber,
        name: name,
        instagram: instagram,
        email: email,
        state: 'ERROR',
        error: error.message
      });
    } catch (sendError) {
      console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao enviar mensagem de erro para ${userPhoneNumber}:`, safeLogError(sendError));
    }
  }
}

/**
 * Manipula interações após o envio da carta
 * @param {string} userPhoneNumber - Número de telefone do usuário
 * @param {string} messageText - Texto da mensagem recebida
 * @param {Object} userState - Estado atual do usuário
 * @returns {Promise<void>}
 */
async function handlePostLetterInteraction(userPhoneNumber, messageText, userState) {
  try {
    console.log(`[WHATSAPP_HANDLER] Processando interação pós-carta para ${userPhoneNumber}`);
    
    // Incrementar contador de perguntas
    const questionsCount = (userState.questionsCount || 0) + 1;
    
    // Registrar a conversa
    const conversations = userState.conversations || [];
    conversations.push({
      timestamp: new Date().toISOString(),
      userMessage: messageText
    });
    
    // Atualizar estado do usuário
    await state.saveUserData(userPhoneNumber, {
      ...userState,
      questionsCount: questionsCount,
      conversations: conversations
    });
    
    // Responder à pergunta
    await sendWhatsAppMessage(userPhoneNumber, "Obrigado por sua mensagem! Durante o evento MAPA DO LUCRO, estou focado em gerar Cartas de Consciência personalizadas.\n\nPara saber mais sobre como a IA pode transformar seu negócio, converse pessoalmente com os criadores do programa no evento!\n\nSe quiser gerar uma nova carta, envie 'reset' para reiniciar a experiência.");
    
    console.log(`[WHATSAPP_HANDLER] Resposta pós-carta enviada para ${userPhoneNumber}`);
  } catch (error) {
    console.error(`[WHATSAPP_HANDLER_ERROR] Erro ao processar interação pós-carta para ${userPhoneNumber}:`, safeLogError(error));
    throw error;
  }
}

module.exports = {
  processIncomingMessage
};
