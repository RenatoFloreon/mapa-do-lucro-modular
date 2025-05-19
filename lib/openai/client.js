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

let redis = null;

/**
 * Inicializa o cliente Redis com as configurações apropriadas
 * @returns {Redis|null} Cliente Redis inicializado ou null em caso de erro
 */
function initRedisClient() {
  if (!config.redis.url) {
    console.error("[REDIS_INIT_ERROR] REDIS_URL não está definida. O Redis não será utilizado.");
    return null;
  }

  try {
    console.log(`[REDIS_INIT_ATTEMPT] Tentando inicializar o Redis com a URL: ${config.redis.url.substring(0, config.redis.url.indexOf("://") + 3)}... e REDIS_TLS_REJECT_UNAUTHORIZED: ${config.redis.tlsRejectUnauthorized}`);
    
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
      redisOptions.tls = { rejectUnauthorized: config.redis.tlsRejectUnauthorized };
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

// Inicializa o cliente Redis apenas uma vez
if (!redis) {
  redis = initRedisClient();
}

// Exporta o cliente já inicializado e uma função para obtê-lo
module.exports = {
  client: redis,
  getClient: () => redis
};
