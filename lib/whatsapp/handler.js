/**
 * @file lib/whatsapp/handler.js
 * @description Manipuladores de eventos do webhook do WhatsApp
 * 
 * Este módulo gerencia o processamento de mensagens recebidas via webhook do WhatsApp,
 * incluindo o controle de mensagens automáticas e o mecanismo de reset.
 */

const { getUserData, saveUserData, createNewUser, resetUserExperience } = require('../redis/state');
const { sendWhatsappMessage } = require('./sender');
const { generateConscienciaLetter } = require('../openai/letter');
const { generateConversationResponse } = require('../openai/conversation');
const { scrapeInstagramProfile } = require('../scraping/instagram');
const { addLeadToKommo } = require('../crm/kommo');
const { splitMessage, messageTemplates } = require('../utils/message');
const fs = require('fs');
const path = require('path');
const config = require('../../config');

/**
 * Comando especial para resetar a experiência do usuário
 * @type {string}
 */
const RESET_COMMAND = "!reset";

/**
 * Processa uma mensagem recebida via webhook do WhatsApp
 * @param {string} phoneNumber - Número de telefone do remetente
 * @param {string} messageText - Texto da mensagem recebida
 * @returns {Promise<void>}
 */
async function processIncomingMessage(phoneNumber, messageText) {
  console.log(`[WEBHOOK_MESSAGE_RECEIVED] Mensagem recebida de ${phoneNumber}: "${messageText}"`);
  
  // Verificar se é um comando de reset
  if (messageText.trim().toLowerCase() === RESET_COMMAND) {
    const resetData = await resetUserExperience(phoneNumber);
    await sendWhatsappMessage(phoneNumber, [messageTemplates.resetConfirmation()]);
    await sendWhatsappMessage(phoneNumber, [messageTemplates.welcome()]);
    return;
  }
  
  // Verificar se o usuário já existe no Redis
  let userData = await getUserData(phoneNumber);
  
  // Se o usuário não existe, criar novo registro
  if (!userData) {
    userData = createNewUser(phoneNumber);
    await sendWhatsappMessage(phoneNumber, [messageTemplates.welcome()]);
    await saveUserData(phoneNumber, userData);
    return;
  }
  
  // Processar a mensagem com base no estado atual do usuário
  switch (userData.state) {
    case "WELCOME":
      // Usuário enviou o nome
      userData.name = messageText.trim();
      userData.state = "ASK_EMAIL";
      userData.firstInteractionSent = true; // Marca que a primeira interação já foi enviada
      
      await sendWhatsappMessage(phoneNumber, [messageTemplates.askEmail(userData.name)]);
      break;
      
    case "ASK_EMAIL":
      // Usuário enviou o email
      if (messageText.toLowerCase() !== "pular") {
        userData.email = messageText.trim();
      }
      userData.state = "ASK_INSTAGRAM";
      
      await sendWhatsappMessage(phoneNumber, [messageTemplates.askInstagram()]);
      break;
      
    case "ASK_INSTAGRAM":
      // Usuário enviou o perfil do Instagram ou deseja pular
      const igInput = messageText.trim();
      if (igInput.toLowerCase() === "pular" || igInput.toLowerCase().includes("não tenho")) {
        // Usuário optou por não fornecer Instagram
        userData.instagram = null;
        userData.state = "GENERATING_LETTER";
        
        await sendWhatsappMessage(phoneNumber, [messageTemplates.generatingWithoutData()]);
        
        // Criar profileData mínimo e gerar carta
        const minimalProfile = { 
          username: "", 
          fullName: userData.name, 
          bio: "", 
          hashtags: [], 
          contentThemes: [], 
          profileImageAnalysis: {}, 
          additionalInfo: {}, 
          linkedProfiles: {} 
        };
        
        const letter = await generateConscienciaLetter(minimalProfile, userData.name);
        const letterBlocks = splitMessage(letter);
        await sendWhatsappMessage(phoneNumber, letterBlocks);
        await sendWhatsappMessage(phoneNumber, [messageTemplates.finalMessage()]);
        
        // Finalizar fluxo do usuário
        userData.state = "COMPLETED";
        userData.completed = true;
        userData.completionTime = Date.now();
        userData.letter = letter;
        userData.conversations = []; // nenhuma pergunta extra feita
        userData.questionsCount = 0;
        
        // Salvar lead em JSON temporário
        try {
          const leadsDir = path.join(process.cwd(), config.leads.directory);
          fs.mkdirSync(leadsDir, { recursive: true });
          const leadFile = path.join(leadsDir, `${userData.phone}.json`);
          const leadData = {
            name: userData.name,
            phone: userData.phone,
            email: userData.email || '',
            instagram: userData.instagram || '',
            startTime: userData.startTime,
            completionTime: userData.completionTime,
            questionsCount: 0,
            letter: userData.letter
          };
          fs.writeFileSync(leadFile, JSON.stringify(leadData, null, 2));
          
          // Remover leads antigos (TTL manual)
          const TTL_DAYS = config.leads.ttlDays;
          const now = Date.now();
          fs.readdirSync(leadsDir).forEach(file => {
            const filePath = path.join(leadsDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > TTL_DAYS * 24 * 60 * 60 * 1000) {
              fs.unlinkSync(filePath);
            }
          });
        } catch (err) {
          console.error("[LEADS_SAVE_ERROR] Erro ao salvar lead em JSON:", err);
        }
        
        // Integrar com Kommo CRM (se configurado)
        await addLeadToKommo(userData);
      } else {
        // Usuário forneceu Instagram - solicitar permissão para scraping
        userData.instagram = igInput.replace(/^@/, '');
        userData.state = "ASK_PERMISSION";
        
        await sendWhatsappMessage(phoneNumber, [messageTemplates.askPermission()]);
      }
      break;
      
    case "ASK_PERMISSION":
      // Usuário respondeu sobre permissão de uso de dados públicos
      const answer = messageText.trim().toLowerCase();
      userData.state = "GENERATING_LETTER";
      
      if (answer.startsWith("s")) {
        // Usuário autorizou scraping
        await sendWhatsappMessage(phoneNumber, [messageTemplates.generatingWithData()]);
        
        const profileData = await scrapeInstagramProfile(userData.instagram);
        const letter = await generateConscienciaLetter(profileData, userData.name);
        const letterBlocks = splitMessage(letter);
        
        await sendWhatsappMessage(phoneNumber, letterBlocks);
        await sendWhatsappMessage(phoneNumber, [messageTemplates.finalMessage()]);
        
        // Finalizar fluxo
        userData.state = "COMPLETED";
        userData.completed = true;
        userData.completionTime = Date.now();
        userData.letter = letter;
        userData.questionsCount = 0;
        if (!userData.conversations) userData.conversations = [];
        
        // Salvar lead em JSON
        try {
          const leadsDir = path.join(process.cwd(), config.leads.directory);
          fs.mkdirSync(leadsDir, { recursive: true });
          const leadFile = path.join(leadsDir, `${userData.phone}.json`);
          const leadData = {
            name: userData.name,
            phone: userData.phone,
            email: userData.email || '',
            instagram: userData.instagram || '',
            startTime: userData.startTime,
            completionTime: userData.completionTime,
            questionsCount: 0,
            letter: userData.letter
          };
          fs.writeFileSync(leadFile, JSON.stringify(leadData, null, 2));
          
          // Expirar leads antigos (TTL manual)
          const TTL_DAYS = config.leads.ttlDays;
          const now = Date.now();
          fs.readdirSync(leadsDir).forEach(file => {
            const filePath = path.join(leadsDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > TTL_DAYS * 24 * 60 * 60 * 1000) {
              fs.unlinkSync(filePath);
            }
          });
        } catch (err) {
          console.error("[LEADS_SAVE_ERROR] Erro ao salvar lead em JSON:", err);
        }
        
        await addLeadToKommo(userData);
      } else {
        // Usuário NÃO autorizou scraping
        await sendWhatsappMessage(phoneNumber, [messageTemplates.generatingWithoutData()]);
        
        // Gerar carta com dados mínimos
        const minimalProfile = { 
          username: userData.instagram,
          fullName: userData.name, 
          bio: "", 
          hashtags: [], 
          contentThemes: [], 
          profileImageAnalysis: {}, 
          additionalInfo: {}, 
          linkedProfiles: {} 
        };
        
        const letter = await generateConscienciaLetter(minimalProfile, userData.name);
        const letterBlocks = splitMessage(letter);
        
        await sendWhatsappMessage(phoneNumber, letterBlocks);
        await sendWhatsappMessage(phoneNumber, [messageTemplates.finalMessage()]);
        
        // Finalizar fluxo
        userData.state = "COMPLETED";
        userData.completed = true;
        userData.completionTime = Date.now();
        userData.letter = letter;
        userData.questionsCount = 0;
        if (!userData.conversations) userData.conversations = [];
        
        // Salvar lead em JSON
        try {
          const leadsDir = path.join(process.cwd(), config.leads.directory);
          fs.mkdirSync(leadsDir, { recursive: true });
          const leadFile = path.join(leadsDir, `${userData.phone}.json`);
          const leadData = {
            name: userData.name,
            phone: userData.phone,
            email: userData.email || '',
            instagram: userData.instagram || '',
            startTime: userData.startTime,
            completionTime: userData.completionTime,
            questionsCount: 0,
            letter: userData.letter
          };
          fs.writeFileSync(leadFile, JSON.stringify(leadData, null, 2));
          
          // Limpeza de arquivos antigos
          const TTL_DAYS = config.leads.ttlDays;
          const now = Date.now();
          fs.readdirSync(leadsDir).forEach(file => {
            const filePath = path.join(leadsDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > TTL_DAYS * 24 * 60 * 60 * 1000) {
              fs.unlinkSync(filePath);
            }
          });
        } catch (err) {
          console.error("[LEADS_SAVE_ERROR] Erro ao salvar lead em JSON:", err);
        }
        
        await addLeadToKommo(userData);
      }
      break;
      
    case "COMPLETED":
      // Usuário já completou o fluxo e está fazendo perguntas adicionais
      if (!userData.conversations) {
        userData.conversations = [];
      }
      
      userData.conversations.push({
        timestamp: Date.now(),
        userMessage: messageText
      });
      
      // Mostrar mensagem de processamento apenas na primeira pergunta após a carta
      // e apenas se não for uma mensagem curta sem interrogação
      if (userData.conversations.length === 1) {
        const msgLower = messageText.toLowerCase();
        if (messageText.length > 50 || msgLower.includes("?")) {
          await sendWhatsappMessage(phoneNumber, [messageTemplates.processingQuestion(userData.name)]);
        }
      }
      
      try {
        // Gerar resposta personalizada usando OpenAI
        const response = await generateConversationResponse(userData.name, userData.instagram, messageText);
        
        // Registrar a resposta do assistente
        userData.conversations[userData.conversations.length - 1].assistantResponse = response;
        userData.questionsCount = (userData.questionsCount || 0) + 1;
        
        // Enviar a resposta para o usuário
        await sendWhatsappMessage(phoneNumber, [response]);
      } catch (error) {
        console.error(`[OPENAI_CONVERSATION_ERROR] Erro ao gerar resposta para ${userData.name}:`, error);
        await sendWhatsappMessage(phoneNumber, [messageTemplates.errorMessage(userData.name)]);
      }
      break;
      
    default:
      // Estado desconhecido: resetar para o início
      userData = await resetUserExperience(phoneNumber);
      
      await sendWhatsappMessage(phoneNumber, [`Desculpe, ocorreu um erro no processamento. Vamos recomeçar.

Por favor, me diga seu nome completo:`]);
      break;
  }
  
  // Salvar dados atualizados do usuário no Redis
  await saveUserData(phoneNumber, userData);
}

module.exports = {
  processIncomingMessage
};
