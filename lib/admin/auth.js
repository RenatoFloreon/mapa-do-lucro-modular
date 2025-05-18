/**
 * @file lib/admin/auth.js
 * @description Autenticação do painel administrativo
 * 
 * Este módulo gerencia a autenticação do painel administrativo,
 * incluindo verificação de credenciais e geração de tokens.
 */

const crypto = require('crypto');
const config = require('../../config');

// Token de autenticação para a sessão atual
let adminToken = crypto.randomBytes(16).toString('hex');

/**
 * Verifica se as credenciais de administrador são válidas
 * @param {string} username - Nome de usuário
 * @param {string} password - Senha
 * @returns {boolean} - true se as credenciais são válidas, false caso contrário
 */
function verifyCredentials(username, password) {
  return username === config.admin.username && password === config.admin.password;
}

/**
 * Verifica se o token de autenticação é válido
 * @param {string} token - Token de autenticação
 * @returns {boolean} - true se o token é válido, false caso contrário
 */
function verifyToken(token) {
  return token === adminToken;
}

/**
 * Gera um novo token de autenticação
 * @returns {string} - Novo token de autenticação
 */
function generateNewToken() {
  adminToken = crypto.randomBytes(16).toString('hex');
  return adminToken;
}

/**
 * Middleware para verificar autenticação
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
function authMiddleware(req, res, next) {
  const token = req.query.token || req.body.token;
  
  if (!token || !verifyToken(token)) {
    return res.redirect('/admin/login');
  }
  
  next();
}

module.exports = {
  verifyCredentials,
  verifyToken,
  generateNewToken,
  authMiddleware
};
