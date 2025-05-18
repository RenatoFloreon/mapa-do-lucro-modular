/**
 * @file lib/whatsapp/sender.js
 * @description Funções para enviar mensagens via WhatsApp API
 * 
 * Este módulo gerencia o envio de mensagens via WhatsApp API,
 * incluindo tratamento de erros e tentativas de reenvio.
 */

const fetch = require('node-fetch');
const config = require('../../config');
const { safeLogError } = require('../utils/error');
const { splitMessage } = require('../utils/message');

/**
 * Envia mensagens para o WhatsApp
 * @param {string} phoneNumber - Número de telefone do destinatário
 * @param {string[]} messageBlocks - Blocos de mensagem a serem enviados
 * @param {number} attempt - Número da tentativa atual (para retry)
 * @param {number} maxAttempts - Número máximo de tentativas
 * @returns {Promise<void>}
 */
async function sendWhatsappMessage(phoneNumber, messageBlocks, attempt = 1, maxAttempts = 2) {
  if (!config.whatsapp.token || !config.whatsapp.phoneId) {
    console.error("[WHATSAPP_SEND_ERROR] WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID não definidos. Não é possível enviar mensagem.");
    return;
  }
  
  // Garantir que messageBlocks seja um array
  if (typeof messageBlocks === 'string') {
    messageBlocks = splitMessage(messageBlocks);
  }
  
  for (let i = 0; i < messageBlocks.length; i++) {
    const messageData = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      text: { body: messageBlocks[i] },
    };
    
    const chunkInfo = `Bloco ${i + 1}/${messageBlocks.length}`;
    console.log(`[WHATSAPP_SEND_ATTEMPT] [${phoneNumber}] Enviando ${chunkInfo}: "${messageBlocks[i].substring(0,50)}..."`);
    
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${config.whatsapp.phoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.whatsapp.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
        timeout: config.whatsapp.fetchTimeoutMs,
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`[WHATSAPP_SEND_ERROR] [${phoneNumber}] Erro ao enviar ${chunkInfo}. Status: ${response.status} ${response.statusText}. Resposta: ${responseText}`);
        continue;
      }
      
      console.log(`[WHATSAPP_SEND_SUCCESS] [${phoneNumber}] ${chunkInfo} enviado. Status: ${response.status}. Resposta: ${responseText}`);
    } catch (error) {
      console.error(`[WHATSAPP_SEND_ERROR] [${phoneNumber}] Erro de rede ao enviar ${chunkInfo}:`, safeLogError(error, { chunk_info: chunkInfo }));
      
      if (attempt < maxAttempts && (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' || error.code === 'ECONNRESET')) {
        console.log(`[WHATSAPP_SEND_RETRY] [${phoneNumber}] Tentando novamente (${attempt + 1}/${maxAttempts}) para ${chunkInfo} em 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sendWhatsappMessage(phoneNumber, [messageBlocks[i]], attempt + 1, maxAttempts);
      } else {
        console.error(`[WHATSAPP_SEND_FAIL] [${phoneNumber}] Falha final ao enviar ${chunkInfo} após ${attempt} tentativas.`);
      }
    }
    
    // Pequeno intervalo entre mensagens para evitar rate limiting
    if (i < messageBlocks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 700));
    }
  }
}

module.exports = {
  sendWhatsappMessage
};
