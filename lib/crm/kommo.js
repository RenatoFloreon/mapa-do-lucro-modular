/**
 * @file lib/crm/kommo.js
 * @description Integração com Kommo CRM
 * 
 * Este módulo gerencia a integração com o Kommo CRM,
 * incluindo adição de leads e contatos.
 */

const axios = require('axios');
const config = require('../../config');
const { safeLogError } = require('../utils/error');

/**
 * Adiciona um lead ao Kommo CRM
 * @param {Object} userData - Dados do usuário a serem adicionados ao CRM
 * @returns {Promise<boolean>} - true se adicionado com sucesso, false caso contrário
 */
async function addLeadToKommo(userData) {
  if (!config.kommo.apiKey || !config.kommo.accountId) {
    console.log("[KOMMO_INFO] KOMMO_API_KEY ou KOMMO_ACCOUNT_ID não definidos. Pulando integração com Kommo.");
    return false;
  }
  
  console.log(`[KOMMO_ADD_LEAD_ATTEMPT] Adicionando lead ao Kommo: ${userData.name}`);
  
  try {
    // Preparar dados do contato
    const contactData = {
      name: userData.name,
      custom_fields_values: [
        { field_id: 1, values: [ { value: userData.phone } ] }
      ]
    };
    
    // Adicionar email se disponível
    if (userData.email) {
      contactData.custom_fields_values.push({ field_id: 2, values: [ { value: userData.email } ] });
    }
    
    // Adicionar Instagram se disponível
    if (userData.instagram) {
      contactData.custom_fields_values.push({ field_id: 3, values: [ { value: userData.instagram } ] });
    }
    
    // Criar contato no Kommo
    const contactResponse = await axios.post(
      `https://${config.kommo.accountId}.kommo.com/api/v4/contacts`,
      { add: [contactData] },
      { headers: { 'Authorization': `Bearer ${config.kommo.apiKey}`, 'Content-Type': 'application/json' } }
    );
    
    if (!contactResponse.data || !contactResponse.data._embedded || !contactResponse.data._embedded.contacts) {
      console.error(`[KOMMO_ERROR] Resposta inválida ao adicionar contato: ${JSON.stringify(contactResponse.data)}`);
      return false;
    }
    
    const contactId = contactResponse.data._embedded.contacts[0].id;
    
    // Preparar dados do lead
    const leadData = {
      name: `Lead do evento MAPA DO LUCRO - ${userData.name}`,
      price: 0,
      status_id: 142, // ID do status "Novo Lead"
      _embedded: { contacts: [ { id: contactId } ] }
    };
    
    // Criar lead no Kommo
    const leadResponse = await axios.post(
      `https://${config.kommo.accountId}.kommo.com/api/v4/leads`,
      { add: [leadData] },
      { headers: { 'Authorization': `Bearer ${config.kommo.apiKey}`, 'Content-Type': 'application/json' } }
    );
    
    if (!leadResponse.data || !leadResponse.data._embedded || !leadResponse.data._embedded.leads) {
      console.error(`[KOMMO_ERROR] Resposta inválida ao adicionar lead: ${JSON.stringify(leadResponse.data)}`);
      return false;
    }
    
    console.log(`[KOMMO_SUCCESS] Lead adicionado com sucesso para: ${userData.name}`);
    return true;
  } catch (error) {
    console.error(`[KOMMO_ERROR] Erro ao adicionar lead para ${userData.name}:`, safeLogError(error));
    return false;
  }
}

module.exports = {
  addLeadToKommo
};
