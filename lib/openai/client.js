/**
 * @file lib/redis/client.js
 * @description Inicialização e configuração do cliente Redis
 * 
 * Este módulo gerencia a conexão com o Redis, incluindo inicialização,
 * tratamento de erros e estratégias de reconexão.
 */

const Redis = require('ioredis');
const config = require('../../config');
const { safeLogError } = require('../utils/error');

/**
 * Inicializa o cliente Redis com as configurações apropriadas
 * @returns {Redis|null} Cliente Redis inicializado ou null em caso de erro
 */
function initRedisClient() {
  if (!config.redis || !config.redis.url) {
    console.error("[REDIS_INIT_ERROR] REDIS_URL não está definida. O Redis não será utilizado.");
    return null;
  }

  try {
    console.log(`[REDIS_INIT_ATTEMPT] Tentando inicializar o Redis com a URL: ${config.redis.url.substring(0, config.redis.url.indexOf("://") + 3)}...`);
    
    const redisOptions = {
      maxRetriesPerRequest: 3,
      connectTimeout: 15000,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        console.log(`[REDIS_RETRY_STRATEGY] Tentativa de reconexão Redis #${times}. Próxima tentativa em ${delay}ms.`);
        return delay;
      }
    };
    
    // Configurar TLS se a URL começar com rediss://
    if (config.redis.url.startsWith("rediss://")) {
      redisOptions.tls = { 
        rejectUnauthorized: config.redis.tlsRejectUnauthorized === false ? false : true 
      };
      console.log("[REDIS_INIT_TLS_CONFIG] Configuração TLS para Redis: ", redisOptions.tls);
    } else {
      console.log("[REDIS_INIT_NO_TLS] Conectando ao Redis sem TLS (URL não começa com rediss://).");
    }
    
    const client = new Redis(config.redis.url, redisOptions);
    
    // Configurar listeners de eventos para monitoramento da conexão
    client.on("connect", () => console.log("[REDIS_EVENT] Conectado com sucesso ao Redis!"));
    client.on("ready", () => console.log("[REDIS_EVENT] Cliente Redis pronto para uso."));
    client.on("error", (err) => {
      console.error("[REDIS_EVENT_ERROR] Erro de conexão/operação com o Redis:", safeLogError(err));
      if (err.message && (err.message.includes('SSL') || err.message.includes('TLS'))) {
        console.error("[REDIS_TLS_ERROR_DETAIL] Detalhes do erro TLS: code=", err.code, "syscall=", err.syscall, "reason=", err.reason);
      }
    });
    client.on("close", () => console.log("[REDIS_EVENT] Conexão com o Redis fechada."));
    client.on("reconnecting", (delay) => console.log(`[REDIS_EVENT] Tentando reconectar ao Redis... Próxima tentativa em ${delay}ms`));
    client.on("end", () => console.log("[REDIS_EVENT] Conexão com o Redis terminada (não haverá mais reconexões)."));
    
    return client;
  } catch (error) {
    console.error("[REDIS_INIT_ERROR] Erro CRÍTICO ao inicializar o cliente Redis:", safeLogError(error));
    return null;
  }
}

// NÃO exporte diretamente a instância do cliente Redis
// Em vez disso, exporte funções que encapsulam as operações Redis

// Cliente Redis singleton
let redisClient = null;

// Inicializa o cliente Redis apenas uma vez
if (!redisClient) {
  redisClient = initRedisClient();
}

/**
 * Obtém um valor do Redis
 * @param {string} key - Chave para buscar
 * @returns {Promise<string|null>} - Valor armazenado ou null se não encontrado
 */
async function get(key) {
  if (!redisClient) return null;
  
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error(`[REDIS_GET_ERROR] Erro ao obter chave ${key}:`, safeLogError(error));
    return null;
  }
}

/**
 * Define um valor no Redis
 * @param {string} key - Chave para armazenar
 * @param {string} value - Valor para armazenar
 * @param {string} [expireMode='EX'] - Modo de expiração ('EX' para segundos)
 * @param {number} [expireTime] - Tempo de expiração
 * @returns {Promise<boolean>} - true se salvo com sucesso, false caso contrário
 */
async function set(key, value, expireMode, expireTime) {
  if (!redisClient) return false;
  
  try {
    if (expireMode && expireTime) {
      await redisClient.set(key, value, expireMode, expireTime);
    } else {
      await redisClient.set(key, value);
    }
    return true;
  } catch (error) {
    console.error(`[REDIS_SET_ERROR] Erro ao definir chave ${key}:`, safeLogError(error));
    return false;
  }
}

/**
 * Exclui uma chave do Redis
 * @param {string} key - Chave para excluir
 * @returns {Promise<boolean>} - true se excluído com sucesso, false caso contrário
 */
async function del(key) {
  if (!redisClient) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`[REDIS_DEL_ERROR] Erro ao excluir chave ${key}:`, safeLogError(error));
    return false;
  }
}

/**
 * Verifica se o cliente Redis está conectado
 * @returns {boolean} - true se conectado, false caso contrário
 */
function isConnected() {
  return redisClient && redisClient.status === 'ready';
}

/**
 * Fecha a conexão com o Redis
 * @returns {Promise<void>}
 */
async function quit() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log("[REDIS_QUIT] Conexão com o Redis fechada corretamente.");
    } catch (error) {
      console.error("[REDIS_QUIT_ERROR] Erro ao fechar conexão com o Redis:", safeLogError(error));
    }
  }
}

// Exporta as funções de operação Redis
module.exports = {
  get,
  set,
  del,
  isConnected,
  quit,
  // Também exporta o cliente direto para casos especiais
  getClient: () => redisClient
};
