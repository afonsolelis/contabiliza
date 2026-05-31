// Bot de Telegram para o assistente do Contabiliza.
// Usa long polling (getUpdates) — funciona localmente e na Railway sem precisar
// de URL pública/webhook. Reusa o mesmo "cérebro" da aba web (assistenteCore).
//
// Variáveis de ambiente:
//   TELEGRAM_BOT_TOKEN   — token do @BotFather (sem ele, o bot fica desativado)
//   TELEGRAM_ALLOWED_IDS — ids autorizados (CSV). Vazio = ninguém autorizado;
//                          o bot responde a qualquer um apenas revelando o id.
const { processarMensagem, isConfigured, MAX_HISTORY } = require('./assistenteCore');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;
const ALLOWED = new Set(
  (process.env.TELEGRAM_ALLOWED_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);
const MAX_LEN = 4096; // limite de caracteres por mensagem no Telegram

// Histórico de conversa por chat (em memória — reinicia se o processo cair).
const historias = new Map();

async function tgCall(method, body) {
  const resp = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || resp.status}`);
  return data.result;
}

async function enviar(chatId, texto) {
  const t = (texto && texto.trim()) || '(sem resposta)';
  for (let i = 0; i < t.length; i += MAX_LEN) {
    await tgCall('sendMessage', { chat_id: chatId, text: t.slice(i, i + MAX_LEN) });
  }
}

function autorizado(userId) {
  if (!ALLOWED.size) return false; // sem allowlist configurado => ninguém entra
  return ALLOWED.has(String(userId));
}

async function handleUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.chat) return;

  const chatId = msg.chat.id;
  const fromId = msg.from && msg.from.id;
  const texto = (msg.text || '').trim();

  console.log('[telegram] msg recebida de id=%s chat=%s: %j', fromId, chatId, texto);

  if (!texto) {
    await enviar(chatId, 'Por enquanto só entendo mensagens de texto. 🙂');
    return;
  }

  // Segurança: só o(s) dono(s) podem usar — este bot escreve no banco real.
  if (!autorizado(fromId)) {
    await enviar(
      chatId,
      `Acesso negado. Se este bot é seu, adicione seu id em TELEGRAM_ALLOWED_IDS no .env e reinicie.\n\nSeu id do Telegram é: ${fromId}`
    );
    console.warn('[telegram] acesso negado de id=%s', fromId);
    return;
  }

  if (texto === '/start') {
    historias.delete(chatId);
    await enviar(
      chatId,
      'Olá! 👋 Sou o assistente do Contabiliza.\n\n' +
        'Me conte um gasto (ex.: "gastei 45 no almoço hoje no nubank cartão") ou pergunte sobre suas finanças ' +
        '(ex.: "quanto gastei em mercado esse mês?"). Mostro um resumo e só cadastro após sua confirmação.\n\n' +
        'Use /reset para limpar a conversa.'
    );
    return;
  }
  if (texto === '/reset') {
    historias.delete(chatId);
    await enviar(chatId, 'Conversa reiniciada. 🧹');
    return;
  }

  if (!isConfigured()) {
    const keyVar = (process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'nim'
      ? 'NIM_API_KEY' : 'GEMINI_API_KEY';
    await enviar(chatId, `IA não configurada: defina ${keyVar} no .env.`);
    return;
  }

  const history = historias.get(chatId) || [];
  try {
    await tgCall('sendChatAction', { chat_id: chatId, action: 'typing' });
    const { reply } = await processarMensagem({ history, message: texto, canal: 'telegram' });
    history.push({ role: 'user', text: texto });
    history.push({ role: 'model', text: reply });
    historias.set(chatId, history.slice(-MAX_HISTORY));
    await enviar(chatId, reply);
  } catch (e) {
    console.error('[telegram] erro ao processar mensagem:', e);
    await enviar(chatId, '⚠️ Tive um problema ao processar sua mensagem. Tente novamente em instantes.');
  }
}

async function pollLoop() {
  let offset = 0;
  // Garante o modo polling (remove webhook caso exista) sem descartar mensagens.
  try {
    await tgCall('deleteWebhook', { drop_pending_updates: false });
  } catch (e) {
    console.error('[telegram] deleteWebhook falhou:', e.message);
  }
  console.log('[telegram] bot @ long polling iniciado');

  for (;;) {
    try {
      const updates = await tgCall('getUpdates', { offset, timeout: 30 });
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleUpdate(u);
      }
    } catch (e) {
      console.error('[telegram] erro no polling:', e.message);
      await new Promise((r) => setTimeout(r, 3000)); // backoff antes de re-tentar
    }
  }
}

function startTelegramBot() {
  if (!TOKEN) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN não definido — bot desativado.');
    return;
  }
  if (!ALLOWED.size) {
    console.warn('[telegram] TELEGRAM_ALLOWED_IDS vazio — todos os acessos serão negados. Mande uma mensagem ao bot para descobrir seu id e configure-o.');
  }
  pollLoop().catch((e) => console.error('[telegram] loop encerrado:', e));
}

module.exports = { startTelegramBot };
