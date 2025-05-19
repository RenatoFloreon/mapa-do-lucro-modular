/**
 * @file lib/whatsapp/sender.js
 * @description Módulo para envio de mensagens para a API do WhatsApp
 * 
 * Este módulo gerencia o envio de mensagens para a API do WhatsApp,
 * incluindo tratamento de erros e estratégia de retry.
 */

const fetch = require('node-fetch');
const config = require('../../config');
const { safeLogError } = require('../utils/error');

// Configurações para retry
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 segundo

/**
 * Envia uma mensagem para a API do WhatsApp com estratégia de retry
 * @param {string} phoneNumber - Número de telefone do destinatário
 * @param {Object} message - Objeto de mensagem no formato da API do WhatsApp
 * @returns {Promise<Object>} - Resposta da API
 */
async function sendWhatsAppMessage(phoneNumber, message) {
  const url = `https://graph.facebook.com/v19.0/${config.whatsapp.phoneId}/messages`;
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneNumber,
    ...message
  };

  let retries = 0;
  let lastError = null;

  while (retries < MAX_RETRIES) {
    try {
      console.log(`[WHATSAPP_SEND_ATTEMPT] Tentativa ${retries + 1}/${MAX_RETRIES} de enviar mensagem para ${phoneNumber}`);
      
      // Aumentar o timeout para 30 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.whatsapp.token}`
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API respondeu com status ${response.status}: ${JSON.stringify(errorData)}`);
      }
      
      const responseData = await response.json();
      console.log(`[WHATSAPP_SEND_SUCCESS] Mensagem enviada com sucesso para ${phoneNumber}`);
      return responseData;
    } catch (error) {
      lastError = error;
      retries++;
      
      if (retries < MAX_RETRIES) {
        // Backoff exponencial
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retries - 1);
        console.log(`[WHATSAPP_SEND_RETRY] Erro ao enviar mensagem: ${error.message}. Tentando novamente em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`[WHATSAPP_SEND_FAIL] Falha fatal ao enviar mensagem após ${MAX_RETRIES} tentativas:`, safeLogError(error));
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * Envia uma mensagem de texto simples
 * @param {string} phoneNumber - Número de telefone do destinatário
 * @param {string} text - Texto da mensagem
 * @returns {Promise<Object>} - Resposta da API
 */
async function sendTextMessage(phoneNumber, text) {
  return sendWhatsAppMessage(phoneNumber, {
    type: 'text',
    text: { body: text }
  });
}

/**
 * Envia uma mensagem de template
 * @param {string} phoneNumber - Número de telefone do destinatário
 * @param {string} templateName - Nome do template
 * @param {string} language - Código de idioma (ex: pt_BR)
 * @param {Array} components - Componentes do template (opcional)
 * @returns {Promise<Object>} - Resposta da API
 */
async function sendTemplateMessage(phoneNumber, templateName, language = 'pt_BR', components = []) {
  return sendWhatsAppMessage(phoneNumber, {
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components
    }
  });
}

module.exports = {
  sendWhatsAppMessage,
  sendTextMessage,
  sendTemplateMessage
};
