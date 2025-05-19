/**
 * @file lib/redis/mock-state.js
 * @description Implementação de estado sem Redis usando armazenamento em memória
 * 
 * Este módulo substitui a implementação do Redis com uma versão em memória
 * para eliminar a dependência do Redis e resolver problemas de conexão.
 */

// Armazenamento em memória para dados de usuários
const userDataStore = new Map();

// Prefixo para as chaves (apenas para compatibilidade)
const USER_DATA_PREFIX = 'user_data:';

// Tempo de expiração padrão em segundos (24 horas)
const DEFAULT_EXPIRATION = 86400;

/**
 * Obtém os dados do usuário do armazenamento em memória
 * @param {string} phoneNumber - Número de telefone do usuário
 * @returns {Promise<Object|null>} - Dados do usuário ou null se não encontrado
 */
async function getUserData(phoneNumber) {
  try {
    console.log(`[MEMORY_GET_ATTEMPT] Tentando obter dados do usuário: ${phoneNumber}`);
    const userKey = `${USER_DATA_PREFIX}${phoneNumber}`;
    
    if (userDataStore.has(userKey)) {
      const userData = userDataStore.get(userKey);
      console.log(`[MEMORY_GET_SUCCESS] Dados do usuário encontrados: ${phoneNumber}, estado: ${userData.state}`);
      return userData;
    } else {
      console.log(`[MEMORY_GET_NOT_FOUND] Usuário não encontrado: ${phoneNumber}`);
      return null;
    }
  } catch (error) {
    console.error(`[MEMORY_GET_ERROR] Erro ao obter dados do usuário ${phoneNumber}:`, error);
    return null;
  }
}

/**
 * Salva os dados do usuário no armazenamento em memória
 * @param {string} phoneNumber - Número de telefone do usuário
 * @param {Object} userData - Dados do usuário a serem salvos
 * @returns {Promise<boolean>} - true se salvo com sucesso, false caso contrário
 */
async function saveUserData(phoneNumber, userData) {
  try {
    console.log(`[MEMORY_SET_ATTEMPT] Tentando salvar dados do usuário: ${phoneNumber}, estado: ${userData.state}`);
    const userKey = `${USER_DATA_PREFIX}${phoneNumber}`;
    
    userDataStore.set(userKey, userData);
    
    console.log(`[MEMORY_SET_SUCCESS] Dados do usuário salvos: ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`[MEMORY_SET_ERROR] Erro ao salvar dados do usuário ${phoneNumber}:`, error);
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
    firstInteractionSent: false,
    resetCount: 0
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
    name: userData.name,
    email: userData.email,
    instagram: userData.instagram,
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
