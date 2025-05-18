/**
 * @file lib/admin/dashboard.js
 * @description Controladores do dashboard administrativo
 * 
 * Este módulo gerencia as funcionalidades do dashboard administrativo,
 * incluindo listagem de usuários, visualização de cartas e exportação de dados.
 */

const fs = require('fs');
const path = require('path');
const redis = require('../redis/client');
const config = require('../../config');
const { safeLogError } = require('../utils/error');

/**
 * Obtém a lista de todos os usuários do Redis
 * @returns {Promise<Array>} - Lista de usuários
 */
async function getAllUsers() {
  if (!redis) {
    console.error("[ADMIN_DASHBOARD_ERROR] Cliente Redis não inicializado.");
    return [];
  }
  
  try {
    const userKeys = await redis.keys(`${config.redis.keyPrefix}user_data:*`);
    const users = [];
    
    for (const key of userKeys) {
      const userData = await redis.get(key);
      if (userData) {
        try {
          const user = JSON.parse(userData);
          users.push({
            phone: user.phone,
            name: user.name || 'Sem nome',
            email: user.email || 'Não informado',
            instagram: user.instagram || 'Não informado',
            state: user.state,
            completed: user.completed ? 'Sim' : 'Não',
            startTime: user.startTime ? new Date(user.startTime).toLocaleString('pt-BR') : 'Desconhecido',
            completionTime: user.completionTime ? new Date(user.completionTime).toLocaleString('pt-BR') : 'Não concluído',
            questionsCount: user.questionsCount || 0,
            resetCount: user.resetCount || 0
          });
        } catch (parseError) {
          console.error(`[ADMIN_DASHBOARD_ERROR] Erro ao analisar dados do usuário: ${key}`, safeLogError(parseError));
        }
      }
    }
    
    // Ordenar por data de conclusão (mais recentes primeiro)
    users.sort((a, b) => {
      if (a.completionTime === 'Não concluído' && b.completionTime === 'Não concluído') return 0;
      if (a.completionTime === 'Não concluído') return 1;
      if (b.completionTime === 'Não concluído') return -1;
      return new Date(b.completionTime) - new Date(a.completionTime);
    });
    
    return users;
  } catch (error) {
    console.error("[ADMIN_DASHBOARD_ERROR] Erro ao obter lista de usuários:", safeLogError(error));
    return [];
  }
}

/**
 * Obtém os dados completos de um usuário específico
 * @param {string} phoneNumber - Número de telefone do usuário
 * @returns {Promise<Object|null>} - Dados do usuário ou null se não encontrado
 */
async function getUserDetails(phoneNumber) {
  if (!redis) {
    console.error("[ADMIN_DASHBOARD_ERROR] Cliente Redis não inicializado.");
    return null;
  }
  
  try {
    const userKey = `${config.redis.keyPrefix}user_data:${phoneNumber}`;
    const userData = await redis.get(userKey);
    
    if (userData) {
      return JSON.parse(userData);
    }
    
    return null;
  } catch (error) {
    console.error(`[ADMIN_DASHBOARD_ERROR] Erro ao obter detalhes do usuário ${phoneNumber}:`, safeLogError(error));
    return null;
  }
}

/**
 * Exporta todos os dados de usuários para um arquivo JSON
 * @returns {Promise<string|null>} - Caminho do arquivo exportado ou null em caso de erro
 */
async function exportUsersData() {
  try {
    const users = await getAllUsers();
    const userDetails = [];
    
    for (const user of users) {
      const details = await getUserDetails(user.phone);
      if (details) {
        userDetails.push(details);
      }
    }
    
    const exportDir = path.join(process.cwd(), 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFile = path.join(exportDir, `users_export_${timestamp}.json`);
    
    fs.writeFileSync(exportFile, JSON.stringify(userDetails, null, 2));
    
    return exportFile;
  } catch (error) {
    console.error("[ADMIN_DASHBOARD_ERROR] Erro ao exportar dados dos usuários:", safeLogError(error));
    return null;
  }
}

/**
 * Exporta todos os dados de usuários para um arquivo CSV
 * @returns {Promise<string|null>} - Caminho do arquivo exportado ou null em caso de erro
 */
async function exportUsersCSV() {
  try {
    const users = await getAllUsers();
    
    // Cabeçalho do CSV
    let csvContent = "Telefone,Nome,Email,Instagram,Estado,Concluído,Início,Conclusão,Perguntas,Resets\n";
    
    // Adicionar dados de cada usuário
    for (const user of users) {
      const row = [
        user.phone,
        `"${(user.name || '').replace(/"/g, '""')}"`,
        `"${(user.email || '').replace(/"/g, '""')}"`,
        `"${(user.instagram || '').replace(/"/g, '""')}"`,
        user.state,
        user.completed,
        `"${user.startTime}"`,
        `"${user.completionTime}"`,
        user.questionsCount,
        user.resetCount
      ].join(',');
      
      csvContent += row + "\n";
    }
    
    const exportDir = path.join(process.cwd(), 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFile = path.join(exportDir, `users_export_${timestamp}.csv`);
    
    fs.writeFileSync(exportFile, csvContent);
    
    return exportFile;
  } catch (error) {
    console.error("[ADMIN_DASHBOARD_ERROR] Erro ao exportar dados dos usuários para CSV:", safeLogError(error));
    return null;
  }
}

module.exports = {
  getAllUsers,
  getUserDetails,
  exportUsersData,
  exportUsersCSV
};
