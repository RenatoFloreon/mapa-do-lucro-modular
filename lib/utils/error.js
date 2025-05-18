/**
 * @file lib/utils/error.js
 * @description Utilitários para tratamento e logging de erros
 * 
 * Este módulo fornece funções para tratamento seguro de erros,
 * evitando problemas com estruturas circulares em JSON e facilitando
 * o debugging através de logs formatados.
 */

/**
 * Formata um objeto de erro de forma segura para logging
 * Evita problemas com estruturas circulares em JSON
 * 
 * @param {Error} error - Objeto de erro a ser formatado
 * @param {Object} additionalInfo - Informações adicionais a serem incluídas no log
 * @returns {string} Representação JSON do erro formatado
 */
function safeLogError(error, additionalInfo = {}) {
  const errorDetails = {
    message: error.message,
    name: error.name,
    stack: error.stack ? error.stack.split("\n").slice(0, 5).join("\n") : "No stack trace",
    code: error.code,
    errno: error.errno,
    syscall: error.syscall,
    address: error.address,
    port: error.port,
    config: error.config ? { 
      url: error.config.url, 
      method: error.config.method, 
      headers: error.config.headers, 
      timeout: error.config.timeout 
    } : undefined,
    response: error.response ? { 
      status: error.response.status, 
      statusText: error.response.statusText, 
      data: error.response.data 
    } : undefined,
    ...additionalInfo
  };
  
  // Remover propriedades undefined para limpar o objeto
  Object.keys(errorDetails).forEach(key => errorDetails[key] === undefined && delete errorDetails[key]);
  
  return JSON.stringify(errorDetails, null, 2);
}

/**
 * Cria um wrapper para funções assíncronas com tratamento de erro padronizado
 * 
 * @param {Function} fn - Função assíncrona a ser executada
 * @param {string} operationName - Nome da operação para logging
 * @param {Function} onError - Função opcional para tratamento de erro personalizado
 * @returns {Function} Função wrapper com tratamento de erro
 */
function asyncErrorHandler(fn, operationName, onError) {
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`[${operationName}_ERROR] Erro durante operação:`, safeLogError(error));
      
      if (onError && typeof onError === 'function') {
        return onError(error, ...args);
      }
      
      throw error; // Re-throw se não houver handler personalizado
    }
  };
}

module.exports = {
  safeLogError,
  asyncErrorHandler
};
