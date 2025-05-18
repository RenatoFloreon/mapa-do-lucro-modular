/**
 * @file routes/webhook.js
 * @description Rotas para o webhook do WhatsApp
 * 
 * Este módulo gerencia as rotas para o webhook do WhatsApp,
 * incluindo verificação e processamento de mensagens.
 */

const express = require('express');
const router = express.Router();
const config = require('../config');
const { processIncomingMessage } = require('../lib/whatsapp/handler');
const { safeLogError } = require('../lib/utils/error');

/**
 * Rota GET para verificação do webhook pelo WhatsApp
 * Esta rota é chamada pelo WhatsApp para verificar a validade do webhook
 */
router.get('/', (req, res) => {
  console.log("[WEBHOOK_VERIFICATION_HANDLER_START]", req.method, req.url, "Verificação de webhook recebida.");
  
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  
  if (mode && token) {
    if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
      console.log("[WEBHOOK_VERIFIED] Webhook verificado com sucesso!");
      return res.status(200).send(challenge);
    } else {
      console.error("[WEBHOOK_VERIFICATION_FAILED] Falha na verificação do webhook. Modo ou token inválidos.");
      return res.sendStatus(403);
    }
  }
  
  console.error("[WEBHOOK_VERIFICATION_MISSING_PARAMS] Parâmetros 'hub.mode' ou 'hub.verify_token' ausentes.");
  res.sendStatus(400);
});

/**
 * Rota POST para receber mensagens do WhatsApp
 * Esta rota processa as mensagens recebidas e as encaminha para o handler apropriado
 */
router.post('/', async (req, res) => {
  console.log("[WEBHOOK_HANDLER_START] Webhook recebido.");
  
  try {
    const body = req.body;
    
    if (!body || body.object !== "whatsapp_business_account") {
      console.error("[WEBHOOK_INVALID_REQUEST] Requisição inválida:", JSON.stringify(body));
      return res.sendStatus(400);
    }
    
    if (!body.entry || !body.entry.length) {
      console.error("[WEBHOOK_NO_ENTRIES] Nenhuma entrada encontrada na requisição:", JSON.stringify(body));
      return res.sendStatus(400);
    }
    
    console.log("[WEBHOOK_BODY] Corpo completo da solicitação (primeiros 500 caracteres):", JSON.stringify(body).substring(0, 500));
    
    // Responder imediatamente para evitar timeout do webhook
    res.sendStatus(200);
    
    // Processar as mensagens de forma assíncrona
    for (const entry of body.entry) {
      if (!entry.changes || !entry.changes.length) continue;
      
      for (const change of entry.changes) {
        if (!change.value || !change.value.messages || !change.value.messages.length) continue;
        
        for (const message of change.value.messages) {
          if (message.type !== "text" || !message.from) continue;
          
          const userPhoneNumber = message.from;
          const messageText = message.text.body;
          
          // Processar a mensagem de forma assíncrona
          processIncomingMessage(userPhoneNumber, messageText).catch(error => {
            console.error(`[WEBHOOK_PROCESS_ERROR] Erro ao processar mensagem de ${userPhoneNumber}:`, safeLogError(error));
          });
        }
      }
    }
  } catch (error) {
    console.error("[WEBHOOK_ERROR] Erro ao processar webhook:", safeLogError(error));
    
    // Se ainda não enviamos uma resposta, enviar 500
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
});

module.exports = router;
