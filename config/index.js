/**
 * @file config/index.js
 * @description Configurações centralizadas da aplicação Mapa do Lucro
 * 
 * Este módulo centraliza todas as configurações e variáveis de ambiente da aplicação,
 * facilitando a manutenção e evitando duplicação de código.
 */

require('dotenv').config();

module.exports = {
  // Configurações do servidor
  port: process.env.PORT || 3000,
  
  // Configurações do WhatsApp
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_ID,
    fetchTimeoutMs: parseInt(process.env.FETCH_TIMEOUT_MS) || 20000
  },
  
  // Configurações da OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS) || 30000,
    assistantId: process.env.ASSISTANT_ID
  },
  
  // Configurações do Redis
  redis: {
    url: process.env.REDIS_URL,
    tlsRejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    keyPrefix: 'evento:',
    expirationSeconds: 7200 // 2 horas
  },
  
  // Configurações do Kommo CRM
  kommo: {
    apiKey: process.env.KOMMO_API_KEY,
    accountId: process.env.KOMMO_ACCOUNT_ID
  },
  
  // Configurações do painel administrativo
  admin: {
    username: process.env.ADMIN_USER || 'consciencia',
    password: process.env.ADMIN_PASS || 'consciencia2025'
  },
  
  // Configurações de armazenamento de leads
  leads: {
    ttlDays: 7, // Tempo de vida dos arquivos de leads em dias
    directory: 'leads' // Diretório para armazenar os arquivos de leads
  }
};
