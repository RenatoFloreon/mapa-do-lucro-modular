/**
 * @file lib/redis/state.js
 * @description Gerenciamento de estado da conversa via Redis
 * 
 * Este módulo gerencia o estado da conversa, incluindo o campo firstInteractionSent
 * para controle de mensagens automáticas e o mecanismo de reset da experiência.
 */

// Importação corrigida do cliente Redis
const redisModule = require('./client');
const redis = redisModule.client;
const config = require('../../config');
const { safeLogError } = require('../utils/error');

/**
 * Prefixo para as chaves de dados do usuário no Redis
 */
const USER_DATA_PREFIX = `${config.redis.keyPrefix}user_data:`;

/**
 * Obtém os dados do usuário do Redis
 * @param {string} phoneNumber - Número de telefone do usuário
 * @returns {Promise<Object|null>} - Dados do usuário ou null se não encontrado
 */
async function getUserData(phoneNumber) {
  if (!redis) return null;
  
  try {
    console.log(`[REDIS_GET_ATTEMPT] Tentando obter dados do usuário: ${phoneNumber}`);
    const userKey = `${USER_DATA_PREFIX}${phoneNumber}`;
    const userDataStr = await redis.get(userKey);
    
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      console.log(`[REDIS_GET_SUCCESS] Dados do usuário encontrados: ${phoneNumber}, estado: ${userData.state}`);
      return userData;
    } else {
      console.log(`[REDIS_GET_NOT_FOUND] Usuário não encontrado: ${phoneNumber}`);
      return null;
    }
  } catch (error) {
    console.error(`[REDIS_GET_ERROR] Erro ao obter dados do usuário ${phoneNumber}:`, safeLogError(error));
    return null;
  }
}

/**
 * Salva os dados do usuário no Redis
 * @param {string} phoneNumber - Número de telefone do usuário
 * @param {Object} userData - Dados do usuário a serem salvos
 * @returns {Promise<boolean>} - true se salvo com sucesso, false caso contrário
 */
async function saveUserData(phoneNumber, userData) {
  if (!redis) return false;
  
  try {
    console.log(`[REDIS_SET_ATTEMPT] Tentando salvar dados do usuário: ${phoneNumber}, estado: ${userData.state}`);
    const userKey = `${USER_DATA_PREFIX}${phoneNumber}`;
    await redis.set(userKey, JSON.stringify(userData), 'EX', config.redis.expirationSeconds);
    console.log(`[REDIS_SET_SUCCESS] Dados do usuário salvos: ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`[REDIS_SET_ERROR] Erro ao salvar dados do usuário ${phoneNumber}:`, safeLogError(error));
    return false;
  }
}

/**
 * Cria um novo usuário com estado inicial
 * @param {string} phoneNumber - Número de telefone do usuário
 * @returns {Object} - Dados iniciais do usuário
 */
function createNewUser(phoneNumber) {
  return {
    phone: phoneNumber,
    state: "WELCOME",
    startTime: Date.now(),
    completed: false,
    firstInteractionSent: false, // Novo campo para controlar mensagens automáticas
    resetCount: 0 // Contador de resets para análise
  };
}

/**
 * Reseta a experiência do usuário, mantendo dados básicos
 * @param {string} phoneNumber - Número de telefone do usuário
 * @returns {Promise<Object|null>} - Novos dados do usuário ou null em caso de erro
 */
async function resetUserExperience(phoneNumber) {
  const userData = await getUserData(phoneNumber);
  
  if (!userData) {
    return createNewUser(phoneNumber);
  }
  
  // Manter alguns dados básicos, mas resetar o estado
  const resetData = {
    phone: phoneNumber,
    name: userData.name, // Mantém o nome se já foi fornecido
    email: userData.email, // Mantém o email se já foi fornecido
    instagram: userData.instagram, // Mantém o instagram se já foi fornecido
    state: "WELCOME",
    startTime: Date.now(),
    completed: false,
    firstInteractionSent: false,
    resetCount: (userData.resetCount || 0) + 1,
    previousCompletions: userData.previousCompletions || []
  };
  
  // Se o usuário já tinha completado o fluxo, salva a carta anterior
  if (userData.completed && userData.letter) {
    if (!resetData.previousCompletions) {
      resetData.previousCompletions = [];
    }
    
    resetData.previousCompletions.push({
      completionTime: userData.completionTime,
      letter: userData.letter
    });
  }
  
  await saveUserData(phoneNumber, resetData);
  return resetData;
}

module.exports = {
  getUserData,
  saveUserData,
  createNewUser,
  resetUserExperience
};
