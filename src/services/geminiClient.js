// Cliente do Google Gemini (IA do assistente de chat).
// A chave vem de GEMINI_API_KEY no .env (carregado por dotenv em server.js antes
// de qualquer controller ser exigido). O modelo é configurável via GEMINI_MODEL.
const { GoogleGenAI, Type, FunctionCallingConfigMode } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Só instancia o cliente se houver chave — assim o app sobe mesmo sem a IA
// configurada, e o controller responde com uma mensagem clara.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

function isConfigured() {
  return Boolean(apiKey);
}

module.exports = { ai, MODEL, Type, FunctionCallingConfigMode, isConfigured };
