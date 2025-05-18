/**
 * @file api/webhook.js
 * @description Ponto de entrada para a função serverless da Vercel
 * 
 * Este módulo serve como ponto de entrada para a função serverless da Vercel,
 * redirecionando as requisições para o servidor Express.
 */

const { createServer } = require('http');
const app = require('../lib/server');

/**
 * Handler para a função serverless da Vercel
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 */
module.exports = (req, res) => {
  // Corrigir a rota para compatibilidade com Express
  if (req.url.startsWith('/api/webhook')) {
    req.url = req.url.replace('/api', '');
  }
  
  // Criar servidor HTTP e emitir evento de requisição
  const server = createServer(app);
  server.emit('request', req, res);
};
