/**
 * @file lib/openai/client.js
 * @description Inicialização e configuração do cliente OpenAI
 * 
 * Este módulo gerencia a conexão com a API da OpenAI,
 * incluindo inicialização e configuração do cliente.
 */

const { OpenAI } = require('openai');
const config = require('../../config');
const { safeLogError } = require('../utils/error');

let openai = null;

/**
 * Inicializa o cliente OpenAI com as configurações apropriadas
 * @returns {OpenAI|null} Cliente OpenAI inicializado ou null em caso de erro
 */
function initOpenAIClient() {
  if (!config.openai.apiKey) {
    console.error("[OPENAI_INIT_ERROR] OPENAI_API_KEY não está definida. A funcionalidade da OpenAI será desativada.");
    return null;
  }

  try {
    console.log("[OPENAI_INIT_ATTEMPT] Tentando inicializar o cliente OpenAI...");
    const client = new OpenAI({ apiKey: config.openai.apiKey });
    console.log("[OPENAI_INIT_SUCCESS] Instância OpenAI criada com sucesso.");
    return client;
  } catch (error) {
    console.error("[OPENAI_INIT_ERROR] Erro ao inicializar o cliente OpenAI:", safeLogError(error));
    return null;
  }
}

// Inicializa o cliente OpenAI apenas uma vez
if (!openai) {
  openai = initOpenAIClient();
}

// Exporta o cliente já inicializado e uma função para obtê-lo
module.exports = {
  client: openai,
  getClient: () => openai
};
