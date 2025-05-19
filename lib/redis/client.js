/**
 * @file lib/redis/client.js
 * @description Cliente Redis usando o SDK oficial do Redis
 */

const { createClient } = require('redis');
const { logError } = require('../utils/error');

// Cliente Redis
let redisClient = null;

/**
 * Inicializa o cliente Redis
 * @returns {Promise<Object>} Cliente Redis inicializado
 */
async function initRedisClient() {
  try {
    console.log('[REDIS_INIT_ATTEMPT] Tentando inicializar o Redis com a URL:', process.env.REDIS_URL);
    
    // Criar cliente Redis
    const client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: process.env.REDIS_URL.startsWith('rediss://'),
        rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    });
    
    // Manipuladores de eventos
    client.on('connect', () => {
      console.log('[REDIS] Conectado ao servidor Redis');
    });
    
    client.on('ready', () => {
      console.log('[REDIS] Cliente Redis pronto para uso');
    });
    
    client.on('error', (err) => {
      console.error('[REDIS_ERROR] Erro no cliente Redis:', err.message);
    });
    
    // Conectar ao Redis
    await client.connect();
    
    // Testar conexão
    await client.ping();
    console.log('[REDIS] Teste de conexão bem-sucedido (PING)');
    
    return client;
  } catch (error) {
    logError('Redis Client Initialization', error);
    console.error('[REDIS_INIT_ERROR] Falha ao inicializar cliente Redis:', error.message);
    
    // Em caso de falha, retornar um cliente simulado
    return createMockRedisClient();
  }
}

// Resto do código (createMockRedisClient, getRedisClient, closeRedisConnection) permanece o mesmo
