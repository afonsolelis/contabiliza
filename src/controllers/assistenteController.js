const express = require('express');
const { processarMensagem } = require('../services/assistenteCore');
const { isConfigured } = require('../services/geminiClient');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('assistente/index', { configurado: isConfigured() });
});

router.post('/mensagem', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ erro: 'Assistente indisponível: configure GEMINI_API_KEY no .env.' });
  }

  const mensagem = (req.body.message || '').toString().trim();
  const historico = Array.isArray(req.body.history) ? req.body.history : [];
  if (!mensagem) return res.status(400).json({ erro: 'Mensagem vazia.' });

  try {
    const { reply, inseridos } = await processarMensagem({ history: historico, message: mensagem, canal: 'web' });
    return res.json({ reply, inseridos });
  } catch (e) {
    console.error('[assistente] erro ao falar com a IA:', e);
    return res.status(500).json({ erro: 'Erro ao falar com a IA. Tente novamente em instantes.' });
  }
});

module.exports = { router };
