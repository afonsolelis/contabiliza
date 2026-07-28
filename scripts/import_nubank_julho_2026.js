const fs = require('fs');
const { Client } = require('pg');

const session = '/var/home/afonsolelis/.codex/sessions/2026/07/28/rollout-2026-07-28T10-45-04-019fa8f8-c98d-7123-a1d7-566c158f0ec1.jsonl';
const records = fs.readFileSync(session, 'utf8').trim().split('\n').map(JSON.parse);
const item = records.find((r) =>
  r.type === 'response_item' &&
  r.payload?.role === 'user' &&
  r.payload.content?.[0]?.text?.includes('6a451cbd-2507-4b46-9247-bcd5150acb49')
);
if (!item) throw new Error('Extrato não encontrado na sessão');

const text = item.payload.content[0].text;
const lines = text.split('\n').filter((line) => /^\d{2}\/\d{2}\/2026\t/.test(line));
const all = lines.map((line) => {
  const [dateBr, valueRaw, identifier, ...descriptionParts] = line.split('\t');
  const [day, month, year] = dateBr.split('/');
  return {
    date: `${year}-${month}-${day}`,
    value: Number(valueRaw),
    identifier,
    raw: descriptionParts.join('\t').trim(),
  };
});

function excluded(row) {
  if (row.value >= 0) return true;
  if (row.identifier === '6a451d71-712d-4380-9d03-f07a803c552a') return true;
  if (/^Pagamento de fatura$/i.test(row.raw)) return true;
  if (/^Aplicação RDB$/i.test(row.raw)) return true;
  return false;
}

function cleanDescription(raw) {
  if (/^Resgate de empréstimo$/i.test(raw)) return 'Pagamento parcela empréstimo Nubank';
  return raw
    .replace(/^Transferência enviada pelo Pix - /i, '')
    .replace(/^Compra no débito - /i, '')
    .replace(/\s+-\s+(?:\*{3}|•{3})?[\d./*-]+.*$/u, '')
    .replace(/\s+-\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*$/, '')
    .trim();
}

function tagFor(row, description) {
  const s = `${row.raw} ${description}`.toLowerCase();
  if (/empréstimo/.test(s)) return 'emprestimo_nubank';
  if (/uber|guarucoop taxis/.test(s)) return 'uber';
  if (/loter|capitalização/.test(s)) return 'loterica';
  if (/sem parar/.test(s)) return 'sem_parar';
  if (/drogaria|drogasil|pague menos/.test(s)) return 'farmacia';
  if (/cobasi|vital vet/.test(s)) return 'animais';
  if (/posto|estacionamento|rcjautoposto/.test(s)) return 'carro';
  if (/gradd cards|smolka|bancasaojorge/.test(s)) return 'pokemon_tcg';
  if (/amazon|shpp|americanas|livraria|salvaia|nademoya|nandemoya/.test(s)) return 'diversos';
  if (/mercado|minuto pa|oxxo/.test(s)) return 'mercado';
  if (/restaurante|sukiya|hot dog|lanchonete|bakery|pecorino|coffee|ifd\\*|ifood|sapore|brigadeiro|bolo|falafel|sorveteria|tapioca|ice bode|japa|padroeira/.test(s)) return 'alimentacao';
  return 'envios_pix';
}

const rows = all.filter((r) => !excluded(r)).map((r) => {
  const description = cleanDescription(r.raw);
  return {
    ...r,
    amount: Math.abs(r.value),
    description,
    type: /^Compra no débito/i.test(r.raw) || /^Resgate de empréstimo/i.test(r.raw) ? 'debito' : 'pix',
    tag: tagFor(r, description),
  };
});

if (rows.length !== 114) throw new Error(`Esperados 114 gastos, encontrados ${rows.length}`);

const csvEscape = (v) => `"${String(v).replaceAll('"', '""')}"`;
fs.writeFileSync('/tmp/nubank_julho_2026.csv',
  ['data,valor,identificador,descricao,tipo,tag', ...rows.map((r) =>
    [r.date, r.amount.toFixed(2), r.identifier, r.description, r.type, r.tag].map(csvEscape).join(',')
  )].join('\n') + '\n'
);

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_PUBLIC_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    if (process.env.VERIFY_ONLY === '1') {
      const summary = await client.query(
        `SELECT COUNT(*) AS quantidade, SUM(valor)::numeric(14,2) AS total,
                MIN(id) AS primeiro_id, MAX(id) AS ultimo_id
           FROM gastos
          WHERE conta_id = 1 AND tipo IN ('pix', 'debito')
            AND data_efetivacao >= $1::date AND data_efetivacao < $2::date`,
        ['2026-07-01', '2026-07-29']
      );
      const loan = await client.query(
        `SELECT id, descricao_gasto, valor, tipo, data_efetivacao::date AS data
           FROM gastos WHERE descricao_gasto = $1`,
        ['Pagamento parcela empréstimo Nubank']
      );
      console.log(JSON.stringify({ resumo: summary.rows[0], emprestimo: loan.rows }));
      return;
    }
    const tagsResult = await client.query('SELECT id, tag FROM tags');
    const tags = new Map(tagsResult.rows.map((r) => [r.tag, r.id]));
    const missing = [...new Set(rows.map((r) => r.tag).filter((tag) => !tags.has(tag)))];
    if (missing.length) throw new Error(`Tags ausentes: ${missing.join(', ')}`);

    const possible = [];
    for (const row of rows) {
      const found = await client.query(
        `SELECT id, descricao_gasto, valor, data_efetivacao::date AS data, tipo
           FROM gastos
          WHERE conta_id = 1
            AND valor = $1
            AND data_efetivacao >= $2::date - interval '3 days'
            AND data_efetivacao < $2::date + interval '4 days'`,
        [row.amount, row.date]
      );
      if (found.rows.some((r) => r.tipo === row.type)) possible.push({ row, found: found.rows });
    }
    if (possible.length) {
      console.log(JSON.stringify({ status: 'duplicatas_encontradas', possible }, null, 2));
      process.exitCode = 2;
      return;
    }

    await client.query('BEGIN');
    const ids = [];
    for (const row of rows) {
      const inserted = await client.query(
        `INSERT INTO gastos
          (descricao_gasto, valor, tag_id, tipo, conta_id, data_efetivacao,
           parcela_numero, parcela_total, parcela_grupo_id)
         VALUES ($1,$2,$3,$4,1,$5::date,NULL,NULL,NULL)
         RETURNING id`,
        [row.description, row.amount, tags.get(row.tag), row.type, row.date]
      );
      ids.push(inserted.rows[0].id);
    }
    await client.query('COMMIT');
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    console.log(JSON.stringify({ status: 'importado', quantidade: rows.length, total: total.toFixed(2), primeiro_id: ids[0], ultimo_id: ids.at(-1) }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
