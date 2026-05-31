// Cliente NVIDIA NIM (API compatível com OpenAI) — provider alternativo do assistente.
// Endpoint: https://integrate.api.nvidia.com/v1
// Chave: NIM_API_KEY no .env (formato `nvapi-...`).
// Modelo: NIM_MODEL (ex.: `google/gemma-3n-e4b-it`, `meta/llama-3.3-70b-instruct`).
//
// Importante: o Gemma na NIM NÃO suporta function calling nativo. Este cliente
// só expõe `chat.completions.create(...)` — a orquestração de tools fica no
// assistenteCore via JSON-mode prompting.
const OpenAI = require('openai');

const apiKey = process.env.NIM_API_KEY;
const MODEL = process.env.NIM_MODEL || 'google/gemma-3n-e4b-it';
const BASE_URL = process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';

// Só instancia o cliente se houver chave — assim o app sobe mesmo sem NIM
// configurada (e o assistente cai pro Gemini, se este estiver configurado).
const client = apiKey ? new OpenAI({ apiKey, baseURL: BASE_URL }) : null;

function isConfigured() {
  return Boolean(apiKey);
}

module.exports = { client, MODEL, BASE_URL, isConfigured };
