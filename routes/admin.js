/**
 * @file routes/admin.js
 * @description Rotas para o painel administrativo
 * 
 * Este módulo gerencia as rotas para o painel administrativo,
 * incluindo autenticação, dashboard e exportação de dados.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { verifyCredentials, generateNewToken, authMiddleware } = require('../lib/admin/auth');
const { getAllUsers, getUserDetails, exportUsersData, exportUsersCSV } = require('../lib/admin/dashboard');
const { safeLogError } = require('../lib/utils/error');

/**
 * Rota para a página de login
 */
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

/**
 * Rota para processar o login
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (verifyCredentials(username, password)) {
    const token = generateNewToken();
    res.redirect(`/admin/dashboard?token=${token}`);
  } else {
    res.render('login', { error: 'Credenciais inválidas. Tente novamente.' });
  }
});

/**
 * Rota para o dashboard principal (protegida por autenticação)
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const users = await getAllUsers();
    const stats = {
      total: users.length,
      completed: users.filter(u => u.completed === 'Sim').length,
      inProgress: users.filter(u => u.completed === 'Não').length,
      withQuestions: users.filter(u => u.questionsCount > 0).length,
      withResets: users.filter(u => u.resetCount > 0).length
    };
    
    res.render('dashboard', { 
      users, 
      stats, 
      token: req.query.token,
      error: null,
      success: req.query.success
    });
  } catch (error) {
    console.error("[ADMIN_ROUTE_ERROR] Erro ao renderizar dashboard:", safeLogError(error));
    res.render('dashboard', { 
      users: [], 
      stats: { total: 0, completed: 0, inProgress: 0, withQuestions: 0, withResets: 0 }, 
      token: req.query.token,
      error: 'Erro ao carregar dados do dashboard.',
      success: null
    });
  }
});

/**
 * Rota para visualizar detalhes de um usuário específico (protegida por autenticação)
 */
router.get('/user/:phone', authMiddleware, async (req, res) => {
  try {
    const userData = await getUserDetails(req.params.phone);
    
    if (!userData) {
      return res.redirect(`/admin/dashboard?token=${req.query.token}&error=Usuário não encontrado.`);
    }
    
    res.render('user_details', { 
      user: userData, 
      token: req.query.token,
      error: null
    });
  } catch (error) {
    console.error(`[ADMIN_ROUTE_ERROR] Erro ao obter detalhes do usuário ${req.params.phone}:`, safeLogError(error));
    res.redirect(`/admin/dashboard?token=${req.query.token}&error=Erro ao carregar detalhes do usuário.`);
  }
});

/**
 * Rota para visualizar a carta de um usuário específico (protegida por autenticação)
 */
router.get('/letter/:phone', authMiddleware, async (req, res) => {
  try {
    const userData = await getUserDetails(req.params.phone);
    
    if (!userData || !userData.letter) {
      return res.redirect(`/admin/dashboard?token=${req.query.token}&error=Carta não encontrada.`);
    }
    
    res.render('letter', { 
      user: userData, 
      letter: userData.letter,
      token: req.query.token
    });
  } catch (error) {
    console.error(`[ADMIN_ROUTE_ERROR] Erro ao obter carta do usuário ${req.params.phone}:`, safeLogError(error));
    res.redirect(`/admin/dashboard?token=${req.query.token}&error=Erro ao carregar carta do usuário.`);
  }
});

/**
 * Rota para exportar dados de usuários em JSON (protegida por autenticação)
 */
router.get('/export/json', authMiddleware, async (req, res) => {
  try {
    const exportFile = await exportUsersData();
    
    if (!exportFile) {
      return res.redirect(`/admin/dashboard?token=${req.query.token}&error=Erro ao exportar dados.`);
    }
    
    res.download(exportFile, path.basename(exportFile), (err) => {
      if (err) {
        console.error("[ADMIN_ROUTE_ERROR] Erro ao fazer download do arquivo exportado:", safeLogError(err));
        return res.redirect(`/admin/dashboard?token=${req.query.token}&error=Erro ao fazer download do arquivo exportado.`);
      }
    });
  } catch (error) {
    console.error("[ADMIN_ROUTE_ERROR] Erro ao exportar dados:", safeLogError(error));
    res.redirect(`/admin/dashboard?token=${req.query.token}&error=Erro ao exportar dados.`);
  }
});

/**
 * Rota para exportar dados de usuários em CSV (protegida por autenticação)
 */
router.get('/export/csv', authMiddleware, async (req, res) => {
  try {
    const exportFile = await exportUsersCSV();
    
    if (!exportFile) {
      return res.redirect(`/admin/dashboard?token=${req.query.token}&error=Erro ao exportar dados para CSV.`);
    }
    
    res.download(exportFile, path.basename(exportFile), (err) => {
      if (err) {
        console.error("[ADMIN_ROUTE_ERROR] Erro ao fazer download do arquivo CSV exportado:", safeLogError(err));
        return res.redirect(`/admin/dashboard?token=${req.query.token}&error=Erro ao fazer download do arquivo CSV exportado.`);
      }
    });
  } catch (error) {
    console.error("[ADMIN_ROUTE_ERROR] Erro ao exportar dados para CSV:", safeLogError(error));
    res.redirect(`/admin/dashboard?token=${req.query.token}&error=Erro ao exportar dados para CSV.`);
  }
});

module.exports = router;
