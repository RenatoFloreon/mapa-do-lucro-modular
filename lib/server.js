/**
 * @file lib/server.js
 * @description Configuração e inicialização do servidor Express
 * 
 * Este módulo configura e inicializa o servidor Express,
 * incluindo middlewares, rotas e configurações de view engine.
 */

const express = require('express');
const path = require('path');
const config = require('../config');
const webhookRoutes = require('../routes/webhook');
const adminRoutes = require('../routes/admin');

// Inicialização do Express
const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar view engine para EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Rotas
app.use('/webhook', webhookRoutes);
app.use('/admin', adminRoutes);

// Rota de verificação de saúde
app.get('/', (req, res) => {
  console.log('[HEALTH_CHECK] GET / recebido.');
  res.send('Servidor do assistente WhatsApp-OpenAI está ativo e a escuta!');
});

// Iniciar o servidor (apenas quando executado diretamente)
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[SERVER_START] Servidor Node.js escutando na porta ${config.port}`);
  }).on('error', (err) => {
    console.error('[SERVER_START_ERROR] Falha ao iniciar o servidor:', err);
    process.exit(1);
  });
}

module.exports = app;
