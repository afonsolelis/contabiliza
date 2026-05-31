// Núcleo do assistente de IA — agnóstico ao canal (web ou Telegram).
// Define as ferramentas (function calling), o system prompt e o loop que conversa
// com o Gemini. Os controllers/bots só chamam processarMensagem(...).
const { randomUUID } = require('crypto');
const { query, loadSql } = require('../db');
const { ai, MODEL, Type, isConfigured: geminiConfigured } = require('./geminiClient');
const { client: nimClient, MODEL: NIM_MODEL, isConfigured: nimConfigured } = require('./nimClient');

// Provider ativo: 'gemini' (padrão, function calling nativo) ou 'nim'
// (NVIDIA NIM via JSON-mode prompting — para Gemma e similares sem tool-use).
const PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

function isConfigured() {
  return PROVIDER === 'nim' ? nimConfigured() : geminiConfigured();
}

// SQL (carregado no load do módulo, como no resto do app)
const insertGastoSql = loadSql('gastos/insert.sql');
const findSimilarSql = loadSql('gastos/find_similar.sql');
const queryFlexibleSql = loadSql('gastos/query_flexible.sql');
const sumFlexibleSql = loadSql('gastos/sum_flexible.sql');
const totalsByTagRangeSql = loadSql('reports/totals_by_tag_range.sql');
const listTagsSql = loadSql('tags/list.sql');
const insertTagSql = loadSql('tags/insert.sql');
const listContasSql = loadSql('contas/list.sql');

const TIPOS = new Set(['pix', 'cartao', 'debito']);
const MAX_STEPS = 6; // teto de rodadas de function calling por mensagem
const MAX_HISTORY = 30; // turnos de texto mantidos por conversa

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// O Gemini Flash às vezes retorna 503/429 transitórios em picos de demanda —
// repetir com backoff curto resolve a maioria desses casos.
async function generateWithRetry(params, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (e) {
      lastErr = e;
      const retriable = [429, 500, 503].includes(e?.status);
      if (!retriable || i === attempts - 1) throw e;
      await sleep(600 * (i + 1));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Helpers de data — mesma convenção do resto do app (UTC-start, fim exclusivo)
// ---------------------------------------------------------------------------
function parseYmdToUtcStart(ymd) {
  if (!ymd) return null;
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function todayUtcStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function startOfCurrentMonthUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Resolução de tag por nome (case-insensitive). Cria a tag se pedido (spec).
// ---------------------------------------------------------------------------
async function resolveTagId(nome, { criarSeNaoExistir = false } = {}) {
  const alvo = (nome || '').trim();
  if (!alvo) return null;
  const { rows } = await query(listTagsSql);
  const achou = rows.find((t) => t.tag.toLowerCase() === alvo.toLowerCase());
  if (achou) return achou.id;
  if (!criarSeNaoExistir) return null;
  const ins = await query(insertTagSql, [alvo]);
  if (ins.rows[0]) return ins.rows[0].id;
  // ON CONFLICT DO NOTHING não retorna linha — re-buscar pelo nome
  const { rows: again } = await query(listTagsSql);
  const r = again.find((t) => t.tag.toLowerCase() === alvo.toLowerCase());
  return r ? r.id : null;
}

// Período padrão: mês corrente até hoje (usado pelas consultas)
function resolvePeriodo(args) {
  const inicio = parseYmdToUtcStart(args.data_inicio) || startOfCurrentMonthUtc();
  const fimBase = parseYmdToUtcStart(args.data_fim) || todayUtcStart();
  const fimExclusive = addDays(fimBase, 1);
  return { inicio, fimBase, startIso: inicio.toISOString(), endIso: fimExclusive.toISOString() };
}

// ---------------------------------------------------------------------------
// Ferramentas (executadas no servidor — o modelo nunca escreve SQL)
// ---------------------------------------------------------------------------
async function execConsultarGastos(args) {
  const { inicio, fimBase, startIso, endIso } = resolvePeriodo(args);

  let tagId = null;
  if (args.tag) {
    tagId = await resolveTagId(args.tag);
    if (tagId === null) {
      return { periodo: { inicio: ymd(inicio), fim: ymd(fimBase) }, total: 0, qtd: 0, gastos: [], aviso: `Tag "${args.tag}" não encontrada.` };
    }
  }
  const tipo = args.tipo && TIPOS.has(String(args.tipo).toLowerCase()) ? String(args.tipo).toLowerCase() : null;
  const contaId = args.conta_id ? Number(args.conta_id) : null;
  const params = [startIso, endIso, tagId, tipo, contaId];

  const { rows: sumRows } = await query(sumFlexibleSql, params);
  const out = {
    periodo: { inicio: ymd(inicio), fim: ymd(fimBase) },
    total: Number(sumRows[0]?.total || 0),
    qtd: Number(sumRows[0]?.qtd || 0),
  };

  if (!args.apenas_total) {
    const { rows } = await query(queryFlexibleSql, params);
    out.gastos = rows.map((r) => ({
      id: r.id,
      descricao: r.descricao_gasto,
      valor: Number(r.valor),
      tipo: r.tipo,
      data: ymd(new Date(r.efetivado_em)),
      tag: r.tag || null,
      banco: r.banco || null,
    }));
  }
  return out;
}

async function execTotaisPorTag(args) {
  const { inicio, fimBase, startIso, endIso } = resolvePeriodo(args);
  const { rows } = await query(totalsByTagRangeSql, [startIso, endIso]);
  return {
    periodo: { inicio: ymd(inicio), fim: ymd(fimBase) },
    totais: rows.map((r) => ({ tag: r.tag, total: Number(r.total) })),
  };
}

async function execVerificarDuplicatas(args) {
  const desc = (args.descricao || '').trim();
  const valor = Number(args.valor);
  const dataBase = parseYmdToUtcStart(args.data_efetivacao) || todayUtcStart();
  // termo-chave: primeira palavra "significativa" (>= 3 letras) da descrição
  const termo = desc.split(/\s+/).find((w) => w.length >= 3) || desc;
  const inicio = addDays(dataBase, -3);
  const fimExclusive = addDays(dataBase, 4); // ±3 dias, fim exclusivo

  const { rows } = await query(findSimilarSql, [
    `%${termo}%`,
    Number.isFinite(valor) ? valor : -1,
    inicio.toISOString(),
    fimExclusive.toISOString(),
  ]);
  return {
    duplicatas: rows.map((r) => ({
      id: r.id,
      descricao: r.descricao_gasto,
      valor: Number(r.valor),
      data: ymd(new Date(r.efetivado_em)),
      tipo: r.tipo,
      tag: r.tag || null,
      parcela: r.parcela_total ? `${r.parcela_numero}/${r.parcela_total}` : null,
    })),
  };
}

async function execRegistrarGasto(args, inseridos) {
  const descricaoBase = (args.descricao || '').trim();
  const valorTotal = Number(args.valor);
  const tipo = (args.tipo || 'pix').toString().toLowerCase();
  const tagNome = args.tag ? String(args.tag) : null;
  const contaId = args.conta_id ? Number(args.conta_id) : null;
  const numParcelas = args.num_parcelas ? Number(args.num_parcelas) : null;
  const efetivacaoDate = parseYmdToUtcStart(args.data_efetivacao) || todayUtcStart();

  // Mesmas validações do gastosController
  if (!descricaoBase || !Number.isFinite(valorTotal) || valorTotal < 0 || !TIPOS.has(tipo)) {
    return { ok: false, erro: 'Dados inválidos: confira descrição, valor (>= 0) e tipo (pix/cartao/debito).' };
  }
  if (numParcelas !== null && (Number.isNaN(numParcelas) || numParcelas < 1 || numParcelas > 999)) {
    return { ok: false, erro: 'Número de parcelas inválido (1-999).' };
  }

  const tagId = tagNome ? await resolveTagId(tagNome, { criarSeNaoExistir: true }) : null;

  // À vista (sem parcelamento ou 1 parcela)
  if (!numParcelas || numParcelas === 1) {
    const { rows } = await query(insertGastoSql, [
      descricaoBase, valorTotal, tagId, tipo, contaId, efetivacaoDate.toISOString(), null, null, null,
    ]);
    const id = rows[0]?.id;
    if (id) inseridos.push(id);
    console.log('[assistente] gasto inserido id=%s "%s" R$%s', id, descricaoBase, valorTotal);
    return { ok: true, parcelado: false, ids: [id], tag_id: tagId };
  }

  // Parcelado (spec): 1 linha por parcela, valor/N, +1 mês, sufixo (parcela X/Y)
  const grupoId = randomUUID();
  const valorParcela = valorTotal / numParcelas;
  const ids = [];
  for (let i = 1; i <= numParcelas; i++) {
    const dataParcela = new Date(efetivacaoDate);
    dataParcela.setUTCMonth(dataParcela.getUTCMonth() + (i - 1));
    const { rows } = await query(insertGastoSql, [
      `${descricaoBase} (parcela ${i}/${numParcelas})`,
      valorParcela, tagId, tipo, contaId, dataParcela.toISOString(), i, numParcelas, grupoId,
    ]);
    if (rows[0]?.id) ids.push(rows[0].id);
  }
  inseridos.push(...ids);
  console.log('[assistente] gasto parcelado %dx grupo=%s "%s"', numParcelas, grupoId, descricaoBase);
  return { ok: true, parcelado: true, num_parcelas: numParcelas, valor_parcela: valorParcela, grupo_id: grupoId, ids, tag_id: tagId };
}

async function executeTool(name, args, inseridos) {
  switch (name) {
    case 'consultar_gastos': return execConsultarGastos(args);
    case 'totais_por_tag': return execTotaisPorTag(args);
    case 'verificar_duplicatas': return execVerificarDuplicatas(args);
    case 'registrar_gasto': return execRegistrarGasto(args, inseridos);
    default: return { erro: `Ferramenta desconhecida: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// Declarações das ferramentas para o Gemini
// ---------------------------------------------------------------------------
const tools = [{
  functionDeclarations: [
    {
      name: 'consultar_gastos',
      description: 'Consulta gastos de um período, com filtros opcionais por tag, tipo e conta. Retorna total, quantidade e (opcionalmente) a lista. Use para perguntas como "quanto gastei em mercado em maio".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          data_inicio: { type: Type.STRING, description: 'Data inicial YYYY-MM-DD. Padrão: primeiro dia do mês atual.' },
          data_fim: { type: Type.STRING, description: 'Data final (inclusiva) YYYY-MM-DD. Padrão: hoje.' },
          tag: { type: Type.STRING, description: 'Nome da tag/categoria para filtrar (opcional).' },
          tipo: { type: Type.STRING, description: 'Tipo de gasto (opcional).', enum: ['pix', 'cartao', 'debito'] },
          conta_id: { type: Type.INTEGER, description: 'ID da conta para filtrar (opcional).' },
          apenas_total: { type: Type.BOOLEAN, description: 'Se true, retorna só total/quantidade, sem listar os gastos.' },
        },
      },
    },
    {
      name: 'totais_por_tag',
      description: 'Total gasto agrupado por tag em um período. Use para visões gerais como "no que gastei mais esse mês".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          data_inicio: { type: Type.STRING, description: 'YYYY-MM-DD. Padrão: primeiro dia do mês atual.' },
          data_fim: { type: Type.STRING, description: 'YYYY-MM-DD (inclusivo). Padrão: hoje.' },
        },
      },
    },
    {
      name: 'verificar_duplicatas',
      description: 'OBRIGATÓRIO antes de registrar um gasto. Busca gastos parecidos já cadastrados (descrição similar OU mesmo valor em datas próximas) para evitar duplicatas.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          descricao: { type: Type.STRING, description: 'Descrição do gasto a verificar.' },
          valor: { type: Type.NUMBER, description: 'Valor total do gasto.' },
          data_efetivacao: { type: Type.STRING, description: 'Data do gasto YYYY-MM-DD.' },
        },
        required: ['descricao', 'valor'],
      },
    },
    {
      name: 'registrar_gasto',
      description: 'Insere um gasto no banco. NUNCA chame antes de (1) verificar_duplicatas e (2) o usuário confirmar explicitamente. Para parcelado, informe num_parcelas e o valor TOTAL da compra — o sistema cria uma linha por parcela automaticamente.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          descricao: { type: Type.STRING, description: 'Descrição do gasto.' },
          valor: { type: Type.NUMBER, description: 'Valor TOTAL em reais (ex: 150.00). Para parcelado, o total da compra.' },
          tipo: { type: Type.STRING, description: 'Tipo de gasto. Padrão: pix.', enum: ['pix', 'cartao', 'debito'] },
          conta_id: { type: Type.INTEGER, description: 'ID da conta (opcional).' },
          tag: { type: Type.STRING, description: 'Nome da categoria/tag (opcional). Se não existir, será criada.' },
          data_efetivacao: { type: Type.STRING, description: 'YYYY-MM-DD. Padrão: hoje.' },
          num_parcelas: { type: Type.INTEGER, description: 'Número de parcelas (opcional). Vazio ou 1 = à vista.' },
        },
        required: ['descricao', 'valor'],
      },
    },
  ],
}];

// Descrição textual das ferramentas — usada no system prompt quando o provider
// não tem function calling nativo (NIM/Gemma). Mantém os mesmos nomes/args das
// declarações Gemini acima pra que `executeTool` sirva pros dois caminhos.
const TOOLS_DOC_NIM = `=== FERRAMENTAS DISPONÍVEIS ===
Cada turno seu DEVE ser EXATAMENTE um destes formatos JSON, SEM nenhum texto, markdown ou comentário ao redor, e SEM cercas \`\`\`json. NUNCA misture os dois formatos no mesmo turno.

Para chamar uma ferramenta:
{"tool":"<nome>","args":{ ... }}

Para dar a resposta final ao usuário (após coletar tudo que precisa):
{"final":"<sua resposta em pt-BR>"}

Ferramentas:

1) verificar_duplicatas (LEITURA — OBRIGATÓRIA antes de registrar)
   args: { "descricao": string, "valor": number, "data_efetivacao"?: "YYYY-MM-DD" }

2) consultar_gastos (LEITURA)
   args: { "data_inicio"?: "YYYY-MM-DD", "data_fim"?: "YYYY-MM-DD", "tag"?: string, "tipo"?: "pix"|"cartao"|"debito", "conta_id"?: integer, "apenas_total"?: boolean }

3) totais_por_tag (LEITURA)
   args: { "data_inicio"?: "YYYY-MM-DD", "data_fim"?: "YYYY-MM-DD" }

4) registrar_gasto (ESCRITA — só DEPOIS do usuário confirmar explicitamente)
   args: { "descricao": string, "valor": number, "tipo"?: "pix"|"cartao"|"debito", "conta_id"?: integer, "tag"?: string, "data_efetivacao"?: "YYYY-MM-DD", "num_parcelas"?: integer }`;

// ---------------------------------------------------------------------------
// System instruction — montada por requisição (data atual + tags/contas frescas)
// `canal` ajusta só o estilo de saída (web usa Markdown; Telegram, texto puro).
// ---------------------------------------------------------------------------
async function buildSystemInstruction(canal = 'web', provider = PROVIDER) {
  const { rows: tags } = await query(listTagsSql);
  const { rows: contas } = await query(listContasSql);
  const hoje = todayUtcStart();
  const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(hoje);
  const tagsList = tags.map((t) => t.tag).join(', ') || '(nenhuma cadastrada)';
  const contasList = contas.map((c) => `${c.id}=${c.banco}`).join(', ') || '(nenhuma cadastrada)';

  const estilo = canal === 'telegram'
    ? `ESTILO (Telegram):
- Responda em português do Brasil, conciso e amigável.
- Escreva em TEXTO PURO, sem Markdown e SEM TABELAS (o Telegram não renderiza). Para listas, use hífens e quebras de linha.
- Formate valores como R$ 1.234,56.`
    : `ESTILO:
- Responda sempre em português do Brasil, de forma concisa e amigável.
- Formate valores como R$ 1.234,56.
- Pode usar Markdown (listas e tabelas) para organizar resumos e resultados.`;

  return `Você é o assistente financeiro do Contabiliza, um controle de gastos pessoal em português do Brasil.

Data de hoje: ${ymd(hoje)} (${diaSemana}). Use-a para resolver datas relativas como "hoje", "ontem", "anteontem", "semana passada", "mês passado".

Contas disponíveis (id=banco): ${contasList}.
Tags existentes: ${tagsList}.
Tipos de gasto válidos: pix, cartao, debito.

SUAS CAPACIDADES (via ferramentas):
- Registrar gastos descritos em linguagem natural.
- Responder perguntas sobre os gastos com consultar_gastos e totais_por_tag.

REGRAS PARA REGISTRAR UM GASTO (siga à risca):
1. Extraia do texto: descrição, valor, tipo, conta, tag, data e parcelas. Se o tipo não for dito, assuma "pix" e avise no resumo. Se a data não for dita, use hoje.
2. SEMPRE chame verificar_duplicatas ANTES de registrar.
3. Mostre um RESUMO do gasto (descrição, valor em R$, tipo, conta, tag, data, parcelamento) e, se houver, liste as possíveis duplicatas encontradas. Pergunte: "Confirma? (sim/não)".
4. NUNCA chame registrar_gasto na mesma mensagem em que apresenta o resumo. Só chame registrar_gasto DEPOIS que o usuário confirmar explicitamente (ex.: "sim", "pode cadastrar", "confirmo").
5. Para parcelamento, passe num_parcelas e o valor TOTAL da compra; o sistema divide e cria uma linha por mês. No resumo, diga "Parcelado em Nx de R$ X".
6. Se o usuário citar vários gastos de uma vez, trate todos — mas confirme antes de inserir.
7. Após inserir, confirme citando os ids retornados pela ferramenta.

${estilo}${provider === 'nim' ? `\n\n${TOOLS_DOC_NIM}` : ''}`;
}

// Fallback amigável quando o modelo cala mas alguma inserção rolou — evita o
// "(sem resposta)" no frontend.
function fallbackReplyIfInserted(inseridos) {
  if (inseridos.length === 0) return null;
  return inseridos.length === 1
    ? `✅ Gasto registrado com sucesso (id ${inseridos[0]}).`
    : `✅ Gastos registrados com sucesso (ids ${inseridos.join(', ')}).`;
}

// ---------------------------------------------------------------------------
// Caminho Gemini (function calling nativo).
// ---------------------------------------------------------------------------
async function processarMensagemGemini({ history, message, canal }) {
  const contents = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  const systemInstruction = await buildSystemInstruction(canal, 'gemini');
  const inseridos = [];
  let reply = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    const resp = await generateWithRetry({
      model: MODEL,
      contents,
      config: { systemInstruction, tools, temperature: 0.2 },
    });

    const calls = resp.functionCalls || [];
    if (!calls.length) {
      reply = resp.text || '';
      // Gemini 2.5 às vezes devolve texto vazio depois de uma tool call bem-sucedida.
      if (!reply.trim()) {
        const fb = fallbackReplyIfInserted(inseridos);
        if (fb) reply = fb;
        else {
          console.warn('[assistente] resposta vazia sem inserção. finishReason=%s',
            resp.candidates?.[0]?.finishReason);
          reply = 'Não consegui formular uma resposta agora. Pode reformular ou repetir?';
        }
      }
      break;
    }

    contents.push({ role: 'model', parts: calls.map((fc) => ({ functionCall: fc })) });
    const responseParts = [];
    for (const fc of calls) {
      let result;
      try {
        result = await executeTool(fc.name, fc.args || {}, inseridos);
      } catch (e) {
        console.error('[assistente] erro na ferramenta', fc.name, e);
        result = { erro: 'Falha ao executar a ferramenta.' };
      }
      responseParts.push({ functionResponse: { name: fc.name, response: result } });
    }
    contents.push({ role: 'user', parts: responseParts });

    if (step === MAX_STEPS - 1) {
      reply = fallbackReplyIfInserted(inseridos)
        || 'Não consegui concluir o pedido em tempo. Pode reformular ou simplificar?';
    }
  }

  return { reply, inseridos };
}

// ---------------------------------------------------------------------------
// Caminho NIM (NVIDIA, OpenAI-compatible). Sem function calling nativo —
// o modelo emite JSON `{"tool":...}` ou `{"final":...}` em cada turno, e o
// servidor parseia + executa. Gemma 3n é um modelo pequeno, então a tolerância
// a desvio de formato (ex.: cercas ```json, texto antes do JSON) é alta.
// ---------------------------------------------------------------------------
function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  // Remove cercas ```json … ``` se vierem
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (_) { /* tenta extrair substring */ }
  // Procura primeiro objeto JSON balanceado (tolerante a texto antes/depois)
  let depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(s.slice(start, i + 1)); } catch (_) { return null; }
      }
    }
  }
  return null;
}

async function nimChatWithRetry(messages, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await nimClient.chat.completions.create({
        model: NIM_MODEL,
        messages,
        max_tokens: 512,
        temperature: 0.2,
        top_p: 0.7,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
      });
    } catch (e) {
      lastErr = e;
      const retriable = [429, 500, 502, 503, 504].includes(e?.status);
      if (!retriable || i === attempts - 1) throw e;
      await sleep(600 * (i + 1));
    }
  }
  throw lastErr;
}

async function processarMensagemNim({ history, message, canal }) {
  const systemInstruction = await buildSystemInstruction(canal, 'nim');
  const inseridos = [];
  const messages = [{ role: 'system', content: systemInstruction }];

  // Histórico: turnos `model` viram `assistant`. Como no caminho Gemini, só
  // turnos de texto são preservados — as tool calls do turno anterior somem
  // (o modelo é instruído a re-verificar duplicatas a cada nova mensagem).
  for (const m of (Array.isArray(history) ? history : []).slice(-MAX_HISTORY)) {
    if (!m || typeof m.text !== 'string') continue;
    if (m.role === 'user') messages.push({ role: 'user', content: m.text });
    else if (m.role === 'model') messages.push({ role: 'assistant', content: m.text });
  }
  messages.push({ role: 'user', content: message });

  let reply = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    const resp = await nimChatWithRetry(messages);
    const content = resp.choices?.[0]?.message?.content ?? '';
    const finishReason = resp.choices?.[0]?.finish_reason;
    const parsed = extractJson(content);

    if (!parsed) {
      // Modelo respondeu fora do formato — devolve o que veio como texto final.
      reply = (content || '').trim()
        || fallbackReplyIfInserted(inseridos)
        || 'Não consegui formular uma resposta agora. Pode reformular ou repetir?';
      if (!content) console.warn('[assistente][nim] vazio. finish_reason=%s', finishReason);
      break;
    }

    if (parsed.final !== undefined) {
      reply = String(parsed.final || '').trim() || fallbackReplyIfInserted(inseridos) || '';
      if (!reply) reply = 'Não consegui formular uma resposta agora. Pode reformular ou repetir?';
      break;
    }

    if (parsed.tool) {
      let result;
      try {
        result = await executeTool(parsed.tool, parsed.args || {}, inseridos);
      } catch (e) {
        console.error('[assistente][nim] erro na ferramenta', parsed.tool, e);
        result = { erro: 'Falha ao executar a ferramenta.' };
      }
      // Mantém a chamada e o resultado no histórico desta requisição.
      messages.push({ role: 'assistant', content: JSON.stringify({ tool: parsed.tool, args: parsed.args || {} }) });
      messages.push({ role: 'user', content: `RESULTADO de ${parsed.tool}:\n${JSON.stringify(result)}\n\nResponda EXCLUSIVAMENTE com JSON no formato {"tool":...} ou {"final":...}.` });
    } else {
      // JSON sem `tool` nem `final` — trata como resposta livre.
      reply = content.trim();
      break;
    }

    if (step === MAX_STEPS - 1) {
      reply = fallbackReplyIfInserted(inseridos)
        || 'Não consegui concluir o pedido em tempo. Pode reformular ou simplificar?';
    }
  }

  return { reply, inseridos };
}

// ---------------------------------------------------------------------------
// Dispatcher — escolhe o provider conforme AI_PROVIDER.
// `history` são turnos de texto (user/model). Retorna { reply, inseridos }.
// ---------------------------------------------------------------------------
async function processarMensagem({ history = [], message, canal = 'web' }) {
  if (PROVIDER === 'nim') {
    if (!nimConfigured()) throw new Error('NIM_API_KEY ausente — configure no .env.');
    return processarMensagemNim({ history, message, canal });
  }
  if (!geminiConfigured()) throw new Error('GEMINI_API_KEY ausente — configure no .env.');
  return processarMensagemGemini({ history, message, canal });
}

module.exports = { processarMensagem, isConfigured, MAX_HISTORY };
